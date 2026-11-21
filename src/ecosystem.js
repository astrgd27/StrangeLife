// Life as populations spread across zones, in the spirit of SimEarth.
//
// The planet's fine terrain grid (40,962 cells) is grouped into 2,562 zones. Each zone holds the
// biomass of every species living there. Every tick, populations grow, eat and die according to
// simple ecology (logistic growth for producers, saturating feeding for consumers, a shared food
// pool per trophic level), and some of each population disperses to neighbouring zones. That is
// how life spreads across the globe.
//
// Evolution happens at the species level:
//   - every species carries a genome (genome.js) that develops into a body: cells, tissues,
//     symmetry, segments, limbs, skeleton, size, wings, brain, diet. Ecology follows from the body.
//   - anagenesis: each species slowly adapts its climate niche to where it lives
//   - speciation: a population splits off with mutated genes, sometimes a big developmental jump.
//     New body plans (multicellularity, shells, backbones, legs, wings) appear when genes produce
//     them, and survive only if the planet rewards them. Groups like "fish" are just names for
//     what evolved, and may evolve more than once (convergent evolution) or never.
//   - mergers: the few transitions genes alone can't make (the archaeal split, the mitochondrion
//     and the chloroplast, both born when one cell engulfed another)

import { makeGeodesicGrid } from './planet.js';
import { gaussian } from './rng.js';
import { genusName, speciesEpithet } from './names.js';
import { probe } from './brain.js';
import { FAMILY, GI, ARCHETYPES, develop, classify, ecology, mutate, innovate, evolvable, makeGenes, setDiet, storyKeysFor, describe, randomLooks, sexualLooks, LOOK_GENES, lookSimilarity, convergeLooks } from './genome.js';

export const ZONE_LEVEL = 4;
const MAXT = 160;            // species slots
const SOFT_CAP = 80;         // speciation slows above this many living species
const SPEC_CAP = MAXT - 25;  // ordinary speciation stops here, keeping slots free for major transitions
const EXTINCT = 1e-5;
const LAND_TARGET = [0.04, 0.42, 0.82, 0.1]; // drought resistance favoured at sea, on shores, on land, in fresh water
const LAND_GROUPS = new Set(['insect', 'arachnid', 'myriapod', 'amphibian', 'reptile', 'snake', 'turtle', 'crocodile', 'dinosaur', 'pterosaur',
  'mammal', 'rodent', 'ungulate', 'carnivoran', 'primate', 'bat', 'bird', 'whale', 'sapient']);

// trophic modes
export const TROPHIC = { CHEMO: 0, PHOTO: 1, DECOMP: 2, GRAZER: 3, PREDATOR: 4, OMNI: 5, PARASITE: 6 };
export const TROPHIC_NAMES = ['Chemotroph', 'Photosynthesiser', 'Decomposer', 'Grazer', 'Predator', 'Omnivore', 'Parasite'];
export const HABITAT_NAMES = ['Marine', 'Coastal', 'Land', 'Freshwater'];
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

// Named kinds of organism. A species' kind is worked out from its body (genome.classify), so
// these are descriptions, not boxes. `tier` is a 0–6 complexity score for sorting.
export const GRADES = {
  bacteria: { kingdom: 'bacteria', name: 'Bacteria', tier: 0, size: '1–5 µm', habitats: [0, 1], trophics: [0, 2], icon: '🦠' },
  archaea: { kingdom: 'archaea', name: 'Archaea', tier: 0, size: '1–5 µm', habitats: [0, 1], trophics: [0, 2], icon: '♨️' },
  cyano: { kingdom: 'bacteria', name: 'Cyanobacteria', tier: 0, size: '1–10 µm', habitats: [0, 1, 3], trophics: [1], icon: '🟢' },
  protist: { kingdom: 'protist', name: 'Protists', tier: 1, size: '10–100 µm', habitats: [0, 1], trophics: [3, 4], icon: '🧫' },
  algae: { kingdom: 'plant', name: 'Algae', tier: 1, size: '10 µm–1 mm', habitats: [0, 1, 3], trophics: [1], icon: '🍃' },
  diatom: { kingdom: 'plant', name: 'Diatoms', tier: 1, size: '2–500 µm', habitats: [0, 3], trophics: [1], icon: '💠' },
  foram: { kingdom: 'protist', name: 'Forams & radiolarians', tier: 1, size: '0.1–20 mm', habitats: [0], trophics: [4, 3], icon: '🌀' },
  seaweed: { kingdom: 'plant', name: 'Seaweeds & water algae', tier: 2, size: 'cm–30 m', habitats: [0, 1, 3], trophics: [1], icon: '🌿' },
  waterplant: { kingdom: 'plant', name: 'Water plants & seagrasses', tier: 4, size: 'cm–3 m', habitats: [3, 0], trophics: [1], icon: '🪷' },
  moss: { kingdom: 'plant', name: 'Mosses', tier: 3, size: 'mm–cm', habitats: [1, 2], trophics: [1], icon: '🌱' },
  fern: { kingdom: 'plant', name: 'Ferns & horsetails', tier: 4, size: 'cm–20 m', habitats: [2], trophics: [1], icon: '🌴' },
  conifer: { kingdom: 'plant', name: 'Conifers', tier: 5, size: '1–100 m', habitats: [2], trophics: [1], icon: '🌲' },
  flower: { kingdom: 'plant', name: 'Flowering plants', tier: 6, size: 'mm–100 m', habitats: [2, 1], trophics: [1], icon: '🌸' },
  grass: { kingdom: 'plant', name: 'Grasses', tier: 6, size: 'cm–30 m', habitats: [2, 1], trophics: [1], icon: '🌾' },
  cactus: { kingdom: 'plant', name: 'Cacti & succulents', tier: 6, size: 'cm–20 m', habitats: [2], trophics: [1], icon: '🌵' },
  vine: { kingdom: 'plant', name: 'Vines & epiphytes', tier: 6, size: 'cm–100 m', habitats: [2], trophics: [1], icon: '🪴' },
  fungi: { kingdom: 'fungus', name: 'Molds & yeasts', tier: 2, size: 'µm–cm', habitats: [0, 1], trophics: [2], icon: '🍄' },
  mushroom: { kingdom: 'fungus', name: 'Mushrooms & mycorrhizae', tier: 3, size: 'cm–km', habitats: [2], trophics: [2], icon: '🍄' },
  lichen: { kingdom: 'fungus', name: 'Lichens', tier: 3, size: 'mm–m', habitats: [2], trophics: [1], icon: '🪨' },
  sponge: { kingdom: 'animal', name: 'Sponges & corals', tier: 2, size: 'mm–m', habitats: [0], trophics: [3, 4], icon: '🪸' },
  jelly: { kingdom: 'animal', name: 'Jellies & comb jellies', tier: 2, size: 'mm–2 m', habitats: [0], trophics: [4, 3], icon: '🪼' },
  starfish: { kingdom: 'animal', name: 'Starfish & sea urchins', tier: 3, size: 'cm–1 m', habitats: [0], trophics: [4, 3], icon: '⭐' },
  worm: { kingdom: 'animal', name: 'Worms', tier: 3, size: 'mm–3 m', habitats: [0, 1, 2], trophics: [3, 4, 5], icon: '🪱' },
  mollusc: { kingdom: 'animal', name: 'Shelled molluscs', tier: 3, size: 'mm–1 m', habitats: [0, 1, 2], trophics: [3, 4, 5], icon: '🐚' },
  squid: { kingdom: 'animal', name: 'Squid & octopuses', tier: 4, size: 'cm–15 m', habitats: [0], trophics: [4, 5], icon: '🦑' },
  arthropod: { kingdom: 'animal', name: 'Crustaceans & sea arthropods', tier: 3, size: 'mm–1 m', habitats: [0, 1, 3], trophics: [3, 4, 5], icon: '🦐' },
  insect: { kingdom: 'animal', name: 'Insects', tier: 3, size: 'mm–70 cm', habitats: [2, 1], trophics: [3, 4, 5], icon: '🐞' },
  socialinsect: { kingdom: 'animal', name: 'Ants, bees & termites', tier: 4, size: 'mm–5 cm', habitats: [2, 1], trophics: [5, 3, 4], icon: '🐜' },
  arachnid: { kingdom: 'animal', name: 'Spiders & scorpions', tier: 3, size: 'mm–30 cm', habitats: [2, 1], trophics: [4, 5], icon: '🕷️' },
  myriapod: { kingdom: 'animal', name: 'Centipedes & millipedes', tier: 3, size: 'mm–2 m', habitats: [2, 1], trophics: [3, 4], icon: '🐛' },
  fish: { kingdom: 'animal', name: 'Fish', tier: 4, size: 'cm–15 m', habitats: [0, 3, 1], trophics: [3, 4, 5], icon: '🐟' },
  amphibian: { kingdom: 'animal', name: 'Amphibians', tier: 4, size: 'cm–5 m', habitats: [1, 3, 2], trophics: [4, 5], icon: '🐸' },
  reptile: { kingdom: 'animal', name: 'Lizards & other reptiles', tier: 5, size: 'cm–3 m', habitats: [2, 1], trophics: [3, 4, 5], icon: '🦎' },
  snake: { kingdom: 'animal', name: 'Snakes', tier: 5, size: 'cm–10 m', habitats: [2, 1], trophics: [4], icon: '🐍' },
  turtle: { kingdom: 'animal', name: 'Turtles & tortoises', tier: 5, size: 'cm–4 m', habitats: [2, 1, 3], trophics: [3, 5], icon: '🐢' },
  crocodile: { kingdom: 'animal', name: 'Crocodiles', tier: 5, size: '1–12 m', habitats: [1, 3], trophics: [4], icon: '🐊' },
  dinosaur: { kingdom: 'animal', name: 'Dinosaurs', tier: 5, size: '1–40 m', habitats: [2, 1], trophics: [3, 4, 5], icon: '🦕' },
  pterosaur: { kingdom: 'animal', name: 'Pterosaurs', tier: 5, size: '0.3–11 m', habitats: [2, 1], trophics: [4, 5], icon: '🐉' },
  bird: { kingdom: 'animal', name: 'Birds', tier: 5, size: 'cm–3 m', habitats: [2, 1], trophics: [3, 4, 5], icon: '🐦' },
  mammal: { kingdom: 'animal', name: 'Mammals (small insect-eaters and kin)', tier: 5, size: 'cm–2 m', habitats: [2, 1], trophics: [5, 3, 4], icon: '🦔' },
  rodent: { kingdom: 'animal', name: 'Rodents & rabbits', tier: 5, size: 'cm–1 m', habitats: [2, 1], trophics: [3, 5], icon: '🐭' },
  ungulate: { kingdom: 'animal', name: 'Hoofed mammals', tier: 5, size: '0.5–6 m', habitats: [2, 1], trophics: [3], icon: '🦌' },
  carnivoran: { kingdom: 'animal', name: 'Carnivores', tier: 5, size: 'cm–3 m', habitats: [2, 1], trophics: [4, 5], icon: '🐺' },
  primate: { kingdom: 'animal', name: 'Primates', tier: 5, size: 'cm–2 m', habitats: [2], trophics: [5, 3], icon: '🐒' },
  bat: { kingdom: 'animal', name: 'Bats', tier: 5, size: 'cm–1.7 m', habitats: [2, 1], trophics: [4, 3, 5], icon: '🦇' },
  whale: { kingdom: 'animal', name: 'Whales, seals & river dolphins', tier: 5, size: '1–30 m', habitats: [0, 3], trophics: [4, 3], icon: '🐋' },
  sapient: { kingdom: 'animal', name: 'Intelligent life', tier: 6, size: '1–2 m', habitats: [2, 1], trophics: [5], icon: '🧠' },
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
  if (FAMILY[grade] === 'mammals' || grade === 'bird' || grade === 'whale') return { n2: 0.45, alt: 0.5 };
  return { n2: 0.38, alt: 0.4 };
}

