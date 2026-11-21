// Genomes and development: how a species' genes build its body and decide how it lives.
//
// Every species carries a small genome of continuous genes (0..1), a domain (bacteria, archaea,
// eukaryote) and organelles gained by endosymbiosis (mitochondria, chloroplasts). A developmental
// function turns the genome into a phenotype: how many cells and tissues it has, its symmetry,
// segments, limbs, skeleton, size, wings, brain, metabolism and diet. Ecology is computed from that
// phenotype, and the familiar names (fish, insects, trees…) are just descriptions of what evolved.
// Nothing forces life down Earth's path: groups appear when their genes do, and may never appear.

export const GENES = [
  'adhesion', 'differentiation', 'photo', 'ingest', 'absorb', 'carnivory', 'motility', 'size',
  'symmetry', 'segments', 'limbs', 'skeleton', 'vascular', 'landAdapt', 'endothermy', 'brain',
  'wings', 'display', 'hue', 'covering', 'armour', 'succulence', 'climbing', 'parasitism', 'symbiosis',
  'toxins', 'care', 'metamorphosis', 'sociality', 'migration',
  // looks: heritable, but with no effect on survival (like hue). They drift between species, so
  // relatives share a family look, and sexual selection reshuffles them
  'accent', 'shade', 'pattern', 'patternSize', 'ornament', 'ornamentSize', 'build', 'snout', 'reach', 'tail',
];
export const LOOK_GENES = ['hue', 'accent', 'shade', 'pattern', 'patternSize', 'ornament', 'ornamentSize', 'build', 'snout', 'reach', 'tail'];
export const NG = GENES.length;
export const GI = Object.fromEntries(GENES.map((g, i) => [g, i]));

