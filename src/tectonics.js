// Plate tectonics: continents drift, collide and rift apart.
//
// The crust is divided into ~10 rigid plates, each rotating about its own axis (an "Euler pole")
// at a few cm per year, as Earth's plates do. Elevation is stored in a reference frame and
// rotated with each plate:
//  - where two plates overlap (convergent boundary), the more buoyant crust stays on top and
//    the boundary is pushed up into mountains or volcanic arcs
//  - where plates pull apart (divergent boundary), the gap fills with new ocean floor at a
//    mid-ocean ridge, with hydrothermal vents
// Every so often the current surface is baked in as the new reference ("re-anchoring"); then
// mountains erode a little and old ocean floor cools and sinks deeper.

import { mulberry32 } from './rng.js';

const CELL = 0.0185;          // angular spacing of the terrain grid (radians)
const MOVE_STEP = 0.8 * CELL;  // redraw the map after plates move this far
const ANCHOR_STEP = 2.5 * CELL;
const CM_PER_YEAR = 1 / 6.371e8; // radians per year for 1 cm/yr on Earth's radius

export class Tectonics {
  constructor(planet, seed, nPlates = 10) {
    this.planet = planet;
    this.speed = 1;
    this.P = nPlates;
    const rng = (this.rng = mulberry32(seed * 31 + 7));
    const n = planet.n, pos = planet.grid.pos;
    // plates: noisy Voronoi regions around random seed points
    this.seeds = [];
    for (let p = 0; p < nPlates; p++) {
      const u = rng() * 2 - 1, t = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      this.seeds.push([r * Math.cos(t), u, r * Math.sin(t)]);
    }
    this.plate0 = new Int8Array(n);
    this.label = new Int8Array(n);
    for (let c = 0; c < n; c++) {
      let best = 0, bd = -Infinity;
      const wob = planet.moistNoise[c] * 0.08; // a little noise so boundaries aren't perfectly straight
      for (let p = 0; p < nPlates; p++) {
        const s = this.seeds[p];
        const d = pos[c * 3] * s[0] + pos[c * 3 + 1] * s[1] + pos[c * 3 + 2] * s[2] + wob * (p % 2 ? 1 : -1);
        if (d > bd) { bd = d; best = p; }
      }
      this.plate0[c] = best; this.label[c] = best;
    }
    // each plate rotates about a random pole at 1–8 cm/yr (Earth's plates move 1–10 cm/yr)
    this.axis = []; this.omega = new Float64Array(nPlates); this.angle = new Float64Array(nPlates);
    this.lastMove = new Float64Array(nPlates);
    for (let p = 0; p < nPlates; p++) {
      const u = rng() * 2 - 1, t = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      this.axis.push([r * Math.cos(t), u, r * Math.sin(t)]);
      this.omega[p] = (1 + rng() * 7) * CM_PER_YEAR * (rng() < 0.5 ? -1 : 1);
    }
    this.crust0 = Float32Array.from(planet.elev);
    // how much continental crust the planet has; arcs make more when collisions destroy some
    this.continentTarget = 0;
    for (let c = 0; c < n; c++) if (planet.elev[c] > 0) this.continentTarget++;
    this.collide = new Int32Array(nPlates);
    this.uplift = new Float32Array(n);
    // mantle plumes (hotspots) stay put while plates slide over them, like Hawaii
    this.hotspot = new Float32Array(n);
    for (let c = 0; c < n; c++) this.hotspot[c] = planet.volc[c] > 0.75 ? planet.volc[c] * 0.8 : 0;
    // volcanoes and vents start along the plate boundaries
    const nb = planet.grid;
    for (let c = 0; c < n; c++) {
      let edge = false;
      for (let k = nb.nbrStart[c]; k < nb.nbrStart[c + 1]; k++) if (this.label[nb.nbr[k]] !== this.label[c]) edge = true;
      planet.volc[c] = Math.max(this.hotspot[c], edge ? 0.7 : 0);
    }
    this.guess = new Int32Array(n * nPlates);
    for (let c = 0; c < n; c++) for (let p = 0; p < nPlates; p++) this.guess[c * nPlates + p] = c;
    this.boundary = new Uint8Array(n);
    this.moves = 0;
    this.version = 0;
    this.computeBoundary();
    this.landStats();
  }

