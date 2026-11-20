// Life as populations spread across zones, in the spirit of SimEarth.
//
// The planet's fine terrain grid (40,962 cells) is grouped into 2,562 zones. Each zone holds the
// biomass of every species living there. Every tick, populations grow, eat and die according to
// simple ecology (logistic growth for producers, saturating feeding for consumers, a shared food
// pool per trophic level), and some of each population disperses to neighbouring zones. That is
// how life spreads across the globe.
//
// Evolution happens at the species level:
//   - anagenesis: each species slowly adapts its preferred temperature to where it lives
//   - speciation: a population at the edge of the range splits off as a new species with
//     slightly different traits (a new temperature niche, diet, habitat or body size)
//   - major transitions: rare events that found new lineages (endosymbiosis, multicellularity,
//     the move onto land, vertebrates, flowers...) once the planet allows them

import { makeGeodesicGrid } from './planet.js';
import { gaussian } from './rng.js';
import { genusName, speciesEpithet } from './names.js';

export const ZONE_LEVEL = 4;
const MAXT = 160;            // species slots
const SOFT_CAP = 80;         // speciation slows above this many living species
const SPEC_CAP = MAXT - 25;  // ordinary speciation stops here, keeping slots free for major transitions
const EXTINCT = 1e-5;

// trophic modes
export const TROPHIC = { CHEMO: 0, PHOTO: 1, DECOMP: 2, GRAZER: 3, PREDATOR: 4, OMNI: 5 };
export const TROPHIC_NAMES = ['Chemotroph', 'Photosynthesiser', 'Decomposer', 'Grazer', 'Predator', 'Omnivore'];
export const HABITAT_NAMES = ['Marine', 'Coastal', 'Land'];
// prey pools that a species' biomass counts toward
const POOL = { NONE: -1, MICRO: 0, PROD: 1, HERB: 2 };

export const KINGDOMS = {
  bacteria: { name: 'Bacteria', domain: 'Bacteria', color: '#6f93bd' },
  archaea: { name: 'Archaea', domain: 'Archaea', color: '#a57ad8' },
  protist: { name: 'Protists', domain: 'Eukaryotes', color: '#3fb4a6' },
  plant: { name: 'Plants & algae', domain: 'Eukaryotes', color: '#58b55c' },
  fungus: { name: 'Fungi', domain: 'Eukaryotes', color: '#b8895a' },
  animal: { name: 'Animals', domain: 'Eukaryotes', color: '#e3a33e' },
};
export const KINGDOM_KEYS = Object.keys(KINGDOMS);

// Grades of organisation. `tier` is a 0–6 complexity score. Ecology parameters:
// r growth (producers), imax/half feeding, e conversion efficiency, m mortality, kmul share of light,
// o2 needed (% of atmosphere), disp dispersal, tol temperature tolerance (°C, 1 s.d.).
export const GRADES = {
  bacteria: { kingdom: 'bacteria', name: 'Bacteria', tier: 0, size: '1–5 µm', habitats: [0, 1], trophics: [0, 2], icon: '🦠', imax: 0.3, half: 0.2, e: 0.55, m: 0.03, o2: 0, disp: 0.08, tol: 14, self: 0.2 },
  archaea: { kingdom: 'archaea', name: 'Archaea', tier: 0, size: '1–5 µm', habitats: [0, 1], trophics: [0, 2], icon: '♨️', imax: 0.28, half: 0.2, e: 0.5, m: 0.028, o2: 0, disp: 0.07, tol: 18, self: 0.2 },
  cyano: { kingdom: 'bacteria', name: 'Cyanobacteria', tier: 0, size: '1–10 µm', habitats: [0, 1], trophics: [1], icon: '🟢', r: 0.12, kmul: 0.55, m: 0.004, o2: 0, disp: 0.08, tol: 13 },
  protist: { kingdom: 'protist', name: 'Protists', tier: 1, size: '10–100 µm', habitats: [0, 1], trophics: [3, 4], icon: '🧫', imax: 0.25, half: 0.05, e: 0.35, m: 0.025, o2: 0.4, disp: 0.07, tol: 11, self: 0.3 },
  algae: { kingdom: 'plant', name: 'Algae', tier: 1, size: '10 µm–1 mm', habitats: [0, 1], trophics: [1], icon: '🍃', r: 0.15, kmul: 0.7, m: 0.004, o2: 0.4, disp: 0.06, tol: 11 },
  seaweed: { kingdom: 'plant', name: 'Seaweeds', tier: 2, size: 'cm–30 m', habitats: [0, 1], trophics: [1], icon: '🌿', r: 0.1, kmul: 0.9, m: 0.003, o2: 2, disp: 0.04, tol: 10 },
  moss: { kingdom: 'plant', name: 'Mosses', tier: 3, size: 'mm–cm', habitats: [1, 2], trophics: [1], icon: '🌱', r: 0.08, kmul: 0.45, m: 0.003, o2: 3, disp: 0.03, tol: 12 },
  fern: { kingdom: 'plant', name: 'Ferns & horsetails', tier: 4, size: 'cm–20 m', habitats: [2], trophics: [1], icon: '🌴', r: 0.07, kmul: 0.7, m: 0.003, o2: 6, disp: 0.03, tol: 9 },
  conifer: { kingdom: 'plant', name: 'Conifers', tier: 5, size: '1–100 m', habitats: [2], trophics: [1], icon: '🌲', r: 0.06, kmul: 0.85, m: 0.002, o2: 8, disp: 0.025, tol: 10 },
  flower: { kingdom: 'plant', name: 'Flowering plants', tier: 6, size: 'mm–100 m', habitats: [2, 1], trophics: [1], icon: '🌸', r: 0.08, kmul: 1.0, m: 0.002, o2: 8, disp: 0.04, tol: 9 },
  fungi: { kingdom: 'fungus', name: 'Molds & yeasts', tier: 2, size: 'µm–cm', habitats: [0, 1], trophics: [2], icon: '🍄', imax: 0.2, half: 0.05, e: 0.35, m: 0.02, o2: 1, disp: 0.05, tol: 11, self: 0.3 },
  mushroom: { kingdom: 'fungus', name: 'Mushrooms & mycorrhizae', tier: 3, size: 'cm–km', habitats: [2], trophics: [2], icon: '🍄', imax: 0.2, half: 0.04, e: 0.35, m: 0.015, o2: 4, disp: 0.05, tol: 10, self: 0.3 },
  sponge: { kingdom: 'animal', name: 'Sponges & cnidarians', tier: 2, size: 'mm–m', habitats: [0], trophics: [3, 4], icon: '🪸', imax: 0.15, half: 0.1, e: 0.3, m: 0.015, o2: 3, disp: 0.02, tol: 8, self: 0.5 },
  arthropod: { kingdom: 'animal', name: 'Arthropods & worms', tier: 3, size: 'mm–1 m', habitats: [0, 1], trophics: [3, 4, 5], icon: '🦐', imax: 0.15, half: 0.08, e: 0.25, m: 0.015, o2: 7, disp: 0.04, tol: 8, self: 0.5 },
  insect: { kingdom: 'animal', name: 'Insects & spiders', tier: 3, size: 'mm–70 cm', habitats: [2, 1], trophics: [3, 4, 5], icon: '🐞', imax: 0.16, half: 0.06, e: 0.25, m: 0.016, o2: 8, disp: 0.06, tol: 8, self: 0.5 },
  fish: { kingdom: 'animal', name: 'Fish', tier: 4, size: 'cm–15 m', habitats: [0, 1], trophics: [3, 4, 5], icon: '🐟', imax: 0.12, half: 0.08, e: 0.25, m: 0.012, o2: 10, disp: 0.06, tol: 8, self: 0.5 },
  amphibian: { kingdom: 'animal', name: 'Amphibians', tier: 4, size: 'cm–5 m', habitats: [1], trophics: [4, 5], icon: '🐸', imax: 0.11, half: 0.07, e: 0.25, m: 0.012, o2: 11, disp: 0.03, tol: 7, self: 0.5 },
  reptile: { kingdom: 'animal', name: 'Reptiles', tier: 5, size: 'cm–40 m', habitats: [2, 1], trophics: [3, 4, 5], icon: '🦎', imax: 0.1, half: 0.07, e: 0.25, m: 0.01, o2: 11, disp: 0.035, tol: 8, self: 0.5 },
  mammal: { kingdom: 'animal', name: 'Mammals', tier: 5, size: 'cm–6 m', habitats: [2, 1], trophics: [3, 4, 5], icon: '🦌', imax: 0.13, half: 0.06, e: 0.3, m: 0.013, o2: 12, disp: 0.04, tol: 12, self: 0.5 },
  bird: { kingdom: 'animal', name: 'Birds', tier: 5, size: 'cm–3 m', habitats: [2, 1], trophics: [3, 4, 5], icon: '🐦', imax: 0.13, half: 0.06, e: 0.3, m: 0.013, o2: 12, disp: 0.1, tol: 12, self: 0.5 },
  whale: { kingdom: 'animal', name: 'Marine mammals', tier: 5, size: '1–30 m', habitats: [0], trophics: [4, 3], icon: '🐋', imax: 0.12, half: 0.06, e: 0.3, m: 0.011, o2: 12, disp: 0.08, tol: 12, self: 0.5 },
  sapient: { kingdom: 'animal', name: 'Intelligent life', tier: 6, size: '1–2 m', habitats: [2, 1], trophics: [5], icon: '🧠', imax: 0.12, half: 0.03, e: 0.35, m: 0.01, o2: 14, disp: 0.06, tol: 22, self: 0.4 },
};
export const GRADE_KEYS = Object.keys(GRADES);