// Niche bins for diversity-dependence and competitive exclusion: same group, habitat, diet,
// ~8 °C temperature band, rainfall/depth third, and host plant.
function nicheKey(sp) {
  // (chemically defended animals count as a niche of their own: they often feed differently, as
  // poison frogs get their poisons from eating ants)
  return `${sp.grade}|${sp.habitat}|${sp.trophic}|${Math.floor((sp.pref + 40) / 8)}|${Math.min(2, Math.floor(sp.n2 * 3))}|${sp.host || 0}${sp.ph?.poison > 0.6 ? '|P' : ''}`;
}

// How many species a single group (e.g. seaweeds, insects) tends to hold before its splitting
// slows. Animals, insects above all, are where most of Earth's species are.
const GROUP_CAP = { bacteria: 8, archaea: 6, protist: 8, plant: 10, fungus: 8, animal: 12 };
// a few kinds of animal are famously species-rich
const GRADE_CAP = { insect: 22, fish: 16, arthropod: 14, sponge: 7, jelly: 7, cyano: 7, socialinsect: 10 };
// how common a species is for its habitat: rivers and lakes are small, so their species are
// judged against that when competition decides who is squeezed out
const abundance = (sp) => sp.total * (sp.habitat === 3 ? 3 : 1) * (sp.trophic === 6 ? 30 : 1);
// parasites are counted as their own group (parasitic worms apart from free-living ones)
// (and so are poisonous animals, which crowd out only each other)
const gkey = (sp) => (sp.trophic === 6 ? sp.grade + '*' : sp.ph?.poison > 0.6 ? sp.grade + '!' : sp.grade);
const capOf = (key) => (key.endsWith('*') ? 10 : key.endsWith('!') ? 6 : GRADE_CAP[key] ?? GROUP_CAP[GRADES[key].kingdom]);

// how strongly mate choice drives speciation (birds and fish are famous for it)
// (scaled by each species' display gene: showy colours, songs and dances)
const SEXUAL_SELECTION = { bird: 2, fish: 1.5, insect: 1, mammal: 0.8, reptile: 0.8, amphibian: 0.8, arthropod: 0.6, squid: 0.6, mollusc: 0.3, worm: 0.3,
  dinosaur: 0.8, pterosaur: 0.8, ungulate: 0.8, primate: 0.8, rodent: 0.6, carnivoran: 0.6, bat: 0.6, arachnid: 0.6, snake: 0.4, crocodile: 0.4, turtle: 0.3 };

// icon variants within a grade (by diet and size)
function pickIcon(g, trophic, size, habitat = 0) {
  if (trophic === TROPHIC.PARASITE) return g === 'insect' || g === 'arachnid' || g === 'arthropod' ? '🦟' : g === 'worm' ? '🪱' : g === 'protist' ? '🦠' : GRADES[g].icon;
  if (g === 'mollusc') return habitat === 0 ? '🐚' : '🐌';
  if (g === 'squid') return size > 0.45 ? '🦑' : '🐙';
  if (g === 'worm') return habitat === 0 && trophic === TROPHIC.PREDATOR ? '🪱' : '🪱';
  if (g === 'jelly') return '🪼';
  if (g === 'fish') return trophic === TROPHIC.PREDATOR ? '🦈' : '🐟';
  if (g === 'arthropod') return trophic === TROPHIC.PREDATOR ? '🦀' : '🦐';
  if (g === 'socialinsect') return trophic === TROPHIC.GRAZER ? '🐝' : '🐜';
  if (g === 'insect') return trophic === TROPHIC.PREDATOR ? '🐝' : size > 0.15 ? '🦋' : '🐞';
  if (g === 'reptile') return '🦎';
  if (g === 'mammal') return size > 0.5 ? '🐻' : '🦔';
  if (g === 'ungulate') return size > 0.75 ? '🐘' : size > 0.6 ? '🦬' : '🦌';
  if (g === 'carnivoran') return size > 0.55 ? '🐻' : size > 0.35 ? '🐺' : '🦊';
  if (g === 'rodent') return size > 0.2 ? '🐇' : '🐭';
  if (g === 'primate') return size > 0.5 ? '🦍' : '🐒';
  if (g === 'dinosaur') return trophic === TROPHIC.PREDATOR ? '🦖' : '🦕';
  if (g === 'turtle') return '🐢';
  if (g === 'arachnid') return size > 0.2 ? '🦂' : '🕷️';
  if (g === 'bird') return trophic === TROPHIC.PREDATOR ? '🦅' : '🐦';
  if (g === 'whale') return habitat === 3 || trophic === TROPHIC.PREDATOR ? '🐬' : '🐋';
  if (g === 'flower') return size > 0.6 ? '🌳' : '🌸';
  if (g === 'protist' && trophic === TROPHIC.PREDATOR) return '🧫';
  if (g === 'bacteria' && trophic === TROPHIC.DECOMP) return '🦠';
  return GRADES[g].icon;
}

