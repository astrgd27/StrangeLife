// The planet: a geodesic grid of cells with terrain, climate, biomes and plant life.
// Pure simulation code (no rendering), so it can run headless for testing.

import { mulberry32, makeNoise3 } from './rng.js';

// ---------- geodesic grid ----------

export function makeGeodesicGrid(level) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(normalize);
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let l = 0; l < level; l++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 1e7 + b : b * 1e7 + a;
      let m = cache.get(key);
      if (m === undefined) {
        const va = verts[a], vb = verts[b];
        m = verts.length;
        verts.push(normalize([va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]]));
        cache.set(key, m);
      }
      return m;
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }

  const n = verts.length;
  const pos = new Float32Array(n * 3);
  verts.forEach((v, i) => { pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]; });
  const index = new Uint32Array(faces.length * 3);
  faces.forEach((f, i) => { index[i * 3] = f[0]; index[i * 3 + 1] = f[1]; index[i * 3 + 2] = f[2]; });

  // adjacency (each vertex has 5 or 6 neighbours)
  const adj = Array.from({ length: n }, () => []);
  const add = (a, b) => { if (!adj[a].includes(b)) adj[a].push(b); };
  for (const [a, b, c] of faces) { add(a, b); add(b, a); add(b, c); add(c, b); add(c, a); add(a, c); }
  const nbrStart = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) nbrStart[i + 1] = nbrStart[i] + adj[i].length;
  const nbr = new Int32Array(nbrStart[n]);
  for (let i = 0; i < n; i++) nbr.set(adj[i], nbrStart[i]);

  return { n, pos, index, nbrStart, nbr };
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------- biomes ----------

export const BIOMES = [
  // name, lush colour, plant capacity
  { name: 'Deep ocean', color: [0.04, 0.13, 0.32], K: 0.35, water: true },
  { name: 'Shallow sea', color: [0.09, 0.36, 0.55], K: 0.75, water: true },
  { name: 'Sea ice', color: [0.82, 0.88, 0.94], K: 0.04, water: true },
  { name: 'Ice sheet', color: [0.94, 0.96, 0.99], K: 0.02 },
  { name: 'Tundra', color: [0.52, 0.55, 0.42], K: 0.25 },
  { name: 'Taiga', color: [0.17, 0.36, 0.26], K: 0.55 },
  { name: 'Temperate forest', color: [0.2, 0.48, 0.18], K: 0.85 },
  { name: 'Grassland', color: [0.55, 0.66, 0.29], K: 0.5 },
  { name: 'Desert', color: [0.87, 0.76, 0.5], K: 0.06 },
  { name: 'Savanna', color: [0.72, 0.66, 0.33], K: 0.45 },
  { name: 'Rainforest', color: [0.07, 0.4, 0.11], K: 1.0 },
  { name: 'Mountains', color: [0.5, 0.45, 0.41], K: 0.1 },
  { name: 'Scalding sea', color: [0.42, 0.36, 0.24], K: 0.03, water: true },
];
export const B = {
  DEEP: 0, SHALLOW: 1, SEA_ICE: 2, ICE: 3, TUNDRA: 4, TAIGA: 5, TEMPERATE: 6,
  GRASS: 7, DESERT: 8, SAVANNA: 9, RAINFOREST: 10, MOUNTAIN: 11, SCALDING: 12,
};

const SOIL = [0.5, 0.4, 0.29];
const BASALT = [0.27, 0.24, 0.23];

// How the planet starts. Values are loosely modelled on Earth's history:
// the young Sun was ~25% dimmer, and the early atmosphere was thick with CO₂ and had no free oxygen.
export const SCENARIOS = {
  barren: { label: 'Young planet (no life)', age: 0, years: 0, seaLevel: -0.36, co2: 60000, o2: 0, iron: 1, sun: 0.76, photosynthesis: false, landPlants: false },
  microbial: { label: 'Microbial ocean', age: 900, years: 0.6e9, seaLevel: -0.04, co2: 20, o2: 0, iron: 1, sun: 0.8, photosynthesis: false, landPlants: false },
  oxygen: { label: 'Oxygen world', age: 14000, years: 4.0e9, seaLevel: 0, co2: 1.2, o2: 21, iron: 0, sun: 0.97, photosynthesis: true, landPlants: true },
};

// ---------- planet ----------