// How narrowly each kind of life specialises on the second niche axis (rainfall on land, water
// depth at sea) and on altitude. Microbes are generalists; plants are picky about rainfall.
export function nicheTol(grade) {
  const G = GRADES[grade];
  if (grade === 'sapient') return { n2: 1.2, alt: 1.2 };
  if (G.tier === 0) return { n2: 0.6, alt: 0.6 };
  if (G.kingdom === 'plant') return { n2: 0.22, alt: 0.25 };
  if (G.kingdom === 'fungus') return { n2: 0.35, alt: 0.4 };
  if (G.kingdom === 'protist') return { n2: 0.45, alt: 0.5 };
  if (grade === 'mammal' || grade === 'bird' || grade === 'whale') return { n2: 0.45, alt: 0.5 };
  return { n2: 0.38, alt: 0.4 };
}

// Niche bins for diversity-dependence and competitive exclusion: same group, habitat, diet,
// ~8 °C temperature band, rainfall/depth third, and host plant.
function nicheKey(sp) {
  return `${sp.grade}|${sp.habitat}|${sp.trophic}|${Math.floor((sp.pref + 40) / 8)}|${Math.min(2, Math.floor(sp.n2 * 3))}|${sp.host || 0}`;
}

// How many species a single group (e.g. seaweeds, insects) tends to hold before its splitting
// slows. Animals, insects above all, are where most of Earth's species are.
const GROUP_CAP = { bacteria: 8, archaea: 6, protist: 8, plant: 10, fungus: 8, animal: 22 };

// how strongly mate choice drives speciation (birds and fish are famous for it)
const SEXUAL_SELECTION = { bird: 2, fish: 1.5, insect: 1, mammal: 0.8, reptile: 0.8, amphibian: 0.8, arthropod: 0.6 };

// icon variants within a grade (by diet and size)
function pickIcon(g, trophic, size) {
  if (g === 'fish') return trophic === TROPHIC.PREDATOR ? '🦈' : '🐟';
  if (g === 'arthropod') return trophic === TROPHIC.PREDATOR ? '🦀' : '🦐';
  if (g === 'insect') return trophic === TROPHIC.PREDATOR ? '🕷️' : '🐞';
  if (g === 'reptile') return size > 0.65 ? (trophic === TROPHIC.PREDATOR ? '🦖' : '🦕') : trophic === TROPHIC.PREDATOR ? '🐊' : '🦎';
  if (g === 'mammal') return trophic === TROPHIC.PREDATOR ? '🐺' : trophic === TROPHIC.OMNI ? (size < 0.3 ? '🐭' : '🐻') : size > 0.7 ? '🐘' : '🦌';
  if (g === 'bird') return trophic === TROPHIC.PREDATOR ? '🦅' : '🐦';
  if (g === 'whale') return trophic === TROPHIC.PREDATOR ? '🐬' : '🐋';
  if (g === 'flower') return size > 0.6 ? '🌳' : '🌸';
  if (g === 'protist' && trophic === TROPHIC.PREDATOR) return '🧫';
  if (g === 'bacteria' && trophic === TROPHIC.DECOMP) return '🦠';
  return GRADES[g].icon;
}

// Major transitions: rare events that found a new lineage. `need` checks the planet and the zone.
export const TRANSITIONS = [
  { from: 'bacteria', to: 'archaea', p: 0.004, key: 'archaea', need: () => true },
  { from: 'bacteria', to: 'cyano', p: 0.0012, key: 'photosynthesis', need: (E, z) => E.zSea[z] > 0.2 },
  // endosymbiosis: an archaeal host engulfs a bacterium that becomes its mitochondrion
  { from: 'archaea', to: 'protist', p: 0.003, key: 'eukaryote', need: (E, z) => E.planet.o2 >= 0.4 && E.kingdomIn(z, 'bacteria') },
  // a protist engulfs a cyanobacterium: the chloroplast
  { from: 'protist', to: 'algae', p: 0.003, key: 'algae', need: (E, z) => E.gradeIn(z, 'cyano') },
  { from: 'protist', to: 'fungi', p: 0.002, key: 'fungi', need: (E) => E.planet.o2 >= 1 },
  { from: 'protist', to: 'sponge', p: 0.002, key: 'animals', need: (E) => E.planet.o2 >= 3 },
  { from: 'algae', to: 'seaweed', p: 0.003, key: 'multicellular', need: (E) => E.planet.o2 >= 2 },
  { from: 'seaweed', to: 'moss', p: 0.003, key: 'landplants', need: (E, z) => E.planet.ozone >= 0.6 && E.zLand[z] > 0.1, hab: 1 },
  { from: 'moss', to: 'fern', p: 0.002, key: 'forests', need: (E) => E.planet.o2 >= 6 },
  { from: 'fern', to: 'conifer', p: 0.0015, key: 'seeds', need: () => true },
  { from: 'conifer', to: 'flower', p: 0.0015, key: 'flowers', need: (E) => E.gradeAlive('insect') },
  { from: 'fungi', to: 'mushroom', p: 0.003, key: 'mycorrhiza', need: (E, z) => E.zLand[z] > 0.1 && E.landPlantsAlive(), hab: 2 },
  { from: 'sponge', to: 'arthropod', p: 0.003, key: 'cambrian', need: (E) => E.planet.o2 >= 7 },
  { from: 'arthropod', to: 'insect', p: 0.003, key: 'landanimals', need: (E, z) => E.planet.ozone >= 0.6 && E.zLand[z] > 0.1 && E.landPlantsAlive(), hab: 2 },
  { from: 'arthropod', to: 'fish', p: 0.002, key: 'vertebrates', need: (E) => E.planet.o2 >= 10 },
  { from: 'fish', to: 'amphibian', p: 0.002, key: 'tetrapods', need: (E, z) => E.zLand[z] > 0.1 && E.landPlantsAlive() && E.gradeAlive('insect'), hab: 1 },
  { from: 'amphibian', to: 'reptile', p: 0.002, key: 'amniotes', need: () => true, hab: 2 },
  { from: 'reptile', to: 'mammal', p: 0.0012, key: 'mammals', need: () => true },
  { from: 'reptile', to: 'bird', p: 0.001, key: 'birds', need: () => true },
  { from: 'mammal', to: 'whale', p: 0.0008, key: 'whales', need: (E, z) => E.zSea[z] > 0.2, hab: 0 },
  { from: 'mammal', to: 'sapient', p: 0.0005, key: 'intelligence', need: (E, z, sp) => E.planet.o2 >= 14 && sp.range >= 25 && E.tick - sp.born > 400 },
];

