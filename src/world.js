// World = planet + biosphere + deep time, abiogenesis, natural events, history and milestones.
// Render-free, so it can run headless.

import { Planet, BIOMES, B } from './planet.js';
import { Ecosystem, GRADES, KINGDOM_KEYS, TROPHIC } from './ecosystem.js';
import { mulberry32 } from './rng.js';
import { storyByKey } from './science.js';

// The four eons of Earth's history. Time runs fast while only microbes live and slows down once
// complex life appears, so the whole story fits into a game session.
export const EONS = [
  { name: 'Hadean', yearsPerTick: 0.8e6, blurb: 'A scalding, bombarded world with no life.' },
  { name: 'Archean', yearsPerTick: 0.6e6, blurb: 'Microbes under an oxygen-free sky.' },
  { name: 'Proterozoic', yearsPerTick: 0.5e6, blurb: 'Oxygen builds up; complex cells appear.' },
  { name: 'Phanerozoic', yearsPerTick: 0.05e6, blurb: 'The age of visible, complex life.' },
];

export function formatYears(y) {
  if (y >= 1e9) return `${(y / 1e9).toFixed(2)} Gyr`;
  if (y >= 1e6) return `${(y / 1e6).toFixed(y >= 1e8 ? 0 : 1)} Myr`;
  return `${Math.round(y / 1e3)} kyr`;
}

export class World {
  constructor(seed = 1, opts = {}) {
    this.seed = seed;
    this.scenario = opts.scenario ?? 'barren';
    this.planet = new Planet(seed, opts.level ?? 6, this.scenario);
    this.rng = mulberry32(seed * 7919 + 13);
    this.eco = new Ecosystem(this.planet, this.rng);
    this.tick = 0;
    this.years = this.planet.startYears;
    this.eon = 0;
    this.eonTicks = [{ tick: 0, eon: 0 }];
    this.history = [];      // sampled stats
    this.historyEvery = 5;
    this.milestones = new Map(); // key -> { tick, years }
    this.listeners = [];
    this.naturalEvents = true;
    this.abiogenesis = 0;   // progress of prebiotic chemistry toward the first cell, 0..1
    this.lifePotential = 0;
    this.bestCell = -1;
    this.lifeBegan = false;
    this.snowball = false;
    this.eco.onEvent = (e) => this.onEco(e);
    this.setupScenario();
    this.stepAbiogenesis();
    this.sample();
  }

  on(fn) { this.listeners.push(fn); }
  emit(e) { e.tick = this.tick; e.years = this.years; for (const fn of this.listeners) fn(e); }

  onEco(e) {
    if (e.type === 'transition') {
      if (!this.milestones.has(e.key)) this.achieve([e.key]);
      else this.emit({ type: 'lineage', species: e.species, parent: e.parent });
      if (e.key === 'cambrian') this.setEon(3);
    } else if (e.type === 'sex') {
      this.achieve(['sex']);
    } else {
      this.emit(e);
    }
  }

  get life() { return this.eco; }

  setupScenario() {
    const P = this.planet, E = this.eco;
    const zone = (pred) => E.zoneOf[this.randomCell(pred)];
    if (this.scenario === 'microbial') {
      this.achieve(['oceans', 'soup', 'rna'], true);
      this.startLife(this.findWarmShallowSea());
      this.setEon(1);
    } else if (this.scenario === 'oxygen') {
      this.achieve(['oceans', 'soup', 'rna', 'life', 'archaea', 'photosynthesis', 'goe', 'ozone', 'eukaryote', 'sex', 'algae', 'multicellular', 'fungi', 'animals', 'cambrian', 'landplants', 'forests', 'mycorrhiza', 'landanimals', 'vertebrates'], true);
      ['archaea', 'photosynthesis', 'eukaryote', 'algae', 'multicellular', 'fungi', 'animals', 'cambrian', 'landplants', 'forests', 'mycorrhiza', 'landanimals', 'vertebrates'].forEach((k) => E.innovations.add(k));
      this.lifeBegan = true;
      const sea = (t0 = 0, t1 = 30) => zone((c) => P.water[c] && P.temp[c] > t0 && P.temp[c] < t1);
      const land = (t0 = 0, t1 = 30) => zone((c) => !P.water[c] && P.K[c] > 0.3 && P.temp[c] > t0 && P.temp[c] < t1);
      const coast = () => zone((c) => !P.water[c] && P.oceanDist[c] === 1 && P.temp[c] > 5);
      const S = (g, z, o) => E.seed(g, z, { amount: 0.15, ...o });
      S('bacteria', sea(), { trophic: TROPHIC.DECOMP });
      S('archaea', sea(10, 40));
      S('cyano', sea(10, 30)); S('cyano', sea(-5, 12));
      S('algae', sea(5, 25)); S('algae', sea(15, 30));
      S('seaweed', sea(0, 15)); S('seaweed', sea(12, 28));
      S('protist', sea());
      S('fungi', sea());
      S('mushroom', land(), { habitat: 2 });
      S('fern', land(15, 35)); S('fern', land(0, 15));
      S('moss', coast(), { habitat: 1 });
      S('sponge', sea(10, 30));
      S('arthropod', sea(5, 25)); S('arthropod', sea(5, 25), { trophic: TROPHIC.PREDATOR });
      S('insect', land(10, 30), { habitat: 2 }); S('insect', land(0, 20), { habitat: 2 });
      S('fish', sea(5, 25)); S('fish', sea(5, 25), { trophic: TROPHIC.PREDATOR });
      for (const sp of E.species.values()) sp.seeded = false;
      this.setEon(3);
    }
  }