export class Planet {
  constructor(seed = 1, level = 6, scenario = 'barren') {
    this.grid = makeGeodesicGrid(level);
    const n = (this.n = this.grid.n);
    this.elev = new Float32Array(n);        // -1 (abyss) .. +1 (peaks); sea level at this.seaLevel
    this.tempOffset = new Float32Array(n);  // local climate edits (°C)
    this.moistOffset = new Float32Array(n); // local climate edits
    this.moistNoise = new Float32Array(n);
    this.baseT = new Float32Array(n);       // temperature from latitude/altitude only
    this.baseM = new Float32Array(n);       // moisture from geography only
    this.light = new Float32Array(n);       // sunlight reaching the surface, 0..1
    this.temp = new Float32Array(n);
    this.moist = new Float32Array(n);
    this.biome = new Uint8Array(n);
    this.K = new Float32Array(n);
    this.plant = new Float32Array(n);       // photosynthetic biomass: plankton, algae, land plants
    this.organics = new Float32Array(n);    // prebiotic organic molecules ("primordial soup")
    this.volc = new Float32Array(n);        // volcanic / hydrothermal activity 0..1
    this.water = new Uint8Array(n);
    // rivers and lakes: water running downhill (flow), and the share of each cell that is fresh water
    this.flow = new Float32Array(n);
    // ocean currents and seasons: upwelling (cold, nutrient-rich water), and how strong the seasons
    // are (from the axial tilt, the latitude and how far from the sea)
    this.upwell = new Float32Array(n);
    this.current = new Int8Array(n);   // +1 warm current, -1 cold current
    this.season = new Float32Array(n);
    this.tilt = 23.5;
    this.fresh = new Float32Array(n);
    this.lake = new Uint8Array(n);
    this.oceanDist = new Uint16Array(n);    // land cells: steps to the sea
    this.landDist = new Uint16Array(n);     // sea cells: steps to the shore
    this.seaLevel = 0;
    this.globalTemp = 0;  // player greenhouse offset (°C)
    this.winter = 0;      // impact-winter cooling, decays over time
    this.plantGrowth = 0.035;
    this.climateDirty = true;
    this.age = 0;
    // atmosphere & geochemistry
    this.co2 = 1;          // CO₂ relative to a modern-Earth-like level
    this.o2 = 0;           // free oxygen, % of atmosphere
    this.iron = 1;         // dissolved iron left in the oceans to soak up oxygen (1 = full)
    this.sun = 1;          // solar luminosity relative to today
    this.photosynthesis = false; // has life invented oxygenic photosynthesis?
    this.landPlants = false;     // have plants colonised the land?
    this.volcanism = 1;
    this.meanT = 15; this.iceFrac = 0; this.landFrac = 0.3; this.oceanFrac = 0.7; this.landPlantCover = 0;
    this.primaryProduction = 0;
    this.cycles = true; this.orbital = 0; this.cycleAmp = 0;
    this.ch4 = 0; this.haze = 0; this.methaneProduction = 0;
    this.landProduction = 0;
    this.generate(seed, scenario);
  }

  get ozone() { return Math.min(1, this.o2 / 4); }

