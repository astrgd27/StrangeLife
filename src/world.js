// World = planet + life + time, history and milestones. Still render-free.

import { Planet, BIOMES } from './planet.js';
import { Life, PRESETS, decode } from './life.js';
import { mulberry32 } from './rng.js';

export const YEARS_PER_TICK = 10000;

export class World {
  constructor(seed = 1, opts = {}) {
    this.seed = seed;
    this.planet = new Planet(seed, opts.level ?? 6);
    this.rng = mulberry32(seed * 7919 + 13);
    this.life = new Life(this.planet, this.rng, opts.maxCreatures ?? 6000);
    this.tick = 0;
    this.history = [];      // sampled stats
    this.historyEvery = 5;
    this.milestones = new Set();
    this.listeners = [];
    this.life.onEvent = (e) => this.emit(e);
    this.seedFirstLife();
  }

  on(fn) { this.listeners.push(fn); }
  emit(e) { e.tick = this.tick; for (const fn of this.listeners) fn(e); }

  seedFirstLife() {
    // Life begins in a warm shallow sea
    const P = this.planet;
    let best = -1, bestScore = -Infinity;
    for (let k = 0; k < 400; k++) {
      const c = Math.floor(this.rng() * P.n);
      if (!P.water[c]) continue;
      const s = -Math.abs(P.temp[c] - 22) + (P.biome[c] === 1 ? 6 : 0);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (best < 0) best = 0;
    this.origin = best;
    this.life.seed(best, PRESETS.algae.genes, 60, 'Protocella primordialis');
  }

  step() {
    this.tick++;
    this.planet.step(this.tick);
    this.life.step();
    if (this.tick % this.historyEvery === 0) this.sample();
    if (this.tick % 10 === 0) this.checkMilestones();
  }

  sample() {
    const L = this.life, P = this.planet;
    const bySpecies = {};
    let land = 0, sea = 0, carn = 0;
    let established = 0;
    for (const sp of L.speciesById.values()) if (sp.count > 0) { bySpecies[sp.id] = sp.count; if (sp.count >= 5) established++; }
    for (let i = 0; i < L.hi; i++) {
      if (!L.alive[i]) continue;
      if (P.water[L.cell[i]]) sea++; else land++;
      if (L.genes[i * 8 + 2] > 0.6) carn++;
    }
    let t = 0, plants = 0;
    for (let i = 0; i < P.n; i++) { t += P.temp[i]; plants += P.plant[i]; }
    this.history.push({
      tick: this.tick, pop: L.count, land, sea, carn, bySpecies,
      species: Object.keys(bySpecies).length, established, temp: t / P.n, plants: plants / P.n,
    });
    if (this.history.length > 600) {
      // thin out old history, keep it bounded
      this.history = this.history.filter((_, i) => i % 2 === 0 || i > 400);
    }
  }

  checkMilestones() {
    const L = this.life;
    const once = (key, text) => {
      if (this.milestones.has(key)) return;
      this.milestones.add(key);
      this.emit({ type: 'milestone', text });
    };
    const living = L.livingSpecies().filter((s) => s.count >= 5);
    for (const sp of living) {
      if (sp.count < 12 || sp.seeded) continue;
      const t = L.speciesTraits(sp);
      if (t.aquatic < 0.65 && t.aquatic > 0.35) once('amphibian', `${sp.name} can survive both in water and on land.`);
      if (t.aquatic < 0.3) once('land', `Life conquers the land! ${sp.name} walks on dry ground.`);
      if (t.diet > 0.6) once('predator', `The first predator evolves: ${sp.name}.`);
      if (t.diet > 0.35 && t.diet < 0.6) once('omnivore', `${sp.name} eats both plants and animals.`);
      if (t.size > 2.2) once('mega', `Megafauna! ${sp.name} grows to enormous size.`);
      if (t.tempPref < -4) once('polar', `${sp.name} has adapted to the polar cold.`);
      if (t.speed > 1.2) once('fast', `${sp.name} evolves to be a swift runner.`);
    }
    if (living.length >= 10) once('sp10', 'Biodiversity blooms: 10 living species.');
    if (living.length >= 25) once('sp25', 'A thriving biosphere: 25 living species.');
    if (living.length >= 50) once('sp50', 'Explosion of life: 50 living species!');
    if (L.count === 0 && this.tick > 5) once('dead', 'All life on the planet has died out. Seed new life with the 🧬 tool.');

    // mass extinction detection: lost >40% of species in the last 100 ticks
    const h = this.history;
    if (h.length > 20) {
      const then = h[h.length - 21], now = h[h.length - 1];
      if (then.established >= 15 && now.established < then.established * 0.5 && this.tick - (this.lastMassExt || -999) > 300) {
        this.lastMassExt = this.tick;
        this.emit({ type: 'milestone', text: `Mass extinction! Species fell from ${then.established} to ${now.established}.`, bad: true });
      }
    }
  }

  // ---- convenience for the UI ----
  get years() { return this.tick * YEARS_PER_TICK; }

  describeCell(c) {
    const P = this.planet;
    return {
      biome: BIOMES[P.biome[c]].name,
      temp: P.temp[c],
      moist: P.moist[c],
      elev: (P.elev[c] - P.seaLevel),
      plant: P.plant[c],
      K: P.K[c],
      water: !!P.water[c],
      creatures: this.life.cellCount[c],
    };
  }

  creatureInfo(i) {
    const L = this.life;
    if (!L.alive[i]) return null;
    const sp = L.speciesById.get(L.species[i]);
    return { index: i, species: sp, traits: decode(L.genes, i * 8), energy: L.energy[i], age: L.age[i], generation: L.generation[i], cell: L.cell[i] };
  }
}