// Mergers and splits: the few major transitions that gene mutations alone can't produce. All other
// new kinds of life (multicellularity, animals, land plants, backbones, flight…) emerge from genes.
export const TRANSITIONS = [
  // the deepest split in the tree of life
  { from: 'bacteria', to: 'archaea', p: 0.004, key: 'archaea', need: () => true,
    make: (sp) => ({ domain: 'archaea' }) },
  // endosymbiosis: an archaeal host engulfs a bacterium that becomes its mitochondrion
  { from: 'archaea', to: 'protist', p: 0.003, key: 'eukaryote', need: (E, z) => E.planet.o2 >= 0.4 && E.kingdomIn(z, 'bacteria'),
    make: () => ({ domain: 'eukaryote', mito: true, genes: { adhesion: 0.15, ingest: 0.75, carnivory: 0.3, motility: 0.6, size: 0.5 } }) },
  // a fungus that farms algae or cyanobacteria inside itself: a lichen, the first life on bare rock
  { from: 'mushroom', to: 'lichen', p: 0.002, key: 'lichen', hab: 2, need: (E, z) => E.zLand[z] > 0.1 && (E.gradeIn(z, 'algae') || E.gradeIn(z, 'cyano')),
    make: () => ({ lichen: true, chloro: true, genes: { photo: 0.85, absorb: 0.7, landAdapt: 0.85, size: 0.1 } }) },
  // a protist engulfs a cyanobacterium: the chloroplast
  { from: 'protist', to: 'algae', p: 0.003, key: 'algae', need: (E, z) => E.gradeIn(z, 'cyano'),
    make: () => ({ chloro: true, genes: { photo: 0.85, ingest: 0.15, absorb: 0.1 } }) },
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
    this.tDry = new Float32Array(MAXT); this.tVuln = new Float32Array(MAXT).fill(1); this.tVuln0 = new Float32Array(MAXT).fill(1);
    this.tSucc = new Float32Array(MAXT); this.tClimb = new Float32Array(MAXT); this.tRock = new Uint8Array(MAXT);
    this.tCoral = new Uint8Array(MAXT); this.tRoots = new Uint8Array(MAXT);
    // plant defences and fire: how palatable each plant is to generalist grazers, how well it
    // tolerates being grazed (grasses regrow from the base) and how much of it survives a fire
    this.tHardy = new Float32Array(MAXT).fill(1);
    this.tPal = new Float32Array(MAXT).fill(1); this.tGraze = new Float32Array(MAXT).fill(1); this.tFire = new Float32Array(MAXT).fill(1);
    this.zFire = null; // recent fires per zone (made when the environment is first known)
    // the food web: how much each predator prefers each prey (by size), and recent flows of food
    // from prey to predator and from host to parasite, for finding keystone species
    this.link = new Float32Array(MAXT * MAXT);
    this.flow = new Float32Array(MAXT * MAXT);
    this.webDirty = true;
    this.pendingCascades = [];
    this.groupOrigins = {}; // kind of life -> number of independent origins
    this.tHost = new Int16Array(MAXT).fill(-1);
    this.tDraw = new Float32Array(MAXT).fill(1); // share of food taken from the wild (farming lowers it) // specialist herbivores: slot of their host plant
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
    // fresh water: the share of a zone covered by rivers and lakes, and its plant capacity
    this.zFw = new Float32Array(Z); this.zKf = new Float32Array(Z);
    this.zSeason = new Float32Array(Z); // how harsh the seasons are
    this.realm = new Int16Array(Z).fill(-1); this.realms = []; // biogeographic realms, worked out on request
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
    const ml = new Float32Array(Z), hl = new Float32Array(Z), ds = new Float32Array(Z), fw = new Float32Array(Z), kf = new Float32Array(Z);
    const fresh = P.fresh, season = new Float32Array(Z);
    const depthScale = 1 / Math.max(0.3, 1 + P.seaLevel);
    for (let c = 0; c < P.n; c++) {
      const z = zoneOf[c], T = P.temp[c], b = P.biome[c];
      tAll[z] += T;
      season[z] += P.season ? P.season[c] : 0;
      if (P.water[c]) {
        sea[z]++; ts[z] += T; org[z] += P.organics[c];
        ds[z] += Math.min(1, (P.seaLevel - P.elev[c]) * depthScale * 1.6);
        if (b !== 2 && b !== 12) ks[z] += P.K[c] * P.light[c];
      } else if (b !== 3) {
        land[z]++; tl[z] += T; kl[z] += P.K[c] * P.light[c];
        ml[z] += P.moist[c]; hl[z] += P.heightAboveSea(c);
        // rivers and lakes gather nutrients from their whole catchment, so they are rich for their size
        if (fresh && fresh[c] > 0 && b !== 3) { fw[z] += fresh[c]; kf[z] += fresh[c] * 1.6 * P.light[c] * (T > 0 ? 1 : 0.2); }
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
      this.zFw[z] = fw[z] / n;
      this.zSeason[z] = season[z] / n;
      this.zKf[z] = kf[z] / n;
    }
    // refresh a rotating share of species each call; climate changes slowly
    const nA = this.alive.length;
    for (let k = 0; k < nA; k += 4) { const s = this.alive[(k + (this.envCalls = (this.envCalls || 0) + 1)) % nA]; this.refreshSuit(s); }
  }

  // the local values of a species' niche axes in a zone
  localNiche(h, z) {
    return {
      T: h === 0 ? this.zTs[z] : h >= 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]),
      n2: h === 0 ? this.zDs[z] : this.zMl[z], // depth at sea, rainfall on land, coasts and rivers
      alt: h >= 2 ? this.zHl[z] : 0,
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
      const T = h === 0 ? this.zTs[z] : h >= 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]);
      const d = (T - pref) / tol;
      const e = ((h === 0 ? this.zDs[z] : this.zMl[z]) - n2) / n2t;
      const a = h >= 2 ? (this.zHl[z] - alt) / altT : 0;
      // temperature limits survival outright; rainfall/depth and altitude shape how well a
      // species does (a mismatch costs up to 70% of its performance, not its life)
      suit[z * MAXT + s] = Math.exp(-0.5 * d * d) * (0.3 + 0.7 * Math.exp(-0.5 * (e * e + a * a)));
    }
  }

  // ---------- species ----------

  // A new species. Its genome comes from opts.genes (a parent's mutated genes), or from the
  // archetype for `grade` when life is seeded; its kind of life is then worked out from its body.
  createSpecies(grade, opts) {
    let slot = this.slots.indexOf(null);
    if (slot < 0) return null;
    const rng = this.rng;
    const parent = opts.parent ? this.species.get(opts.parent) : null;
    const A = ARCHETYPES[grade] || ARCHETYPES.bacteria;
    const genes = opts.genes ? Float32Array.from(opts.genes) : makeGenes(A.genes);
    if (!opts.genes) randomLooks(genes, rng);
    const sp = {
      id: this.nextId++, slot, grade, kingdom: GRADES[grade].kingdom,
      domain: opts.domain ?? A.domain, mito: opts.mito ?? A.mito, chloro: opts.chloro ?? A.chloro, lichen: opts.lichen ?? parent?.lichen ?? !!A.lichen,
      genes, trophic: 0, habitat: opts.habitat ?? 0, size: 0,
      pref: opts.pref ?? 20, tol: opts.tol ?? 10,
      n2: opts.n2 ?? 0.5, n2tol: opts.n2tol ?? 0.4,
      alt: opts.alt ?? 0.1, altTol: opts.altTol ?? 0.4,
      host: opts.host || 0,
      parent: parent ? parent.id : 0, born: this.tick, bornYears: opts.years ?? 0, died: -1,
      total: 0, range: 0, peak: 0, peakRange: 0, seeded: !!opts.seeded,
    };
    // learned behaviour is inherited by daughter species
    if (parent?.brain) { sp.brain = Float32Array.from(parent.brain); sp.brainGens = parent.brainGens; }
    // has this lineage ever lived on land? (so a warm-blooded sea creature can be a whale)
    sp.landAnc = parent ? !!parent.landAnc || sp.habitat === 2 : sp.habitat === 2 || LAND_GROUPS.has(grade);
    this.develop(sp);
    if (opts.tol === undefined) sp.tol = sp.eco.tol;
    const nt = nicheTol(sp.grade);
    if (opts.n2tol === undefined) sp.n2tol = nt.n2;
    if (opts.altTol === undefined) sp.altTol = nt.alt;
    sp.sexual = opts.sexual ?? (sp.domain === 'eukaryote' && (sp.ph.level >= 2 || (parent?.sexual ?? false)));
    const sameGrade = parent && parent.grade === sp.grade;
    sp.genus = sameGrade && rng() < 0.6 ? parent.genus : genusName(rng, sp.grade);
    sp.name = opts.name || `${sp.genus} ${speciesEpithet(rng, { size: 0.3 + 2.7 * sp.size, diet: sp.trophic === TROPHIC.PREDATOR ? 0.9 : 0, tempPref: sp.pref, speed: 0, aquatic: sp.habitat === 1 ? 0.5 : 1 })}`;
    this.species.set(sp.id, sp);
    this.slots[slot] = sp;
    this.alive.push(slot);
    this.setParams(sp);
    this.refreshSuit(slot);
    return sp;
  }

  // genome → body → kind of life, diet, size, icon and ecology
  develop(sp) {
    const ph = (sp.ph = develop(sp));
    sp.trophic = ph.trophic;
    sp.size = ph.size;
    sp.grade = classify(sp, ph, sp.habitat, sp.grade);
    sp.kingdom = GRADES[sp.grade].kingdom;
    sp.tier = ph.tier;
    sp.body = describe(ph);
    sp.icon = pickIcon(sp.grade, sp.trophic, sp.size, sp.habitat);
    sp.hue = (KINGDOM_HUES[sp.kingdom] + (sp.genes[GI.hue] - 0.5) * 0.3 + 1) % 1;
    sp.eco = ecology(sp, ph);
    return ph;
  }

  setParams(sp) {
    const s = sp.slot;
    if (!sp.ph || !sp.eco) this.develop(sp);
    const ph = sp.ph, p = sp.eco;
    const T = TROPHIC;
    this.tTroph[s] = sp.trophic; this.tHab[s] = sp.habitat;
    this.tKing[s] = KINGDOM_KEYS.indexOf(sp.kingdom);
    this.tPref[s] = sp.pref; this.tTol[s] = sp.tol;
    this.tR[s] = p.r; this.tK[s] = p.kmul;
    this.tM[s] = p.m; this.tE[s] = p.e; this.tImax[s] = p.imax; this.tHalf[s] = p.half;
    this.tO2[s] = p.o2; this.tDisp[s] = p.disp; this.tSelf[s] = p.self * (sp.sexual ? 0.75 : 1);
    this.tDry[s] = p.dry; this.tVuln[s] = p.vuln;
    this.tSucc[s] = p.succ || 0; this.tClimb[s] = p.climb || 0; this.tRock[s] = p.rock ? 1 : 0;
    this.tCoral[s] = p.coral ? 1 : 0; this.tRoots[s] = p.roots ? 1 : 0;
    this.tPal[s] = p.pal ?? 1;
    this.tHardy[s] = p.hardy ?? 1;
    this.tGraze[s] = sp.grade === 'grass' ? 0.55 : 1;
    // what survives a wildfire: grasses resprout, trees burn, animals mostly flee
    this.tFire[s] = sp.trophic !== 1 ? (ph.animal ? 0.85 : 0.9) : sp.grade === 'grass' ? 0.85 : sp.grade === 'lichen' ? 0.6 : ph.succulence > 0.5 ? 0.35 : ph.size > 0.45 ? 0.25 : 0.4;
    this.webDirty = true;
    // behaviour evolved by individuals (when you dive into a zone): better foragers and hunters
    // eat more, and animals that flee or crowd together are harder to catch
    if (sp.brain && ph.animal) {
      const k = sp.skills || (sp.skills = probe(sp.brain));
      const f = sp.trophic === T.PREDATOR ? k.hunt : sp.trophic === T.OMNI ? Math.max(k.hunt, k.forage) : k.forage;
      this.tImax[s] *= Math.max(0.85, Math.min(1.2, 1 + 0.35 * (f - 0.4)));
      this.tVuln[s] *= Math.max(0.7, Math.min(1.15, 1 - 0.35 * (k.evade - 0.3) - (k.herd > 0.3 ? 0.1 : 0)));
    }
    // mimics share their model's protection (worked out in updateMimicry)
    this.tVuln0[s] = this.tVuln[s];
    this.tVuln[s] *= 1 - 0.5 * (sp.mimicP || 0);
    // specialists are efficient on their one host plant and can't use anything else
    const host = sp.host ? this.species.get(sp.host) : null;
    this.tHost[s] = host && host.died < 0 ? host.slot : -1;
    if (this.tHost[s] >= 0 && sp.trophic !== T.PARASITE) { this.tImax[s] *= 1.35; this.tHalf[s] *= 0.4; }
    // what it eats depends on its body: single cells and filter-feeders eat microbes
    this.wChem[s] = this.wMicro[s] = this.wProd[s] = this.wHerb[s] = this.wDet[s] = 0;
    const micro = ph.level <= 1, filter = ph.animal && (ph.level === 2 || ph.radial || !ph.motile);
    if (sp.trophic === T.CHEMO) this.wChem[s] = 1;
    else if (sp.trophic === T.DECOMP) this.wDet[s] = 1;
    else if (sp.trophic === T.GRAZER) {
      if (micro) { this.wMicro[s] = 1; this.wProd[s] = 0.6; }
      else if (filter) { this.wMicro[s] = 1; this.wProd[s] = 1; }
      else this.wProd[s] = 1;
    } else if (sp.trophic === T.PREDATOR) {
      if (micro) this.wMicro[s] = 1;
      else if (filter) { this.wHerb[s] = 0.6; this.wMicro[s] = 0.6; }
      else this.wHerb[s] = 1;
    } else if (sp.trophic === T.OMNI) {
      if (micro) { this.wMicro[s] = 1; this.wProd[s] = 0.3; }
      else { this.wProd[s] = 0.5; this.wHerb[s] = 0.6; }
    }
    // what eats it: microbes are grazed, plants browsed, and animals hunted unless they are
    // big backboned predators at the top of the food chain
    if (sp.trophic === T.PHOTO) this.tPool[s] = POOL.PROD;
    else if (sp.trophic === T.PARASITE) this.tPool[s] = POOL.NONE;
    else if (micro && sp.kingdom !== 'plant') this.tPool[s] = POOL.MICRO;
    else if (ph.animal && (sp.trophic !== T.PREDATOR || ph.skeleton !== 'endo' || ph.size < 0.45)) this.tPool[s] = POOL.HERB;
    else this.tPool[s] = POOL.NONE;
    // intelligent life is a flexible omnivore that eats plants as well as prey, and grows much of
    // its own food, so it takes far less from wild ecosystems for its numbers
    this.tDraw[s] = 1;
    if (sp.grade === 'sapient') { this.wProd[s] = 0.8; this.wHerb[s] = 0.8; this.tDraw[s] = 0.3; this.tO2[s] = Math.min(this.tO2[s], 14); }
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
      const kin = this.alive.map((t) => this.slots[t]).filter((t) => t.grade === sp.grade && t.trophic !== TROPHIC.PARASITE);
      q.host = kin.length ? kin.sort((a, b) => Math.abs(a.pref - q.pref) - Math.abs(b.pref - q.pref))[0].id : 0;
      this.setParams(q);
    }
    if (sp.peakRange >= 6) this.onEvent({ type: 'extinction', species: sp });
    // forget the food flows through this slot; a new species will take it over
    for (let k = 0; k < MAXT; k++) { this.flow[slot * MAXT + k] = 0; this.flow[k * MAXT + slot] = 0; }
    // a keystone predator gone: watch what happens to the prey it held in check
    if (sp.keystone) this.pendingCascades.push({ pred: sp, tick: this.tick, prey: sp.keystone.map((id) => ({ id, total: this.species.get(id)?.total || 0 })) });
    this.webDirty = true;
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
    return h === 0 ? this.zSea[z] > 0.05 : h === 2 ? this.zLand[z] > 0.05 : h === 3 ? this.zFw[z] > 0.01 : this.zSea[z] > 0.02 && this.zLand[z] > 0.02;
  }

  seed(grade, z, opts = {}) {
    const G = GRADES[grade], A = ARCHETYPES[grade];
    let habitat = opts.habitat ?? G.habitats[0];
    // pick a habitat the zone actually has
    if (!this.habitatOk(habitat, z)) habitat = G.habitats.find((h) => this.habitatOk(h, z)) ?? habitat;
    const L = this.localNiche(habitat, z);
    let genes = opts.genes;
    if (!genes) {
      genes = makeGenes(A.genes);
      randomLooks(genes, this.rng);
      if (opts.looks) LOOK_GENES.forEach((k, i) => { genes[GI[k]] = opts.looks[i]; });
      if (opts.trophic !== undefined && G.trophics.includes(opts.trophic)) setDiet(genes, A.domain, opts.trophic);
      if (opts.size !== undefined) genes[GI.size] = Math.max(0.02, Math.min(1, opts.size));
    }
    const sp = this.createSpecies(grade, { ...opts, genes, habitat, pref: opts.pref ?? L.T, n2: opts.n2 ?? L.n2, alt: opts.alt ?? L.alt });
    if (!sp) return null;
    this.introduce(sp, z, opts.amount ?? (sp.trophic === TROPHIC.PHOTO ? 0.08 : 0.02));
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
  // how many separate times a kind of life has evolved
  originsOf(grade) { return this.groupOrigins[grade] || 0; }
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
    const { tTroph, tHab, tPool, tPref, tTol, tR, tK, tM, tE, tImax, tHalf, tO2, tSelf, wChem, wMicro, wProd, wHerb, wDet, tKing, tHost, tDry, tVuln, tSucc, tClimb, tRock, tCoral, tRoots } = this;
    if (this.webDirty) this.buildLinks();
    const link = this.link, flow = this.flow;
    const loss = this._loss || (this._loss = new Float32Array(MAXT));
    const preyList = this._preyList || (this._preyList = new Uint8Array(MAXT));
    // corals need algae to partner with; roots need bacteria
    const algaeOK = this.gradeAlive('algae') || this.gradeAlive('diatom') || this.gradeAlive('cyano') ? 1 : 0;
    // which species build reefs (1) or forests (2)
    const engineer = this._eng || (this._eng = new Uint8Array(MAXT));
    for (const s of alive) {
      const sp = this.slots[s];
      engineer[s] = sp.grade === 'sponge' && sp.habitat === 0 && tCoral[s] ? 1 : (sp.grade === 'fern' || sp.grade === 'conifer' || sp.grade === 'flower') && sp.size > 0.45 ? 2 : 0;
    }
    const total = this.total, range = this.range, sumT = this.sumT, pres = this.pres, presN = this.presN;
    const sumN2 = this.sumN2 || (this.sumN2 = new Float32Array(MAXT)), sumA = this.sumA || (this.sumA = new Float32Array(MAXT));
    total.fill(0); range.fill(0); sumT.fill(0); sumN2.fill(0); sumA.fill(0);
    const nA = alive.length;
    const fungK = KINGDOM_KEYS.indexOf('fungus');
    const pollinators = this.gradeAlive('insect') || this.gradeAlive('bird') || this.gradeAlive('bat');
    // plants with their own specialist insects get dedicated pollinators
    const pollinated = this.pollinated || (this.pollinated = new Uint8Array(MAXT));
    pollinated.fill(0);
    for (const s of alive) if (tHost[s] >= 0) pollinated[tHost[s]] = 1;
    const newB = this._newB || (this._newB = new Float32Array(MAXT));
    const suitArr = this.suit;
    const archK = KINGDOM_KEYS.indexOf('archaea');
    const archO2 = 0.03 * Math.min(1, o2 / 5); // most archaea are strict anaerobes
    let prodTotal = 0, landProd = 0, methane = 0;
    const kRange = this.kRange || (this.kRange = new Int32Array(KINGDOM_KEYS.length));
    kRange.fill(0);
    let lifeZones = 0;

    for (let z = 0; z < Z; z++) {
      const base = z * MAXT;
      const zs = this.zSea[z], zl = this.zLand[z];
      // food pools by habitat (sea, land) for microbes, plants and dead matter; animals that can be
      // eaten are listed individually, because predators choose their prey
      // edS/edL: plants as food for generalist grazers, weighted by how palatable they are
      let microS = 0, microL = 0, prodS = 0, prodL = 0, prodF = 0, edS = 0, edL = 0, fungL = 0, decS = 0, decL = 0, reef = 0, forest = 0, np = 0;
      let any = false;
      const nP = presN[z];
      for (let a = 0; a < nP; a++) {
        const s = pres[base + a], b = B[base + s];
        if (b === 0) continue;
        any = true;
        const h = tHab[s], hs = h === 0 ? 1 : h === 1 ? 0.5 : 0, hl = 1 - hs;
        const p = tPool[s];
        if (p === 0) { const v = b * tVuln[s]; microS += v * hs; microL += v * hl; }
        else if (p === 1) { prodS += b * hs; prodL += b * hl; if (h === 3) prodF += b; const e = b * this.tPal[s]; edS += e * hs; edL += e * hl; }
        else if (p === 2) preyList[np++] = s;
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
      let cMicroS = 0, cMicroL = 0, cProdS = 0, cProdL = 0, cDetS = 0, cDetL = 0, cChem = 0;
      let deadS = 0, deadL = 0;

      for (let a = 0; a < nP; a++) {
        const s = pres[base + a];
        let b = B[base + s];
        if (b === 0) { newB[s] = 0; continue; }
        const h = tHab[s], hs = h === 0 ? 1 : h === 1 ? 0.5 : 0, hl = 1 - hs;
        const suit = suitArr[base + s];
        const o2f = tO2[s] > 0 ? Math.min(1, o2 / tO2[s]) : 1;
        // (harsh seasons weigh on everything that can't go dormant, keep warm or leave)
        let mort = tM[s] + 0.05 * (1 - suit) + 0.08 * (1 - o2f) + 0.1 * hl * (1 - ozone) + tDry[s] + 0.045 * this.zSeason[z] * (1 - this.tHardy[s]);
        // habitat shrinking under them (sea level, ice)
        const room = h === 0 ? zs : h === 2 ? zl : h === 3 ? Math.min(1, 0.2 + 6 * this.zFw[z]) : Math.min(1, 4 * Math.min(zs, zl));
        if (room < 0.03) mort += 0.2;
        // Allee effect: tiny populations struggle to find mates and recover (parasites are always
        // small by weight, but they live packed inside their hosts)
        if (b < 3e-4 && tTroph[s] !== 6) mort += 0.04;
        if (tKing[s] === archK) mort += archO2;
        let nb;
        if (tTroph[s] === 1) {
          // land capacity: water-storing plants do well where it's dry, climbers where there are
          // trees to climb, lichens on bare rock; fresh water has its own
          const dryness = this.zMl[z];
          let kl = h === 3 ? this.zKf[z] * nutL
            : KL * (1 + tSucc[s] * (2.4 * Math.max(0, 0.45 - dryness) - 0.8 * Math.max(0, dryness - 0.4))) * (1 + 1.5 * tClimb[s] * struct);
          if (tRock[s]) kl = Math.max(kl, 0.12 * zl);
          const K = (hs * KS + hl * kl * (pollinators || this.slots[s].grade !== 'flower' ? 1 : 0.6)) * tK[s] * (this.pollinated[s] ? 1.15 : 1) * (tRoots[s] ? 1.2 : 1);
          // (water plants compete for light only with each other, not with the forest on the bank)
          const crowd = h === 3 ? prodF : hs * prodS + hl * (prodL - prodF);
          nb = b + tR[s] * b * (suit * o2f - crowd / (K + 1e-6)) - mort * 0.3 * b;
          prodTotal += b;
          if (h > 0) landProd += b * hl;
        } else if (tTroph[s] === 6) {
          // a parasite feeds on its one host species where the two live together
          const hostSlot = tHost[s];
          const F = hostSlot >= 0 ? B[base + hostSlot] : 0;
          const I = F > 0 ? tImax[s] * F / (F + tHalf[s]) : 0;
          // (the host's immune defences grow with the parasite load, so parasites stay a modest
          // share of their host; where the host is missing they die out)
          nb = b + b * (tE[s] * I * suit * o2f - mort - tSelf[s] * b / (F + 1e-4));
          if (I > 0) { const eat = b * I; loss[hostSlot] += eat; flow[s * MAXT + hostSlot] += eat; }
        } else {
          const own = b;
          const fMicro = wMicro[s] * Math.max(0, hs * microS + hl * microL - (tPool[s] === 0 ? own * tVuln[s] : 0));
          const hostSlot = tHost[s];
          // specialists eat their own host plant (they have beaten its defences); everyone else
          // avoids toxic plants
          const fProd = wProd[s] * (hostSlot >= 0 ? B[base + hostSlot] : hs * edS + hl * edL);
          // prey: each predator prefers prey of a size it can handle, and well-defended prey (big,
          // armoured, fast, flying) are both safer and poorer food
          let fHerb = 0;
          if (wHerb[s] > 0) {
            const row = s * MAXT;
            for (let k = 0; k < np; k++) {
              const q = preyList[k], l = link[row + q];
              if (l === 0) continue;
              const hq = tHab[q], qs = hq === 0 ? 1 : hq === 1 ? 0.5 : 0;
              fHerb += l * B[base + q] * tVuln[q] * (hs * qs + hl * (1 - qs));
            }
            fHerb *= wHerb[s];
          }
          const fDet = wDet[s] * (hs * detS + hl * detL);
          const fChem = wChem[s] * org * hs;
          const F = fMicro + fProd + fHerb + fDet + fChem;
          const I = F > 0 ? tImax[s] * F / (F + tHalf[s]) : 0;
          // corals feed partly on sugar from the algae in their tissues, in sunlit shallows, but
          // too much heat makes them expel the algae (bleaching)
          let extra = 0;
          if (tCoral[s]) {
            extra = algaeOK * 0.06 * Math.min(1, this.zKs[z] * 2) * (this.zDs[z] < 0.35 ? 1 : 0.3);
            const heat = (this.zTs[z] - tPref[s]) / tTol[s] - 0.8;
            if (heat > 0) { mort += 0.15 * heat; extra *= Math.max(0, 1 - heat); }
          }
          nb = b + b * (tE[s] * I * suit * o2f + extra * suit - mort - tSelf[s] * coexist * b);
          if (F > 0) {
            const eat = (b * I / F) * this.tDraw[s];
            cMicroS += eat * fMicro * hs; cMicroL += eat * fMicro * hl;
            if (hostSlot >= 0) { const take = eat * fProd; loss[hostSlot] += take; flow[s * MAXT + hostSlot] += take; }
            else { cProdS += eat * fProd * hs; cProdL += eat * fProd * hl; }
            if (fHerb > 0) {
              const k2 = eat * wHerb[s], row = s * MAXT;
              for (let k = 0; k < np; k++) {
                const q = preyList[k], l = link[row + q];
                if (l === 0) continue;
                const hq = tHab[q], qs = hq === 0 ? 1 : hq === 1 ? 0.5 : 0;
                const take = k2 * l * B[base + q] * tVuln[q] * (hs * qs + hl * (1 - qs));
                loss[q] += take; flow[row + q] += take;
              }
            }
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
      const fpS = f(cProdS, edS), fpL = f(cProdL, edL);
      let pS = 0, pL = 0, kmask = 0, w = 0;
      for (let a = 0; a < nP; a++) {
        const s = pres[base + a];
        let nb = newB[s];
        const ls = loss[s];
        loss[s] = 0;
        if (nb === 0) { B[base + s] = 0; continue; }
        // eaten by its own predators and parasites (a few always escape into refuges)
        if (ls > 0) nb = Math.max(nb * 0.05, nb - ls);
        const p = tPool[s];
        if (p >= 0) {
          const h = tHab[s], hs = h === 0 ? 1 : h === 1 ? 0.5 : 0, hl = 1 - hs;
          if (p === 0) {
            // microbe losses fall hardest on the easiest to catch
            const v = tVuln[s];
            nb *= hs * Math.max(0, 1 - v * (1 - fmS)) + hl * Math.max(0, 1 - v * (1 - fmL));
          } else if (p === 1) {
            // grazing falls on palatable plants; grasses shrug much of it off
            const v = this.tPal[s] * this.tGraze[s];
            nb *= hs * Math.max(0, 1 - v * (1 - fpS)) + hl * Math.max(0, 1 - v * (1 - fpL));
          }
          if (p === 1) { pS += nb * hs; pL += nb * hl; }
          if (nb < EXTINCT) nb = 0;
        }
        B[base + s] = nb;
        if (nb > 0) {
          pres[base + w++] = s;
          total[s] += nb; range[s]++;
          if (nb > 1e-4) kmask |= 1 << tKing[s];
          if (tKing[s] === archK) methane += nb; // archaea include the methanogens
          const h = tHab[s];
          sumT[s] += nb * (h === 0 ? this.zTs[z] : h >= 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]));
          sumN2[s] += nb * (h === 0 ? this.zDs[z] : this.zMl[z]);
          if (h >= 2) sumA[s] += nb * this.zHl[z];
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
    if (this.tick % 10 === 5) this.wildfires();
    if (this.tick % 4 === 0) this.disperse();
    this.evolve();
    if (this.tick % 20 === 0) this.checkIsolation();
    // tell the planet what the biosphere is doing
    P.primaryProduction = prodTotal / Z;
    P.landProduction = landProd / Z;
    P.methaneProduction = methane / Z;
    this.applyToPlanet();
  }

  // Wildfires: dry land with plenty of fuel burns now and then, once there is enough oxygen
  // (fires need ~13%). Trees burn; grasses resprout and their dry stems are good fuel, so in
  // seasonally dry places fire and grass hold back the forest: savannas.
  wildfires() {
    const P = this.planet, B = this.B, Z = this.Z;
    const zf = this.zFire || (this.zFire = new Float32Array(Z));
    const ox = Math.min(1, Math.max(0, (P.o2 - 12.5) / 5));
    let fires = 0;
    for (let z = 0; z < Z; z++) {
      zf[z] *= 0.97;
      if (!ox || this.zLand[z] < 0.3 || this.zTl[z] < 5) continue;
      const dry = Math.max(0, 0.6 - this.zMl[z]) * 2.5;
      if (!dry) continue;
      const base = z * MAXT;
      let fuel = 0;
      for (let a = 0; a < this.presN[z]; a++) {
        const s = this.pres[base + a];
        if (this.tTroph[s] === 1 && this.tHab[s] >= 1 && this.tHab[s] <= 2) fuel += B[base + s] * (this.slots[s].grade === 'grass' ? 2 : 1);
      }
      const load = fuel / Math.max(0.05, this.zKl[z] * this.zLand[z]);
      if (this.rng() > 0.12 * ox * dry * Math.min(1.5, load)) continue;
      fires++;
      zf[z] += 1;
      for (let a = 0; a < this.presN[z]; a++) {
        const s = this.pres[base + a];
        if (this.tHab[s] === 0 || this.tHab[s] === 3) continue;
        const i = base + s, burnt = B[i] * (1 - this.tFire[s]);
        B[i] -= burnt;
        this.detL[z] += burnt * 0.3; // ash returns nutrients to the soil
      }
    }
    this.firesRecent = (this.firesRecent || 0) * 0.9 + fires;
    if (fires > 3 && !this.innovations.has('fire')) { this.innovations.add('fire'); this.onEvent({ type: 'firstof', key: 'fire' }); }
  }

  disperse() {
    const B = this.B, zg = this.zgrid, pres = this.pres, presN = this.presN, Z = this.Z;
    const ok = this._okCache || (this._okCache = new Uint8Array(Z * 4));
    for (let z = 0; z < Z; z++) for (let h = 0; h < 4; h++) ok[z * 4 + h] = this.habitatOk(h, z) ? 1 : 0;
    const recZ = this._recZ || (this._recZ = new Int32Array(Z * MAXT));
    const recS = this._recS || (this._recS = new Uint8Array(Z * MAXT));
    const recA = this._recA || (this._recA = new Float32Array(Z * MAXT));
    const recH = this._recH || (this._recH = new Int16Array(Z * MAXT));
    let n = 0;
    // emigration is computed from pre-dispersal populations...
    for (let z = 0; z < Z; z++) {
      const base = z * MAXT, k0 = zg.nbrStart[z], k1 = zg.nbrStart[z + 1];
      for (let a = 0; a < presN[z]; a++) {
        const s = pres[base + a], b = B[base + s];
        if (b < (this.tTroph[s] === 6 ? 2e-6 : 1e-4)) continue;
        const h = this.tHab[s];
        let cnt = 0;
        const host = this.tTroph[s] === 6 ? this.tHost[s] : -1;
        const fits = (q) => ok[q * 4 + h] && (host < 0 || B[q * MAXT + host] > 1e-4); // parasites only spread to their hosts
        for (let k = k0; k < k1; k++) if (fits(zg.nbr[k])) cnt++;
        if (!cnt) continue;
        // dispersal rises with crowding: sparse populations mostly stay put instead of
        // smearing themselves too thin to breed (runs every 4th tick)
        // (parasites travel inside their hosts, so they spread even when few)
        const out = b * Math.min(0.5, this.tDisp[s] * 4) * (this.tTroph[s] === 6 ? 1 : b / (b + 0.0015));
        B[base + s] = b - out;
        recZ[n] = z; recS[n] = s; recA[n] = out / cnt; n++;
        recH[n - 1] = host + 1;
      }
    }
    // ...then settles in neighbouring zones that offer the right habitat
    for (let r = 0; r < n; r++) {
      const z = recZ[r], s = recS[r], share = recA[r], h = this.tHab[s], host = recH[r] - 1;
      for (let k = zg.nbrStart[z]; k < zg.nbrStart[z + 1]; k++) {
        const q = zg.nbr[k];
        if (ok[q * 4 + h] && (host < 0 || B[q * MAXT + host] > 1e-4)) this.addB(q, s, share);
      }
    }
  }

  evolve() {
    const rng = this.rng;
    const nA = this.alive.length;
    const gradeCounts = {}, bins = new Map();
    for (const s of this.alive) {
      const sp = this.slots[s];
      gradeCounts[gkey(sp)] = (gradeCounts[gkey(sp)] || 0) + 1;
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
      // (lake and river species are naturally confined to a few places, so they get more leeway)
      const ab = abundance(sp);
      if (ab < 2e-4 || (ab < 3e-3 && sp.range <= (sp.habitat === 3 ? 1 : 3) && this.tick - sp.born > 150)) { this.extinct(s); continue; }
      // a new kind of life counts once it has taken hold, not when a doomed first mutant appears
      if (!sp.estab && sp.range >= 4 && this.tick - sp.born > 25) this.establish(sp);
      // anagenesis: populations adapt to the temperatures they actually live in
      if (this.tick % 5 === 0) {
        const k = 0.02 * this.mutationRate;
        sp.pref += (this.sumT[s] / sp.total - sp.pref) * k;
        sp.n2 += (this.sumN2[s] / sp.total - sp.n2) * k;
        if (sp.habitat >= 2) sp.alt += (this.sumA[s] / sp.total - sp.alt) * k;
        this.tPref[s] = sp.pref;
        if (this.tick % 40 === 0) this.refreshSuit(s);
      }
      // speciation: a population splits off and goes its own way (a globe-spanning intelligent
      // species keeps exchanging genes and ideas, so it stays one species)
      if (nA >= SPEC_CAP || sp.grade === 'sapient') continue;
      const rangeF = Math.max(0.2, Math.min(2.5, sp.range / 25));
      // diversity-dependent diversification: species packed into the same niche split more slowly
      const nB = bins.get(sp._bin)?.length ?? 1, nG = gradeCounts[gkey(sp)];
      const gCap = capOf(gkey(sp));
      const crowded = Math.exp(-(nB - 1) / 2) * (nG > gCap ? Math.exp(-(nG - gCap) / 4) : 1) * (nA > SOFT_CAP ? Math.exp(-(nA - SOFT_CAP) / 25) : 1);
      // (colonies have few breeders, so social insects split into new species more slowly)
      const pSpec = 0.0009 * this.mutationRate * rangeF * (sp.sexual ? 1.5 : 1) * crowded * opp * (1 - 0.6 * (sp.ph?.sociality || 0) * (sp.ph?.skeleton === 'exo' ? 1 : 0));
      if (rng() < pSpec) this.speciate(sp, sp.grade);
      // sexual selection: in showy animals, mate choice alone can split a population
      const SS = (SEXUAL_SELECTION[sp.grade] || 0) * (0.4 + 1.2 * sp.genes[GI.display]);
      if (SS && sp.sexual && rng() < 0.0004 * SS * this.mutationRate * rangeF * crowded * opp) {
        const z = this.pickZone(sp);
        if (z >= 0) this.speciate(sp, sp.grade, z, null, 'sexual');
      }
    }
    // Competitive exclusion: species sharing one niche can't all persist; the rarest is squeezed
    // out. A grade with far too many species also loses its rarest.
    for (const list of bins.values()) {
      if (list.length < 4 || rng() > 0.02 * (list.length - 3)) continue;
      const worst = list.filter((q) => q.died < 0 && q.grade !== 'sapient' && this.tick - q.born > 100).sort((a, b) => abundance(a) - abundance(b))[0];
      if (worst) { worst.outcompeted = true; this.extinct(worst.slot); }
    }
    for (const g in gradeCounts) {
      const nG = gradeCounts[g], cap = capOf(g) + 2;
      if (nG <= cap || rng() > 0.025 * (nG - cap)) continue;
      let worst = null;
      for (const s of this.alive) {
        const sp = this.slots[s];
        if (gkey(sp) === g && g !== 'sapient' && this.tick - sp.born > 100 && (!worst || abundance(sp) < abundance(worst))) worst = sp;
      }
      if (worst) { worst.outcompeted = true; this.extinct(worst.slot); }
    }
    // Colonising fresh water: now and then a population living beside a river or lake founds a
    // freshwater species (most fail; the ones that fit the river or lake spread along it)
    if (nA < SPEC_CAP && rng() < 0.003 * this.transitionRate * (nA > SOFT_CAP ? Math.exp(-(nA - SOFT_CAP) / 30) : 1)) {
      const sp = this.slots[this.alive[Math.floor(rng() * nA)]];
      if (sp && sp.habitat !== 3 && sp.grade !== 'sapient' && sp.grade !== 'lichen' && sp.grade !== 'whale') {
        const z = this.pickZone(sp, (q) => this.habitatOk(3, q));
        if (z >= 0) this.speciate(sp, sp.grade, z, null, 'colonise');
      }
    }
    // New parasites: now and then a protist, fungus, worm or small arthropod population takes to
    // living on an abundant host nearby. Parasitism has evolved hundreds of times on Earth.
    if (nA < SPEC_CAP && rng() < 0.025 * this.transitionRate * (nA > SOFT_CAP ? Math.exp(-(nA - SOFT_CAP) / 30) : 1)) {
      const sp = this.slots[this.alive[Math.floor(rng() * nA)]];
      const ph = sp?.ph;
      const able = ph && ph.euk && !ph.photo && sp.trophic !== TROPHIC.PARASITE && ph.skeleton !== 'endo' && !ph.lichen &&
        (ph.level <= 1 || ph.fungus || (ph.animal && (ph.skeleton === 'none' || ph.size < 0.2)));
      if (able) { const z = this.pickZone(sp); if (z >= 0) this.speciate(sp, sp.grade, z, null, 'parasite'); }
    }
    // Social insects: now and then an insect lineage takes to living in colonies with queens and
    // workers (it happened at least a dozen times on Earth: ants, bees, wasps, termites)
    if (nA < SPEC_CAP && rng() < 0.0015 * this.transitionRate) {
      const insects = this.alive.map((q) => this.slots[q]).filter((q) => q.grade === 'insect' && q.trophic !== TROPHIC.PARASITE && q.range >= 10);
      const sp = insects[Math.floor(rng() * insects.length)];
      if (sp) { const z = this.pickZone(sp); if (z >= 0) this.speciate(sp, sp.grade, z, null, 'social'); }
    }
    // Poisons: now and then a prey animal that predators hunt takes up a chemical defence (often
    // from what it eats, as poison frogs and monarchs do), and with it, bright warning colours
    if (nA < SPEC_CAP && rng() < 0.004 * this.transitionRate) {
      const prey = this.alive.map((q) => this.slots[q]).filter((q) => q.ph?.animal && q.ph.level === 3 && q.trophic !== TROPHIC.PARASITE && q.trophic !== TROPHIC.PREDATOR && q.range >= 8 && q.ph.poison < 0.6);
      const sp = prey[Math.floor(rng() * prey.length)];
      if (sp) { const z = this.pickZone(sp); if (z >= 0) this.speciate(sp, sp.grade, z, null, 'poison'); }
    }
    if (this.tick % 50 === 0) { this.analyseWeb(); this.updateMimicry(); }
    // Background turnover: a crowded biosphere keeps losing its rarest species, so there is always
    // room for new ones and evolution never stalls at the species limit
    if (nA > SOFT_CAP + 10 && rng() < 0.012 * (nA - SOFT_CAP - 10) / 10) {
      let worst = null;
      for (const s of this.alive) {
        const sp = this.slots[s];
        if (sp.grade === 'sapient' || sp.seeded || this.tick - sp.born < 150) continue;
        if (!worst || abundance(sp) < abundance(worst)) worst = sp;
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
      const nTo = gradeCounts[t.to] || 0, capTo = capOf(t.to);
      const repeat = this.innovations.has(t.key) || this.originsOf(t.to) > 0 ? 0.3 * (nTo > capTo / 2 ? Math.exp(-(nTo - capTo / 2) / 2) : 1) : 1;
      if (rng() >= t.p * this.transitionRate * Math.min(4, Math.max(0.6, weight / 25)) * repeat * Math.sqrt(opp)) continue;
      let r = rng() * weight, sp = cands[0][0];
      for (const [c, w] of cands) { r -= w; if (r <= 0) { sp = c; break; } }
      const z = this.pickZone(sp, (q) => t.need(this, q, sp) && (t.hab === undefined || this.habitatOk(t.hab, q)));
      if (z >= 0) this.speciate(sp, t.to, z, t);
    }
    // Developmental innovations: now and then a lineage produces a mutant with a big change in
    // one gene its body plan can easily alter (more segments, a lost shell, legs, a bigger brain).
    // Most such mutants fail; the few that fit the planet found new kinds of life. Rolled once per
    // kind of life, so the pace doesn't depend on how many species there are.
    if (nA < SPEC_CAP) {
      const pools = new Map();
      for (const s of this.alive) {
        const sp = this.slots[s];
        if (sp.grade === 'sapient') continue;
        let pool = pools.get(sp.grade);
        if (!pool) pools.set(sp.grade, (pool = { w: 0, list: [] }));
        const w = Math.min(60, sp.range);
        pool.w += w; pool.list.push([sp, w]);
      }
      // a crowded biosphere leaves less room for experiments
      const room = nA > SOFT_CAP ? Math.exp(-(nA - SOFT_CAP) / 30) : 1;
      for (const pool of pools.values()) {
        if (!pool.w || rng() >= 0.005 * room * this.transitionRate * Math.min(4, Math.max(0.6, pool.w / 25)) * Math.sqrt(opp)) continue;
        let r = rng() * pool.w, sp = pool.list[0][0];
        for (const [c, w] of pool.list) { r -= w; if (r <= 0) { sp = c; break; } }
        const z = this.pickZone(sp);
        if (z >= 0) this.speciate(sp, sp.grade, z, null, 'innovation');
      }
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
      if (!sp || sp.range < 6 || sp.grade === 'sapient') { if (sp) sp.isolates = null; continue; }
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
    const nB = this._bins?.get(sp._bin)?.length ?? 1, nG = this._gradeCounts?.[gkey(sp)] ?? 1;
    const gCap = capOf(gkey(sp)), nA = this.alive.length;
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
    const genes = mutate(sp.genes, rng, gaussian, 0.6 * this.mutationRate, evolvable(sp, sp.ph));
    const child = this.createSpecies(sp.grade, {
      parent: sp.id, habitat: sp.habitat, sexual: sp.sexual, genes, domain: sp.domain, mito: sp.mito, chloro: sp.chloro,
      pref: T / w + gaussian(rng) * 1.5, tol: sp.tol * Math.exp(gaussian(rng) * 0.08),
      n2: clamp01(n2 / w + gaussian(rng) * 0.05), n2tol: sp.n2tol, alt: clamp01(alt / w), altTol: sp.altTol,
      years: this.years, host: sp.host,
    });
    if (!child) return null;
    // the island rule: on small islands, small animals tend to grow large (Komodo dragons) and
    // large ones shrink (dwarf elephants), as food and predators are scarce
    const island = sp.habitat !== 0 && frag.zones.length <= 10 && frag.zones.every((z) => this.zSea[z] > 0.35);
    if (island) {
      child.island = true;
      if (sp.kingdom === 'animal') {
        const old = child.size, g = child.genes;
        if (old < 0.35) g[GI.size] = Math.min(1, g[GI.size] + 0.3);
        else if (old > 0.6) g[GI.size] = Math.max(0.05, g[GI.size] - 0.35);
        this.develop(child);
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
    // walk the zones from a random start (with a stride, so picks spread over the globe) until
    // enough candidates turn up; a rare kind of zone (a coast) is still found when it exists
    const Z = this.Z, start = Math.floor(this.rng() * Z), stride = 997;
    let found = 0;
    for (let k = 0; k < Z && found < 12; k++) {
      const z = (start + k * stride) % Z;
      if (this.B[z * MAXT + s] < 1e-4 || !pred(z)) continue;
      found++;
      const h = sp.habitat;
      const T = h === 0 ? this.zTs[z] : h >= 2 ? this.zTl[z] : 0.5 * (this.zTs[z] + this.zTl[z]);
      const score = -Math.abs(T - sp.pref) + this.rng() * 6;
      if (score < bestScore) { bestScore = score; best = z; }
    }
    return best;
  }

  // A population splits off as a new species. Its genes mutate (now and then with a big
  // developmental jump), and it adapts to the place it was founded. `transition` is a merger or
  // split from TRANSITIONS; mode 'sexual' is a split by mate choice alone.
  speciate(sp, grade, z = this.pickZone(sp), transition = null, mode = 'peripatric') {
    if (z < 0) return null;
    const rng = this.rng;
    const sexualSel = mode === 'sexual';
    let habitat = sp.habitat;
    let genes = mutate(sp.genes, rng, gaussian, sexualSel ? 0.3 : this.mutationRate, evolvable(sp, sp.ph));
    let domain = sp.domain, mito = sp.mito, chloro = sp.chloro, lichen = sp.lichen;
    // predators select on looks: a species living beside a poisonous model tends to come to look
    // like it (mimicry), and a poisonous species tends to become conspicuous (warning colours)
    if (!transition && sp.ph?.animal && sp.ph.level === 3) {
      const model = sp.modelId ? this.species.get(sp.modelId) : null;
      if (model && model.died < 0 && rng() < 0.35) convergeLooks(genes, model.genes, rng, 0.45);
      else if ((sp.eco?.tox || 0) > 0.4 && (sp.eco?.conspic || 0) < 0.7 && rng() < 0.3) {
        genes[GI.display] = Math.min(1, genes[GI.display] + 0.12 + 0.1 * rng());
        genes[GI.patternSize] = Math.min(1, genes[GI.patternSize] + 0.1);
      }
    }
    if (sexualSel) {
      // speciation by mate choice: same niche, a new courtship display and colours
      genes[GI.display] = Math.min(1, genes[GI.display] + 0.1);
      sexualLooks(genes, rng, gaussian);
    } else if (mode === 'colonise') {
      habitat = 3;
    } else if (mode === 'poison') {
      genes[GI.toxins] = 0.75 + 0.2 * rng();
      // usually advertised with bold colours; sometimes kept hidden
      if (rng() < 0.7) { genes[GI.display] = Math.min(1, genes[GI.display] + 0.35 + 0.2 * rng()); genes[GI.patternSize] = Math.min(1, genes[GI.patternSize] + 0.25); if (genes[GI.pattern] < 0.14) genes[GI.pattern] = 0.15 + 0.3 * rng(); }
    } else if (mode === 'social') {
      genes[GI.sociality] = 0.65 + 0.25 * rng();
    } else if (mode === 'parasite') {
      genes[GI.parasitism] = 0.7 + 0.2 * rng();
      genes[GI.size] *= 0.6;
    } else if (mode === 'innovation') {
      const before = genes[GI.landAdapt];
      const gene = innovate(genes, sp, sp.ph, rng);
      // a mutant that copes better (or worse) with drying out moves up (or down) the shore
      if (gene === 'landAdapt') {
        const up = genes[GI.landAdapt] > before, h0 = sp.habitat;
        const h = up ? (h0 === 3 ? 2 : Math.min(2, h0 + 1)) : h0 === 2 ? (rng() < 0.5 ? 1 : 3) : h0 === 1 ? 0 : h0;
        const z2 = h === sp.habitat ? -1 : this.habitatOk(h, z) ? z : this.pickZone(sp, (q) => this.habitatOk(h, q));
        if (z2 >= 0) { habitat = h; z = z2; }
      }
    } else if (transition) {
      const m = transition.make(sp);
      domain = m.domain ?? domain; mito = m.mito ?? mito; chloro = m.chloro ?? chloro; lichen = m.lichen ?? lichen;
      if (transition.hab !== undefined) habitat = transition.hab;
      if (m.genes) for (const k in m.genes) genes[GI[k]] = m.genes[k];
      randomLooks(genes, rng);
    } else if (rng() < 0.2) {
      // move into the neighbouring habitat: sea ↔ coast ↔ land, founded somewhere in the range
      // that has it (a sea creature colonises the shore from a coastal population)
      // (fresh water connects to the shore through estuaries and to the land through swamps)
      // a population living beside a river is the likeliest to move into it
      const r = rng(), river = sp.habitat !== 3 && this.habitatOk(3, z) && rng() < 0.5;
      const h = river ? 3 : sp.habitat === 0 ? (r < 0.75 ? 1 : 3) : sp.habitat === 1 ? (r < 0.4 ? 0 : r < 0.75 ? 2 : 3) : sp.habitat === 2 ? (r < 0.6 ? 1 : 3) : r < 0.5 ? 1 : 2;
      const z2 = this.habitatOk(h, z) ? z : this.pickZone(sp, (q) => this.habitatOk(h, q));
      if (z2 >= 0) { habitat = h; z = z2; }
    }
    if (!this.habitatOk(habitat, z)) {
      if (habitat === sp.habitat) return null;
      habitat = sp.habitat;
    }
    // the founders adapt to their home: drying shores and land select for waterproof skins,
    // lungs and seeds; the open sea lets them go. Shores are where life rehearses for land.
    if (!transition && !sexualSel) {
      const la = genes[GI.landAdapt], target = LAND_TARGET[habitat];
      genes[GI.landAdapt] = Math.max(0, Math.min(1, la + (target - la) * (habitat !== sp.habitat ? 0.6 : 0.3) * (0.7 + 0.6 * rng())));
    }
    const L = this.localNiche(habitat, z);
    const shift = sexualSel ? 0.1 : 0.5;
    const pref = sp.pref + (L.T - sp.pref) * shift + gaussian(rng) * (sexualSel ? 0.5 : 3);
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const n2 = clamp01(habitat === sp.habitat ? sp.n2 + (L.n2 - sp.n2) * shift + gaussian(rng) * (sexualSel ? 0.02 : 0.1) : L.n2);
    const alt = clamp01(habitat === 2 ? (sp.habitat === 2 ? sp.alt : L.alt) + (L.alt - sp.alt) * shift + gaussian(rng) * (sexualSel ? 0.02 : 0.08) : 0);
    const tol = Math.max(3, Math.min(30, sp.tol * Math.exp(gaussian(rng) * 0.15)));
    const eukaryote = domain === 'eukaryote';
    const sexual = eukaryote && (sp.sexual || rng() < 0.15);
    const child = this.createSpecies(grade, { parent: sp.id, genes, domain, mito, chloro, lichen, habitat, pref, tol, sexual, n2, alt, years: this.years,
      n2tol: Math.max(0.08, Math.min(1.2, sp.n2tol * Math.exp(gaussian(rng) * 0.15))), altTol: sp.altTol });
    if (!child) return null;
    // a new body plan brings a new climate tolerance with it (warm blood, a brain…)
    if (child.grade !== sp.grade) { child.tol = Math.max(3, Math.min(30, 0.5 * (child.tol + child.eco.tol))); this.setParams(child); }
    child.host = transition ? 0 : this.chooseHost(sp, child, z);
    // a parasite lives wherever its host does
    if (child.trophic === TROPHIC.PARASITE && child.host) {
      // a parasite lives inside its host, so it shares the host's habitat and climate
      const host = this.species.get(child.host);
      Object.assign(child, { habitat: host.habitat, pref: host.pref, tol: Math.max(child.tol, host.tol), n2: host.n2, n2tol: host.n2tol, alt: host.alt, altTol: host.altTol });
      this.develop(child); this.refreshSuit(child.slot);
    }
    if (child.host) this.setParams(child);
    if (sexualSel) child.display = true;
    // the founding population: part of the parent's local population becomes the new species
    const zg = this.zgrid;
    const big = transition || mode === 'innovation' || child.grade !== sp.grade;
    const hostSlot = child.trophic === TROPHIC.PARASITE && child.host ? this.species.get(child.host)?.slot : -1;
    const take = (q, frac) => {
      const pb = this.B[q * MAXT + sp.slot];
      if (pb <= 0) return;
      // a new parasite starts small, only where its host lives
      if (child.trophic === TROPHIC.PARASITE) {
        const hb = hostSlot >= 0 ? this.B[q * MAXT + hostSlot] : 0;
        if (hb > 0) this.addB(q, child.slot, Math.min(pb * frac, hb * 0.05));
        return;
      }
      const amt = pb * frac;
      if (habitat === sp.habitat) this.B[q * MAXT + sp.slot] -= amt;
      if (this.habitatOk(habitat, q)) this.addB(q, child.slot, Math.max(amt, big ? 0.01 : 0));
    };
    take(z, big ? 0.3 : 0.5);
    for (let k = zg.nbrStart[z]; k < zg.nbrStart[z + 1]; k++) take(zg.nbr[k], big ? 0.15 : 0.25);
    if (sexual && !sp.sexual) this.onEvent({ type: 'sex', species: child });
    if (transition) child.merger = transition.key;
    if (!transition) {
      this.onEvent({ type: sexualSel ? 'sexualsel' : 'speciation', species: child, parent: sp });
      this.logSpeciation(child);
      this.cospeciate(sp, child, [z]);
    }
    return child;
  }

  // A species that has taken hold. If it is a new kind of life, the story moves on; if its kind
  // already evolved elsewhere from a different ancestor, that is convergent evolution.
  establish(sp) {
    sp.estab = true;
    // firsts in the web of life
    if (sp.trophic === TROPHIC.PARASITE && !this.innovations.has('parasites')) { this.innovations.add('parasites'); this.onEvent({ type: 'firstof', key: 'parasites', species: sp }); }
    if (sp.ph?.partner === 'algae' && !this.innovations.has('corals')) { this.innovations.add('corals'); this.onEvent({ type: 'firstof', key: 'corals', species: sp }); }
    for (const [key, ok] of [['toxins', sp.ph?.toxins > 0.6], ['care', sp.ph?.care > 0.6 && sp.ph?.animal], ['metamorphosis', sp.ph?.metamorphosis > 0.6], ['migration', sp.ph?.migration > 0.6], ['aposematism', (sp.eco?.warning || 0) > 0.35 && sp.eco.conspic > 0.5]]) {
      if (ok && !this.innovations.has(key)) { this.innovations.add(key); this.onEvent({ type: 'firstof', key, species: sp }); }
    }
    if (sp.ph?.partner === 'gut' && !this.innovations.has('gut')) { this.innovations.add('gut'); this.onEvent({ type: 'firstof', key: 'gut', species: sp }); }
    // the first life to settle in rivers and lakes
    if (sp.habitat === 3 && !this.innovations.has('freshwater')) {
      this.innovations.add('freshwater');
      this.onEvent({ type: 'freshwater', species: sp });
    }
    const parent = sp.parent ? this.species.get(sp.parent) : null;
    const seen = (this.groupsSeen ||= new Set());
    if (!parent) { seen.add(sp.grade); return; } // life the player (or the scenario) put there
    if (parent.grade === sp.grade) return;
    // a lineage drifting back into a group its recent ancestors belonged to is a reversal,
    // not a new origin
    for (let a = parent, k = 0; a && k < 12; a = a.parent ? this.species.get(a.parent) : null, k++) if (a.grade === sp.grade) return;
    const n = (this.groupOrigins[sp.grade] = (this.groupOrigins[sp.grade] || 0) + 1);
    const keys = storyKeysFor(sp.grade, sp.ph).filter((k, i, a) => a.indexOf(k) === i && !this.innovations.has(k));
    for (const key of keys) {
      this.innovations.add(key);
      this.onEvent({ type: 'transition', key, first: true, species: sp, parent });
    }
    const first = !seen.has(sp.grade);
    seen.add(sp.grade);
    // convergence worth announcing: the group evolving again from a different kind of ancestor
    const from = ((this.groupFrom ||= {})[sp.grade] ||= []);
    const novelSource = !from.includes(parent.grade);
    if (novelSource) from.push(parent.grade);
    if (first) this.onEvent({ type: 'newgroup', species: sp, parent, grade: sp.grade });
    else if (!sp.merger && novelSource && n > 1) this.onEvent({ type: 'convergent', species: sp, parent, grade: sp.grade, count: n });
  }

  // Specialist herbivores: insects (and other land arthropods) may specialise on one plant
  // species, inheriting their parent's host or switching to another plant growing nearby.
  chooseHost(parent, child, z) {
    const grade = child.grade;
    if (child.trophic === TROPHIC.PARASITE) return this.chooseParasiteHost(parent, child, z);
    if (!(grade === 'insect' || (grade === 'arthropod' && child.habitat !== 0)) || child.trophic !== TROPHIC.GRAZER) return 0;
    const rng = this.rng;
    const inherited = parent.host && this.species.get(parent.host)?.died < 0 ? parent.host : 0;
    if (inherited && rng() < 0.65) return inherited;
    if (rng() > 0.45) return inherited;
    const plants = [];
    for (let a = 0; a < this.presN[z]; a++) {
      const s = this.pres[z * MAXT + a], q = this.slots[s];
      if (q && q.kingdom === 'plant' && q.habitat !== 0 && this.B[z * MAXT + s] > 1e-3) plants.push(q);
    }
    if (!plants.length) return inherited;
    // specialists favour well-defended plants: food that few others can eat
    let tot = 0;
    for (const q of plants) tot += 0.3 + (q.ph?.toxins || 0);
    let r = rng() * tot;
    for (const q of plants) { r -= 0.3 + (q.ph?.toxins || 0); if (r <= 0) return q.id; }
    return plants[plants.length - 1].id;
  }

  // A parasite keeps its parent's host, or now and then jumps to another host living nearby
  // (most new diseases start this way). Hosts are complex plants and animals, chosen by abundance.
  chooseParasiteHost(parent, child, z) {
    const rng = this.rng;
    const inherited = parent.trophic === TROPHIC.PARASITE && parent.host && this.species.get(parent.host)?.died < 0 ? parent.host : 0;
    if (inherited && rng() < 0.75) return inherited;
    const fungal = child.kingdom === 'fungus';
    let tot = 0;
    const cands = [];
    for (let a = 0; a < this.presN[z]; a++) {
      const s = this.pres[z * MAXT + a], q = this.slots[s];
      if (!q || q === child || !q.ph || q.ph.level < 2 || q.trophic === TROPHIC.PARASITE || q.grade === 'lichen') continue;
      const b = this.B[z * MAXT + s];
      if (b < 1e-3) continue;
      // fungi mostly attack plants, the rest mostly animals
      const w = b * (q.kingdom === 'plant' ? (fungal ? 1 : 0.15) : q.kingdom === 'animal' ? (fungal ? 0.3 : 1) : 0.1);
      cands.push([q, w]); tot += w;
    }
    if (!tot) return inherited;
    let r = rng() * tot;
    for (const [q, w] of cands) { r -= w; if (r <= 0) return q.id; }
    return cands[cands.length - 1][0].id;
  }

  // Cospeciation: when a host splits, its specialists and parasites often split with it (the
  // matching family trees of figs and fig wasps, or of lice and their birds).
  cospeciate(parentPlant, childPlant, zones) {
    for (const s of this.alive.slice()) {
      const q = this.slots[s];
      if (!q || q.host !== parentPlant.id || this.rng() > 0.35 || this.alive.length >= MAXT - 5) continue;
      const z = zones.find((zz) => this.B[zz * MAXT + s] > 1e-4) ?? this.pickZone(q);
      if (z === undefined || z < 0) continue;
      const genes = mutate(q.genes, this.rng, gaussian, 0.4 * this.mutationRate, evolvable(q, q.ph));
      const kid = this.createSpecies(q.grade, { parent: q.id, habitat: q.habitat, genes, domain: q.domain, mito: q.mito, chloro: q.chloro, pref: childPlant.pref, tol: q.tol, n2: childPlant.n2, alt: childPlant.alt, sexual: q.sexual, host: childPlant.id, years: this.years });
      if (!kid) return;
      const amt = this.B[z * MAXT + s] * 0.5;
      this.B[z * MAXT + s] -= amt;
      this.addB(z, kid.slot, Math.max(amt, 2e-4));
      kid.cospeciated = true;
      if (kid.trophic === TROPHIC.PARASITE) kid.host = childPlant.id, this.setParams(kid);
      this.onEvent({ type: 'cospeciation', species: kid, parent: q, host: childPlant });
    }
  }

  // Who prefers to eat whom. Predators take prey of a size they can handle: hunters about a
  // third of their own size, filter-feeders much smaller animals. (Defences and where each lives
  // are applied when they meet.)
  buildLinks() {
    this.webDirty = false;
    const L = this.link, alive = this.alive;
    L.fill(0);
    for (const s of alive) {
      if (this.wHerb[s] === 0) continue;
      const pred = this.slots[s], ph = pred.ph;
      const centre = ph && (ph.level === 2 || ph.radial || !ph.motile) ? -2.2 : -1.0;
      const ps = (pred.size || 0) + 0.04;
      for (const q of alive) {
        if (q === s || this.tPool[q] !== 2) continue;
        const r = Math.log((this.slots[q].size + 0.04) / ps) - centre;
        L[s * MAXT + q] = Math.exp(-0.5 * (r / 0.85) ** 2);
      }
    }
  }

  // Every 50 ticks: which predators hold their prey in check (keystone species), and whether
  // losing one set off a trophic cascade
  analyseWeb() {
    const F = this.flow, alive = this.alive;
    const inflow = new Float32Array(MAXT);
    for (const p of alive) for (const q of alive) inflow[q] += F[p * MAXT + q];
    const animals = alive.map((s) => this.slots[s]).filter((q) => q.ph?.animal && q.trophic !== TROPHIC.PARASITE).map((q) => q.total).sort((a, b) => a - b);
    const common = animals.length ? animals[Math.floor(animals.length * 0.6)] : Infinity;
    for (const p of alive) {
      const sp = this.slots[p];
      sp.keystone = null;
      if (sp.trophic === TROPHIC.PARASITE || this.wHerb[p] === 0 || sp.range < 15) continue;
      const held = [];
      for (const q of alive) {
        const f = F[p * MAXT + q];
        if (f > 0 && f > 0.5 * inflow[q] && this.slots[q].total >= common) held.push(this.slots[q].id);
      }
      if (held.length) sp.keystone = held;
    }
    for (let i = 0; i < F.length; i++) F[i] *= 0.5;
    // cascades: prey released from their keystone predator boom
    this.pendingCascades = this.pendingCascades.filter((c) => {
      if (this.tick - c.tick < 150) return true;
      let best = null, ratio = 1;
      for (const { id, total } of c.prey) {
        const q = this.species.get(id);
        if (!q || q.died >= 0 || !total) continue;
        if (q.total / total > ratio) { ratio = q.total / total; best = q; }
      }
      if (best && ratio > 1.5) this.onEvent({ type: 'cascade', species: c.pred, prey: best, ratio });
      return false;
    });
  }

  // Warning colours and mimicry. Poisonous animals that look it are models; any animal living
  // alongside one, of about the same size, that looks like it is partly protected too, because
  // predators that learned to avoid the model avoid it as well (Batesian mimicry if it is good to
  // eat, Müllerian if it is poisonous too). Each animal also remembers the model it could most
  // profit from copying, which steers how its daughter species' looks evolve (speciate).
  updateMimicry() {
    const Z = this.Z, B = this.B, alive = this.alive;
    const models = alive.filter((s) => (this.slots[s].eco?.warning || 0) > 0.3 && this.slots[s].eco.conspic > 0.5);
    for (const s of alive) { const sp = this.slots[s]; if (sp.mimicP || sp.mimic || sp.modelId) { sp.mimicP = 0; sp.mimic = 0; sp.modelId = 0; this.tVuln[s] = this.tVuln0[s]; } }
    if (!models.length) return;
    // how many of each animal's zones each model shares
    const nm = models.length, share = new Float32Array(MAXT * nm), occ = new Float32Array(MAXT), here = new Uint8Array(nm);
    for (let z = 0; z < Z; z++) {
      let any = 0;
      for (let k = 0; k < nm; k++) { here[k] = B[z * MAXT + models[k]] > 1e-4 ? 1 : 0; any |= here[k]; }
      for (let a = 0; a < this.presN[z]; a++) {
        const s = this.pres[z * MAXT + a];
        if (B[z * MAXT + s] < 1e-4) continue;
        occ[s]++;
        if (any) for (let k = 0; k < nm; k++) if (here[k]) share[s * nm + k]++;
      }
    }
    for (const s of alive) {
      const sp = this.slots[s];
      if (!sp.ph?.animal || sp.ph.level < 3 || sp.trophic === TROPHIC.PARASITE || !occ[s]) continue;
      let best = 0, bestM = null, pot = 0;
      for (let k = 0; k < nm; k++) {
        const m = models[k], M = this.slots[m];
        if (m === s || !share[s * nm + k] || Math.abs(M.size - sp.size) > 0.25 || M.habitat !== sp.habitat && (M.habitat === 0) !== (sp.habitat === 0)) continue;
        const ov = share[s * nm + k] / occ[s], sim = lookSimilarity(sp, M);
        const prot = M.eco.warning * Math.max(0, (sim - 0.55) / 0.45) * ov;
        if (prot > best) { best = prot; bestM = M; }
        if (M.eco.warning * ov > pot) { pot = M.eco.warning * ov; sp.modelId = M.id; }
      }
      sp.mimicP = Math.min(0.9, best);
      sp.mimic = bestM && best > 0.15 ? bestM.id : 0;
      this.tVuln[s] = this.tVuln0[s] * (1 - 0.5 * sp.mimicP);
      if (sp.mimic && (sp.eco.tox || 0) < 0.3 && sp.estab && !this.innovations.has('mimicry')) {
        this.innovations.add('mimicry');
        this.onEvent({ type: 'firstof', key: 'mimicry', species: sp, model: bestM });
      }
    }
  }

  // Biogeographic realms: group zones by which species they share (k-means on species lists),
  // separately for land and sea. Continents long apart grow their own faunas, so the realms show
  // where drifting plates have isolated life (like Wallace's Line between Asia and Australia).
  computeRealms(K = 7) {
    const Z = this.Z, B = this.B, rng = this.rng;
    this.realm.fill(-1);
    this.realms = [];
    for (const marine of [false, true]) {
      const zones = [], lists = [];
      for (let z = 0; z < Z; z++) {
        if (marine ? this.zSea[z] < 0.5 : this.zLand[z] < 0.2) continue;
        const list = [];
        for (let a = 0; a < this.presN[z]; a++) {
          const s = this.pres[z * MAXT + a], sp = this.slots[s];
          if (!sp || B[z * MAXT + s] < 1e-4 || sp.ph?.level < 2) continue; // complex life tells realms apart
          if (marine ? sp.habitat !== 0 : sp.habitat === 0) continue;
          list.push(s);
        }
        if (list.length >= 2) { zones.push(z); lists.push(list); }
      }
      if (zones.length < K * 3) continue;
      const k = marine ? Math.max(3, K - 2) : K;
      const sim = (list, c) => { let d = 0; for (const s of list) d += c[s]; return d / Math.sqrt(list.length); };
      // seeds spread apart: each next seed is the zone least like those already chosen
      const cents = [];
      const asCent = (list) => { const c = new Float32Array(MAXT); for (const s of list) c[s] = 1 / Math.sqrt(list.length); return c; };
      cents.push(asCent(lists[Math.floor(rng() * lists.length)]));
      while (cents.length < k) {
        let worst = 0, wv = Infinity;
        for (let i = 0; i < lists.length; i++) { let best = 0; for (const c of cents) best = Math.max(best, sim(lists[i], c)); if (best < wv) { wv = best; worst = i; } }
        cents.push(asCent(lists[worst]));
      }
      const lab = new Int16Array(zones.length);
      for (let it = 0; it < 8; it++) {
        for (let i = 0; i < lists.length; i++) { let bi = 0, bv = -1; cents.forEach((c, j) => { const v = sim(lists[i], c); if (v > bv) { bv = v; bi = j; } }); lab[i] = bi; }
        const sums = cents.map(() => new Float32Array(MAXT)), cnt = new Int32Array(k);
        for (let i = 0; i < lists.length; i++) { cnt[lab[i]]++; for (const s of lists[i]) sums[lab[i]][s] += 1; }
        for (let j = 0; j < k; j++) { let nrm = 0; for (let s = 0; s < MAXT; s++) nrm += sums[j][s] ** 2; nrm = Math.sqrt(nrm) || 1; for (let s = 0; s < MAXT; s++) cents[j][s] = sums[j][s] / nrm; }
      }
      // name each realm after its most characteristic species: common there, rare elsewhere
      const base = this.realms.length;
      for (let j = 0; j < k; j++) {
        const inR = new Float32Array(MAXT), outR = new Float32Array(MAXT);
        let nIn = 0, nOut = 0;
        for (let i = 0; i < lists.length; i++) { const t = lab[i] === j ? inR : outR; if (lab[i] === j) nIn++; else nOut++; for (const s of lists[i]) t[s]++; }
        let best = -1, bv = -Infinity;
        for (let s = 0; s < MAXT; s++) { if (!inR[s]) continue; const v = inR[s] / Math.max(1, nIn) - outR[s] / Math.max(1, nOut); if (v > bv) { bv = v; best = s; } }
        this.realms.push({ marine, zones: nIn, sig: best >= 0 ? this.slots[best] : null });
      }
      zones.forEach((z, i) => { this.realm[z] = base + lab[i]; });
    }
    this.realmsTick = this.tick;
    return this.realms;
  }

  // The food web of one zone, for the food-web view: who lives here and who eats whom.
  webOf(z) {
    const B = this.B, base = z * MAXT, nodes = [], links = [];
    const at = new Map();
    for (let a = 0; a < this.presN[z]; a++) {
      const s = this.pres[base + a], sp = this.slots[s], b = B[base + s];
      if (!sp || b < 1e-4) continue;
      at.set(s, nodes.length);
      nodes.push({ sp, b, slot: s });
    }
    const habOf = (s) => { const h = this.tHab[s]; return h === 0 ? 1 : h === 1 ? 0.5 : 0; };
    const add = (from, to, f, kind) => { if (f > 0) links.push({ from, to, f, kind }); };
    const extra = { det: null, chem: null };
    for (const n of nodes) {
      const s = n.slot, sp = n.sp, hs = habOf(s), hl = 1 - hs;
      if (sp.trophic === 1) continue;
      const parts = [];
      if (sp.trophic === TROPHIC.PARASITE) {
        const h = this.tHost[s];
        if (at.has(h)) add(at.get(h), at.get(s), B[base + h] * n.b, 'parasite');
        continue;
      }
      if (this.wChem[s]) { extra.chem ??= nodes.length + 1000; add('chem', at.get(s), this.wChem[s] * this.zOrg[z] * n.b, 'eat'); }
      if (this.wDet[s]) { add('det', at.get(s), this.wDet[s] * (hs * this.detS[z] + hl * this.detL[z]) * n.b, 'eat'); }
      for (const m of nodes) {
        const q = m.slot;
        if (q === s) continue;
        const qs = habOf(q), ov = hs * qs + hl * (1 - qs);
        if (ov <= 0) continue;
        let f = 0;
        const pool = this.tPool[q];
        if (pool === 0) f = this.wMicro[s] * m.b * this.tVuln[q] * ov;
        else if (pool === 1) f = this.tHost[s] >= 0 && sp.trophic !== TROPHIC.PARASITE ? (this.tHost[s] === q ? this.wProd[s] * m.b : 0) : this.wProd[s] * m.b * ov * this.tPal[q];
        else if (pool === 2) f = this.wHerb[s] * this.link[s * MAXT + q] * m.b * this.tVuln[q] * ov;
        add(at.get(q), at.get(s), f * n.b, 'eat');
      }
    }
    // partnerships
    for (const n of nodes) {
      const sp = n.sp;
      if (sp.ph?.partner === 'algae') { const alg = nodes.find((m) => m.sp.grade === 'algae' || m.sp.grade === 'diatom' || m.sp.grade === 'cyano'); if (alg) add(at.get(alg.slot), at.get(n.slot), 1, 'partner'); }
      if (sp.grade === 'mushroom') for (const m of nodes) if (m.sp.kingdom === 'plant' && m.sp.habitat >= 1 && m.sp.habitat <= 2 && m.sp.grade !== 'moss') { add(at.get(n.slot), at.get(m.slot), 1, 'partner'); break; }
      if (sp.host && sp.trophic === TROPHIC.GRAZER && sp.kingdom === 'animal') { const h = this.tHost[n.slot]; if (at.has(h)) add(at.get(n.slot), at.get(h), 1, 'partner'); }
    }
    return { nodes, links, det: this.detS[z] + this.detL[z], chem: this.zOrg[z] };
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

// A stand-in species (not added to the world) for previewing what the organism designer will
// seed: the archetype's genome with the chosen diet, size and habitat, developed into a body.
export function previewSpecies(grade, opts = {}) {
  const G = GRADES[grade], A = ARCHETYPES[grade];
  const genes = makeGenes(A.genes);
  genes[GI.hue] = opts.hue ?? 0.5;
  if (opts.looks) LOOK_GENES.forEach((k, i) => { genes[GI[k]] = opts.looks[i]; });
  if (opts.trophic !== undefined && G.trophics.includes(opts.trophic)) setDiet(genes, A.domain, opts.trophic);
  if (opts.size !== undefined) genes[GI.size] = Math.max(0.02, Math.min(1, opts.size));
  const sp = { id: 1, genes, domain: A.domain, mito: A.mito, chloro: A.chloro, lichen: !!A.lichen, habitat: opts.habitat ?? G.habitats[0], landAnc: LAND_GROUPS.has(grade) };
  sp.ph = develop(sp);
  sp.trophic = sp.ph.trophic; sp.size = sp.ph.size;
  sp.grade = classify(sp, sp.ph, sp.habitat, grade);
  sp.kingdom = GRADES[sp.grade].kingdom;
  sp.body = describe(sp.ph);
  return sp;
}

export const KINGDOM_HUES = { bacteria: 0.59, archaea: 0.74, protist: 0.48, plant: 0.33, fungus: 0.08, animal: 0.11 };
export { MAXT };
