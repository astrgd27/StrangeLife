// Creatures, genomes, natural selection and speciation.
//
// Every creature carries a genome of 8 genes in 0..1. Traits are decoded from genes,
// each has a cost, and energy flows: sunlight -> plants -> grazers -> predators.
// Offspring inherit their parent's genome with small mutations. When a lineage drifts
// far enough from its species' founding genome, it becomes a new species.

import { gaussian } from './rng.js';
import { genusName, speciesEpithet } from './names.js';

export const G = 8;
export const GENE = { SIZE: 0, SPEED: 1, DIET: 2, TEMP: 3, TOL: 4, AQUA: 5, HUE: 6, REPRO: 7 };
export const GENE_NAMES = ['Size', 'Speed', 'Diet', 'Climate', 'Tolerance', 'Habitat', 'Colour', 'Brood'];
// how much each gene counts toward species divergence (colour is neutral)
const WEIGHT = [1, 1, 1.4, 1, 0.7, 1.4, 0, 0.7];

export function decode(g, o = 0) {
  return {
    size: 0.3 + 2.7 * g[o],
    speed: 0.15 + 1.35 * g[o + 1],
    diet: g[o + 2],
    tempPref: -20 + 60 * g[o + 3],
    tempTol: 3 + 22 * g[o + 4],
    aquatic: g[o + 5],
    hue: g[o + 6],
    brood: g[o + 7],
  };
}

export function geneticDistance(a, ao, b, bo) {
  let s = 0;
  for (let k = 0; k < G; k++) {
    const d = a[ao + k] - b[bo + k];
    s += WEIGHT[k] * d * d;
  }
  return Math.sqrt(s);
}

export const PRESETS = {
  algae: { label: 'Primordial swimmer', genes: [0.15, 0.2, 0.02, 0.62, 0.45, 0.92, 0.52, 0.3] },
  grazer: { label: 'Land grazer', genes: [0.3, 0.35, 0.05, 0.55, 0.45, 0.0, 0.25, 0.45] },
  hunter: { label: 'Land hunter', genes: [0.45, 0.6, 0.9, 0.55, 0.45, 0.0, 0.0, 0.6] },
  fish: { label: 'Sea grazer', genes: [0.3, 0.45, 0.05, 0.55, 0.4, 1.0, 0.58, 0.35] },
  shark: { label: 'Sea hunter', genes: [0.5, 0.65, 0.92, 0.55, 0.4, 1.0, 0.95, 0.6] },
  amphibian: { label: 'Amphibian', genes: [0.25, 0.3, 0.3, 0.6, 0.5, 0.5, 0.35, 0.35] },
};

export class Life {
  constructor(planet, rng, max = 6000) {
    this.planet = planet;
    this.rng = rng;
    this.max = max;
    this.genes = new Float32Array(max * G);
    this.energy = new Float32Array(max);
    this.age = new Float32Array(max);
    this.cell = new Int32Array(max);
    this.prevCell = new Int32Array(max);
    this.species = new Int32Array(max);
    this.moveAcc = new Float32Array(max);
    this.alive = new Uint8Array(max);
    this.generation = new Uint32Array(max);
    this.jitter = new Float32Array(max * 2);
    this.free = [];
    this.hi = 0;
    this.count = 0;

    this.head = new Int32Array(planet.n).fill(-1);
    this.next = new Int32Array(max).fill(-1);
    this.cellCount = new Uint16Array(planet.n);

    this.speciesById = new Map();
    this.nextSpeciesId = 1;
    this.mutationRate = 1;
    this.speciationThreshold = 0.45;
    this.tick = 0;
    this.births = 0;
    this.deaths = { starve: 0, age: 0, eaten: 0, disaster: 0 };
    this.onEvent = () => {};
  }

  // ---------- species ----------

