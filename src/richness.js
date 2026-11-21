// How many real species does a simulated lineage stand for?
//
// The simulation follows a few hundred lineages; Earth has millions of species. Each lineage is
// best read as a clade: a group of closely related species living in much the same way. Its
// estimated size here combines three things:
//  - how rich its kind of life is on Earth today, shared among the lineages that group usually
//    holds in the simulation (an assumption: the planet is calibrated to Earth's group sizes,
//    so insects stand for far more species than whales);
//  - how widely it has spread (wide ranges span more habitats and more isolated populations,
//    so they hold more species: the species–area rule, with an exponent of 0.5 across regions);
//  - how long its kind of life has had to diversify (clades fill out over tens of millions of
//    years, so a group that has just appeared stands for few species).
// The result is an estimate, shown rounded, never a count.

import { groupCapOf } from './ecosystem.js';

// species on Earth today by kind of life (described plus estimated undescribed, round numbers)
export const EARTH_SPECIES = {
  insect: 5.5e6, arachnid: 6e5, arthropod: 1.5e5, myriapod: 8e4, socialinsect: 4e4,
  mollusc: 2e5, squid: 800, worm: 1e6, sponge: 9000, jelly: 11000, starfish: 7000,
  fish: 35000, amphibian: 8700, reptile: 7000, snake: 4000, turtle: 360, crocodile: 27,
  dinosaur: 3000, pterosaur: 200, bird: 11000, mammal: 1500, rodent: 2600, bat: 1400, primate: 500,
  carnivoran: 300, ungulate: 350, whale: 90, sapient: 1,
  flower: 3.5e5, grass: 12000, cactus: 1800, vine: 20000, conifer: 630, fern: 10500, moss: 20000,
  waterplant: 3000, seaweed: 10000, algae: 50000, diatom: 1e5,
  mushroom: 1.5e6, fungi: 1e5, lichen: 20000,
  protist: 2e5, foram: 50000, bacteria: 1e6, archaea: 1e5, cyano: 8000,
};
const REF_RANGE = 120;  // zones a typical lineage spans
const TAU_MY = 80;      // millions of years for a new kind of life to diversify

// when each kind of life first appeared (years), worked out from every species ever
function groupBorn(E) {
  const c = E._groupBorn;
  if (c && c.n === E.species.size) return c.born;
  const born = c?.born || {};
  let i = 0;
  for (const sp of E.species.values()) {
    if (c && i++ < c.n) continue;
    const y = sp.bornYears ?? 0;
    if (born[sp.grade] === undefined || y < born[sp.grade]) born[sp.grade] = y;
  }
  E._groupBorn = { n: E.species.size, born };
  return born;
}

// the estimate for one lineage
export function lineageSpecies(E, sp, years = E.years ?? 0) {
  if (!sp || sp.died >= 0) return 0;
  const earth = EARTH_SPECIES[sp.grade] ?? 1000;
  const lineages = Math.max(1, groupCapOf(sp.grade));
  const spread = Math.min(3, Math.max(0.05, Math.sqrt((sp.range || 1) / REF_RANGE)));
  const born = groupBorn(E)[sp.grade] ?? sp.bornYears ?? 0;
  const maturity = 1 - Math.exp(-Math.max(0, years - born) / 1e6 / TAU_MY) * 0.95;
  return Math.max(1, (earth / lineages) * spread * maturity);
}

// estimates for every living lineage, with totals by kingdom
export function estimateSpecies(E, years = E.years ?? 0) {
  const byKingdom = {}, byId = new Map();
  let total = 0;
  for (const s of E.alive) {
    const sp = E.slots[s], n = lineageSpecies(E, sp, years);
    byId.set(sp.id, n);
    byKingdom[sp.kingdom] = (byKingdom[sp.kingdom] || 0) + n;
    total += n;
  }
  return { total, byKingdom, byId };
}

// "1.2 million", "38,000", "about 400"
export function formatCount(n, short = false) {
  if (!n) return '0';
  const sig = (v) => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  if (n >= 1e6) return short ? `${sig(n / 1e6)}M` : `${sig(n / 1e6)} million`;
  if (n >= 1e4) return short ? `${Math.round(n / 1e3)}k` : `${(Math.round(n / 1e3) * 1e3).toLocaleString('en')}`;
  if (n >= 1000) return short ? `${(n / 1e3).toFixed(1)}k` : `${(Math.round(n / 100) * 100).toLocaleString('en')}`;
  return `${n >= 100 ? Math.round(n / 10) * 10 : Math.round(n)}`;
}