  // advance plate rotation by a span of geological time
  step(years) {
    if (this.speed <= 0) return false;
    let maxSince = 0;
    for (let p = 0; p < this.P; p++) {
      // cap the per-tick motion so the fast early eons don't send continents spinning
      const d = Math.sign(this.omega[p]) * Math.min(Math.abs(this.omega[p]) * years * this.speed, 0.0012 * this.speed);
      this.angle[p] += d;
      maxSince = Math.max(maxSince, Math.abs(this.angle[p] - this.lastMove[p]));
    }
    if (maxSince < MOVE_STEP) return false;
    this.move();
    return true;
  }

  // the planet's surface was edited (tools, impacts): bake it into the reference frame
  reanchor(erode = false) {
    const P = this.planet, n = P.n;
    if (erode) this.reorganise();
    for (let c = 0; c < n; c++) {
      let e = P.elev[c];
      if (erode) {
        if (e > 0.3) e = 0.3 + (e - 0.3) * 0.975;                 // mountains wear down
        else if (e < -0.12) e += (-0.82 - e) * 0.04;              // old sea floor cools and sinks
      }
      this.crust0[c] = e;
      this.plate0[c] = this.label[c];
    }
    if (erode) { this.growContinents(); this.buildHotspotIslands(); }
    this.uplift.fill(0);
    this.angle.fill(0);
    this.lastMove.fill(0);
    for (let c = 0; c < n; c++) for (let p = 0; p < this.P; p++) this.guess[c * this.P + p] = c;
    P.crustDirty = false;
  }

  // Continents are too buoyant to sink, so when two collide, convergence stalls and the plates
  // swing onto new courses (as India's collision with Asia slowed and turned it).
  reorganise() {
    const rng = this.rng;
    for (let p = 0; p < this.P; p++) {
      if (this.collide[p] < 120) continue;
      const u = rng() * 2 - 1, t = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      this.axis[p] = [r * Math.cos(t), u, r * Math.sin(t)];
      this.omega[p] = (1 + rng() * 7) * CM_PER_YEAR * (rng() < 0.5 ? -1 : 1);
    }
    this.collide.fill(0);
  }

  // New continental crust forms at volcanic arcs over subduction zones and at hotspots,
  // replacing what collisions destroy, so the planet keeps a steady amount of continent.
  growContinents() {
    const P = this.planet, n = P.n, crust = this.crust0;
    let have = 0;
    for (let c = 0; c < n; c++) if (crust[c] > 0) have++;
    let deficit = Math.round((this.continentTarget - have) * 0.35);
    if (deficit <= 0) return;
    // arcs accrete onto continental margins: favour shallow sea next to land
    const ns = P.grid.nbrStart, nbr = P.grid.nbr;
    const landNbrs = (c) => { let k = 0; for (let j = ns[c]; j < ns[c + 1]; j++) if (crust[nbr[j]] > 0) k++; return k; };
    const cands = [];
    for (let c = 0; c < n; c++) {
      if (crust[c] > 0 || crust[c] < -0.35) continue;
      const ln = landNbrs(c);
      if (ln >= 2 || (P.volc[c] >= 0.55 && ln >= 1)) cands.push([c, ln * 0.2 + crust[c] + P.volc[c] * 0.3]);
    }
    cands.sort((a, b) => b[1] - a[1]);
    for (const [c] of cands) {
      if (deficit-- <= 0) break;
      crust[c] = 0.03 + this.rng() * 0.08;
    }
  }

  // Hotspot volcanoes pile up islands as a plate slides over them; each island is carried away,
  // erodes and sinks, leaving a chain (like Hawaii and the Emperor seamounts).
  buildHotspotIslands() {
    const crust = this.crust0, hot = this.hotspot;
    for (let c = 0; c < this.planet.n; c++) {
      if (hot[c] < 0.6) continue;
      if (crust[c] < 0.18 && crust[c] > -0.7) crust[c] = Math.min(0.18, crust[c] + 0.12);
    }
  }