export class Ecosystem {
  constructor(planet, rng) {
    this.planet = planet;
    this.rng = rng;
    const zg = (this.zgrid = makeGeodesicGrid(ZONE_LEVEL));
    const Z = (this.Z = zg.n);
    this.B = new Float32Array(Z * MAXT);
    this.slots = new Array(MAXT).fill(null);
    this.alive = [];          // living slot indices
    this.species = new Map(); // id -> species (including extinct)
    this.nextId = 1;
    this.mutationRate = 1;
    this.transitionRate = 1;
    this.tick = 0;
    this.onEvent = () => {};
    this.innovations = new Set(); // transition keys that have happened

    // per-slot parameters, packed for speed
    this.tTroph = new Int8Array(MAXT); this.tHab = new Int8Array(MAXT); this.tPool = new Int8Array(MAXT);
    this.tPref = new Float32Array(MAXT); this.tTol = new Float32Array(MAXT);
    this.tR = new Float32Array(MAXT); this.tK = new Float32Array(MAXT); this.tM = new Float32Array(MAXT);
    this.tE = new Float32Array(MAXT); this.tImax = new Float32Array(MAXT); this.tHalf = new Float32Array(MAXT);
    this.tO2 = new Float32Array(MAXT); this.tDisp = new Float32Array(MAXT); this.tSelf = new Float32Array(MAXT);
    this.wChem = new Float32Array(MAXT); this.wMicro = new Float32Array(MAXT); this.wProd = new Float32Array(MAXT);
    this.wHerb = new Float32Array(MAXT); this.wDet = new Float32Array(MAXT);
    this.tKing = new Int8Array(MAXT);
    this.tHost = new Int16Array(MAXT).fill(-1); // specialist herbivores: slot of their host plant
    this.recentMax = 0;      // recent peak species count, for spotting post-extinction recovery
    this.specLog = {};       // recent speciation ticks per grade, for spotting adaptive radiations
    this.radiationNoted = {};
    this.total = new Float32Array(MAXT); this.range = new Int32Array(MAXT); this.sumT = new Float32Array(MAXT);

    // zones ↔ terrain cells (the first Z terrain vertices are exactly the zone centres)
    const P = planet;
    this.zoneOf = new Int32Array(P.n);
    const zp = zg.pos, tp = P.grid.pos;
    let z = 0;
    for (let c = 0; c < P.n; c++) {
      const x = tp[c * 3], y = tp[c * 3 + 1], w = tp[c * 3 + 2];
      let best = x * zp[z * 3] + y * zp[z * 3 + 1] + w * zp[z * 3 + 2], moved = true;
      while (moved) {
        moved = false;
        for (let k = zg.nbrStart[z]; k < zg.nbrStart[z + 1]; k++) {
          const m = zg.nbr[k];
          const d = x * zp[m * 3] + y * zp[m * 3 + 1] + w * zp[m * 3 + 2];
          if (d > best) { best = d; z = m; moved = true; }
        }
      }
      this.zoneOf[c] = z;
    }
    // zone environment
    this.zCells = new Uint16Array(Z);
    for (let c = 0; c < P.n; c++) this.zCells[this.zoneOf[c]]++;
    this.zSea = new Float32Array(Z); this.zLand = new Float32Array(Z);
    this.zTs = new Float32Array(Z); this.zTl = new Float32Array(Z);
    this.zKs = new Float32Array(Z); this.zKl = new Float32Array(Z);
    this.zOrg = new Float32Array(Z); this.orgFactor = new Float32Array(Z);
    // niche axes: rainfall and altitude of the land part, depth of the sea part (all 0..1)
    this.zMl = new Float32Array(Z); this.zHl = new Float32Array(Z); this.zDs = new Float32Array(Z);
    this.detS = new Float32Array(Z); this.detL = new Float32Array(Z);
    this.coverS = new Float32Array(Z); this.coverL = new Float32Array(Z);
    this.suit = new Float32Array(Z * MAXT);
    this.zStruct = new Float32Array(Z);
    // per-zone lists of the species present, so the simulation skips empty entries
    this.pres = new Uint8Array(Z * MAXT);
    this.presN = new Uint16Array(Z);
    this.updateEnvironment();
  }

  // ---------- environment ----------

  updateEnvironment() {
    const P = this.planet, Z = this.Z, zoneOf = this.zoneOf;
    const sea = new Float32Array(Z), land = new Float32Array(Z), ts = new Float32Array(Z), tl = new Float32Array(Z);
    const ks = new Float32Array(Z), kl = new Float32Array(Z), org = new Float32Array(Z), tAll = new Float32Array(Z);
    const ml = new Float32Array(Z), hl = new Float32Array(Z), ds = new Float32Array(Z);
    const depthScale = 1 / Math.max(0.3, 1 + P.seaLevel);
    for (let c = 0; c < P.n; c++) {
      const z = zoneOf[c], T = P.temp[c], b = P.biome[c];
      tAll[z] += T;
      if (P.water[c]) {
        sea[z]++; ts[z] += T; org[z] += P.organics[c];
        ds[z] += Math.min(1, (P.seaLevel - P.elev[c]) * depthScale * 1.6);
        if (b !== 2 && b !== 12) ks[z] += P.K[c] * P.light[c];
      } else if (b !== 3) {
        land[z]++; tl[z] += T; kl[z] += P.K[c] * P.light[c];
        ml[z] += P.moist[c]; hl[z] += P.heightAboveSea(c);
      }
    }
    for (let z = 0; z < Z; z++) {
      const n = this.zCells[z];
      this.zSea[z] = sea[z] / n;
      this.zLand[z] = land[z] / n;
      this.zTs[z] = sea[z] ? ts[z] / sea[z] : tAll[z] / n;
      this.zTl[z] = land[z] ? tl[z] / land[z] : tAll[z] / n;
      this.zKs[z] = ks[z] / n;
      this.zKl[z] = kl[z] / n;
      this.zOrg[z] = sea[z] ? org[z] / n : 0;
      this.zMl[z] = land[z] ? ml[z] / land[z] : 0.5;
      this.zHl[z] = land[z] ? hl[z] / land[z] : 0;
      this.zDs[z] = sea[z] ? ds[z] / sea[z] : 0.3;
    }
    // refresh a rotating share of species each call; climate changes slowly
    const nA = this.alive.length;
    for (let k = 0; k < nA; k += 4) { const s = this.alive[(k + (this.envCalls = (this.envCalls || 0) + 1)) % nA]; this.refreshSuit(s); }
  }