  newSpecies(genes, o, parentId, tick) {
    const rng = this.rng;
    const parent = parentId ? this.speciesById.get(parentId) : null;
    const traits = decode(genes, o);
    let genus = parent && rng() < 0.55 ? parent.genus : genusName(rng);
    const sp = {
      id: this.nextSpeciesId++,
      genus,
      name: genus + ' ' + speciesEpithet(rng, traits),
      proto: Float32Array.from(genes.subarray(o, o + G)),
      parent: parentId || 0,
      born: tick,
      died: -1,
      count: 0,
      peak: 0,
      sum: new Float32Array(G), // running sum of genes for mean traits
    };
    this.speciesById.set(sp.id, sp);
    return sp;
  }

  // ---------- agents ----------

  spawn(cell, genes, go, speciesId, energy, gen = 0) {
    if (this.count >= this.max) return -1;
    const i = this.free.length ? this.free.pop() : this.hi++;
    this.genes.set(genes.subarray ? genes.subarray(go, go + G) : genes.slice(go, go + G), i * G);
    this.energy[i] = energy;
    this.age[i] = 0;
    this.cell[i] = cell;
    this.prevCell[i] = cell;
    this.species[i] = speciesId;
    this.moveAcc[i] = this.rng();
    this.alive[i] = 1;
    this.generation[i] = gen;
    this.jitter[i * 2] = this.rng() * 2 - 1;
    this.jitter[i * 2 + 1] = this.rng() * 2 - 1;
    this.cellCount[cell]++;
    this.count++;
    return i;
  }

  kill(i, cause) {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.cellCount[this.cell[i]]--;
    this.free.push(i);
    this.count--;
    this.deaths[cause]++;
  }

  // Seed a population of a new species around a cell.
  seed(cell, genes, n = 40, name = null) {
    const g = Float32Array.from(genes);
    const sp = this.newSpecies(g, 0, 0, this.tick);
    if (name) sp.name = name;
    sp.seeded = this.tick > 0;
    const cells = this.planet.cellsNear(cell, 0.12);
    const t = decode(g);
    for (let k = 0; k < n; k++) {
      const c = cells[2 * Math.floor(this.rng() * (cells.length / 2))];
      const child = Float32Array.from(g);
      for (let j = 0; j < G; j++) if (j !== GENE.HUE) child[j] = clamp01(child[j] + gaussian(this.rng) * 0.015);
      this.spawn(c, child, 0, sp.id, 5 * t.size);
    }
    this.onEvent({ type: 'seed', species: sp });
    return sp;
  }

  // ---------- simulation ----------