  move() {
    const P = this.planet, n = P.n, NP = this.P;
    if (P.crustDirty) {
      // the surface was edited since the last move: bake the edits in at the current positions,
      // then carry on with only the motion that hasn't been drawn yet
      const delta = Array.from(this.angle, (a, p) => a - this.lastMove[p]);
      this.reanchor();
      for (let p = 0; p < NP; p++) this.angle[p] = delta[p];
    }
    // inverse rotation for each plate (rotate by -angle about its axis), packed for speed
    const Mf = new Float64Array(NP * 9);
    for (let p = 0; p < NP; p++) Mf.set(rotation(this.axis[p], -this.angle[p]), p * 9);
    const pos = P.grid.pos, ns = P.grid.nbrStart, nbr = P.grid.nbr, nb = P.grid;
    const newElev = new Float32Array(n), newLabel = new Int8Array(n);
    const newVolc = new Float32Array(n);
    const guess = this.guess, plate0 = this.plate0, crust0 = this.crust0, label = this.label, boundary = this.boundary;
    const kind = new Uint8Array(n); // 1–3: ocean–ocean, ocean–continent, continent–continent overlap
    let collisions = 0;
    for (let c = 0; c < n; c++) {
      const x = pos[c * 3], y = pos[c * 3 + 1], z = pos[c * 3 + 2];
      let top = -1, topE = -Infinity, count = 0, otherE = 0, other = -1;
      const own = label[c], all = boundary[c] === 1;
      // interior cells only need their own plate checked (others if it has slid away)
      for (let pass = 0; pass < 2; pass++) {
        if (pass === 1 && (all || count > 0)) break;
        for (let p = 0; p < NP; p++) {
          if (pass === 0 && !all && p !== own) continue;
          if (pass === 1 && p === own) continue;
          const m = p * 9;
          const o = nearest3(pos, ns, nbr,
            Mf[m] * x + Mf[m + 1] * y + Mf[m + 2] * z,
            Mf[m + 3] * x + Mf[m + 4] * y + Mf[m + 5] * z,
            Mf[m + 6] * x + Mf[m + 7] * y + Mf[m + 8] * z,
            guess[c * NP + p]);
          guess[c * NP + p] = o;
          if (plate0[o] !== p) continue;
          count++;
          const e = crust0[o];
          if (e > topE) { if (top >= 0) { otherE = topE; other = top; } top = p; topE = e; } else { otherE = e; other = p; }
        }
      }
      if (count === 0) {
        // divergent boundary: new ocean floor at a ridge, with hydrothermal activity
        newElev[c] = -0.38;
        newLabel[c] = -1;
        newVolc[c] = 0.9;
      } else {
        if (count > 1) {
          // overlap: a convergent boundary (confirmed below, once we know it isn't a lone cell)
          const contTop = topE > -0.05, contOther = otherE > -0.05;
          kind[c] = contTop && contOther ? 3 : contTop ? 2 : 1;
          if (kind[c] === 3) { this.collide[top]++; this.collide[other]++; }
        }
        newElev[c] = topE;
        newLabel[c] = top;
      }
    }
    // Resampling moving plates onto a fixed grid makes stray one-cell overlaps and gaps along every
    // boundary. Only bands of them are real: a gap among covered cells is just filled in, and only
    // overlap cells with overlapping neighbours count as collisions.
    const near = (c, pred) => { let k = 0; for (let j = ns[c]; j < ns[c + 1]; j++) if (pred(nbr[j])) k++; return k; };
    for (let c = 0; c < n; c++) {
      if (newLabel[c] === -1 && near(c, (m) => newLabel[m] === -1) < 2) {
        let sum = 0, k = 0;
        for (let j = ns[c]; j < ns[c + 1]; j++) { const m = nbr[j]; if (newLabel[m] >= 0) { sum += newElev[m]; k++; } }
        if (k) { newElev[c] = sum / k; newVolc[c] = 0; newLabel[c] = -2; }
      }
    }
    for (let c = 0; c < n; c++) {
      if (!kind[c] || near(c, (m) => kind[m] > 0) < 3) continue;
      // continent–continent collisions raise great ranges; ocean crust diving under a
      // continent builds a volcanic arc; ocean–ocean collisions make island arcs
      this.uplift[c] = Math.min(0.8, this.uplift[c] + (kind[c] === 3 ? 0.02 : kind[c] === 2 ? 0.01 : 0.006));
      newVolc[c] = kind[c] === 3 ? 0.3 : 0.75;
      collisions++;
    }
    for (let c = 0; c < n; c++) newElev[c] = Math.min(1.2, newElev[c] + this.uplift[c]);
    // erosion smooths the seams along plate boundaries
    const smooth = Float32Array.from(newElev);
    for (let c = 0; c < n; c++) {
      if (!boundary[c]) continue;
      let sum = 0, k = 0;
      for (let j = ns[c]; j < ns[c + 1]; j++) { sum += newElev[nbr[j]]; k++; }
      smooth[c] = newElev[c] * 0.65 + (sum / k) * 0.35;
    }
    newElev.set(smooth);
    // gaps join a neighbouring plate
    for (let pass = 0; pass < 4; pass++) {
      let left = 0;
      for (let c = 0; c < n; c++) {
        if (newLabel[c] >= 0) continue;
        if (newLabel[c] === -2) { newLabel[c] = label[c]; continue; }
        for (let k = nb.nbrStart[c]; k < nb.nbrStart[c + 1]; k++) {
          const l = newLabel[nb.nbr[k]];
          if (l >= 0) { newLabel[c] = l; break; }
        }
        if (newLabel[c] < 0) left++;
      }
      if (!left) break;
    }
    for (let c = 0; c < n; c++) if (newLabel[c] < 0) newLabel[c] = this.label[c];
    // keep plates whole: a cell outvoted by its neighbours joins their plate (no stray fragments)
    const votes = new Int32Array(NP);
    for (let pass = 0; pass < 2; pass++) {
      for (let c = 0; c < n; c++) {
        if (!boundary[c]) continue;
        votes.fill(0);
        let k = 0;
        for (let j = ns[c]; j < ns[c + 1]; j++) { votes[newLabel[nbr[j]]]++; k++; }
        let best = newLabel[c];
        for (let p = 0; p < NP; p++) if (votes[p] > votes[best]) best = p;
        if (best !== newLabel[c] && votes[best] >= k - 1) newLabel[c] = best;
      }
    }
    // volcanism: plate boundaries plus fixed hotspots, fading where the boundary has moved on
    for (let c = 0; c < n; c++) {
      const v = Math.max(newVolc[c], this.hotspot[c], P.volc[c] * 0.8);
      P.volc[c] = v;
      P.elev[c] = newElev[c];
      this.label[c] = newLabel[c];
    }
    this.collisions = collisions;
    for (let p = 0; p < NP; p++) this.lastMove[p] = this.angle[p];
    this.moves++;
    this.computeBoundary();
    const maxAngle = Math.max(...Array.from(this.angle, Math.abs));
    if (maxAngle > ANCHOR_STEP) this.reanchor(true);
    P.terrainChanged();
    this.landStats();
    this.version++;
  }