  // the local values of a species' niche axes in a zone
  localNiche(h, z) {
    return {
      T: h === 0 ? this.zTs[z] : h === 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]),
      n2: h === 0 ? this.zDs[z] : this.zMl[z], // depth at sea, rainfall on land and coasts
      alt: h === 2 ? this.zHl[z] : 0,
    };
  }

  // How well a species fits each zone: temperature × (rainfall or depth) × altitude, each a
  // bell curve around its preference. Cached, because climate changes slowly.
  refreshSuit(s) {
    const sp = this.slots[s];
    if (!sp) return;
    const pref = this.tPref[s], tol = this.tTol[s], h = this.tHab[s], suit = this.suit;
    const n2 = sp.n2, n2t = sp.n2tol, alt = sp.alt, altT = sp.altTol;
    for (let z = 0; z < this.Z; z++) {
      const T = h === 0 ? this.zTs[z] : h === 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]);
      const d = (T - pref) / tol;
      const e = ((h === 0 ? this.zDs[z] : this.zMl[z]) - n2) / n2t;
      const a = h === 2 ? (this.zHl[z] - alt) / altT : 0;
      // temperature limits survival outright; rainfall/depth and altitude shape how well a
      // species does (a mismatch costs up to 70% of its performance, not its life)
      suit[z * MAXT + s] = Math.exp(-0.5 * d * d) * (0.3 + 0.7 * Math.exp(-0.5 * (e * e + a * a)));
    }
  }

  // ---------- species ----------

  createSpecies(grade, opts) {
    let slot = this.slots.indexOf(null);
    if (slot < 0) return null;
    const G = GRADES[grade];
    const rng = this.rng;
    const parent = opts.parent ? this.species.get(opts.parent) : null;
    const trophic = opts.trophic ?? G.trophics[0];
    const habitat = opts.habitat ?? G.habitats[0];
    const size = Math.max(0, Math.min(1, opts.size ?? 0.4));
    const sameGrade = parent && parent.grade === grade;
    const sp = {
      id: this.nextId++, slot, grade, kingdom: G.kingdom,
      trophic, habitat, size,
      pref: opts.pref ?? 20, tol: opts.tol ?? G.tol,
      n2: opts.n2 ?? 0.5, n2tol: opts.n2tol ?? nicheTol(grade).n2,
      alt: opts.alt ?? 0.1, altTol: opts.altTol ?? nicheTol(grade).alt,
      host: opts.host || 0,
      sexual: opts.sexual ?? (G.tier >= 2 || G.kingdom === 'animal' || G.kingdom === 'fungus'),
      parent: parent ? parent.id : 0, born: this.tick, bornYears: opts.years ?? 0, died: -1,
      total: 0, range: 0, peak: 0, peakRange: 0, seeded: !!opts.seeded,
    };
    sp.icon = pickIcon(grade, trophic, size);
    sp.genus = sameGrade && rng() < 0.6 ? parent.genus : genusName(rng, grade);
    sp.name = opts.name || `${sp.genus} ${speciesEpithet(rng, { size: 0.3 + 2.7 * size, diet: trophic === TROPHIC.PREDATOR ? 0.9 : 0, tempPref: sp.pref, speed: 0, aquatic: habitat === 1 ? 0.5 : 1 })}`;
    sp.hue = (KINGDOM_HUES[G.kingdom] + (rng() - 0.5) * 0.12 + 1) % 1;
    this.species.set(sp.id, sp);
    this.slots[slot] = sp;
    this.alive.push(slot);
    this.setParams(sp);
    this.refreshSuit(slot);
    return sp;
  }

  setParams(sp) {
    const s = sp.slot, G = GRADES[sp.grade];
    const T = TROPHIC;
    this.tTroph[s] = sp.trophic; this.tHab[s] = sp.habitat;
    this.tKing[s] = KINGDOM_KEYS.indexOf(G.kingdom);
    this.tPref[s] = sp.pref; this.tTol[s] = sp.tol;
    // bigger bodies: slower turnover (lower mortality and feeding rate per unit mass)
    const sz = Math.pow(0.6 + sp.size, -0.25);
    this.tR[s] = (G.r || 0) * sz; this.tK[s] = G.kmul || 0;
    this.tM[s] = G.m * sz; this.tE[s] = G.e || 0; this.tImax[s] = (G.imax || 0) * sz;
    // hunters are adapted to finding sparse prey; grazers live among abundant food
    this.tHalf[s] = (G.half || 1) * (sp.trophic === TROPHIC.PREDATOR ? 0.12 : sp.trophic === TROPHIC.OMNI ? 0.35 : 1);
    this.tO2[s] = G.o2; this.tDisp[s] = G.disp; this.tSelf[s] = (G.self || 0) * (sp.sexual ? 0.75 : 1);
    // specialists are efficient on their one host plant and can't use anything else
    const host = sp.host ? this.species.get(sp.host) : null;
    this.tHost[s] = host && host.died < 0 ? host.slot : -1;
    if (this.tHost[s] >= 0) { this.tImax[s] *= 1.35; this.tHalf[s] *= 0.4; }
    // what it eats
    this.wChem[s] = this.wMicro[s] = this.wProd[s] = this.wHerb[s] = this.wDet[s] = 0;
    const animal = G.kingdom === 'animal';
    if (sp.trophic === T.CHEMO) this.wChem[s] = 1;
    else if (sp.trophic === T.DECOMP) this.wDet[s] = 1;
    else if (sp.trophic === T.GRAZER) {
      if (G.kingdom === 'protist') { this.wMicro[s] = 1; this.wProd[s] = 0.6; }
      else if (sp.grade === 'sponge') { this.wMicro[s] = 1; this.wProd[s] = 1; }
      else this.wProd[s] = 1;
    } else if (sp.trophic === T.PREDATOR) {
      if (G.kingdom === 'protist') this.wMicro[s] = 1;
      else if (sp.grade === 'sponge') { this.wHerb[s] = 0.6; this.wMicro[s] = 0.6; }
      else this.wHerb[s] = 1;
    } else if (sp.trophic === T.OMNI) { this.wProd[s] = 0.5; this.wHerb[s] = 0.6; }
    // what eats it
    if (sp.trophic === T.PHOTO) this.tPool[s] = POOL.PROD;
    else if (G.tier <= 1 && G.kingdom !== 'plant') this.tPool[s] = POOL.MICRO;
    else if (animal && (sp.trophic === T.GRAZER || sp.trophic === T.OMNI || G.tier <= 3)) this.tPool[s] = POOL.HERB;
    else this.tPool[s] = POOL.NONE;
    // intelligent life is a flexible omnivore that eats plants as well as prey
    if (sp.grade === 'sapient') { this.wProd[s] = 0.8; this.wHerb[s] = 0.8; }
  }

  extinct(slot) {
    const sp = this.slots[slot];
    sp.died = this.tick;
    sp.diedYears = this.years;
    sp.total = 0; sp.range = 0;
    for (let z = 0; z < this.Z; z++) {
      const base = z * MAXT;
      this.B[base + slot] = 0;
      let w = 0;
      for (let a = 0; a < this.presN[z]; a++) if (this.pres[base + a] !== slot) this.pres[base + w++] = this.pres[base + a];
      this.presN[z] = w;
    }
    this.slots[slot] = null;
    this.alive.splice(this.alive.indexOf(slot), 1);
    // specialists that fed on this species switch to a close relative, or broaden their diet
    for (const s of this.alive) {
      const q = this.slots[s];
      if (q.host !== sp.id) continue;
      const kin = this.alive.map((t) => this.slots[t]).filter((t) => t.grade === sp.grade && t.habitat !== 0);
      q.host = kin.length ? kin.sort((a, b) => Math.abs(a.pref - q.pref) - Math.abs(b.pref - q.pref))[0].id : 0;
      this.setParams(q);
    }
    if (sp.peakRange >= 6) this.onEvent({ type: 'extinction', species: sp });
  }

  // introduce a species into a zone and its neighbours
  introduce(sp, z, amount) {
    const zg = this.zgrid, s = sp.slot;
    const ok = (q) => this.habitatOk(sp.habitat, q);
    if (ok(z)) this.addB(z, s, amount);
    for (let k = zg.nbrStart[z]; k < zg.nbrStart[z + 1]; k++) {
      const q = zg.nbr[k];
      if (ok(q)) this.addB(q, s, amount * 0.5);
    }
  }

  // spread an existing species across every zone that suits it (for starting an established world)
  populate(sp, amount, minSuit = 0.35) {
    for (let z = 0; z < this.Z; z++) {
      if (!this.habitatOk(sp.habitat, z) || this.suit[z * MAXT + sp.slot] < minSuit) continue;
      this.addB(z, sp.slot, amount * this.suit[z * MAXT + sp.slot]);
    }
  }

  habitatOk(h, z) {
    return h === 0 ? this.zSea[z] > 0.05 : h === 2 ? this.zLand[z] > 0.05 : this.zSea[z] > 0.02 && this.zLand[z] > 0.02;
  }

  seed(grade, z, opts = {}) {
    const G = GRADES[grade];
    let habitat = opts.habitat ?? G.habitats[0];
    // pick a habitat the zone actually has
    if (!this.habitatOk(habitat, z)) habitat = G.habitats.find((h) => this.habitatOk(h, z)) ?? habitat;
    const L = this.localNiche(habitat, z);
    const sp = this.createSpecies(grade, { ...opts, habitat, pref: opts.pref ?? L.T, n2: opts.n2 ?? L.n2, alt: opts.alt ?? L.alt });
    if (!sp) return null;
    this.introduce(sp, z, opts.amount ?? (G.r ? 0.08 : 0.02));
    this.onEvent({ type: 'seed', species: sp });
    return sp;
  }

  // ---------- queries ----------

  b(z, slot) { return this.B[z * MAXT + slot]; }
  addB(z, s, amt) {
    const i = z * MAXT + s;
    if (this.B[i] === 0 && amt > 0) this.pres[z * MAXT + this.presN[z]++] = s;
    this.B[i] += amt;
  }
  kingdomIn(z, k) {
    const ki = KINGDOM_KEYS.indexOf(k);
    for (let a = 0; a < this.presN[z]; a++) { const s = this.pres[z * MAXT + a]; if (this.tKing[s] === ki && this.B[z * MAXT + s] > 1e-3) return true; }
    return false;
  }
  gradeIn(z, g) {
    for (let a = 0; a < this.presN[z]; a++) { const s = this.pres[z * MAXT + a]; if (this.slots[s]?.grade === g && this.B[z * MAXT + s] > 1e-3) return true; }
    return false;
  }
  gradeAlive(g) { return this.alive.some((s) => this.slots[s].grade === g); }
  landPlantsAlive() { return this.alive.some((s) => { const sp = this.slots[s]; return sp.kingdom === 'plant' && sp.habitat > 0 && GRADES[sp.grade].tier >= 3; }); }
  livingSpecies() { return this.alive.map((s) => this.slots[s]).sort((a, b) => b.range - a.range || b.total - a.total); }
  speciesIn(z) {
    const out = [];
    for (let a = 0; a < this.presN[z]; a++) { const s = this.pres[z * MAXT + a]; const b = this.B[z * MAXT + s]; if (b > 1e-4 && this.slots[s]) out.push({ sp: this.slots[s], b }); }
    return out.sort((a, b) => GRADES[b.sp.grade].tier - GRADES[a.sp.grade].tier || b.b - a.b);
  }

  // up to 3 icons for a zone, most notable first
  zoneIcons(z) {
    const seen = new Set(), out = [];
    const cands = [];
    for (let a = 0; a < this.presN[z]; a++) {
      const s = this.pres[z * MAXT + a];
      const b = this.B[z * MAXT + s];
      const sp = this.slots[s];
      if (!sp) continue;
      const min = sp.trophic === TROPHIC.PHOTO ? 0.02 : GRADES[sp.grade].tier <= 1 ? 0.004 : 0.002;
      if (b > min) cands.push({ sp, pri: GRADES[sp.grade].tier * 10 + Math.log10(b) });
    }
    cands.sort((a, b) => b.pri - a.pri);
    for (const c of cands) {
      if (seen.has(c.sp.icon)) continue;
      seen.add(c.sp.icon);
      out.push(c.sp);
      if (out.length === 3) break;
    }
    return out;
  }

  // ---------- simulation ----------

  step(years) {
    this.tick++;
    this.years = years;
    const P = this.planet, B = this.B, Z = this.Z, alive = this.alive;
    const o2 = P.o2, ozone = P.ozone;
    const { tTroph, tHab, tPool, tPref, tTol, tR, tK, tM, tE, tImax, tHalf, tO2, tSelf, wChem, wMicro, wProd, wHerb, wDet, tKing, tHost } = this;
    // which species build reefs (1) or forests (2)
    const engineer = this._eng || (this._eng = new Uint8Array(MAXT));
    for (const s of alive) {
      const sp = this.slots[s];
      engineer[s] = sp.grade === 'sponge' && sp.habitat === 0 ? 1 : (sp.grade === 'fern' || sp.grade === 'conifer' || sp.grade === 'flower') && sp.size > 0.45 ? 2 : 0;
    }
    const total = this.total, range = this.range, sumT = this.sumT, pres = this.pres, presN = this.presN;
    const sumN2 = this.sumN2 || (this.sumN2 = new Float32Array(MAXT)), sumA = this.sumA || (this.sumA = new Float32Array(MAXT));
    total.fill(0); range.fill(0); sumT.fill(0); sumN2.fill(0); sumA.fill(0);
    const nA = alive.length;
    const fungK = KINGDOM_KEYS.indexOf('fungus');
    const pollinators = this.gradeAlive('insect') || this.gradeAlive('bird');
    // plants with their own specialist insects get dedicated pollinators
    const pollinated = this.pollinated || (this.pollinated = new Uint8Array(MAXT));
    pollinated.fill(0);
    for (const s of alive) if (tHost[s] >= 0) pollinated[tHost[s]] = 1;
    const newB = this._newB || (this._newB = new Float32Array(MAXT));
    const suitArr = this.suit;
    const archK = KINGDOM_KEYS.indexOf('archaea');
    const archO2 = 0.03 * Math.min(1, o2 / 5); // most archaea are strict anaerobes
    let prodTotal = 0, landProd = 0;
    const kRange = this.kRange || (this.kRange = new Int32Array(KINGDOM_KEYS.length));
    kRange.fill(0);
    let lifeZones = 0;

    for (let z = 0; z < Z; z++) {
      const base = z * MAXT;
      const zs = this.zSea[z], zl = this.zLand[z];
      // food pools by habitat (sea, land)
      let microS = 0, microL = 0, prodS = 0, prodL = 0, herbS = 0, herbL = 0, fungL = 0, decS = 0, decL = 0, reef = 0, forest = 0;
      let any = false;
      const nP = presN[z];
      for (let a = 0; a < nP; a++) {
        const s = pres[base + a], b = B[base + s];
        if (b === 0) continue;
        any = true;
        const h = tHab[s], hs = h === 0 ? 1 : h === 1 ? 0.5 : 0, hl = 1 - hs;
        const p = tPool[s];
        if (p === 0) { microS += b * hs; microL += b * hl; }
        else if (p === 1) { prodS += b * hs; prodL += b * hl; }
        else if (p === 2) { herbS += b * hs; herbL += b * hl; }
        if (tTroph[s] === 2) { decS += b * hs; decL += b * hl; if (tKing[s] === fungK) fungL += b * hl; }
        const ge = engineer[s];
        if (ge === 1) reef += b; else if (ge === 2) forest += b;
      }
      if (!any) { presN[z] = 0; this.orgFactor[z] = 1; this.coverS[z] = 0; this.coverL[z] = 0; continue; }
      const detS = this.detS[z], detL = this.detL[z], org = this.zOrg[z];
      // decomposers recycle nutrients; mycorrhizal fungi feed land plants
      const nutS = 1 + 0.3 * Math.min(1, decS / 0.02);
      const nutL = 1 + 0.25 * Math.min(1, decL / 0.02) + 0.35 * Math.min(1, fungL / 0.02);
      const KS = this.zKs[z] * nutS, KL = this.zKl[z] * nutL;
      // ecosystem engineers: coral reefs in sunlit shallows and tall forests build 3D habitat,
      // with more hiding places and microhabitats, so more species can coexist in the zone
      const struct = Math.min(1, (this.zDs[z] < 0.35 ? reef / 0.02 : 0) * 0.6 + forest / (0.4 * Math.max(0.05, this.zKl[z])));
      this.zStruct[z] = struct;
      const coexist = 1 - 0.45 * struct;
      let cMicroS = 0, cMicroL = 0, cProdS = 0, cProdL = 0, cHerbS = 0, cHerbL = 0, cDetS = 0, cDetL = 0, cChem = 0;
      let deadS = 0, deadL = 0;

      for (let a = 0; a < nP; a++) {
        const s = pres[base + a];
        let b = B[base + s];
        if (b === 0) { newB[s] = 0; continue; }
        const h = tHab[s], hs = h === 0 ? 1 : h === 1 ? 0.5 : 0, hl = 1 - hs;
        const suit = suitArr[base + s];
        const o2f = tO2[s] > 0 ? Math.min(1, o2 / tO2[s]) : 1;
        let mort = tM[s] + 0.05 * (1 - suit) + 0.08 * (1 - o2f) + 0.1 * hl * (1 - ozone);
        // habitat shrinking under them (sea level, ice)
        const room = h === 0 ? zs : h === 2 ? zl : Math.min(1, 4 * Math.min(zs, zl));
        if (room < 0.03) mort += 0.2;
        if (b < 3e-4) mort += 0.04; // Allee effect: tiny populations struggle to find mates and recover
        if (tKing[s] === archK) mort += archO2;
        let nb;
        if (tTroph[s] === 1) {
          const K = (hs * KS + hl * KL * (pollinators || this.slots[s].grade !== 'flower' ? 1 : 0.6)) * tK[s] * (this.pollinated[s] ? 1.15 : 1);
          const crowd = hs * prodS + hl * prodL;
          nb = b + tR[s] * b * (suit * o2f - crowd / (K + 1e-6)) - mort * 0.3 * b;
          prodTotal += b;
          if (h > 0) landProd += b * hl;
        } else {
          const own = b;
          const fMicro = wMicro[s] * Math.max(0, hs * microS + hl * microL - (tPool[s] === 0 ? own : 0));
          const hostSlot = tHost[s];
          const fProd = wProd[s] * (hostSlot >= 0 ? B[base + hostSlot] : hs * prodS + hl * prodL);
          const fHerb = wHerb[s] * Math.max(0, hs * herbS + hl * herbL - (tPool[s] === 2 ? own : 0));
          const fDet = wDet[s] * (hs * detS + hl * detL);
          const fChem = wChem[s] * org * hs;
          const F = fMicro + fProd + fHerb + fDet + fChem;
          const I = F > 0 ? tImax[s] * F / (F + tHalf[s]) : 0;
          nb = b + b * (tE[s] * I * suit * o2f - mort - tSelf[s] * coexist * b);
          if (F > 0) {
            const eat = b * I / F;
            cMicroS += eat * fMicro * hs; cMicroL += eat * fMicro * hl;
            cProdS += eat * fProd * hs; cProdL += eat * fProd * hl;
            cHerbS += eat * fHerb * hs; cHerbL += eat * fHerb * hl;
            cDetS += eat * fDet * hs; cDetL += eat * fDet * hl;
            cChem += eat * fChem;
          }
        }
        const dead = mort * b;
        deadS += dead * hs; deadL += dead * hl;
        if (nb < EXTINCT) nb = 0;
        newB[s] = nb;
      }
      // eaten prey leave their pools
      const f = (c, pool) => (pool > 0 ? Math.max(0, 1 - c / pool) : 1);
      const fmS = f(cMicroS, microS), fmL = f(cMicroL, microL);
      const fpS = f(cProdS, prodS), fpL = f(cProdL, prodL);
      const fhS = f(cHerbS, herbS), fhL = f(cHerbL, herbL);
      let pS = 0, pL = 0, kmask = 0, w = 0;
      for (let a = 0; a < nP; a++) {
        const s = pres[base + a];
        let nb = newB[s];
        if (nb === 0) { B[base + s] = 0; continue; }
        const p = tPool[s];
        if (p >= 0) {
          const h = tHab[s], hs = h === 0 ? 1 : h === 1 ? 0.5 : 0, hl = 1 - hs;
          nb *= p === 0 ? hs * fmS + hl * fmL : p === 1 ? hs * fpS + hl * fpL : hs * fhS + hl * fhL;
          if (p === 1) { pS += nb * hs; pL += nb * hl; }
          if (nb < EXTINCT) nb = 0;
        }
        B[base + s] = nb;
        if (nb > 0) {
          pres[base + w++] = s;
          total[s] += nb; range[s]++;
          if (nb > 1e-4) kmask |= 1 << tKing[s];
          const h = tHab[s];
          sumT[s] += nb * (h === 0 ? this.zTs[z] : h === 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]));
          sumN2[s] += nb * (h === 0 ? this.zDs[z] : this.zMl[z]);
          if (h === 2) sumA[s] += nb * this.zHl[z];
        }
      }
      presN[z] = w;
      if (kmask) { lifeZones++; for (let k = 0; k < kRange.length; k++) if (kmask & (1 << k)) kRange[k]++; }
      this.detS[z] = Math.max(0, detS * 0.93 + deadS - cDetS);
      this.detL[z] = Math.max(0, detL * 0.93 + deadL - cDetL);
      this.orgFactor[z] = org > 0 ? Math.max(0, 1 - cChem / org) : 1;
      this.coverS[z] = this.zKs[z] > 0 ? Math.min(1, pS / this.zKs[z]) : 0;
      this.coverL[z] = this.zKl[z] > 0 ? Math.min(1, pL / this.zKl[z]) : 0;
    }

    this.lifeZones = lifeZones;
    if (this.tick % 4 === 0) this.disperse();
    this.evolve();
    if (this.tick % 20 === 0) this.checkIsolation();
    // tell the planet what the biosphere is doing
    P.primaryProduction = prodTotal / Z;
    P.landProduction = landProd / Z;
    this.applyToPlanet();
  }

  disperse() {
    const B = this.B, zg = this.zgrid, pres = this.pres, presN = this.presN, Z = this.Z;
    const ok = this._okCache || (this._okCache = new Uint8Array(Z * 3));
    for (let z = 0; z < Z; z++) for (let h = 0; h < 3; h++) ok[z * 3 + h] = this.habitatOk(h, z) ? 1 : 0;
    const recZ = this._recZ || (this._recZ = new Int32Array(Z * MAXT));
    const recS = this._recS || (this._recS = new Uint8Array(Z * MAXT));
    const recA = this._recA || (this._recA = new Float32Array(Z * MAXT));
    let n = 0;
    // emigration is computed from pre-dispersal populations...
    for (let z = 0; z < Z; z++) {
      const base = z * MAXT, k0 = zg.nbrStart[z], k1 = zg.nbrStart[z + 1];
      for (let a = 0; a < presN[z]; a++) {
        const s = pres[base + a], b = B[base + s];
        if (b < 1e-4) continue;
        const h = this.tHab[s];
        let cnt = 0;
        for (let k = k0; k < k1; k++) if (ok[zg.nbr[k] * 3 + h]) cnt++;
        if (!cnt) continue;
        // dispersal rises with crowding: sparse populations mostly stay put instead of
        // smearing themselves too thin to breed (runs every 4th tick)
        const out = b * Math.min(0.5, this.tDisp[s] * 4) * (b / (b + 0.0015));
        B[base + s] = b - out;
        recZ[n] = z; recS[n] = s; recA[n] = out / cnt; n++;
      }
    }
    // ...then settles in neighbouring zones that offer the right habitat
    for (let r = 0; r < n; r++) {
      const z = recZ[r], s = recS[r], share = recA[r], h = this.tHab[s];
      for (let k = zg.nbrStart[z]; k < zg.nbrStart[z + 1]; k++) {
        const q = zg.nbr[k];
        if (ok[q * 3 + h]) this.addB(q, s, share);
      }
    }
  }

  evolve() {
    const rng = this.rng;
    const nA = this.alive.length;
    const gradeCounts = {}, bins = new Map();
    for (const s of this.alive) {
      const sp = this.slots[s];
      gradeCounts[sp.grade] = (gradeCounts[sp.grade] || 0) + 1;
      const k = (sp._bin = nicheKey(sp)); // fixed for this pass; adaptation may shift the niche below
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(sp);
    }
    // Ecological opportunity: after a mass extinction, empty niches let survivors diversify
    // fast (an adaptive radiation), the way mammals did after the dinosaurs.
    if (this.tick % 20 === 0) this.recentMax = Math.max(nA, this.recentMax * 0.985);
    this.opportunity = 1 + 4 * Math.max(0, (this.recentMax - nA) / Math.max(1, this.recentMax));
    const opp = this.opportunity;
    this._bins = bins; this._gradeCounts = gradeCounts;
    for (const s of this.alive.slice()) {
      const sp = this.slots[s];
      sp.total = this.total[s]; sp.range = this.range[s];
      if (sp.range > sp.peakRange) sp.peakRange = sp.range;
      if (sp.total > sp.peak) sp.peak = sp.total;
      // too rare to persist: a few scattered stragglers don't make a viable species
      if (sp.total < 2e-4 || (sp.total < 3e-3 && sp.range <= 3 && this.tick - sp.born > 150)) { this.extinct(s); continue; }
      // anagenesis: populations adapt to the temperatures they actually live in
      if (this.tick % 5 === 0) {
        const k = 0.02 * this.mutationRate;
        sp.pref += (this.sumT[s] / sp.total - sp.pref) * k;
        sp.n2 += (this.sumN2[s] / sp.total - sp.n2) * k;
        if (sp.habitat === 2) sp.alt += (this.sumA[s] / sp.total - sp.alt) * k;
        this.tPref[s] = sp.pref;
        if (this.tick % 40 === 0) this.refreshSuit(s);
      }
      // speciation: a population splits off and goes its own way
      if (nA >= SPEC_CAP) continue;
      const rangeF = Math.max(0.2, Math.min(2.5, sp.range / 25));
      // diversity-dependent diversification: species packed into the same niche split more slowly
      const nB = bins.get(sp._bin)?.length ?? 1, nG = gradeCounts[sp.grade];
      const gCap = GROUP_CAP[sp.kingdom];
      const crowded = Math.exp(-(nB - 1) / 2) * (nG > gCap ? Math.exp(-(nG - gCap) / 4) : 1) * (nA > SOFT_CAP ? Math.exp(-(nA - SOFT_CAP) / 25) : 1);
      const pSpec = 0.0009 * this.mutationRate * rangeF * (sp.sexual ? 1.5 : 1) * crowded * opp;
      if (rng() < pSpec) this.speciate(sp, sp.grade);
      // sexual selection: in showy animals, mate choice alone can split a population
      const SS = SEXUAL_SELECTION[sp.grade];
      if (SS && sp.sexual && rng() < 0.0004 * SS * this.mutationRate * rangeF * crowded * opp) {
        const z = this.pickZone(sp);
        if (z >= 0) this.speciate(sp, sp.grade, z, null, 'sexual');
      }
    }
    // Competitive exclusion: species sharing one niche can't all persist; the rarest is squeezed
    // out. A grade with far too many species also loses its rarest.
    for (const list of bins.values()) {
      if (list.length < 4 || rng() > 0.02 * (list.length - 3)) continue;
      const worst = list.filter((q) => q.died < 0 && this.tick - q.born > 100).sort((a, b) => a.total - b.total)[0];
      if (worst) { worst.outcompeted = true; this.extinct(worst.slot); }
    }
    for (const g in gradeCounts) {
      const nG = gradeCounts[g], cap = GROUP_CAP[GRADES[g].kingdom] + 2;
      if (nG <= cap || rng() > 0.025 * (nG - cap)) continue;
      let worst = null;
      for (const s of this.alive) {
        const sp = this.slots[s];
        if (sp.grade === g && this.tick - sp.born > 100 && (!worst || sp.total < worst.total)) worst = sp;
      }
      if (worst) { worst.outcompeted = true; this.extinct(worst.slot); }
    }
    // Major transitions are rolled once per lineage pool, not per species, so their pace doesn't
    // depend on how many species there happen to be. Wider-spread lineages get more chances.
    for (const t of TRANSITIONS) {
      let weight = 0;
      const cands = [];
      for (const s of this.alive) {
        const sp = this.slots[s];
        if (sp.grade !== t.from || (t.sexual && !sp.sexual)) continue;
        const w = Math.min(60, sp.range);
        cands.push([sp, w]); weight += w;
      }
      if (!weight) continue;
      // a group that already exists and is crowded rarely gets a fresh origin
      const nTo = gradeCounts[t.to] || 0, capTo = GROUP_CAP[GRADES[t.to].kingdom];
      const repeat = this.innovations.has(t.key) ? 0.3 * (nTo > capTo / 2 ? Math.exp(-(nTo - capTo / 2) / 2) : 1) : 1;
      if (rng() >= t.p * this.transitionRate * Math.min(4, Math.max(0.6, weight / 25)) * repeat * Math.sqrt(opp)) continue;
      let r = rng() * weight, sp = cands[0][0];
      for (const [c, w] of cands) { r -= w; if (r <= 0) { sp = c; break; } }
      const z = this.pickZone(sp, (q) => t.need(this, q, sp) && (t.hab === undefined || this.habitatOk(t.hab, q)));
      if (z >= 0) this.speciate(sp, t.to, z, t);
    }
  }

  // Allopatric speciation: when a species' range breaks into pieces that can't exchange
  // migrants (an ocean opens, a mountain range or climate barrier rises), each isolated piece
  // evolves on its own. If a sizeable fragment stays cut off for long enough, it becomes a
  // separate species, adapted to its own patch of the world.
  checkIsolation() {
    const B = this.B, zg = this.zgrid, Z = this.Z;
    const comp = this._comp || (this._comp = new Int32Array(Z));
    const queue = this._queue || (this._queue = new Int32Array(Z));
    const ISOLATION_CHECKS = 6; // ~120 ticks of separation
    const nA = this.alive.length;
    if (nA >= MAXT - 5) return;
    for (const s of this.alive.slice()) {
      const sp = this.slots[s];
      if (!sp || sp.range < 6) { if (sp) sp.isolates = null; continue; }
      comp.fill(-1);
      const comps = [];
      for (let z = 0; z < Z; z++) {
        if (comp[z] >= 0 || B[z * MAXT + s] < 3e-4) continue;
        const id = comps.length, zones = [];
        let total = 0, qh = 0, qt = 0;
        queue[qt++] = z; comp[z] = id;
        while (qh < qt) {
          const q = queue[qh++];
          zones.push(q); total += B[q * MAXT + s];
          for (let k = zg.nbrStart[q]; k < zg.nbrStart[q + 1]; k++) {
            const m = zg.nbr[k];
            if (comp[m] < 0 && B[m * MAXT + s] >= 3e-4) { comp[m] = id; queue[qt++] = m; }
          }
        }
        comps.push({ zones, total });
      }
      if (comps.length < 2) { sp.isolates = null; continue; }
      comps.sort((a, b) => b.total - a.total);
      const prev = sp.isolates || [];
      const next = [];
      for (const c of comps.slice(1)) {
        if (c.zones.length < 3 || c.total < 0.06 * sp.total) continue;
        // is this the same fragment we saw last time? (most of its zones overlap)
        const set = new Set(c.zones);
        let count = 1;
        for (const p of prev) {
          let overlap = 0;
          for (const z of p.zones) if (set.has(z)) overlap++;
          if (overlap >= 0.5 * Math.min(p.zones.length, c.zones.length)) { count = p.count + 1; break; }
        }
        if (count >= ISOLATION_CHECKS && this.alive.length < MAXT - 5) {
          // in a crowded niche the isolated population usually fails to become distinct
          if (this.rng() < this.crowding(sp) * this.opportunity) this.splitFragment(sp, c);
        } else next.push({ zones: c.zones, count });
      }
      sp.isolates = next;
    }
  }

  // how much room a species' niche and group leave for a new species (1 = plenty)
  crowding(sp) {
    const nB = this._bins?.get(sp._bin)?.length ?? 1, nG = this._gradeCounts?.[sp.grade] ?? 1;
    const gCap = GROUP_CAP[sp.kingdom], nA = this.alive.length;
    return Math.exp(-(nB - 1) / 2) * (nG > gCap ? Math.exp(-(nG - gCap) / 4) : 1) * (nA > SOFT_CAP ? Math.exp(-(nA - SOFT_CAP) / 25) : 1);
  }

  splitFragment(sp, frag) {
    const rng = this.rng, s = sp.slot, B = this.B;
    // the fragment's own conditions, weighted by where its populations are
    let w = 0, T = 0, n2 = 0, alt = 0;
    for (const z of frag.zones) {
      const b = B[z * MAXT + s], L = this.localNiche(sp.habitat, z);
      w += b; T += b * L.T; n2 += b * L.n2; alt += b * L.alt;
    }
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    // isolated populations drift genetically as well as adapting
    const child = this.createSpecies(sp.grade, {
      parent: sp.id, habitat: sp.habitat, trophic: sp.trophic, sexual: sp.sexual,
      pref: T / w + gaussian(rng) * 1.5, tol: sp.tol * Math.exp(gaussian(rng) * 0.08),
      n2: clamp01(n2 / w + gaussian(rng) * 0.05), n2tol: sp.n2tol, alt: clamp01(alt / w), altTol: sp.altTol,
      size: Math.max(0, Math.min(1, sp.size + gaussian(rng) * 0.08)), years: this.years, host: sp.host,
    });
    if (!child) return null;
    // the island rule: on small islands, small animals tend to grow large (Komodo dragons) and
    // large ones shrink (dwarf elephants), as food and predators are scarce
    const island = sp.habitat !== 0 && frag.zones.length <= 10 && frag.zones.every((z) => this.zSea[z] > 0.35);
    if (island) {
      child.island = true;
      if (sp.kingdom === 'animal') {
        const old = child.size;
        child.size = old < 0.35 ? Math.min(1, old + 0.3) : old > 0.6 ? Math.max(0, old - 0.35) : old;
        child.icon = pickIcon(child.grade, child.trophic, child.size);
        this.setParams(child);
        if (Math.abs(child.size - old) > 0.2) this.onEvent({ type: 'island', species: child, parent: sp, change: child.size > old ? 'giant' : 'dwarf' });
      }
    }
    for (const z of frag.zones) {
      const b = B[z * MAXT + s];
      if (b <= 0) continue;
      B[z * MAXT + s] = 0;
      this.addB(z, child.slot, b);
    }
    child.allopatric = true;
    this.onEvent({ type: 'allopatric', species: child, parent: sp, zones: frag.zones.length });
    this.logSpeciation(child);
    this.cospeciate(sp, child, frag.zones);
    return child;
  }

  // a zone in the species' range, biased toward stressed populations at the range edge
  pickZone(sp, pred = () => true) {
    const s = sp.slot;
    let best = -1, bestScore = Infinity;
    for (let tries = 0; tries < 60; tries++) {
      const z = Math.floor(this.rng() * this.Z);
      if (this.B[z * MAXT + s] < 1e-4 || !pred(z)) continue;
      const h = sp.habitat;
      const T = h === 0 ? this.zTs[z] : h === 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]);
      const score = -Math.abs(T - sp.pref) + this.rng() * 6;
      if (score < bestScore) { bestScore = score; best = z; }
      if (tries > 20 && best >= 0) break;
    }
    return best;
  }

  speciate(sp, grade, z = this.pickZone(sp), transition = null, mode = 'peripatric') {
    if (z < 0) return null;
    const rng = this.rng, G = GRADES[grade];
    let habitat = sp.habitat, trophic = sp.trophic;
    const sexualSel = mode === 'sexual';
    if (sexualSel) {
      // speciation by mate choice: same niche, new courtship display
    } else if (transition) {
      habitat = transition.hab ?? (G.habitats.includes(sp.habitat) ? sp.habitat : G.habitats[0]);
      trophic = G.trophics.includes(sp.trophic) ? sp.trophic : G.trophics[0];
    } else {
      if (rng() < 0.12 && G.habitats.length > 1) habitat = G.habitats[Math.floor(rng() * G.habitats.length)];
      if (rng() < 0.15 && G.trophics.length > 1) trophic = G.trophics[Math.floor(rng() * G.trophics.length)];
    }
    if (!G.habitats.includes(habitat)) habitat = G.habitats[0];
    if (!this.habitatOk(habitat, z)) return null;
    const L = this.localNiche(habitat, z);
    const shift = sexualSel ? 0.1 : 0.5;
    const pref = sp.pref + (L.T - sp.pref) * shift + gaussian(rng) * (sexualSel ? 0.5 : 3);
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const n2 = clamp01(habitat === sp.habitat ? sp.n2 + (L.n2 - sp.n2) * shift + gaussian(rng) * (sexualSel ? 0.02 : 0.1) : L.n2);
    const alt = clamp01(habitat === 2 ? (sp.habitat === 2 ? sp.alt : L.alt) + (L.alt - sp.alt) * shift + gaussian(rng) * (sexualSel ? 0.02 : 0.08) : 0);
    const tol = Math.max(3, Math.min(30, (transition ? G.tol : sp.tol) * Math.exp(gaussian(rng) * 0.15)));
    const size = transition ? 0.2 + rng() * 0.2 : sp.size + gaussian(rng) * (sexualSel ? 0.03 : 0.12);
    const eukaryote = G.kingdom !== 'bacteria' && G.kingdom !== 'archaea';
    const sexual = eukaryote && (sp.sexual || G.tier >= 2 || rng() < 0.15);
    const host = transition ? 0 : this.chooseHost(sp, grade, trophic, z);
    const child = this.createSpecies(grade, { parent: sp.id, habitat, trophic, pref, tol, size, sexual, n2, alt, host, years: this.years,
      n2tol: transition ? undefined : Math.max(0.08, Math.min(1.2, sp.n2tol * Math.exp(gaussian(rng) * 0.15))) });
    if (!child) return null;
    if (sexualSel) child.display = true;
    // the founding population: part of the parent's local population becomes the new species
    const zg = this.zgrid;
    const take = (q, frac) => {
      const pb = this.B[q * MAXT + sp.slot];
      if (pb <= 0) return;
      const amt = pb * frac;
      if (habitat === sp.habitat) this.B[q * MAXT + sp.slot] -= amt;
      if (this.habitatOk(habitat, q)) this.addB(q, child.slot, Math.max(amt, transition ? 0.01 : 0));
    };
    take(z, transition ? 0.3 : 0.5);
    for (let k = zg.nbrStart[z]; k < zg.nbrStart[z + 1]; k++) take(zg.nbr[k], transition ? 0.15 : 0.25);
    if (sexual && !sp.sexual) this.onEvent({ type: 'sex', species: child });
    if (transition) {
      const first = !this.innovations.has(transition.key);
      this.innovations.add(transition.key);
      this.onEvent({ type: 'transition', key: transition.key, first, species: child, parent: sp });
    } else {
      this.onEvent({ type: sexualSel ? 'sexualsel' : 'speciation', species: child, parent: sp });
      this.logSpeciation(child);
      this.cospeciate(sp, child, [z]);
    }
    return child;
  }

  // Specialist herbivores: insects (and other land arthropods) may specialise on one plant
  // species, inheriting their parent's host or switching to another plant growing nearby.
  chooseHost(parent, grade, trophic, z) {
    if (!(grade === 'insect' || (grade === 'arthropod' && parent.habitat !== 0)) || trophic !== TROPHIC.GRAZER) return 0;
    const rng = this.rng;
    const inherited = parent.host && this.species.get(parent.host)?.died < 0 ? parent.host : 0;
    if (inherited && rng() < 0.65) return inherited;
    if (rng() > 0.45) return inherited;
    const plants = [];
    for (let a = 0; a < this.presN[z]; a++) {
      const s = this.pres[z * MAXT + a], q = this.slots[s];
      if (q && q.kingdom === 'plant' && q.habitat !== 0 && this.B[z * MAXT + s] > 1e-3) plants.push(q);
    }
    return plants.length ? plants[Math.floor(rng() * plants.length)].id : inherited;
  }

  // Cospeciation: when a host plant splits, its specialists often split with it
  // (the matching family trees of figs and fig wasps are a famous example).
  cospeciate(parentPlant, childPlant, zones) {
    if (parentPlant.kingdom !== 'plant' || childPlant.kingdom !== 'plant') return;
    for (const s of this.alive.slice()) {
      const q = this.slots[s];
      if (!q || q.host !== parentPlant.id || this.rng() > 0.35 || this.alive.length >= MAXT - 5) continue;
      const z = zones.find((zz) => this.B[zz * MAXT + s] > 1e-4) ?? this.pickZone(q);
      if (z === undefined || z < 0) continue;
      const kid = this.createSpecies(q.grade, { parent: q.id, habitat: q.habitat, trophic: q.trophic, pref: childPlant.pref, tol: q.tol, n2: childPlant.n2, alt: childPlant.alt, size: q.size, sexual: q.sexual, host: childPlant.id, years: this.years });
      if (!kid) return;
      const amt = this.B[z * MAXT + s] * 0.5;
      this.B[z * MAXT + s] -= amt;
      this.addB(z, kid.slot, Math.max(amt, 2e-4));
      kid.cospeciated = true;
      this.onEvent({ type: 'cospeciation', species: kid, parent: q, host: childPlant });
    }
  }

  logSpeciation(sp) {
    const log = (this.specLog[sp.grade] ||= []);
    log.push(this.tick);
    while (log.length && log[0] < this.tick - 150) log.shift();
    // a burst of new species in one group: an adaptive radiation
    if (log.length >= 7 && this.tick - (this.radiationNoted[sp.grade] ?? -1e9) > 1500) {
      this.radiationNoted[sp.grade] = this.tick;
      this.onEvent({ type: 'radiation', grade: sp.grade, count: log.length });
    }
  }

  // biosphere → planet: vegetation for display and weathering, chemistry consumed
  applyToPlanet() {
    const P = this.planet, zoneOf = this.zoneOf;
    for (let c = 0; c < P.n; c++) {
      const z = zoneOf[c];
      P.plant[c] = P.K[c] * (P.water[c] ? this.coverS[z] : this.coverL[z]);
      if (P.water[c]) P.organics[c] *= this.orgFactor[z];
    }
  }

  // kill everything within an angular radius of a zone centre
  disaster(z, radius, frac = 1) {
    const zp = this.zgrid.pos, cosR = Math.cos(radius);
    let lost = 0;
    for (let q = 0; q < this.Z; q++) {
      const d = zp[z * 3] * zp[q * 3] + zp[z * 3 + 1] * zp[q * 3 + 1] + zp[z * 3 + 2] * zp[q * 3 + 2];
      if (d < cosR) continue;
      for (const s of this.alive) { const i = q * MAXT + s; lost += this.B[i] * frac; this.B[i] *= 1 - frac; }
    }
    return lost;
  }

  // global die-off (impact winter, etc.)
  dieOff(frac) {
    for (const s of this.alive) for (let z = 0; z < this.Z; z++) this.B[z * MAXT + s] *= 1 - frac * (0.5 + 0.5 * this.rng());
  }

}

export const KINGDOM_HUES = { bacteria: 0.59, archaea: 0.74, protist: 0.48, plant: 0.33, fungus: 0.08, animal: 0.11 };
export { MAXT };