  rebuildCells() {
    this.head.fill(-1);
    for (let i = 0; i < this.hi; i++) {
      if (!this.alive[i]) continue;
      const c = this.cell[i];
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
  }

  step() {
    const P = this.planet;
    const rng = this.rng;
    const { nbrStart, nbr } = P.grid;
    const genes = this.genes;
    this.tick++;
    this.rebuildCells();
    const sigma = 0.045 * this.mutationRate;
    const full = this.count >= this.max;

    for (let i = 0; i < this.hi; i++) {
      if (!this.alive[i]) continue;
      const o = i * G;
      const size = 0.3 + 2.7 * genes[o];
      const speed = 0.15 + 1.35 * genes[o + 1];
      const diet = genes[o + 2];
      const tPref = -20 + 60 * genes[o + 3];
      const tTol = 3 + 22 * genes[o + 4];
      const aqua = genes[o + 5];
      const brood = genes[o + 7];
      const scale = Math.pow(size, 0.75);
      const maxE = 10 * size;

      this.prevCell[i] = this.cell[i];
      this.age[i]++;

      // --- movement: pick the most attractive neighbouring cell ---
      this.moveAcc[i] += speed;
      while (this.moveAcc[i] >= 1) {
        this.moveAcc[i] -= 1;
        const c = this.cell[i];
        let best = c;
        let bestScore = this.cellScore(i, c, size, diet, tPref, tTol, aqua) + 0.15;
        for (let k = nbrStart[c]; k < nbrStart[c + 1]; k++) {
          const m = nbr[k];
          const s = this.cellScore(i, m, size, diet, tPref, tTol, aqua) + rng() * 0.35;
          if (s > bestScore) { bestScore = s; best = m; }
        }
        if (best === c) break;
        this.cellCount[c]--;
        this.cellCount[best]++;
        this.cell[i] = best;
      }
      const c = this.cell[i];

      // --- metabolism ---
      const T = P.temp[c];
      const stress = Math.max(0, Math.abs(T - tPref) - tTol);
      const habitat = Math.abs(aqua - P.water[c]);
      let cost = scale * (0.02 + 0.012 * speed * speed + 0.0007 * tTol + 0.012 * stress + 0.06 * habitat * habitat);
      cost += 0.004 * diet * scale; // hunting gear isn't free
      this.energy[i] -= cost;

      // --- eat plants ---
      if (diet < 0.95 && this.energy[i] < maxE) {
        const bite = 0.13 * scale * (1 - diet) * (1 - 0.7 * habitat * habitat);
        const eaten = Math.min(bite, P.plant[c] * 0.6, maxE - this.energy[i]);
        P.plant[c] -= eaten;
        this.energy[i] += eaten * (1 - 0.15 * diet);
      }

      // --- hunt ---
      if (diet > 0.12 && this.energy[i] < maxE * 0.9) this.hunt(i, c, size, speed, diet, maxE);

      // --- death ---
      const maxAge = 50 + 70 * Math.sqrt(size);
      if (this.energy[i] <= 0) { this.kill(i, 'starve'); continue; }
      if (this.age[i] > maxAge && rng() < 0.15) { this.kill(i, 'age'); continue; }

      // --- reproduce ---
      const maturity = 6 + 8 * Math.sqrt(size);
      if (!full && this.age[i] > maturity && this.energy[i] > maxE * (0.55 + 0.3 * brood)) {
        const share = 0.25 + 0.45 * brood; // more energy per offspring = fewer, sturdier young
        const childE = this.energy[i] * share;
        this.energy[i] -= childE + 0.3 * size;
        this.reproduce(i, childE, sigma);
      }
    }

    if (this.tick % 2 === 0) this.updateSpecies();
  }

  cellScore(i, m, size, diet, tPref, tTol, aqua) {
    const P = this.planet;
    const habitat = Math.abs(aqua - P.water[m]);
    const stress = Math.max(0, Math.abs(P.temp[m] - tPref) - tTol);
    let food = (1 - diet) * P.plant[m] * 1.6;
    if (diet > 0.12) food += diet * this.preyIn(i, m, size) * 0.6;
    return food - habitat * habitat * 2.4 - stress * 0.12 - this.cellCount[m] * 0.08;
  }

  preyIn(i, c, size) {
    let n = 0;
    const sp = this.species[i];
    for (let j = this.head[c]; j !== -1; j = this.next[j]) {
      if (j === i || !this.alive[j] || this.cell[j] !== c || this.species[j] === sp) continue;
      if (0.3 + 2.7 * this.genes[j * G] < size * 1.25) n++;
      if (n >= 4) break;
    }
    return n;
  }

  hunt(i, c, size, speed, diet, maxE) {
    const sp = this.species[i];
    const genes = this.genes;
    // check this cell and neighbours, pick the first viable prey
    const { nbrStart, nbr } = this.planet.grid;
    let k = nbrStart[c] - 1;
    let cc = c;
    while (true) {
      for (let j = this.head[cc]; j !== -1; j = this.next[j]) {
        if (j === i || !this.alive[j] || this.species[j] === sp) continue;
        if (this.cell[j] !== cc && this.prevCell[j] !== cc) continue;
        const pSize = 0.3 + 2.7 * genes[j * G];
        if (pSize > size * 1.25) continue;
        const pSpeed = 0.15 + 1.35 * genes[j * G + 1];
        const pDiet = genes[j * G + 2];
        // big, fast, specialised hunters succeed more; fast prey escapes; other hunters fight back
        let p = Math.pow(diet, 1.3) * 1.1 * Math.sqrt(size / pSize) * Math.sqrt(speed / pSpeed) * (1 - 0.5 * pDiet);
        if (cc !== c) p *= 0.6;
        if (this.rng() < Math.min(0.85, p)) {
          const gain = (Math.max(0, this.energy[j]) * 0.5 + 2.5 * pSize) * (0.3 + 0.7 * diet);
          this.energy[i] = Math.min(maxE, this.energy[i] + gain);
          this.kill(j, 'eaten');
        } else {
          this.energy[i] -= 0.02 * size;
        }
        return; // one attempt per tick
      }
      k++;
      if (k >= nbrStart[c + 1]) return;
      cc = nbr[k];
    }
  }

  reproduce(i, childE, sigma) {
    const rng = this.rng;
    const g = this.genes;
    const tmp = this._tmp || (this._tmp = new Float32Array(G));
    for (let k = 0; k < G; k++) {
      let v = g[i * G + k];
      if (rng() < 0.4) v += gaussian(rng) * (k === GENE.HUE ? sigma * 0.5 : sigma);
      tmp[k] = k === GENE.HUE ? ((v % 1) + 1) % 1 : clamp01(v);
    }
    let spId = this.species[i];
    const sp = this.speciesById.get(spId);
    if (geneticDistance(tmp, 0, sp.proto, 0) > this.speciationThreshold) {
      // founder effect: new species gets a visibly different colour
      tmp[GENE.HUE] = (tmp[GENE.HUE] + 0.12 + rng() * 0.2) % 1;
      const ns = this.newSpecies(tmp, 0, spId, this.tick);
      spId = ns.id;
      this.onEvent({ type: 'speciation', species: ns, parent: sp });
    }
    this.births++;
    this.spawn(this.cell[i], tmp, 0, spId, childE, this.generation[i] + 1);
  }

  updateSpecies() {
    for (const sp of this.speciesById.values()) { sp.count = 0; sp.sum.fill(0); }
    for (let i = 0; i < this.hi; i++) {
      if (!this.alive[i]) continue;
      const sp = this.speciesById.get(this.species[i]);
      sp.count++;
      for (let k = 0; k < G; k++) sp.sum[k] += this.genes[i * G + k];
    }
    for (const sp of this.speciesById.values()) {
      if (sp.count > sp.peak) sp.peak = sp.count;
      // the species' reference genome slowly follows its population mean, so gradual
      // change within a lineage doesn't count as speciation; only real splits do
      if (sp.count > 0) {
        for (let k = 0; k < G; k++) if (k !== GENE.HUE) sp.proto[k] += 0.05 * (sp.sum[k] / sp.count - sp.proto[k]);
      }
      if (sp.count === 0 && sp.died < 0) {
        sp.died = this.tick;
        if (sp.peak >= 15) this.onEvent({ type: 'extinction', species: sp });
      }
      if (sp.count > 0 && sp.died >= 0) sp.died = -1; // (can't really happen, but be safe)
    }
  }

  // mean decoded traits of a species
  speciesTraits(sp) {
    if (sp.count === 0) return decode(sp.proto);
    const m = new Float32Array(G);
    for (let k = 0; k < G; k++) m[k] = sp.sum[k] / sp.count;
    m[GENE.HUE] = sp.proto[GENE.HUE];
    return decode(m);
  }

  livingSpecies() {
    return [...this.speciesById.values()].filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  }

  // kill everything within an angular radius of a cell
  disaster(cell, radius) {
    const { pos } = this.planet.grid;
    const cx = pos[cell * 3], cy = pos[cell * 3 + 1], cz = pos[cell * 3 + 2];
    const cosR = Math.cos(radius);
    let killed = 0;
    for (let i = 0; i < this.hi; i++) {
      if (!this.alive[i]) continue;
      const c = this.cell[i];
      const d = cx * pos[c * 3] + cy * pos[c * 3 + 1] + cz * pos[c * 3 + 2];
      if (d > cosR) { this.kill(i, 'disaster'); killed++; }
    }
    return killed;
  }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export function speciesColor(sp, light = 0.55) {
  return hslToRgb(sp.proto[GENE.HUE], 0.68, light);
}

export function hslToRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
