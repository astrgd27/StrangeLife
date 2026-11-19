// Procedural Latin-ish binomial names.

const START = ['pr', 'th', 'gl', 'cr', 'ph', 'st', 'br', 'tr', 'sp', 'ch', 'v', 'm', 'n', 'l', 'k', 'd', 'b', 'p', 'h', 's', 'z', 'x', 'r'];
const VOWEL = ['a', 'e', 'i', 'o', 'u', 'ae', 'y', 'io', 'eu', 'ia'];
const MID = ['r', 'n', 'l', 'th', 'x', 'm', 'c', 'nd', 'st', 'ph', 'g', 'v', 'cr', 'lt', 'rn', 'sc'];
const GENUS_END = ['us', 'on', 'a', 'ix', 'odon', 'saurus', 'therium', 'pod', 'ella', 'ops', 'ites', 'cetus', 'morpha', 'phyta', 'zoa', 'idium'];
const SPECIES_END = ['us', 'is', 'a', 'um', 'ensis', 'ii', 'ata', 'ica', 'oides', 'inus'];

const pick = (rng, a) => a[Math.floor(rng() * a.length)];

export function genusName(rng) {
  let s = pick(rng, START) + pick(rng, VOWEL);
  if (rng() < 0.7) s += pick(rng, MID) + pick(rng, VOWEL);
  const stripped = s.replace(/[aeiouy]+$/, '');
  if (/[aeiouy]/.test(stripped)) s = stripped;
  s += pick(rng, GENUS_END);
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