export const GENE_INFO = {
  adhesion: 'Cells stick together: colonies, then true multicellular bodies',
  differentiation: 'Cells specialise into tissues and organs',
  photo: 'Harvests sunlight (needs chloroplasts in complex cells)',
  ingest: 'Swallows food: other cells, plants or animals',
  absorb: 'Digests food outside the body, like fungi',
  carnivory: 'Prefers prey over plants',
  motility: 'Moves actively',
  size: 'Body size',
  symmetry: 'Radial (jellyfish) to bilateral (a head and a tail)',
  segments: 'Repeated body segments',
  limbs: 'Pairs of limbs or fins',
  skeleton: 'Shell or exoskeleton (low), soft body (middle), internal bones (high)',
  vascular: 'Plant plumbing: water-carrying tubes for height',
  landAdapt: 'Survives drying out: cuticle, lungs, seeds or eggs',
  endothermy: 'Warm blood: steady body heat',
  brain: 'Nervous system and brain',
  wings: 'Wings',
  display: 'Showy colours, songs or flowers',
  hue: 'Colouring (no effect on survival)',
  covering: 'Body covering: fur (low), bare skin, scales, feathers (high)',
  armour: 'Body armour: bony plates or a shell, like turtles and armadillos',
  succulence: 'Stores water in thick stems or leaves, like cacti',
  climbing: 'Climbs other plants to reach the light, like vines and orchids',
  parasitism: 'Lives on or in one host species and feeds on it',
  symbiosis: 'Partners with microbes: algae in corals, gut microbes in grazers, nitrogen-fixing bacteria in plant roots',
  toxins: 'Chemical defences that make a plant poor food for most grazers',
  care: 'Few young, well looked after (high), or many young left to chance (low)',
  metamorphosis: 'Young (larvae, tadpoles) live a different life from the adults',
  sociality: 'Lives in colonies with workers and queens (insects), or in herds and packs',
  migration: 'Travels with the seasons to escape winters and follow food',
  accent: 'Second colour, for markings and ornaments (looks only)',
  shade: 'Dark or pale colouring (looks only)',
  pattern: 'Markings: plain, spots, stripes, bands, mottling, a dark back, eyespots (looks only)',
  patternSize: 'Fine or bold markings (looks only)',
  ornament: 'Which ornament: crests, horns, frills, plumes, sails… (looks only)',
  ornamentSize: 'How big the ornament grows; showy species grow bigger ones (looks only)',
  build: 'Slender or stout build; in plants, the shape of the crown (looks only)',
  snout: 'Short face or long snout, beak or jaws (looks only)',
  reach: 'Short or long legs, neck and antennae (looks only)',
  tail: 'Short or long tail (looks only)',
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function makeGenes(obj = {}) {
  const g = new Float32Array(NG);
  for (const k of GENES) g[GI[k]] = obj[k] ?? 0.1;
  if (obj.skeleton === undefined) g[GI.skeleton] = 0.5;
  if (obj.covering === undefined) g[GI.covering] = 0.32; // bare skin: the ground state
  for (const k of ['armour', 'succulence', 'climbing', 'parasitism', 'symbiosis']) if (obj[k] === undefined) g[GI[k]] = 0.05;
  // life-history genes start part-way, so one big change can tip a lineage over
  for (const [k, v] of [['toxins', 0.15], ['care', 0.2], ['metamorphosis', 0.2], ['sociality', 0.2], ['migration', 0.15]]) if (obj[k] === undefined) g[GI[k]] = v;
  if (obj.hue === undefined) g[GI.hue] = 0.5;
  for (const k of LOOK_GENES) if (k !== 'hue' && obj[k] === undefined) g[GI[k]] = 0.5;
  return g;
}

// a fresh, random look (for life seeded from nothing, or a new lineage made by a merger)
export function randomLooks(genes, rng) {
  for (const k of LOOK_GENES) genes[GI[k]] = rng();
  return genes;
}

// ---------- looks ----------

// Markings, in gene order. Ornaments (or, for plants, fungi and microbes, the form they take)
// depend on the body plan: the same gene grows a crest on a bird and antlers on a deer.
export const PATTERNS = ['plain', 'spots', 'stripes', 'bands', 'mottled', 'dark back', 'eyespots', 'rosettes', 'chevrons', 'patches', 'speckles', 'two-tone', 'saddle'];
const PAT_EDGES = PATTERNS.slice(1).map((_, i) => 0.14 + (0.86 * i) / (PATTERNS.length - 1));
const PATTERN_WORDS = { 'dark back': 'dark-backed', saddle: 'saddled', speckles: 'speckled', patches: 'patchy', chevrons: 'chevroned', 'two-tone': 'two-toned' };
export const ORNAMENTS = {
  fish: ['a sail fin', 'streamer fins', 'barbels', 'spiny fins', 'a sword', 'a lure'],
  whale: ['a tall fin', 'long flippers', 'a tusk', 'a hump'],
  amphibian: ['a crest', 'warts', 'frilly gills', 'horns', 'a throat sac'],
  reptile: ['a frill', 'a back sail', 'horns', 'spines', 'a crest', 'a dewlap'],
  dinosaur: ['a frill', 'a back sail', 'horns', 'back plates', 'a crest', 'a tail club'],
  crocodile: ['a nose knob', 'back spines', 'a crest'],
  snake: ['a hood', 'horns', 'a rattle', 'a crest'],
  turtle: ['a high dome', 'a ridged shell', 'a spiky shell', 'a flat shell'],
  pterosaur: ['a sail crest', 'a blade crest', 'a throat pouch'],
  bird: ['a crest', 'long tail plumes', 'a wattle', 'a fan tail', 'head plumes', 'a casque'],
  mammal: ['big ears', 'quills', 'a tufted tail', 'a crest', 'a trunk'],
  rodent: ['big ears', 'long whiskers', 'a bushy tail', 'quills'],
  carnivoran: ['a mane', 'tufted ears', 'a bushy tail', 'long whiskers', 'sabre teeth'],
  ungulate: ['antlers', 'spiral horns', 'curved horns', 'a nose horn', 'a hump', 'a mane'],
  primate: ['a beard', 'a mane', 'a bright face', 'a crest'],
  bat: ['big ears', 'a nose leaf', 'a mane'],
  sapient: ['a crest', 'long hair', 'body paint'],
  insect: ['horns', 'long antennae', 'feathery antennae', 'wing eyespots', 'tail filaments', 'big jaws'],
  socialinsect: ['big jaws', 'long antennae', 'a stinger'],
  arachnid: ['pincers', 'a tail sting', 'hairy legs', 'long legs'],
  myriapod: ['long antennae', 'bright legs', 'spines'],
  arthropod: ['big claws', 'long antennae', 'spines', 'a tail fan', 'a horned shield'],
  mollusc: ['a tall spire', 'a flat coil', 'a cone shell', 'two valves', 'a spiny shell'],
  squid: ['long tentacles', 'frilly fins', 'eight arms', 'a crest'],
  worm: ['bristles', 'feathery gills', 'frills', 'tentacles'],
  jelly: ['frilly arms', 'long tentacles', 'a crested bell', 'comb rows'],
  // forms rather than ornaments: always shown
  sponge: ['a vase', 'branches', 'a fan', 'a brain shape', 'tubes'],
  starfish: ['five arms', 'many arms', 'an urchin', 'thin arms'],
  flower: ['daisy flowers', 'bell flowers', 'flower spikes', 'flower clusters', 'cup flowers'],
  conifer: ['big cones', 'small cones', 'drooping needles'],
  fern: ['fiddleheads', 'lacy fronds', 'broad fronds'],
  grass: ['feathery plumes', 'seed spikes', 'tufts', 'canes'],
  cactus: ['a column', 'a barrel', 'pads', 'a candelabra'],
  vine: ['heart-shaped leaves', 'lobed leaves', 'trumpet flowers'],
  moss: ['spore capsules', 'star moss', 'feathery moss'],
  seaweed: ['kelp blades', 'air bladders', 'frilly red fronds', 'branching fronds'],
  waterplant: ['lily pads', 'reeds', 'floating rosettes'],
  mushroom: ['a dome cap', 'a flat cap', 'a pointed cap', 'brackets', 'a puffball', 'coral branches'],
  fungi: ['threads', 'tufts'],
  lichen: ['crusts', 'leafy lobes', 'shrubby tufts', 'beards'],
  protist: ['an amoeba', 'a ciliate', 'a flagellate', 'a spiky shell', 'a stalk'],
  algae: ['a flagellate', 'a desmid', 'a ball colony'],
  diatom: ['round boxes', 'boat shapes', 'star chains'],
  foram: ['a spiral', 'a star', 'a chain'],
  bacteria: ['rods', 'spheres', 'spirals', 'commas'],
  archaea: ['lobed cells', 'squares', 'rods'],
  cyano: ['filaments', 'spheres', 'mats'],
};
const FORMS = new Set(['sponge', 'starfish', 'flower', 'conifer', 'fern', 'grass', 'cactus', 'vine', 'moss', 'seaweed', 'waterplant', 'mushroom', 'fungi', 'lichen', 'protist', 'algae', 'diatom', 'foram', 'bacteria', 'archaea', 'cyano']);

// decode a species' look genes into what it looks like
export function looks(sp) {
  const g = sp.genes, G = (k) => g[GI[k]];
  let pi = PAT_EDGES.findIndex((e) => G('pattern') < e);
  if (pi < 0) pi = PATTERNS.length - 1;
  const list = ORNAMENTS[sp.grade] || null;
  const oi = list ? Math.min(list.length - 1, Math.floor(G('ornament') * list.length)) : -1;
  const form = FORMS.has(sp.grade);
  // showy species grow bigger ornaments
  const orn = form ? 1 : G('ornamentSize') * (0.45 + 0.55 * G('display'));
  return {
    pattern: PATTERNS[pi], pat: pi, patSize: G('patternSize'),
    ornament: list && (form || orn > 0.2) ? list[oi] : null, oi: list && (form || orn > 0.2) ? oi : -1, orn, form,
    build: G('build'), snout: G('snout'), reach: G('reach'), tail: G('tail'),
    hue: G('hue'), accent: G('accent'), shade: G('shade'), showy: G('display') > 0.55,
    // a metallic, iridescent sheen in some showy species (beetles, hummingbirds, sunbirds, fish)
    sheen: G('display') > 0.6 && G('shade') > 0.5 && (G('accent') * 7) % 1 < 0.35,
  };
}

// How far back a species' markings and ornament go in its lineage. `chain` is its ancestors,
// nearest first. Returns, for each, how many ancestral species shared it (0: new in this one).
export function lookHeritage(sp, chain) {
  const L = looks(sp), out = [];
  for (const key of ['pattern', 'ornament']) {
    const mine = L[key];
    if (!mine || mine === 'plain') continue;
    let n = 0, from = null;
    for (const a of chain) {
      if (!a?.genes || a.genes.length <= GI.accent || a.grade !== sp.grade) break;
      if (looks(a)[key] !== mine) break;
      n++; from = a;
    }
    out.push({ key, what: key === 'pattern' ? (mine === 'dark back' ? 'dark back' : mine) : mine.replace(/^an? /, ''), n, from });
  }
  return out;
}
export function heritageText(h, esc = (x) => x) {
  return h.map((x) => `${x.what.charAt(0).toUpperCase() + x.what.slice(1)}: ${x.n ? `inherited, shared by ${x.n} ancestral species back to <i>${esc(x.from.name)}</i>` : 'new in this species'}`).join('<br>');
}

const COLOUR_NAMES = [[0.03, 'red'], [0.08, 'orange'], [0.14, 'golden'], [0.2, 'yellow'], [0.3, 'lime'], [0.42, 'green'], [0.5, 'teal'], [0.58, 'sky-blue'], [0.68, 'blue'], [0.76, 'violet'], [0.86, 'purple'], [0.95, 'pink'], [1.01, 'red']];
export function colourName(h, s = 0.6, l = 0.5) {
  if (l < 0.18) return 'black';
  if (s < 0.18) return l > 0.75 ? 'white' : l > 0.45 ? 'grey' : 'charcoal';
  const n = COLOUR_NAMES.find(([e]) => h < e)[1];
  if ((n === 'orange' || n === 'golden' || n === 'red') && s < 0.5) return l > 0.6 ? 'sandy' : l > 0.38 ? 'brown' : 'dark brown';
  return l > 0.68 ? `pale ${n}` : l < 0.3 ? `dark ${n}` : n;
}

// a naturalist's description of its looks
export function describeLooks(sp) {
  const L = looks(sp), ph = sp.ph || {}, parts = [];
  if (ph.animal && ph.level === 3) {
    if (L.build < 0.25) parts.push('slender'); else if (L.build > 0.75) parts.push('stout');
    if (ph.skeleton === 'endo' && sp.grade !== 'snake') {
      if (L.snout > 0.75) parts.push(sp.grade === 'bird' ? 'long-billed' : 'long-snouted'); else if (L.snout < 0.22) parts.push(sp.grade === 'bird' ? 'stubby-billed' : 'short-faced');
      if (ph.limbs && L.reach > 0.75) parts.push('long-legged'); else if (ph.limbs && L.reach < 0.2) parts.push('short-legged');
      if (L.tail > 0.78) parts.push('long-tailed');
    } else if (ph.skeleton === 'exo' && ph.limbs && L.reach > 0.75) parts.push('long-legged');
  }
  if (L.pattern !== 'plain' && (ph.animal || sp.grade === 'mushroom')) parts.push(`${L.patSize > 0.65 ? 'bold ' : L.patSize < 0.3 ? 'fine ' : ''}${PATTERN_WORDS[L.pattern] || L.pattern}`);
  if (L.sheen && ph.animal) parts.push('iridescent');
  if (L.ornament) {
    const o = L.ornament.replace(/^an? /, '');
    parts.push(L.form ? L.ornament : L.orn > 0.55 && !/^(big|long|tall|high) /.test(o) ? `big ${o}` : o);
  }
  return parts.join(' · ');
}

// ---------- development: genome → body ----------

export function develop(sp) {
  const g = sp.genes, euk = sp.domain === 'eukaryote';
  const G = (k) => g[GI[k]];
  let level;
  if (G('adhesion') < 0.35) level = 0;          // single cells
  else if (G('adhesion') < 0.6 || !euk) level = 1; // colonies, filaments, mats
  else level = G('differentiation') > 0.55 ? 3 : 2; // tissues & organs, or simple multicellular
  const photo = G('photo') > 0.5 && (sp.domain === 'bacteria' || sp.chloro);
  const lichen = !!sp.lichen && photo && level >= 1;
  const ingest = euk && G('ingest') > 0.45 && !photo;
  const absorb = !photo && G('absorb') > 0.45 && G('absorb') >= G('ingest') - 0.05;
  let trophic;
  if (photo) trophic = 1;
  else if (ingest && !absorb) trophic = G('carnivory') < 0.33 ? 3 : G('carnivory') > 0.66 ? 4 : 5;
  else if (absorb || euk) trophic = 2;
  else trophic = 0;
  // parasites: protists, fungi, worms and small arthropods that live on one host and feed on it
  // (backboned animals and photosynthesisers don't)
  const parasite = euk && !photo && !lichen && G('parasitism') > 0.6 && G('skeleton') < 0.7;
  if (parasite) trophic = 6;
  const animal = euk && level >= 2 && trophic >= 3 && !(parasite && absorb);
  const plant = euk && level >= 2 && trophic === 1 && !lichen;
  const fungus = euk && level >= 2 && (trophic === 2 || (parasite && absorb));
  const radial = G('symmetry') < 0.5;
  const motile = G('motility') > 0.35 && !plant && !fungus;
  const segments = 1 + Math.round(G('segments') * 9);
  let skeleton = 'none';
  // skeleton bands run shell/exoskeleton → soft-bodied → bone, so a backbone evolves from a soft
  // ancestor (as chordates did), never straight from an armoured one
  if (animal) skeleton = G('skeleton') < 0.3 ? 'exo' : G('skeleton') < 0.7 || level < 3 || radial ? 'none' : 'endo';
  const limbs = animal && level === 3 && !radial ? Math.round(G('limbs') * 4) : 0;
  const sizeCap = [0.1, 0.25, 0.6, 1][level] * (animal && level === 3 && skeleton !== 'endo' ? 0.6 : 1);
  const size = G('size') * sizeCap * (parasite ? 0.4 : 1);
  const endo = animal && level === 3 && G('skeleton') >= 0.7 && !radial && G('endothermy') > 0.55;
  const brain = animal && level === 3 ? G('brain') : 0;
  const flying = animal && level === 3 && G('wings') > 0.6 && size < 0.6 && (limbs >= 1 || skeleton === 'exo');
  const vascular = plant ? G('vascular') : 0;
  const sapient = animal && brain > 0.88 && size >= 0.35 && limbs >= 1 && endo && G('landAdapt') > 0.5;
  // backboned animals have a body covering; the bands run fur → bare skin → scales → feathers,
  // so fur evolves from glandular skin (as in mammals) and feathers from scales (as in dinosaurs)
  const c = G('covering');
  const covering = skeleton !== 'endo' ? 'none' : c < 0.2 ? 'fur' : c < 0.45 ? 'skin' : c < 0.75 ? 'scales' : 'feathers';
  const armour = animal && level === 3 ? G('armour') : 0;
  const shelled = euk && level <= 1 && G('skeleton') < 0.3; // diatom glass, foram chalk
  // partners: algae living in coral tissues, gut microbes that digest plants, root bacteria that fix nitrogen
  const sy = G('symbiosis') > 0.6;
  const partner = !sy ? null
    : animal && !motile && trophic !== 6 && skeleton !== 'endo' ? 'algae'
    : animal && level === 3 && (trophic === 3 || trophic === 5) ? 'gut'
    : plant && G('vascular') >= 0.35 ? 'roots' : null;
  return {
    level, euk, photo, trophic, animal, plant, fungus, lichen, radial, motile, segments, limbs, skeleton,
    size, endo, brain, flying, vascular, sapient, covering, armour, shelled, parasite, partner,
    succulence: plant ? G('succulence') : 0, climbing: plant ? G('climbing') : 0,
    toxins: plant ? G('toxins') : 0,
    care: animal && level === 3 ? G('care') : 0,
    metamorphosis: animal && level === 3 && (skeleton === 'exo' || covering === 'skin' || skeleton === 'none') ? G('metamorphosis') : 0,
    sociality: animal && level === 3 ? G('sociality') : 0,
    migration: animal && level === 3 && G('motility') > 0.45 ? G('migration') : 0,
    landAdapt: G('landAdapt'), display: G('display'), differentiation: G('differentiation'), motility: G('motility'),
    tier: !euk ? 0 : level <= 1 ? 1 : level === 2 ? 2 : sapient ? 6 : 3 + (skeleton === 'endo' ? 1 : 0) + (endo || vascular > 0.65 ? 1 : 0),
  };
}

// ---------- naming what evolved ----------

// The nearest familiar description of a body plan (a category key in GRADES). `prev` is the
// group the lineage belonged to: within a family (mammals, reptiles and birds, land arthropods,
// seed plants) a lineage keeps its group unless its body has clearly moved on, so a rodent isn't
// renamed every time its size wobbles across a line.
export function classify(sp, ph, habitat, prev) {
  const G = (k) => sp.genes[GI[k]];
  if (sp.domain === 'archaea') return 'archaea';
  if (sp.domain === 'bacteria') return ph.photo ? 'cyano' : 'bacteria';
  if (ph.lichen) return 'lichen';
  if (ph.level <= 1) return ph.photo ? (ph.shelled ? 'diatom' : 'algae') : ph.shelled ? 'foram' : 'protist';
  const wet = habitat === 0 || habitat === 3;
  if (ph.plant) {
    if (wet || ph.landAdapt < 0.3) return ph.vascular >= 0.35 && ph.landAdapt >= 0.22 ? 'waterplant' : 'seaweed';
    if (ph.vascular < 0.35) return 'moss';
    if (ph.vascular < 0.65 || ph.landAdapt < 0.55) return 'fern';
    return pickOrder(SEED_PLANTS, sp, ph, habitat, prev, G);
  }
  if (ph.fungus) return wet || ph.landAdapt < 0.3 ? 'fungi' : 'mushroom';
  if (!ph.animal) return 'protist';
  if (ph.sapient && !wet) return 'sapient';
  if (ph.radial && ph.level === 3 && ph.skeleton === 'exo') return 'starfish';
  if (ph.level === 2 || ph.radial || (!ph.motile && wet && ph.skeleton !== 'endo')) return ph.motile ? 'jelly' : 'sponge';
  if (ph.skeleton === 'exo' && ph.limbs === 0) return 'mollusc';
  if (ph.skeleton === 'none' && ph.limbs === 0) return ph.brain > 0.6 && wet ? 'squid' : 'worm';
  // jointed legs, armoured or soft (like caterpillars and velvet worms)
  if (ph.skeleton !== 'endo') return wet || ph.landAdapt < (habitat === 2 ? 0.35 : 0.5) ? 'arthropod' : pickOrder(LAND_ARTHROPODS, sp, ph, habitat, prev, G);
  // backbones
  // warm-blooded water vertebrates are 'whales' only if their ancestors once lived on land
  if (wet) return ph.endo && sp.landAnc ? 'whale' : 'fish';
  if (ph.landAdapt < 0.35) return 'fish'; // shore fish
  if (!ph.endo && (ph.covering === 'skin' || ph.landAdapt < 0.6)) return 'amphibian';
  // (a warm-blooded mammal that loses its fur, like a naked mole rat, is still a mammal)
  if (ph.covering === 'fur' || (ph.endo && ph.covering === 'skin' && FAMILY[prev] === 'mammals')) return pickOrder(MAMMALS, sp, ph, habitat, prev, G);
  return pickOrder(SAUROPSIDS, sp, ph, habitat, prev, G);
}

// Orders within a family, most distinctive first; the last is the catch-all. Each rule takes a
// margin m that loosens it (m > 0) or tightens it (m < 0), for keeping a lineage in its group.
const MAMMALS = [
  { g: 'bat', rule: (G, ph, h, m) => G('wings') > 0.6 - m && ph.size < 0.6 },
  { g: 'primate', rule: (G, ph, h, m) => ph.brain > 0.72 - m && ph.limbs >= 2 },
  { g: 'carnivoran', rule: (G, ph, h, m) => G('carnivory') > 0.62 - m },
  { g: 'ungulate', rule: (G, ph, h, m) => G('carnivory') < 0.38 + m && ph.size > 0.45 - m },
  { g: 'rodent', rule: (G, ph, h, m) => ph.size < 0.28 + m },
  { g: 'mammal' },
];
const SAUROPSIDS = [
  { g: 'bird', rule: (G, ph, h, m) => ph.covering === 'feathers' && ph.endo && G('wings') > 0.6 - m * 2 },
  { g: 'pterosaur', rule: (G, ph, h, m) => G('wings') > 0.6 - m && ph.size < 0.6 },
  { g: 'turtle', rule: (G, ph, h, m) => ph.armour > 0.6 - m },
  { g: 'snake', rule: (G, ph, h, m) => G('limbs') < 0.125 + m * 0.5 },
  { g: 'crocodile', rule: (G, ph, h, m) => h !== 2 && ph.size > 0.45 - m && G('carnivory') > 0.55 - m },
  { g: 'dinosaur', rule: (G, ph, h, m) => ph.size > 0.6 - m || ph.covering === 'feathers' },
  { g: 'reptile' },
];
const LAND_ARTHROPODS = [
  { g: 'socialinsect', rule: (G, ph, h, m) => G('sociality') > 0.6 - m && ph.limbs === 3 },
  { g: 'myriapod', rule: (G, ph, h, m) => G('segments') > 0.61 - m },
  { g: 'arachnid', rule: (G, ph, h, m) => G('limbs') > 0.875 - m && !ph.flying && G('carnivory') > 0.5 - m },
  { g: 'insect' },
];
const SEED_PLANTS = [
  { g: 'cactus', rule: (G, ph, h, m) => ph.succulence > 0.6 - m },
  { g: 'vine', rule: (G, ph, h, m) => ph.climbing > 0.6 - m },
  { g: 'flower', rule: (G, ph, h, m) => ph.display > 0.6 - m },
  // grasses are flowering plants that went back to small, wind-pollinated flowers
  { g: 'grass', rule: (G, ph, h, m, prev) => (prev === 'flower' || prev === 'grass') && ph.size < 0.3 + m && ph.display > 0.4 - m && ph.display <= 0.6 },
  { g: 'conifer' },
];
export const FAMILY = {};
for (const [name, list] of [['mammals', MAMMALS], ['sauropsids', SAUROPSIDS], ['land arthropods', LAND_ARTHROPODS], ['seed plants', SEED_PLANTS]]) for (const o of list) FAMILY[o.g] = name;

function pickOrder(list, sp, ph, h, prev, G) {
  const p = prev && list.find((o) => o.g === prev);
  if (p) {
    if (!p.rule) { if (!list.some((o) => o.rule && o.rule(G, ph, h, -0.12, prev))) return prev; }
    else if (p.rule(G, ph, h, 0.12, prev)) return prev;
  }
  return list.find((o) => !o.rule || o.rule(G, ph, h, 0, prev)).g;
}

// a naturalist's one-line description of the body plan
export function describe(ph) {
  const parts = [];
  parts.push(['single-celled', 'colonial', 'multicellular', 'complex'][ph.level]);
  if (ph.animal) {
    if (ph.level === 3) parts.push(ph.radial ? 'radial' : 'bilateral');
    else if (ph.radial) parts.push('radial');
    if (ph.segments > 1) parts.push(`${ph.segments} segments`);
    if (ph.limbs) parts.push(`${ph.limbs} pair${ph.limbs > 1 ? 's' : ''} of limbs`);
    if (ph.skeleton === 'exo') parts.push(ph.limbs ? 'exoskeleton' : 'shell');
    if (ph.skeleton === 'endo') parts.push('backbone');
    if (ph.covering === 'fur' || ph.covering === 'feathers' || ph.covering === 'scales') parts.push(ph.covering);
    else if (ph.covering === 'skin') parts.push('bare skin');
    if (ph.armour > 0.6) parts.push('armoured');
    if (ph.metamorphosis > 0.6) parts.push('metamorphosis');
    if (ph.care > 0.6) parts.push('cares for its young');
    if (ph.sociality > 0.6) parts.push(ph.skeleton === 'endo' ? 'lives in groups' : 'lives in colonies');
    if (ph.migration > 0.6) parts.push('migrates');
    if (ph.flying) parts.push('flying');
    if (ph.endo) parts.push('warm-blooded');
    if (ph.brain > 0.6) parts.push(ph.brain > 0.85 ? 'large brain' : 'brain');
    if (!ph.motile) parts.push('sessile');
  }
  if (ph.lichen) parts.push('a fungus farming algae');
  if (ph.parasite) parts.push('parasite');
  if (ph.partner) parts.push(ph.partner === 'algae' ? 'algae partners' : ph.partner === 'gut' ? 'gut microbes' : 'nitrogen-fixing roots');
  if (ph.shelled) parts.push(ph.photo ? 'glass shell' : 'chalky shell');
  if (ph.plant) {
    if (ph.succulence > 0.6) parts.push('water-storing');
    if (ph.toxins > 0.6) parts.push('toxic');
    if (ph.climbing > 0.6) parts.push('climbing');
    if (ph.vascular > 0.35) parts.push(ph.vascular > 0.65 ? 'tall, woody' : 'vascular');
    if (ph.landAdapt > 0.6) parts.push(ph.display > 0.6 ? 'flowers and seeds' : 'seeds');
  }
  return parts.join(' · ');
}

// ---------- ecology: body → how it lives ----------

export function ecology(sp, ph) {
  const s = ph.size, sz = Math.pow(0.6 + s, -0.25), lvl = ph.level, h = sp.habitat;
  const p = { r: 0, kmul: 0, imax: 0, half: 1, e: 0, m: 0.01, self: 0, o2: 0, disp: 0.05, tol: 10, vuln: 1, dry: 0 };
  // oxygen: complex cells, big bodies, warm blood, brains and flight all need more
  if (ph.euk) {
    p.o2 = lvl === 0 ? 0.4 : lvl === 1 ? 0.8 : lvl === 2 ? 2 + 2 * s : 6 + 5 * s + (ph.endo ? 2 : 0) + 3 * ph.brain + (ph.flying ? 1 : 0);
    if (ph.plant) p.o2 = Math.min(p.o2, 2 + 6 * ph.vascular);
    if (ph.fungus) p.o2 = 1 + 4 * s;
    p.o2 = Math.min(15, p.o2);
  }
  const wet = h === 0 || h === 3;
  if (ph.lichen) {
    // lichens grow slowly but live where nothing else can: bare rock, tundra, mountains
    Object.assign(p, { r: 0.035, kmul: 0.3, m: 0.002, disp: 0.04, tol: 16, o2: 0.5, rock: 1 });
    return p;
  }
  if (ph.photo) {
    p.r = [0.14, 0.12, 0.09, 0.07][lvl] * sz * (1 + 0.12 * ph.display) * (1 - 0.3 * ph.succulence);
    // bigger, taller producers shade out smaller ones
    const kSea = 0.5 + (ph.euk ? 0.15 : 0) + (lvl >= 2 ? 0.2 : 0);
    const kLand = 0.4 + 0.6 * ph.vascular + 0.1 * ph.display;
    p.kmul = Math.min(1.1, wet ? kSea + (ph.shelled ? 0.08 : 0) : h === 2 ? kLand : 0.5 * (kSea + kLand));
    // succulents thrive where it's dry; climbers need trees to climb
    p.succ = ph.succulence; p.climb = ph.climbing;
    if (ph.succulence > 0.3) p.tol += 3;
    p.m = 0.004 * sz * (lvl >= 2 ? 0.7 : 1);
    p.disp = lvl <= 1 ? 0.07 : 0.03 + 0.015 * ph.display;
    p.tol = sp.domain === 'bacteria' ? 13 : 10;
  } else if (!ph.euk) {
    Object.assign(p, { imax: 0.3, half: 0.2, e: sp.domain === 'archaea' ? 0.5 : 0.55, m: 0.03, self: 0.2, disp: 0.08, tol: sp.domain === 'archaea' ? 18 : 14 });
  } else if (lvl <= 1) {
    Object.assign(p, { imax: 0.25, half: 0.05, e: 0.35, m: 0.025, self: 0.3, disp: 0.07, tol: 11 });
  } else if (ph.fungus) {
    Object.assign(p, { imax: 0.2, half: 0.045, e: 0.35, m: 0.018, self: 0.3, disp: 0.05, tol: 11 });
  } else {
    // animals: Kleiber scaling, plus the costs and benefits of their equipment
    p.imax = 0.14 * (1 + 0.25 * ph.motility + 0.3 * ph.brain) * (ph.endo ? 1.2 : 1);
    p.half = 0.08 * (1 - 0.4 * ph.brain);
    p.e = 0.26 + 0.04 * ph.differentiation + 0.05 * ph.brain;
    p.m = 0.014 * (1 + (ph.endo ? 0.5 : 0) + 0.3 * ph.brain + 0.15 * ph.motility + (ph.flying ? 0.1 : 0));
    p.self = 0.5;
    p.disp = 0.015 + 0.035 * ph.motility + (ph.flying ? 0.07 : 0);
    p.tol = 8 + (ph.endo ? 6 : 0) + 4 * ph.brain;
    // fur and feathers insulate: warm blood costs less and copes with colder places
    if (ph.endo && (ph.covering === 'fur' || ph.covering === 'feathers')) { p.m *= 0.9; p.tol += 4; }
    // armour is heavy
    p.imax *= 1 - 0.2 * ph.armour;
    // walking on land needs legs (worms and snails manage slowly)
    if (h === 2 && ph.limbs === 0) p.imax *= 0.75;
    // filtering food from the water is easy but slow; hunting and grazing bodies do better
    if (lvl === 2 || ph.radial) p.imax *= 0.85;
    // filter-feeding only works in water: a sessile animal ashore starves
    if (!ph.motile && (h === 1 || h === 2)) p.imax *= h === 2 ? 0.2 : 0.6;
  }
  if (ph.parasite) {
    // living off a host: steady food, but the host's immune system keeps numbers down
    Object.assign(p, { imax: 0.2, half: 0.003, e: 0.45, m: 0.02, self: 0.5, disp: 0.06, tol: 12 });
  }
  if (ph.partner === 'gut') { p.e *= 1.2; p.m *= 1.04; }
  // plant defences: toxins cost growth but put most grazers off
  if (ph.toxins) { p.r *= 1 - 0.25 * ph.toxins; p.pal = 1 - 0.8 * ph.toxins; }
  // life histories. Parental care: fewer young, slower to bounce back, but far more survive and
  // hold their own. No care: many young, quick to recover and spread, many die.
  if (ph.animal && ph.level === 3) {
    const c = ph.care;
    p.e *= 1 - 0.25 * c; p.m *= 1 - 0.35 * c; p.self *= 1 - 0.3 * c; p.disp *= 1 + 0.5 * (1 - c);
    // metamorphosis: larvae and adults eat different things, so a species competes less with itself
    if (ph.metamorphosis > 0.5) { p.self *= 0.7; p.m *= 1.05; }
    // social living: insect colonies forage efficiently and defend themselves; herds and packs
    // protect prey and help hunters
    const so = ph.sociality;
    // (colonies also cost: workers don't breed, and a colony needs a big, steady food supply)
    if (ph.skeleton !== 'endo') { p.imax *= 1 + 0.15 * so; p.half *= 1 + 0.3 * so; p.self *= 1 - 0.2 * so; p.socialDefence = 0.8 * so; }
    else if (sp.trophic === 4) p.imax *= 1 + 0.15 * so;
    else p.socialDefence = 0.4 * so;
  }
  if (ph.partner === 'roots') { p.r *= 0.95; p.roots = 1; }
  if (ph.partner === 'algae') p.coral = 1;
  p.imax *= sz; if (!ph.photo) p.m *= sz;
  if (sp.trophic === 4) p.half *= 0.12; else if (sp.trophic === 5) p.half *= 0.35;
  // defences: size, armour, flight and speed make an animal hard to catch
  if (!ph.photo) {
    p.vuln = 1 / (1 + 2.5 * s + (ph.skeleton === 'exo' ? 1.2 : ph.skeleton === 'endo' ? 0.6 : 0) + 1.5 * ph.armour + (ph.flying ? 0.8 : 0) + 0.6 * (ph.motile ? ph.motility : 0));
    if (ph.shelled) p.vuln *= 0.6;
    if (p.socialDefence) p.vuln /= 1 + p.socialDefence;
  }
  // Winters: how well it rides out a harsh season. Microbes and plants go dormant, cold-blooded
  // animals go torpid, fur and feathers keep warm-blooded animals going, and migrants just leave.
  p.hardy = !ph.euk ? 0.8 : ph.plant || ph.fungus || ph.lichen ? 0.6 : ph.level <= 1 ? 0.7
    : ph.endo ? (ph.covering === 'fur' || ph.covering === 'feathers' ? 0.55 : 0.3) : 0.4;
  if (ph.migration > 0.3) { p.hardy = Math.max(p.hardy, ph.migration); p.disp *= 1 + ph.migration; p.m *= 1 + 0.06 * ph.migration; }
  // drying out: land needs a waterproof skin, lungs, seeds or eggs; they cost a little to build
  // (bare skin loses water fast, so amphibians stay near water; scales hold it in)
  const skin = ph.covering === 'skin' ? 0.15 : ph.covering === 'scales' ? -0.1 : 0;
  const need = h === 2 ? 0.6 + skin : h === 1 ? 0.1 : 0;
  p.dry = (ph.euk ? 0.2 : 0.08) * Math.max(0, need - ph.landAdapt) / 0.6;
  p.m *= 1 + 0.12 * ph.landAdapt;
  return p;
}

// ---------- mutation ----------

// Small changes to every gene. Genes the body plan depends on are canalised (they barely drift);
// the ones it can easily change drift freely. Big jumps come from innovate().
export function mutate(genes, rng, gaussian, rate = 1, ev = null) {
  const g = Float32Array.from(genes);
  for (let k = 0; k < NG; k++) {
    if (k === GI.hue || k === GI.accent) { g[k] = (((g[k] + gaussian(rng) * 0.035) % 1) + 1) % 1; continue; }
    // looks drift freely; which pattern and ornament a lineage has drift more slowly, so a whole
    // family shares them
    if (LOOK_SET.has(k)) { g[k] = clamp01(g[k] + gaussian(rng) * (k === GI.pattern || k === GI.ornament ? 0.03 : 0.06)); continue; }
    // genes the body doesn't use yet stay in their ground state: no hidden drift that would let a
    // finished insect body spring from a single cell
    const free = !ev || ev[GENES[k]] ? 1 : 0.02;
    g[k] = clamp01(g[k] + gaussian(rng) * 0.035 * rate * free);
  }
  // now and then a new look appears in one step (a new pattern or ornament)
  if (rng() < 0.08) { const k = GI[LOOK_GENES[1 + Math.floor(rng() * (LOOK_GENES.length - 1))]]; g[k] = rng(); }
  return g;
}
const LOOK_SET = new Set(LOOK_GENES.map((k) => GI[k]));

// a new look picked by mate choice: new markings, colours and ornaments, same body
export function sexualLooks(g, rng, gaussian) {
  g[GI.hue] = (g[GI.hue] + 0.15 + 0.2 * rng()) % 1;
  g[GI.accent] = (((g[GI.accent] + gaussian(rng) * 0.2) % 1) + 1) % 1;
  for (const k of ['pattern', 'ornament']) g[GI[k]] = clamp01(g[GI[k]] + gaussian(rng) * 0.15);
  for (const k of ['ornamentSize', 'patternSize']) g[GI[k]] = clamp01(g[GI[k]] + 0.05 + gaussian(rng) * 0.12);
}

// ---------- developmental innovation ----------

// Which genes a body plan can most easily change (evo-devo: a new segment or a lost shell is easy;
// a whole new body plan is hard). Weights for picking the gene of a big developmental jump.
export function evolvable(sp, ph) {
  const g = sp.genes, G = (k) => g[GI[k]];
  // key innovations, once gained, are entrenched: other genes come to depend on them
  const key = (k, th, w) => (G(k) < th ? w : w * 0.12);
  if (!ph.euk) return { photo: key('photo', 0.5, 3), absorb: 2, adhesion: 1, motility: 1, size: 1 };
  if (ph.lichen) return { size: 1, landAdapt: 1 };
  if (ph.level <= 1) return sp.chloro ? { adhesion: 3, photo: 0.5, size: 1, motility: 1, skeleton: 0.4 } : { adhesion: 3, absorb: key('absorb', 0.45, 2), ingest: 1, carnivory: 1, motility: 1, size: 1, skeleton: 0.4, parasitism: key('parasitism', 0.6, 0.8) };
  if (ph.plant) {
    const seed = ph.vascular >= 0.5 ? 1.2 : 0;
    return { differentiation: key('differentiation', 0.55, 2), vascular: key('vascular', 0.65, 3), landAdapt: 2, display: 2, size: 2, succulence: seed, climbing: seed, symbiosis: ph.vascular >= 0.35 ? 0.8 : 0, toxins: 1.5 };
  }
  if (ph.fungus) return { differentiation: 1, landAdapt: 2, size: 1, parasitism: key('parasitism', 0.6, 0.8) };
  if (!ph.animal) return { differentiation: 2, ingest: 1, absorb: 1 };
  if (ph.level === 2) return { differentiation: 3, symmetry: 3, motility: 1.5, carnivory: 1, size: 0.5, symbiosis: 1.2, parasitism: key('parasitism', 0.6, 0.3) };
  return {
    // shells can be lost and bones gained from a soft body, but a backbone is never lost
    skeleton: ph.skeleton === 'endo' ? 0 : ph.skeleton === 'exo' ? 1.2 : 3,
    symmetry: ph.radial ? 3 : 0, limbs: ph.radial ? 0 : 2, segments: 2, landAdapt: 2, endothermy: key('endothermy', 0.55, 1.5), brain: 1.5,
    wings: ph.limbs >= 1 || ph.skeleton === 'exo' ? 1.5 : 0, size: 2, carnivory: 1, motility: ph.skeleton === 'endo' ? 0.3 : ph.motile ? 1 : 2.5, display: 1,
    // backboned animals can change their covering (once warm-blooded, much less) and grow armour
    covering: ph.skeleton !== 'endo' ? 0 : ph.endo ? 0.3 : 1.5, armour: ph.skeleton === 'endo' ? 0.8 : 0,
    // soft worms and small arthropods can become parasites; grazers can take on gut microbes
    parasitism: ph.skeleton === 'endo' ? 0 : key('parasitism', 0.6, ph.skeleton === 'none' ? 1 : ph.size < 0.2 ? 0.5 : 0),
    symbiosis: (sp.trophic === 3 || sp.trophic === 5) ? 0.6 : ph.radial || !ph.motile ? 1.2 : 0,
    // life histories
    care: ph.skeleton === 'endo' ? 1.2 : 0.4,
    metamorphosis: ph.skeleton === 'exo' || ph.covering === 'skin' || ph.skeleton === 'none' ? 1 : 0,
    sociality: ph.skeleton === 'exo' && ph.limbs === 3 ? key('sociality', 0.6, 2.2) : ph.skeleton === 'endo' ? 0.6 : 0,
    migration: ph.flying || ph.skeleton === 'endo' ? 1 : 0.3,
  };
}

// a big jump in one gene; low genes tend to rise and high ones to fall
export function innovate(genes, sp, ph, rng) {
  const w = evolvable(sp, ph);
  let tot = 0;
  for (const k in w) tot += w[k];
  let r = rng() * tot, gene = Object.keys(w)[0];
  for (const k in w) { r -= w[k]; if (r <= 0) { gene = k; break; } }
  const i = GI[gene], v = genes[i];
  const up = rng() < 1 - v;
  let nv = clamp01(v + (up ? 1 : -1) * (0.2 + 0.25 * rng()));
  // a shell can be lost, but a backbone doesn't appear in the same step
  if (gene === 'skeleton' && v < 0.3) nv = Math.min(nv, 0.62);
  genes[i] = nv;
  return gene;
}

// ---------- archetypes ----------

// Starting genomes that develop into each familiar kind of organism (used to seed life).
const A = (o, domain = 'eukaryote', mito = true, chloro = false, extra = {}) => ({ genes: o, domain, mito, chloro, ...extra });
const V = { adhesion: 0.85, differentiation: 0.85, ingest: 0.75, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8 };
const vert = (o) => A({ ...V, ...o });
const PL = { adhesion: 0.85, differentiation: 0.75, photo: 0.85, vascular: 0.82, landAdapt: 0.85 };
const plant = (o) => A({ ...PL, ...o }, 'eukaryote', true, true);
export const ARCHETYPES = {
  bacteria: A({ adhesion: 0.15, absorb: 0.2, motility: 0.4, size: 0.5, segments: 0.2 }, 'bacteria', false),
  archaea: A({ adhesion: 0.15, absorb: 0.2, motility: 0.3, size: 0.5, segments: 0.4 }, 'archaea', false),
  cyano: A({ adhesion: 0.3, photo: 0.8, size: 0.5, segments: 0.6 }, 'bacteria', false),
  protist: A({ adhesion: 0.15, ingest: 0.75, carnivory: 0.3, motility: 0.6, size: 0.5 }),
  algae: A({ adhesion: 0.2, photo: 0.8, size: 0.5 }, 'eukaryote', true, true),
  seaweed: A({ adhesion: 0.75, differentiation: 0.3, photo: 0.85, size: 0.6, segments: 0.5 }, 'eukaryote', true, true),
  moss: A({ adhesion: 0.75, differentiation: 0.6, photo: 0.85, size: 0.15, vascular: 0.2, landAdapt: 0.6 }, 'eukaryote', true, true),
  fern: A({ adhesion: 0.8, differentiation: 0.7, photo: 0.85, size: 0.4, vascular: 0.5, landAdapt: 0.6 }, 'eukaryote', true, true),
  conifer: A({ adhesion: 0.85, differentiation: 0.75, photo: 0.85, size: 0.8, vascular: 0.8, landAdapt: 0.8, display: 0.2, toxins: 0.45 }, 'eukaryote', true, true),
  flower: A({ adhesion: 0.85, differentiation: 0.75, photo: 0.85, size: 0.5, vascular: 0.75, landAdapt: 0.8, display: 0.8, toxins: 0.3 }, 'eukaryote', true, true),
  fungi: A({ adhesion: 0.7, differentiation: 0.3, absorb: 0.8, size: 0.3 }),
  mushroom: A({ adhesion: 0.75, differentiation: 0.4, absorb: 0.8, size: 0.4, landAdapt: 0.6 }),
  sponge: A({ adhesion: 0.7, differentiation: 0.3, ingest: 0.7, carnivory: 0.2, motility: 0.1, size: 0.5, symmetry: 0.2, symbiosis: 0.7 }),
  jelly: A({ adhesion: 0.7, differentiation: 0.4, ingest: 0.7, carnivory: 0.8, motility: 0.5, size: 0.4, symmetry: 0.2, segments: 0.5 }),
  worm: A({ adhesion: 0.75, differentiation: 0.6, ingest: 0.7, carnivory: 0.2, motility: 0.5, size: 0.3, symmetry: 0.8, segments: 0.8 }),
  mollusc: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.7, carnivory: 0.2, motility: 0.4, size: 0.4, symmetry: 0.8, segments: 0.1, skeleton: 0.12 }),
  squid: A({ adhesion: 0.8, differentiation: 0.8, ingest: 0.8, carnivory: 0.9, motility: 0.8, size: 0.6, symmetry: 0.8, segments: 0.8, skeleton: 0.5, brain: 0.7 }),
  arthropod: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.3, motility: 0.6, size: 0.4, symmetry: 0.85, segments: 0.6, limbs: 0.75, skeleton: 0.12 }),
  diatom: A({ adhesion: 0.2, photo: 0.8, size: 0.5, skeleton: 0.12 }, 'eukaryote', true, true),
  foram: A({ adhesion: 0.15, ingest: 0.75, carnivory: 0.5, motility: 0.3, size: 0.6, skeleton: 0.12 }),
  lichen: A({ adhesion: 0.75, differentiation: 0.4, photo: 0.85, absorb: 0.7, landAdapt: 0.85, size: 0.1 }, 'eukaryote', true, true, { lichen: true }),
  grass: plant({ size: 0.15, display: 0.5 }),
  cactus: plant({ size: 0.4, display: 0.7, landAdapt: 0.9, succulence: 0.85 }),
  vine: plant({ size: 0.3, display: 0.5, climbing: 0.85 }),
  waterplant: plant({ size: 0.3, vascular: 0.5, landAdapt: 0.4, display: 0.65 }),
  starfish: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.7, carnivory: 0.6, motility: 0.4, size: 0.4, symmetry: 0.15, segments: 0.5, skeleton: 0.15 }),
  socialinsect: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.4, motility: 0.6, size: 0.15, symmetry: 0.85, segments: 0.3, limbs: 0.75, skeleton: 0.12, landAdapt: 0.8, wings: 0.3, metamorphosis: 0.8, sociality: 0.85, care: 0.6 }),
  arachnid: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.85, motility: 0.6, size: 0.25, symmetry: 0.85, segments: 0.15, limbs: 0.95, skeleton: 0.12, landAdapt: 0.8 }),
  myriapod: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.4, motility: 0.5, size: 0.3, symmetry: 0.85, segments: 0.85, limbs: 0.75, skeleton: 0.12, landAdapt: 0.7 }),
  snake: vert({ carnivory: 0.85, motility: 0.6, size: 0.4, segments: 0.9, limbs: 0.02, covering: 0.6, brain: 0.4 }),
  turtle: vert({ carnivory: 0.3, motility: 0.3, size: 0.5, covering: 0.6, armour: 0.85, brain: 0.35 }),
  crocodile: vert({ carnivory: 0.85, motility: 0.6, size: 0.7, covering: 0.6, armour: 0.35, landAdapt: 0.7, brain: 0.4, care: 0.5 }),
  dinosaur: vert({ carnivory: 0.2, motility: 0.6, size: 0.85, covering: 0.62, endothermy: 0.6, brain: 0.45, care: 0.5 }),
  pterosaur: vert({ carnivory: 0.75, motility: 0.8, size: 0.3, covering: 0.35, endothermy: 0.6, wings: 0.85, brain: 0.45 }),
  bat: vert({ carnivory: 0.7, motility: 0.8, size: 0.15, covering: 0.08, endothermy: 0.8, wings: 0.85, brain: 0.5, care: 0.85 }),
  rodent: vert({ carnivory: 0.3, motility: 0.7, size: 0.15, covering: 0.08, endothermy: 0.8, brain: 0.5, care: 0.6 }),
  ungulate: vert({ carnivory: 0.1, motility: 0.8, size: 0.6, covering: 0.08, endothermy: 0.8, brain: 0.5, symbiosis: 0.75, care: 0.8, sociality: 0.65, migration: 0.45 }),
  carnivoran: vert({ carnivory: 0.85, motility: 0.8, size: 0.45, covering: 0.08, endothermy: 0.8, brain: 0.6, care: 0.85, sociality: 0.5 }),
  primate: vert({ carnivory: 0.45, motility: 0.7, size: 0.4, covering: 0.08, endothermy: 0.8, brain: 0.78, care: 0.9, sociality: 0.7 }),
  insect: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.2, motility: 0.6, size: 0.25, symmetry: 0.85, segments: 0.3, limbs: 0.75, skeleton: 0.12, landAdapt: 0.75, wings: 0.7, metamorphosis: 0.75 }),
  fish: A({ adhesion: 0.85, differentiation: 0.8, ingest: 0.75, carnivory: 0.3, motility: 0.75, size: 0.4, symmetry: 0.85, segments: 0.3, limbs: 0.5, skeleton: 0.88, brain: 0.3, covering: 0.6, care: 0.15 }),
  amphibian: A({ adhesion: 0.85, differentiation: 0.8, ingest: 0.75, carnivory: 0.8, motility: 0.6, size: 0.3, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.55, brain: 0.35, covering: 0.32, metamorphosis: 0.8 }),
  reptile: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.3, motility: 0.6, size: 0.45, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, brain: 0.4, covering: 0.6, care: 0.3 }),
  mammal: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.2, motility: 0.7, size: 0.45, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, endothermy: 0.8, brain: 0.55, covering: 0.08, care: 0.8 }),
  bird: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.3, motility: 0.8, size: 0.3, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, endothermy: 0.8, brain: 0.5, wings: 0.85, display: 0.7, covering: 0.9, care: 0.85, migration: 0.65 }),
  whale: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.8, motility: 0.8, size: 0.85, symmetry: 0.85, segments: 0.2, limbs: 0.3, skeleton: 0.88, landAdapt: 0.5, endothermy: 0.8, brain: 0.6, covering: 0.08, care: 0.9, migration: 0.55 }),
  sapient: A({ adhesion: 0.9, differentiation: 0.9, ingest: 0.8, carnivory: 0.5, motility: 0.7, size: 0.5, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, endothermy: 0.8, brain: 0.95, covering: 0.08, care: 0.95, sociality: 0.8 }),
};

