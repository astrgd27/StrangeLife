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
  'wings', 'display', 'hue', 'covering', 'armour', 'succulence', 'climbing',
];
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
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function makeGenes(obj = {}) {
  const g = new Float32Array(NG);
  for (const k of GENES) g[GI[k]] = obj[k] ?? 0.1;
  if (obj.skeleton === undefined) g[GI.skeleton] = 0.5;
  if (obj.covering === undefined) g[GI.covering] = 0.32; // bare skin: the ground state
  for (const k of ['armour', 'succulence', 'climbing']) if (obj[k] === undefined) g[GI[k]] = 0.05;
  if (obj.hue === undefined) g[GI.hue] = 0.5;
  return g;
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
  const animal = euk && level >= 2 && (trophic >= 3);
  const plant = euk && level >= 2 && trophic === 1 && !lichen;
  const fungus = euk && level >= 2 && trophic === 2;
  const radial = G('symmetry') < 0.5;
  const motile = G('motility') > 0.35 && !plant && !fungus;
  const segments = 1 + Math.round(G('segments') * 9);
  let skeleton = 'none';
  // skeleton bands run shell/exoskeleton → soft-bodied → bone, so a backbone evolves from a soft
  // ancestor (as chordates did), never straight from an armoured one
  if (animal) skeleton = G('skeleton') < 0.3 ? 'exo' : G('skeleton') < 0.7 || level < 3 || radial ? 'none' : 'endo';
  const limbs = animal && level === 3 && !radial ? Math.round(G('limbs') * 4) : 0;
  const sizeCap = [0.1, 0.25, 0.6, 1][level] * (animal && level === 3 && skeleton !== 'endo' ? 0.6 : 1);
  const size = G('size') * sizeCap;
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
  return {
    level, euk, photo, trophic, animal, plant, fungus, lichen, radial, motile, segments, limbs, skeleton,
    size, endo, brain, flying, vascular, sapient, covering, armour, shelled,
    succulence: plant ? G('succulence') : 0, climbing: plant ? G('climbing') : 0,
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
    if (ph.flying) parts.push('flying');
    if (ph.endo) parts.push('warm-blooded');
    if (ph.brain > 0.6) parts.push(ph.brain > 0.85 ? 'large brain' : 'brain');
    if (!ph.motile) parts.push('sessile');
  }
  if (ph.lichen) parts.push('a fungus farming algae');
  if (ph.shelled) parts.push(ph.photo ? 'glass shell' : 'chalky shell');
  if (ph.plant) {
    if (ph.succulence > 0.6) parts.push('water-storing');
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
  p.imax *= sz; if (!ph.photo) p.m *= sz;
  if (sp.trophic === 4) p.half *= 0.12; else if (sp.trophic === 5) p.half *= 0.35;
  // defences: size, armour, flight and speed make an animal hard to catch
  if (!ph.photo) {
    p.vuln = 1 / (1 + 2.5 * s + (ph.skeleton === 'exo' ? 1.2 : ph.skeleton === 'endo' ? 0.6 : 0) + 1.5 * ph.armour + (ph.flying ? 0.8 : 0) + 0.6 * (ph.motile ? ph.motility : 0));
    if (ph.shelled) p.vuln *= 0.6;
  }
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
    if (k === GI.hue) { g[k] = (((g[k] + gaussian(rng) * 0.02) % 1) + 1) % 1; continue; }
    // genes the body doesn't use yet stay in their ground state: no hidden drift that would let a
    // finished insect body spring from a single cell
    const free = !ev || ev[GENES[k]] ? 1 : 0.02;
    g[k] = clamp01(g[k] + gaussian(rng) * 0.035 * rate * free);
  }
  return g;
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
  if (ph.level <= 1) return sp.chloro ? { adhesion: 3, photo: 0.5, size: 1, motility: 1, skeleton: 0.4 } : { adhesion: 3, absorb: key('absorb', 0.45, 2), ingest: 1, carnivory: 1, motility: 1, size: 1, skeleton: 0.4 };
  if (ph.plant) {
    const seed = ph.vascular >= 0.5 ? 1.2 : 0;
    return { differentiation: key('differentiation', 0.55, 2), vascular: key('vascular', 0.65, 3), landAdapt: 2, display: 2, size: 2, succulence: seed, climbing: seed };
  }
  if (ph.fungus) return { differentiation: 1, landAdapt: 2, size: 1 };
  if (!ph.animal) return { differentiation: 2, ingest: 1, absorb: 1 };
  if (ph.level === 2) return { differentiation: 3, symmetry: 3, motility: 1.5, carnivory: 1, size: 0.5 };
  return {
    // shells can be lost and bones gained from a soft body, but a backbone is never lost
    skeleton: ph.skeleton === 'endo' ? 0 : ph.skeleton === 'exo' ? 1.2 : 3,
    symmetry: ph.radial ? 3 : 0, limbs: ph.radial ? 0 : 2, segments: 2, landAdapt: 2, endothermy: key('endothermy', 0.55, 1.5), brain: 1.5,
    wings: ph.limbs >= 1 || ph.skeleton === 'exo' ? 1.5 : 0, size: 2, carnivory: 1, motility: ph.skeleton === 'endo' ? 0.3 : ph.motile ? 1 : 2.5, display: 1,
    // backboned animals can change their covering (once warm-blooded, much less) and grow armour
    covering: ph.skeleton !== 'endo' ? 0 : ph.endo ? 0.3 : 1.5, armour: ph.skeleton === 'endo' ? 0.8 : 0,
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
  conifer: A({ adhesion: 0.85, differentiation: 0.75, photo: 0.85, size: 0.8, vascular: 0.8, landAdapt: 0.8, display: 0.2 }, 'eukaryote', true, true),
  flower: A({ adhesion: 0.85, differentiation: 0.75, photo: 0.85, size: 0.5, vascular: 0.75, landAdapt: 0.8, display: 0.8 }, 'eukaryote', true, true),
  fungi: A({ adhesion: 0.7, differentiation: 0.3, absorb: 0.8, size: 0.3 }),
  mushroom: A({ adhesion: 0.75, differentiation: 0.4, absorb: 0.8, size: 0.4, landAdapt: 0.6 }),
  sponge: A({ adhesion: 0.7, differentiation: 0.3, ingest: 0.7, carnivory: 0.2, motility: 0.1, size: 0.5, symmetry: 0.2 }),
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
  arachnid: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.85, motility: 0.6, size: 0.25, symmetry: 0.85, segments: 0.15, limbs: 0.95, skeleton: 0.12, landAdapt: 0.8 }),
  myriapod: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.4, motility: 0.5, size: 0.3, symmetry: 0.85, segments: 0.85, limbs: 0.75, skeleton: 0.12, landAdapt: 0.7 }),
  snake: vert({ carnivory: 0.85, motility: 0.6, size: 0.4, segments: 0.9, limbs: 0.02, covering: 0.6, brain: 0.4 }),
  turtle: vert({ carnivory: 0.3, motility: 0.3, size: 0.5, covering: 0.6, armour: 0.85, brain: 0.35 }),
  crocodile: vert({ carnivory: 0.85, motility: 0.6, size: 0.7, covering: 0.6, armour: 0.35, landAdapt: 0.7, brain: 0.4 }),
  dinosaur: vert({ carnivory: 0.2, motility: 0.6, size: 0.85, covering: 0.62, endothermy: 0.6, brain: 0.45 }),
  pterosaur: vert({ carnivory: 0.75, motility: 0.8, size: 0.3, covering: 0.35, endothermy: 0.6, wings: 0.85, brain: 0.45 }),
  bat: vert({ carnivory: 0.7, motility: 0.8, size: 0.15, covering: 0.08, endothermy: 0.8, wings: 0.85, brain: 0.5 }),
  rodent: vert({ carnivory: 0.3, motility: 0.7, size: 0.15, covering: 0.08, endothermy: 0.8, brain: 0.5 }),
  ungulate: vert({ carnivory: 0.1, motility: 0.8, size: 0.6, covering: 0.08, endothermy: 0.8, brain: 0.5 }),
  carnivoran: vert({ carnivory: 0.85, motility: 0.8, size: 0.45, covering: 0.08, endothermy: 0.8, brain: 0.6 }),
  primate: vert({ carnivory: 0.45, motility: 0.7, size: 0.4, covering: 0.08, endothermy: 0.8, brain: 0.78 }),
  insect: A({ adhesion: 0.8, differentiation: 0.7, ingest: 0.75, carnivory: 0.2, motility: 0.6, size: 0.25, symmetry: 0.85, segments: 0.3, limbs: 0.75, skeleton: 0.12, landAdapt: 0.75, wings: 0.7 }),
  fish: A({ adhesion: 0.85, differentiation: 0.8, ingest: 0.75, carnivory: 0.3, motility: 0.75, size: 0.4, symmetry: 0.85, segments: 0.3, limbs: 0.5, skeleton: 0.88, brain: 0.3, covering: 0.6 }),
  amphibian: A({ adhesion: 0.85, differentiation: 0.8, ingest: 0.75, carnivory: 0.8, motility: 0.6, size: 0.3, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.55, brain: 0.35, covering: 0.32 }),
  reptile: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.3, motility: 0.6, size: 0.45, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, brain: 0.4, covering: 0.6 }),
  mammal: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.2, motility: 0.7, size: 0.45, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, endothermy: 0.8, brain: 0.55, covering: 0.08 }),
  bird: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.3, motility: 0.8, size: 0.3, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, endothermy: 0.8, brain: 0.5, wings: 0.85, display: 0.7, covering: 0.9 }),
  whale: A({ adhesion: 0.85, differentiation: 0.85, ingest: 0.75, carnivory: 0.8, motility: 0.8, size: 0.85, symmetry: 0.85, segments: 0.2, limbs: 0.3, skeleton: 0.88, landAdapt: 0.5, endothermy: 0.8, brain: 0.6, covering: 0.08 }),
  sapient: A({ adhesion: 0.9, differentiation: 0.9, ingest: 0.8, carnivory: 0.5, motility: 0.7, size: 0.5, symmetry: 0.85, segments: 0.2, limbs: 0.5, skeleton: 0.88, landAdapt: 0.8, endothermy: 0.8, brain: 0.95, covering: 0.08 }),
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
    case 'arachnid': case 'myriapod': add('animals', 'cambrian', 'landanimals'); break;
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