  generate(seed, scenario = 'barren') {
    this.seed = seed;
    const rng = mulberry32(seed);
    const N = makeNoise3(rng);
    const { n, pos } = this.grid;
    const ox = rng() * 100, oy = rng() * 100, oz = rng() * 100;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      // domain warp for interesting coastlines
      const wx = N.fbm(x * 1.5 + 11, y * 1.5, z * 1.5, 3) * 0.6;
      const wy = N.fbm(x * 1.5, y * 1.5 + 23, z * 1.5, 3) * 0.6;
      const wz = N.fbm(x * 1.5, y * 1.5, z * 1.5 + 37, 3) * 0.6;
      const px = x + wx + ox, py = y + wy + oy, pz = z + wz + oz;
      const continent = N.fbm(px * 0.9, py * 0.9, pz * 0.9, 4);
      const detail = N.fbm(px * 3.2, py * 3.2, pz * 3.2, 5);
      const ridge = N.ridged(px * 2.0 + 5, py * 2.0, pz * 2.0, 4);
      raw[i] = continent * 1.0 + detail * 0.35 + ridge * 0.45 * Math.max(0, continent + 0.15);
      this.moistNoise[i] = N.fbm(x * 2.3 + 50, y * 2.3, z * 2.3, 4);
      // volcanic belts: thin ridges of activity (like mid-ocean ridges and arcs) plus hotspots
      const v = N.ridged(x * 1.7 + 70, y * 1.7, z * 1.7, 2);
      const hot = N.noise(x * 4 + 9, y * 4, z * 4);
      this.volc[i] = Math.min(1, Math.max(0, (v - 0.42) * 3.2) + Math.max(0, hot - 0.45) * 3);
      const coslat = Math.sqrt(1 - y * y);
      this.light[i] = 0.25 + 0.75 * coslat;
    }
    // put ~31% of the surface above sea level
    const sorted = Float32Array.from(raw).sort();
    const sea = sorted[Math.floor(n * 0.69)];
    const top = sorted[n - 1] - sea, bottom = sea - sorted[0];
    for (let i = 0; i < n; i++) {
      const e = raw[i] - sea;
      this.elev[i] = e >= 0 ? Math.pow(e / top, 1.35) : -Math.pow(-e / bottom, 0.7);
    }
    this.tempOffset.fill(0);
    this.moistOffset.fill(0);
    this.organics.fill(0);
    const S = SCENARIOS[scenario] || SCENARIOS.barren;
    this.scenario = scenario;
    this.seaLevel = S.seaLevel;
    this.co2 = S.co2; this.o2 = S.o2; this.iron = S.iron; this.sun = S.sun;
    this.photosynthesis = S.photosynthesis; this.landPlants = S.landPlants;
    this.globalTemp = 0;
    this.winter = 0;
    this.age = S.age || 0;
    this.startYears = S.years || 0;
    this.volcanism = 1 + 3 * Math.exp(-this.age / 2000);
    this.terrainChanged();
    this.plant.fill(0);
  }

  // call after elevation or sea-level edits
  terrainChanged() {
    const { n } = this;
    this.terrainVersion = (this.terrainVersion || 0) + 1;
    for (let i = 0; i < n; i++) this.water[i] = this.elev[i] < this.seaLevel ? 1 : 0;
    this.computeDistances();
    this.computeBase();
    this.updateClimate();
    this.computeRivers();
  }

  // Rain runs downhill from cell to cell until it reaches the sea. Basins fill with water until it
  // spills over their lowest rim (a "priority flood" from the coasts inland), so every drop finds a
  // way to the sea. Where enough rain gathers it is a river; a filled basin in a wet climate is a
  // lake, in a dry one a salt pan. Ice holds rain as glaciers.
  computeRivers() {
    const { n, elev, water, moist, temp, flow, fresh, lake } = this;
    const { nbrStart, nbr } = this.grid;
    const down = this._down || (this._down = new Int32Array(n));
    const order = this._order || (this._order = new Int32Array(n));
    const filled = this._filled || (this._filled = new Float32Array(n));
    const seen = this._seen || (this._seen = new Uint8Array(n));
    // binary min-heap on spill height
    const hk = this._hk || (this._hk = new Float32Array(n)), hv = this._hv || (this._hv = new Int32Array(n));
    let hn = 0;
    const push = (k, v) => {
      let i = hn++;
      while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
      hk[i] = k; hv[i] = v;
    };
    const pop = () => {
      const v = hv[0], k = hk[--hn], w = hv[hn];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= hn) break;
        if (c + 1 < hn && hk[c + 1] < hk[c]) c++;
        if (hk[c] >= k) break;
        hk[i] = hk[c]; hv[i] = hv[c]; i = c;
      }
      hk[i] = k; hv[i] = w;
      return v;
    };
    for (let c = 0; c < n; c++) {
      down[c] = -1; flow[c] = 0; fresh[c] = 0; lake[c] = 0; seen[c] = 0; filled[c] = elev[c];
      if (water[c]) { seen[c] = 1; push(elev[c], c); }
    }
    let m = 0;
    while (hn > 0) {
      const c = pop();
      for (let k = nbrStart[c]; k < nbrStart[c + 1]; k++) {
        const q = nbr[k];
        if (seen[q]) continue;
        seen[q] = 1;
        filled[q] = Math.max(elev[q], filled[c] + 1e-6);
        down[q] = c;
        order[m++] = q;
        push(filled[q], q);
      }
    }
    // collect rain from the highest cells down
    for (let i = m - 1; i >= 0; i--) {
      const c = order[i];
      flow[c] += moist[c] * (temp[c] > -2 ? 1 : 0.15);
      const d = down[c];
      if (d >= 0 && !water[d]) flow[d] += flow[c];
    }
    const RIVER = 3.5;
    for (let i = 0; i < m; i++) {
      const c = order[i];
      if (temp[c] < -2) continue;
      const depth = filled[c] - elev[c];
      // a basin holds a lake only if rain keeps it topped up
      if (depth > 0.004 && flow[c] > 2.5 && moist[c] > 0.25) { lake[c] = 1; fresh[c] = 1; }
      else if (flow[c] > RIVER) fresh[c] = Math.min(0.6, 0.18 + (0.42 * (flow[c] - RIVER)) / (RIVER * 8));
    }
  }

  computeDistances() {
    const { n } = this;
    const { nbrStart, nbr } = this.grid;
    const bfs = (d, isSource) => {
      const queue = new Int32Array(n);
      let qh = 0, qt = 0;
      for (let i = 0; i < n; i++) {
        if (isSource(i)) { d[i] = 0; queue[qt++] = i; } else d[i] = 65535;
      }
      while (qh < qt) {
        const c = queue[qh++];
        for (let k = nbrStart[c]; k < nbrStart[c + 1]; k++) {
          const m = nbr[k];
          if (d[m] > d[c] + 1) { d[m] = d[c] + 1; queue[qt++] = m; }
        }
      }
    };
    bfs(this.oceanDist, (i) => this.water[i] === 1);
    bfs(this.landDist, (i) => this.water[i] === 0);
  }

  // land height above sea level in 0..1 (0 for water)
  heightAboveSea(i) {
    return Math.max(0, (this.elev[i] - this.seaLevel) / Math.max(0.2, 1 - this.seaLevel));
  }

  // geography-only parts of climate; recomputed when terrain or sea level change
  computeBase() {
    const pos = this.grid.pos;
    for (let i = 0; i < this.n; i++) {
      const y = pos[i * 3 + 1];
      const alat = Math.abs(Math.asin(y) * 180 / Math.PI);
      let T = 28 - 50 * y * y;
      const w = this.water[i];
      if (w) T = T * 0.8 + 3; // oceans moderate temperature
      else {
        T -= this.heightAboveSea(i) * 34; // lapse rate
        T += Math.min(this.oceanDist[i], 12) * 0.12 * (T > 10 ? 1 : -1); // continentality
      }
      this.baseT[i] = T;
      // moisture: noise + ocean proximity + Hadley circulation
      let m = 0.42 + this.moistNoise[i] * 0.55;
      if (!w) m += 0.42 * Math.exp(-this.oceanDist[i] / 5) - 0.15;
      m -= 0.38 * Math.exp(-(((alat - 27) / 9) ** 2)); // subtropical deserts
      m += 0.3 * Math.exp(-((alat / 11) ** 2));        // tropical rain belt
      m += 0.12 * Math.exp(-(((alat - 55) / 12) ** 2)); // mid-latitude storms
      m -= Math.max(0, this.heightAboveSea(i) - 0.45) * 0.4;
      this.baseM[i] = m;
    }
    this.computeWindsAndCurrents();
  }

  // Prevailing winds by latitude: trade winds blow from the east in the tropics, westerlies from
  // the west at mid-latitudes, polar easterlies near the poles. They push ocean currents along the
  // coasts and carry rain, so:
  //   - west coasts in the subtropics get cold currents and upwelling: rich seas, cool foggy deserts
  //     on the shore (Peru and the Atacama, Namibia and the Namib)
  //   - east coasts get warm currents (the Gulf Stream, the Kuroshio)
  //   - mountains wring the rain out of the wind, leaving a dry rain shadow behind them
  //   - seasons are strongest far from the sea at high latitudes, and scale with the axial tilt
  computeWindsAndCurrents() {
    const n = this.n, pos = this.grid.pos, { nbrStart, nbr } = this.grid, water = this.water;
    const up = this.upwell, cur = this.current, seas = this.season;
    // walk k steps from cell c roughly east (dir=+1) or west (dir=-1); visit(cell) returns true to stop
    const walk = (c, dir, k, visit) => {
      for (let s = 0; s < k; s++) {
        const x = pos[c * 3], z = pos[c * 3 + 2];
        const ex = z * dir, ez = -x * dir; // east = (0,1,0) × position
        let best = -1, bd = -Infinity;
        for (let j = nbrStart[c]; j < nbrStart[c + 1]; j++) {
          const q = nbr[j], d = (pos[q * 3] - x) * ex + (pos[q * 3 + 2] - z) * ez;
          if (d > bd) { bd = d; best = q; }
        }
        if (best < 0 || bd <= 0) return;
        c = best;
        if (visit(c, s)) return;
      }
    };
    const tiltF = this.tilt / 23.5;
    for (let i = 0; i < n; i++) {
      up[i] = 0; cur[i] = 0;
      const y = pos[i * 3 + 1], alat = Math.abs(Math.asin(y) * 180 / Math.PI);
      seas[i] = Math.min(1, tiltF * Math.sin((alat * Math.PI) / 180) * (water[i] ? 0.35 : 0.6 + 0.04 * Math.min(10, this.oceanDist[i])));
      if (!water[i]) continue;
      if (this.landDist[i] <= 3 && alat > 6 && alat < 50) {
        let landEast = false, landWest = false;
        walk(i, 1, 4, (q) => (landEast = !water[q]));
        walk(i, -1, 4, (q) => (landWest = !water[q]));
        const f = Math.exp(-(((alat - 24) / 13) ** 2));
        if (landEast && !landWest) { up[i] = f; cur[i] = -1; this.baseT[i] -= 4 * f; }
        else if (landWest && !landEast) { cur[i] = 1; this.baseT[i] += 2.5 * f; }
      } else if (alat < 5 && this.landDist[i] > 3) up[i] = 0.45; // equatorial upwelling
    }
    // coasts beside cold currents are foggy deserts; inland, mountains cast rain shadows
    for (let i = 0; i < n; i++) {
      if (water[i]) continue;
      if (this.oceanDist[i] <= 2) {
        let u = 0;
        for (let j = nbrStart[i]; j < nbrStart[i + 1]; j++) u = Math.max(u, up[nbr[j]]);
        this.baseM[i] -= 0.28 * u;
        if (u) this.baseT[i] -= 2 * u;
      }
      const y = pos[i * 3 + 1], alat = Math.abs(Math.asin(y) * 180 / Math.PI);
      const from = alat < 30 || alat > 62 ? 1 : -1; // the wind comes from the east, or from the west
      const h0 = this.heightAboveSea(i);
      let peak = 0;
      walk(i, from, 7, (q) => { if (water[q]) return true; peak = Math.max(peak, this.heightAboveSea(q)); return false; });
      const shadow = Math.max(0, peak - h0 - 0.08);
      this.baseM[i] -= Math.min(0.45, 1.3 * shadow);
    }
  }

  // Global temperature shift from the atmosphere and the Sun.
  // ~5 °C per doubling of CO₂ (a game-sized climate sensitivity), a dimmer young Sun,
  // and ice reflecting sunlight back to space (ice-albedo feedback: can tip into a "snowball").
  // CO₂ plus methane (a stronger greenhouse gas, made by archaea before there was oxygen to destroy
  // it); a thick methane haze shades the surface a little, like Titan's
  get greenhouse() { return 5 * Math.log2(Math.max(0.05, this.co2)) + 4 * Math.log2(1 + this.ch4) - 4 * this.haze; }
  get solar() { return (this.sun - 1) * 75; }
  get albedo() { return -16 * Math.max(0, this.iceFrac - 0.12); }
  get globalShift() { return this.greenhouse + this.solar + this.albedo + this.orbital + this.globalTemp - this.winter; }

  // Orbital (Milankovitch) cycles: wobbles in Earth's tilt, orbit shape and axis direction change
  // how sunlight falls on the planet, pacing ice ages. They matter most on a cool planet with ice
  // to amplify them. Real periods are ~23, 41 and 100 thousand years; here they're stretched so a
  // game session sees ice ages come and go.
  updateOrbital() {
    if (!this.cycles) { this.orbital = 0; this.cycleAmp = 0; return; }
    const a = this.orbitalClock ?? this.age, tau = Math.PI * 2;
    const amp = 1 + 4 * Math.min(1, Math.max(0, (16 - this.meanT) / 14));
    const wave = (0.5 * Math.sin((tau * a) / 170) + 0.35 * Math.sin((tau * a) / 260 + 1) + 0.65 * Math.sin((tau * a) / 700 + 2)) / 1.5;
    this.cycleAmp = amp;
    this.orbital = amp * wave;
  }

  updateClimate() {
    const { n } = this;
    const g = this.globalShift;
    let sumT = 0, ice = 0, land = 0, ocean = 0, plantLand = 0, Kland = 0;
    for (let i = 0; i < n; i++) {
      const T = this.baseT[i] + g + this.tempOffset[i];
      this.temp[i] = T;
      sumT += T;
      let m = this.baseM[i];
      if (T < 0) m *= 0.75; // cold air holds less water
      m += this.moistOffset[i];
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      this.moist[i] = m;
      const b = this.classify(i, T, m);
      this.biome[i] = b;
      let K = BIOMES[b].K;
      if (this.water[i]) {
        ocean++;
        if (b !== B.SEA_ICE && b !== B.SCALDING) K *= (0.75 + 0.25 * Math.exp(-(((T - 18) / 14) ** 2)) + (T < 8 ? 0.15 : 0)) * (1 + 0.9 * this.upwell[i]);
        if (b === B.SEA_ICE) ice++;
      } else {
        if (b === B.ICE) ice++; else { land++; Kland += K; plantLand += this.plant[i]; }
      }
      this.K[i] = K;
    }
    this.meanT = sumT / n;
    this.iceFrac = ice / n;
    this.landFrac = land / n;
    this.oceanFrac = ocean / n;
    this.landPlantCover = Kland > 0 ? plantLand / Kland : 0;
    this.climateDirty = false;
  }

  classify(i, T, m) {
    if (this.water[i]) {
      if (T < -6) return B.SEA_ICE;
      if (T > 75) return B.SCALDING;
      return this.elev[i] - this.seaLevel > -0.18 ? B.SHALLOW : B.DEEP;
    }
    const h = this.heightAboveSea(i);
    if (T < -10) return B.ICE;
    if (h > 0.62 && T < 14) return B.MOUNTAIN;
    if (T < 0) return B.TUNDRA;
    if (T < 9) return m > 0.38 ? B.TAIGA : B.TUNDRA;
    if (T < 20) return m < 0.22 ? B.DESERT : m < 0.48 ? B.GRASS : B.TEMPERATE;
    return m < 0.2 ? B.DESERT : m < 0.46 ? B.SAVANNA : B.RAINFOREST;
  }

  // Prebiotic chemistry: organic molecules form at hydrothermal vents and from lightning
  // in a reducing atmosphere (Miller–Urey), concentrate in tidal pools, and break down in
  // hot water, on dry land, and in oxygen.
  stepChemistry(dt = 1) {
    const { n, organics, temp, water, volc, landDist, biome } = this;
    const lightning = this.o2 < 1 ? 0.0025 : 0.0002;
    const oxidise = this.o2 > 2 ? 0.006 : 0;
    for (let i = 0; i < n; i++) {
      let o = organics[i];
      if (!water[i]) { if (o > 0) organics[i] = o * (dt > 1 ? 0.81 : 0.9); continue; }
      const T = temp[i];
      let prod = lightning + 0.01 * volc[i];
      if (landDist[i] <= 2) prod *= 2.5; // wet–dry cycles in tidal pools concentrate monomers
      if (T < -2) prod *= 0.2;           // frozen: chemistry crawls
      const decay = 0.003 + (T > 50 ? (T - 50) * 0.002 : 0) + (biome[i] === B.DEEP ? 0.002 : 0) + oxidise;
      o += (prod - o * decay) * dt;
      if (o < 0) o = 0;
      organics[i] = o;
    }
  }

  // Carbon-silicate cycle and oxygen. Volcanoes add CO₂; rock weathering removes it faster when
  // it's warm, wet and plant-covered, which keeps the climate in check over long times.
  // Photosynthesis makes oxygen, which first rusts the dissolved iron in the oceans (banded iron
  // formations) and only then builds up in the air.
  stepAtmosphere(tick) {
    this.age++;
    this.volcanism = 1 + 3 * Math.exp(-this.age / 2000);
    this.sun = Math.min(1.05, this.sun + 0.000012);
    const V = 0.012 * this.volcanism;
    const land = this.landFrac + 0.08;
    const W = 0.012 * this.co2 * Math.exp(Math.min(6, (this.meanT - 15) / 12)) * land * (1 + 2 * this.landPlantCover)
      + this.primaryProduction * 0.01 * Math.min(1, this.co2); // burial of organic carbon
    const rel = Math.max(-0.012, Math.min(0.012, (V - W) / Math.max(0.05, this.co2)));
    this.co2 = Math.max(0.05, this.co2 * Math.exp(rel));

    const P = this.primaryProduction; // mean photosynthetic biomass per zone
    if (this.iron > 0) {
      this.iron = Math.max(0, this.iron - P * 0.004);
      this.o2 = Math.max(0, this.o2 - 0.02);
    } else {
      // volcanic gases keep soaking up oxygen while the planet is young (the "boring billion"),
      // and above ~21% wildfires burn so readily that they hold oxygen down
      let target = P * 110 - 14 * Math.max(0, this.volcanism - 0.95);
      if (target > 21) target = 21 + (target - 21) * 0.25;
      this.o2 += (Math.max(0, target) - this.o2) * 0.003;
    }
    this.o2 = Math.max(0, this.o2);

    // methane: made by methanogens, destroyed by sunlight slowly and by oxygen fast
    this.ch4 = Math.max(0, this.ch4 + this.methaneProduction * 2.5 - this.ch4 * (0.004 + 0.08 * Math.min(1, this.o2 / 1.5)));
    this.haze = Math.max(0, Math.min(1, (this.ch4 / Math.max(0.5, this.co2) - 0.5) * 1.5));

    // water vapour from volcanoes slowly fills the ocean basins
    if (this.seaLevel < 0) this.seaLevel = Math.min(0, this.seaLevel + 0.00003 * this.volcanism);
    if (Math.abs(this.seaLevel - (this.lastSea ?? this.seaLevel)) > 0.004) {
      this.lastSea = this.seaLevel;
      this.terrainChanged();
    }
    this.lastSea ??= this.seaLevel;
  }

  step(tick) {
    if (this.winter > 0) this.winter = Math.max(0, this.winter * 0.985 - 0.005);
    this.stepAtmosphere(tick);
    // orbital cycles run on real time: one step per tick, but nearly frozen at a human pace
    this.orbitalClock = (this.orbitalClock ?? this.age) + Math.min(1, (this.yearsPerTick ?? 5e4) / 5e4);
    if (tick % 6 === 0) this.updateOrbital();
    if (this.climateDirty || tick % 6 === 0) this.updateClimate();
    if (tick % 60 === 0) this.computeRivers(); // rainfall shifts, rivers follow
    if (tick % 2 === 0) this.stepChemistry(2);
  }

  // ---------- player tools ----------

  // cells within an angular radius (radians) of cell c, with falloff weight 0..1
  cellsNear(c, radius) {
    const { pos } = this.grid;
    const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
    const cosR = Math.cos(radius);
    const out = [];
    for (let i = 0; i < this.n; i++) {
      const d = cx * pos[i * 3] + cy * pos[i * 3 + 1] + cz * pos[i * 3 + 2];
      if (d >= cosR) {
        const a = Math.acos(Math.min(1, d)) / radius;
        out.push(i, 0.5 + 0.5 * Math.cos(Math.PI * a));
      }
    }
    return out; // flat [cell, weight, cell, weight, ...]
  }

  editElevation(c, radius, amount) {
    this.crustDirty = true; // plate tectonics must keep this edit
    const cells = this.cellsNear(c, radius);
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      this.elev[i] = Math.max(-1, Math.min(1.2, this.elev[i] + amount * cells[k + 1]));
    }
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      this.water[i] = this.elev[i] < this.seaLevel ? 1 : 0;
    }
    this.climateDirty = true;
  }

  editClimate(c, radius, dTemp, dMoist) {
    const cells = this.cellsNear(c, radius);
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k], w = cells[k + 1];
      this.tempOffset[i] = Math.max(-30, Math.min(30, this.tempOffset[i] + dTemp * w));
      this.moistOffset[i] = Math.max(-0.8, Math.min(0.8, this.moistOffset[i] + dMoist * w));
    }
    this.climateDirty = true;
  }

  // volcano: builds land, makes the area volcanically active (vents underwater) and vents CO₂
  volcano(c, radius, dt) {
    this.editElevation(c, radius * 0.6, 0.35 * dt);
    const cells = this.cellsNear(c, radius);
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      this.volc[i] = Math.min(1, this.volc[i] + 1.2 * dt * cells[k + 1]);
    }
    this.co2 *= 1 + 0.25 * dt;
  }

  // lightning storm: sparks organic synthesis in nearby water (Miller–Urey)
  lightning(c, radius) {
    const cells = this.cellsNear(c, radius);
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      if (this.water[i]) this.organics[i] += 0.5 * cells[k + 1];
    }
  }

  // icy comet: delivers water and organic molecules
  comet(c) {
    this.crustDirty = true;
    const cells = this.cellsNear(c, 0.22);
    for (let k = 0; k < cells.length; k += 2) this.organics[cells[k]] += 1.6 * cells[k + 1];
    const crater = this.cellsNear(c, 0.04);
    for (let k = 0; k < crater.length; k += 2) this.elev[crater[k]] -= 0.12 * crater[k + 1];
    this.seaLevel = Math.min(0.05, this.seaLevel + 0.008);
    this.terrainChanged();
  }

  impact(c) {
    this.crustDirty = true;
    const crater = this.cellsNear(c, 0.07);
    for (let k = 0; k < crater.length; k += 2) {
      const i = crater[k], w = crater[k + 1];
      // bowl with a raised rim
      this.elev[i] += -0.35 * w + 0.12 * Math.sin(Math.PI * (1 - w));
      this.plant[i] = 0;
    }
    const blast = this.cellsNear(c, 0.35);
    for (let k = 0; k < blast.length; k += 2) this.plant[blast[k]] *= 1 - blast[k + 1];
    for (let i = 0; i < this.n; i++) this.plant[i] *= 0.6;
    this.winter = Math.min(20, this.winter + 9);
    this.terrainChanged();
  }

  // ---------- colours for rendering ----------

  // writes RGB into out (Float32Array n*3)
  colors(out, mode = 'biome') {
    const { n } = this;
    const oxic = Math.min(1, this.o2 / 6); // anoxic, iron-rich seas look green; oxygenated seas blue
    for (let i = 0; i < n; i++) {
      let r, g, b;
      if (mode === 'biome' || mode === 'life') {
        const bi = this.biome[i];
        const base = BIOMES[bi].color;
        if (this.water[i]) {
          const depth = Math.min(1, (this.seaLevel - this.elev[i]) / 0.6);
          if (bi === B.SEA_ICE || bi === B.SCALDING) { [r, g, b] = base; }
          else {
            const sr = 0.1 + (0.2 - 0.1) * (1 - oxic), sg = 0.42 + (0.4 - 0.42) * (1 - oxic), sb = 0.58 + (0.3 - 0.58) * (1 - oxic);
            const dr = 0.02 + 0.03 * (1 - oxic), dg = 0.1 + 0.03 * (1 - oxic), db = 0.3 - 0.18 * (1 - oxic);
            r = sr + (dr - sr) * depth;
            g = sg + (dg - sg) * depth;
            b = sb + (db - sb) * depth;
            const p = Math.min(1, this.plant[i] / 0.9) * 0.14; // plankton tint
            g += p; r += p * 0.3;
          }
          const o = Math.min(1, this.organics[i] / 4) * 0.55; // brown organic "soup"
          r += (0.62 - r) * o; g += (0.45 - g) * o; b += (0.18 - b) * o;
        } else {
          const lush = this.K[i] > 0.05 ? Math.min(1, this.plant[i] / this.K[i]) : 0;
          const v = this.landPlants ? 0 : this.volc[i] * 0.6;
          const sr = SOIL[0] + (BASALT[0] - SOIL[0]) * v, sg = SOIL[1] + (BASALT[1] - SOIL[1]) * v, sb = SOIL[2] + (BASALT[2] - SOIL[2]) * v;
          r = sr + (base[0] - sr) * lush;
          g = sg + (base[1] - sg) * lush;
          b = sb + (base[2] - sb) * lush;
          if (bi === B.ICE || (bi === B.DESERT && this.landPlants) || bi === B.MOUNTAIN) [r, g, b] = base;
          if (bi === B.MOUNTAIN && this.temp[i] < -2) [r, g, b] = [0.92, 0.93, 0.96];
        }
      } else if (mode === 'temperature') {
        [r, g, b] = ramp(TEMP_RAMP, (this.temp[i] + 30) / 100);
      } else if (mode === 'moisture') {
        [r, g, b] = ramp(MOIST_RAMP, this.moist[i]);
        if (this.water[i]) { r *= 0.35; g *= 0.35; b *= 0.45; }
      } else if (mode === 'elevation') {
        const e = this.elev[i] - this.seaLevel;
        [r, g, b] = e < 0 ? ramp(DEPTH_RAMP, 1 + e) : ramp(HEIGHT_RAMP, e / (1 - this.seaLevel));
      } else if (mode === 'plants') {
        [r, g, b] = ramp(PLANT_RAMP, this.plant[i]);
      } else if (mode === 'organics') {
        [r, g, b] = this.water[i] ? ramp(ORGANIC_RAMP, this.organics[i] / 4) : [0.12, 0.11, 0.1];
        const v = this.volc[i] * 0.5;
        r += v * 0.6; g += v * 0.1;
      }
      out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
    }
  }
}

const TEMP_RAMP = [[0.2, 0.25, 0.75], [0.3, 0.65, 0.95], [0.95, 0.95, 0.85], [0.98, 0.65, 0.25], [0.8, 0.15, 0.12], [0.45, 0.05, 0.1]];
const MOIST_RAMP = [[0.75, 0.55, 0.3], [0.8, 0.8, 0.5], [0.35, 0.7, 0.55], [0.2, 0.45, 0.85]];
const DEPTH_RAMP = [[0.02, 0.05, 0.2], [0.1, 0.3, 0.6]];
const HEIGHT_RAMP = [[0.25, 0.5, 0.25], [0.75, 0.7, 0.4], [0.55, 0.42, 0.32], [0.95, 0.95, 0.95]];
const PLANT_RAMP = [[0.08, 0.06, 0.05], [0.25, 0.35, 0.1], [0.3, 0.85, 0.25]];
const ORGANIC_RAMP = [[0.04, 0.08, 0.16], [0.35, 0.3, 0.15], [0.85, 0.6, 0.2], [1, 0.9, 0.55]];

function ramp(stops, t) {
  t = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
