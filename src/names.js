// Procedural Latin-ish binomial names.

const START = ['pr', 'th', 'gl', 'cr', 'ph', 'st', 'br', 'tr', 'sp', 'ch', 'v', 'm', 'n', 'l', 'k', 'd', 'b', 'p', 'h', 's', 'z', 'x', 'r'];
const VOWEL = ['a', 'e', 'i', 'o', 'u', 'ae', 'y', 'io', 'eu', 'ia'];
const MID = ['r', 'n', 'l', 'th', 'x', 'm', 'c', 'nd', 'st', 'ph', 'g', 'v', 'cr', 'lt', 'rn', 'sc'];
const GENUS_END = ['us', 'on', 'a', 'ix', 'odon', 'saurus', 'therium', 'pod', 'ella', 'ops', 'ites', 'cetus', 'morpha', 'phyta', 'zoa', 'idium'];
const SPECIES_END = ['us', 'is', 'a', 'um', 'ensis', 'ii', 'ata', 'ica', 'oides', 'inus'];

const pick = (rng, a) => a[Math.floor(rng() * a.length)];

const GRADE_ENDS = {
  bacteria: ['bacter', 'coccus', 'monas', 'spira', 'bacillus', 'vibrio'],
  archaea: ['archaeon', 'thermus', 'sulfolobus', 'pyrus', 'halo', 'methanus'],
  cyano: ['cystis', 'nostoc', 'chococcus', 'phyton', 'spirulina', 'chloris'],
  protist: ['zoon', 'cystis', 'phrys', 'amoeba', 'ciliata', 'plasma'],
  algae: ['chlorella', 'phycus', 'alga', 'monas', 'desmus', 'diatoma'],
  seaweed: ['phycus', 'laminaria', 'fucus', 'ulva', 'kelpia', 'caulerpa'],
  moss: ['bryum', 'sphagnum', 'marchantia', 'polytrichum', 'mnium'],
  fern: ['pteris', 'equisetum', 'lepidodendron', 'filix', 'cyathea'],
  conifer: ['pinus', 'abies', 'araucaria', 'sequoia', 'cedrus', 'taxus'],
  flower: ['anthus', 'flora', 'rosa', 'magnolia', 'lilium', 'quercus'],
  fungi: ['myces', 'spora', 'mucor', 'candida', 'aspergillus'],
  mushroom: ['agaricus', 'boletus', 'myces', 'amanita', 'russula'],
  sponge: ['spongia', 'cnida', 'medusa', 'coralia', 'hydra'],
  arthropod: ['lobites', 'caris', 'pterus', 'crustis', 'pod', 'annelis'],
  insect: ['ptera', 'opteron', 'scorpius', 'araneus', 'myrmex', 'blatta'],
  fish: ['ichthys', 'odus', 'aspis', 'acanthus', 'selache', 'pisces'],
  amphibian: ['stega', 'batrachus', 'salamandra', 'rana', 'ichthyostega'],
  reptile: ['saurus', 'suchus', 'odon', 'raptor', 'ceratops', 'lacerta'],
  mammal: ['therium', 'odon', 'lestes', 'cyon', 'felis', 'mys'],
  bird: ['ornis', 'avis', 'pteryx', 'aquila', 'corvus'],
  whale: ['cetus', 'delphis', 'balaena', 'physeter', 'orca'],
  sapient: ['homo', 'sapiens', 'anthropus', 'pithecus'],
  diatom: ['navicula', 'diatoma', 'coscinus', 'nitzschia', 'frustula'],
  foram: ['globigerina', 'nummulites', 'foramina', 'radiolaria', 'fusulina'],
  waterplant: ['nymphaea', 'potamogeton', 'zostera', 'elodea', 'nelumbo'],
  grass: ['poa', 'festuca', 'bambusa', 'triticum', 'stipa', 'oryza'],
  cactus: ['cereus', 'opuntia', 'agave', 'euphorbia', 'aloe'],
  vine: ['vitis', 'hedera', 'liana', 'orchis', 'bromelia', 'philodendron'],
  lichen: ['lichen', 'cladonia', 'usnea', 'parmelia', 'lecanora'],
  starfish: ['aster', 'echinus', 'crinus', 'ophiura', 'holothuria'],
  arachnid: ['araneus', 'scorpius', 'opilio', 'acarus', 'lycosa'],
  myriapod: ['scolopendra', 'iulus', 'myriapus', 'arthropleura', 'geophilus'],
  snake: ['ophis', 'boa', 'naja', 'vipera', 'python', 'serpens'],
  turtle: ['chelys', 'testudo', 'emys', 'chelonia', 'trionyx'],
  crocodile: ['crocodylus', 'suchus', 'alligator', 'gavialis', 'caiman'],
  dinosaur: ['saurus', 'raptor', 'ceratops', 'titan', 'odon', 'don'],
  pterosaur: ['pterus', 'dactylus', 'ptera', 'rhamphus', 'ornithocheirus'],
  rodent: ['mys', 'mus', 'lepus', 'sciurus', 'cavia', 'castor'],
  ungulate: ['cervus', 'bos', 'equus', 'capra', 'therium', 'loxodon'],
  carnivoran: ['canis', 'felis', 'ursus', 'mustela', 'cyon', 'leo'],
  primate: ['pithecus', 'lemur', 'simia', 'macaca', 'cebus'],
  bat: ['nycteris', 'pteropus', 'myotis', 'chiroptera', 'vespertilio'],
};

export function genusName(rng, grade = 'mammal') {
  return genusWith(rng, GRADE_ENDS[grade] || GENUS_END);
}

function genusWith(rng, ends) {
  let s = pick(rng, START) + pick(rng, VOWEL);
  if (rng() < 0.7) s += pick(rng, MID) + pick(rng, VOWEL);
  const stripped = s.replace(/[aeiouy]+$/, '');
  if (/[aeiouy]/.test(stripped)) s = stripped;
  s += pick(rng, ends);
  s = s.replace(/([^aeiou])\1+/g, '$1').replace(/([^aeiouy])([^aeiouy])([^aeiouyh])/g, '$1$3');
  return s[0].toUpperCase() + s.slice(1);
}

export function speciesEpithet(rng, traits) {
  // descriptive epithets sometimes reflect traits
  const r = rng();
  if (traits) {
    if (r < 0.12 && traits.size > 2.2) return pick(rng, ['giganteus', 'maximus', 'magnus', 'titanis']);
    if (r < 0.12 && traits.size < 0.6) return pick(rng, ['minimus', 'pusillus', 'nanus', 'parvus']);
    if (r < 0.24 && traits.diet > 0.65) return pick(rng, ['ferox', 'rapax', 'vorax', 'sanguinis', 'dentatus']);
    if (r < 0.24 && traits.tempPref < -2) return pick(rng, ['borealis', 'glacialis', 'frigidus', 'polaris']);
    if (r < 0.24 && traits.tempPref > 28) return pick(rng, ['tropicus', 'calidus', 'aestivus', 'solaris']);
    if (r < 0.3 && traits.speed > 1.15) return pick(rng, ['velox', 'celer', 'rapidus', 'cursor']);
    if (r < 0.3 && traits.aquatic > 0.35 && traits.aquatic < 0.65) return pick(rng, ['amphibius', 'litoralis', 'ripariae']);
  }
  let s = pick(rng, START) + pick(rng, VOWEL) + pick(rng, MID);
  return s + pick(rng, SPECIES_END);
}