  randomCell(pred) {
    for (let k = 0; k < 20000; k++) {
      const c = Math.floor(this.rng() * this.planet.n);
      if (pred(c)) return c;
    }
    return 0;
  }

  findWarmShallowSea() {
    const P = this.planet;
    let best = 0, bestScore = -Infinity;
    for (let k = 0; k < 800; k++) {
      const c = Math.floor(this.rng() * P.n);
      if (!P.water[c]) continue;
      const s = -Math.abs(P.temp[c] - 30) + P.volc[c] * 10 + (P.landDist[c] <= 2 ? 6 : 0);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  }

  startLife(cell) {
    this.lifeBegan = true;
    this.origin = cell;
    const z = this.eco.zoneOf[cell];
    const sp = this.eco.seed('bacteria', z, { name: 'Protobacter primordialis', trophic: TROPHIC.CHEMO, habitat: 0, pref: this.planet.temp[cell], amount: 0.05 });
    if (sp) sp.seeded = false;
    this.achieve(['life']);
    this.setEon(Math.max(this.eon, 1));
    return sp;
  }

  setEon(e) {
    if (e <= this.eon) return;
    this.eon = e;
    this.eonTicks.push({ tick: this.tick, eon: e });
    this.emit({ type: 'eon', eon: e });
  }

  achieve(keys, silent = false) {
    for (const key of keys) {
      if (this.milestones.has(key)) continue;
      this.milestones.set(key, { tick: this.tick, years: this.years });
      if (!silent) this.emit({ type: 'milestone', key, text: storyByKey[key]?.title, major: !!storyByKey[key] });
    }
  }

  step() {
    this.tick++;
    this.years += EONS[this.eon].yearsPerTick;
    const P = this.planet;
    P.step(this.tick);
    if (this.tick % 6 === 0) this.eco.updateEnvironment();
    this.eco.step(this.years);
    if (this.eco.alive.length === 0) this.stepAbiogenesis();
    if (this.naturalEvents) this.naturalDisasters();
    if (this.tick % this.historyEvery === 0) this.sample();
    if (this.tick % 10 === 0) this.checkMilestones();
  }

  // ---------- origin of life ----------

  // How close is a patch of sea to brewing life? Organic concentration × a temperature window
  // where RNA is stable enough to copy itself.
  stepAbiogenesis() {
    const P = this.planet;
    let best = 0, bestCell = -1, liquid = 0, maxOrg = 0;
    for (let c = 0; c < P.n; c++) {
      if (!P.water[c]) continue;
      const T = P.temp[c];
      if (T > -2 && T < 75) liquid++;
      const o = P.organics[c];
      if (o > maxOrg && T < 75 && T > -2) maxOrg = o;
      if (o < 1) continue;
      const suit = T < -2 || T > 70 ? 0 : T < 5 ? (T + 2) / 7 : T <= 50 ? 1 : (70 - T) / 20;
      const pot = o * suit;
      if (pot > best) { best = pot; bestCell = c; }
    }
    this.liquidFrac = liquid / P.n;
    this.maxOrganics = maxOrg;
    this.lifePotential = best;
    this.bestCell = bestCell;
    if (this.tick === 0) return;
    if (best > 1.5) this.abiogenesis += 0.0018 * Math.min(3, best - 1.5);
    else this.abiogenesis = Math.max(0, this.abiogenesis - 0.0008);
    if (this.abiogenesis >= 1 && bestCell >= 0) {
      this.abiogenesis = 0;
      this.startLife(bestCell);
    }
  }

  // ---------- natural events ----------

  naturalDisasters() {
    const P = this.planet, rng = this.rng;
    // early heavy bombardment of icy comets: water and organics from space
    if (rng() < 0.012 * Math.exp(-P.age / 1200) + 0.0004) {
      const c = Math.floor(rng() * P.n);
      this.comet(c);
      this.emit({ type: 'comet', cell: c, natural: true });
    }
    // rare large asteroid once complex life is around
    if (this.eon >= 3 && this.tick - (this.lastAsteroid ?? -1e9) > 4000 && rng() < 0.00004) {
      this.lastAsteroid = this.tick;
      const c = Math.floor(rng() * P.n);
      this.asteroid(c);
      this.emit({ type: 'asteroid', cell: c, natural: true });
    }
  }

  comet(c) {
    this.planet.comet(c);
    this.eco.disaster(this.eco.zoneOf[c], 0.05);
  }

  asteroid(c) {
    const lost = this.eco.disaster(this.eco.zoneOf[c], 0.3);
    this.eco.dieOff(0.45); // impact winter
    this.planet.impact(c);
    return lost;
  }

  // ---------- bookkeeping ----------

  sample() {
    const E = this.eco, P = this.planet;
    const bySpecies = {};
    for (const s of E.alive) bySpecies[E.slots[s].id] = E.slots[s].range;
    const kingdoms = {};
    KINGDOM_KEYS.forEach((k, i) => (kingdoms[k] = { species: 0, range: E.kRange ? E.kRange[i] : 0 }));
    for (const s of E.alive) kingdoms[E.slots[s].kingdom].species++;
    const lifeZones = E.lifeZones || 0;
    this.history.push({
      tick: this.tick, years: this.years, bySpecies, kingdoms,
      species: E.alive.length, lifeZones: lifeZones / E.Z,
      temp: P.meanT, o2: P.o2, co2: P.co2, eon: this.eon,
    });
    if (this.history.length > 600) this.history = this.history.filter((_, i) => i % 2 === 0 || i > 400);
  }

  checkMilestones() {
    const E = this.eco, P = this.planet;
    if (this.liquidFrac > 0.08) this.achieve(['oceans']);
    if (this.maxOrganics > 1.5) this.achieve(['soup']);
    if (this.abiogenesis > 0.5) this.achieve(['rna']);
    if (P.iron <= 0 && this.lifeBegan) { this.achieve(['goe']); this.setEon(2); }
    if (P.ozone >= 0.5 && this.lifeBegan) this.achieve(['ozone']);

    if (P.iceFrac > 0.45 && !this.snowball) { this.snowball = true; this.emit({ type: 'milestone', key: 'snowball-' + this.tick, event: 'snowball', text: 'The planet freezes over: a snowball world.', bad: true }); }
    if (this.snowball && P.iceFrac < 0.2) { this.snowball = false; this.emit({ type: 'milestone', key: 'thaw-' + this.tick, text: 'The ice retreats: the snowball thaws.' }); }

    if (E.alive.length === 0 && this.lifeBegan && !this.deadNoted) {
      this.deadNoted = true;
      this.emit({ type: 'milestone', key: 'dead', text: 'All life on the planet has died out. It may arise again if conditions allow, or seed it with the 🧬 tool.', bad: true });
    }
    if (E.alive.length > 0) this.deadNoted = false;

    // mass extinction: lost half the species within ~100 ticks
    const h = this.history;
    if (h.length > 20) {
      const then = h[h.length - 21], now = h[h.length - 1];
      if (then.species >= 12 && now.species < then.species * 0.5 && this.tick - (this.lastMassExt || -999) > 300) {
        this.lastMassExt = this.tick;
        this.emit({ type: 'milestone', key: 'massext-' + this.tick, event: 'massext', text: `Mass extinction! Species fell from ${then.species} to ${now.species}.`, bad: true });
      }
    }
  }

  // ---- convenience for the UI ----

  describeCell(c) {
    const P = this.planet;
    let biome = BIOMES[P.biome[c]].name;
    if (!P.water[c] && P.plant[c] < 0.02 && P.biome[c] !== B.ICE && P.biome[c] !== B.MOUNTAIN) biome = P.volc[c] > 0.4 ? 'Volcanic rock' : 'Bare rock';
    const z = this.eco.zoneOf[c];
    return {
      biome, zone: z,
      temp: P.temp[c], moist: P.moist[c], elev: P.elev[c] - P.seaLevel,
      plant: P.plant[c], K: P.K[c], organics: P.organics[c], volc: P.volc[c], water: !!P.water[c],
      life: this.eco.speciesIn(z),
    };
  }
}

export { GRADES, KINGDOM_KEYS };