  // cells near a plate boundary need every plate checked; interiors only their own
  computeBoundary() {
    const P = this.planet, nb = P.grid, n = P.n, b = this.boundary;
    b.fill(0);
    for (let c = 0; c < n; c++) {
      for (let k = nb.nbrStart[c]; k < nb.nbrStart[c + 1]; k++) if (this.label[nb.nbr[k]] !== this.label[c]) { b[c] = 1; break; }
    }
    for (let ring = 0; ring < 3; ring++) {
      const prev = Uint8Array.from(b);
      for (let c = 0; c < n; c++) {
        if (prev[c]) continue;
        for (let k = nb.nbrStart[c]; k < nb.nbrStart[c + 1]; k++) if (prev[nb.nbr[k]]) { b[c] = 1; break; }
      }
    }
  }

  // how the land is split up: the largest landmass's share tells a supercontinent from scattered ones
  landStats() {
    const P = this.planet, nb = P.grid, n = P.n;
    const seen = new Uint8Array(n), queue = new Int32Array(n);
    let land = 0, largest = 0, masses = 0;
    for (let c = 0; c < n; c++) {
      if (P.water[c] || seen[c]) continue;
      let qh = 0, qt = 0, size = 0;
      queue[qt++] = c; seen[c] = 1;
      while (qh < qt) {
        const q = queue[qh++]; size++;
        for (let k = nb.nbrStart[q]; k < nb.nbrStart[q + 1]; k++) {
          const m = nb.nbr[k];
          if (!seen[m] && !P.water[m]) { seen[m] = 1; queue[qt++] = m; }
        }
      }
      land += size;
      if (size > 40) masses++;
      largest = Math.max(largest, size);
    }
    this.largestShare = land ? largest / land : 0;
    this.landmasses = masses;
  }
}

function rotation(k, a) {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  const [x, y, z] = k;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

// greedy walk over the grid to the vertex nearest the direction (dx, dy, dz)
function nearest3(pos, ns, nbr, dx, dy, dz, start) {
  let c = start, best = pos[c * 3] * dx + pos[c * 3 + 1] * dy + pos[c * 3 + 2] * dz;
  for (;;) {
    let next = -1;
    for (let k = ns[c]; k < ns[c + 1]; k++) {
      const m = nbr[k];
      const v = pos[m * 3] * dx + pos[m * 3 + 1] * dy + pos[m * 3 + 2] * dz;
      if (v > best) { best = v; next = m; }
    }
    if (next < 0) return c;
    c = next;
  }
}