// story milestones each new kind of organism completes
export function storyKeysFor(grade, ph) {
  const k = [];
  const add = (...x) => k.push(...x);
  switch (grade) {
    case 'archaea': add('archaea'); break;
    case 'cyano': add('photosynthesis'); break;
    case 'protist': add('eukaryote'); break;
    case 'algae': add('eukaryote', 'algae'); break;
    case 'seaweed': add('multicellular'); break;
    case 'fungi': add('fungi'); break;
    case 'mushroom': add('fungi', 'mycorrhiza'); break;
    case 'sponge': case 'jelly': case 'worm': add('animals'); break;
    case 'moss': add('multicellular', 'landplants'); break;
    case 'fern': add('landplants', 'forests'); break;
    case 'conifer': add('landplants', 'forests', 'seeds'); break;
    case 'flower': add('landplants', 'forests', 'seeds', 'flowers'); break;
    case 'mollusc': case 'squid': case 'arthropod': add('animals', 'cambrian'); break;
    case 'insect': add('animals', 'cambrian', 'landanimals'); break;
    case 'fish': add('animals', 'cambrian', 'vertebrates'); break;
    case 'amphibian': add('cambrian', 'vertebrates', 'tetrapods', 'landanimals'); break;
    case 'reptile': add('vertebrates', 'tetrapods', 'amniotes', 'landanimals'); break;
    case 'mammal': add('tetrapods', 'amniotes', 'mammals'); break;
    case 'bird': add('tetrapods', 'amniotes', 'birds'); break;
    case 'whale': add('mammals', 'whales'); break;
    case 'sapient': add('intelligence'); break;
    case 'diatom': add('eukaryote', 'algae'); break;
    case 'foram': add('eukaryote'); break;
    case 'lichen': add('fungi'); break;
    case 'waterplant': add('landplants'); break;
    case 'grass': case 'cactus': case 'vine': add('landplants', 'forests', 'seeds'); break;
    case 'starfish': add('animals', 'cambrian'); break;
    case 'arachnid': case 'myriapod': case 'socialinsect': add('animals', 'cambrian', 'landanimals'); break;
    case 'snake': case 'turtle': case 'crocodile': case 'dinosaur': case 'pterosaur': add('vertebrates', 'tetrapods', 'amniotes', 'landanimals'); break;
    case 'rodent': case 'ungulate': case 'carnivoran': case 'primate': add('tetrapods', 'amniotes', 'mammals'); break;
    case 'bat': add('tetrapods', 'amniotes', 'mammals'); break;
  }
  if (ph && ph.animal && ph.level === 3) k.push('cambrian');
  return k;
}

// Nudge a genome toward a chosen way of feeding (for seeding and the organism designer).
export function setDiet(genes, domain, trophic) {
  const g = genes, set = (k, v) => { g[GI[k]] = v; };
  if (domain !== 'eukaryote') {
    set('photo', trophic === 1 ? 0.8 : 0.1);
    set('absorb', trophic === 2 ? 0.7 : 0.15);
    return;
  }
  if (trophic === 1) { set('photo', 0.85); set('ingest', 0.1); set('absorb', 0.1); return; }
  if (trophic === 2) { set('photo', 0.1); set('ingest', 0.2); set('absorb', 0.8); return; }
  set('photo', 0.1); set('absorb', 0.1);
  set('ingest', Math.max(0.7, g[GI.ingest]));
  set('carnivory', trophic === 3 ? 0.15 : trophic === 4 ? 0.85 : 0.5);
}

// Set a body-size gene so the developed body has (roughly) the given size.
export function setSize(genes, size) { genes[GI.size] = clamp01(size); }
