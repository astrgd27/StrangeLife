// Run the simulation without graphics:
//   node tools/headless.mjs [seed] [ticks] [scenario] [reportEvery]
import { World, EONS, formatYears } from '../src/world.js';
const seed = +(process.argv[2] ?? 1), ticks = +(process.argv[3] ?? 2000), scenario = process.argv[4] ?? 'barren';
const every = +(process.argv[5] ?? 500);
let allo = 0, co = 0, ss = 0, isl = 0;
const t0 = Date.now();
const w = new World(seed, { scenario });
w.on((e) => {
  if (e.type === 'milestone') console.log(`[${e.tick} ${formatYears(e.years)}] ★ ${e.key}: ${e.text}`);
  if (e.type === 'asteroid') console.log(`[${e.tick}] asteroid`);
  if (e.type === 'allopatric') allo++;
  if (e.type === 'cospeciation') co++;
  if (e.type === 'sexualsel') ss++;
  if (e.type === 'island') isl++;
  if (e.type === 'radiation') console.log(`[${e.tick}] radiation of ${e.grade} (${e.count})`);
});
console.log(`gen ${Date.now() - t0}ms`);
const t1 = Date.now();
for (let t = 1; t <= ticks; t++) {
  w.step();
  if (t % every === 0) {
    const P = w.planet, E = w.eco;
    const grades = {};
    for (const s of E.alive) { const g = E.slots[s].grade; grades[g] = (grades[g] || 0) + 1; }
    const h = w.history[w.history.length - 1];
    console.log(`t=${t} ${EONS[w.eon].name} ${formatYears(w.years)} T=${P.meanT.toFixed(1)} co2=${P.co2.toFixed(1)} o2=${P.o2.toFixed(1)} iron=${P.iron.toFixed(2)} ice=${P.iceFrac.toFixed(2)} ocean=${P.oceanFrac.toFixed(2)} prod=${P.primaryProduction.toFixed(3)} land=${(P.landProduction||0).toFixed(3)} cover=${P.landPlantCover.toFixed(2)} abio=${w.abiogenesis.toFixed(2)} plates=${w.tect.moves}mv land:${(w.tect.largestShare*100).toFixed(0)}%/${w.tect.landmasses} allo=${allo} co=${co} ss=${ss} isl=${isl} orb=${w.planet.orbital.toFixed(1)} | sp=${E.alive.length} life=${(h.lifeZones*100).toFixed(0)}% ${Object.entries(grades).map(([g, n]) => g + ':' + n).join(' ')}`);
  }
}
console.log(`avg ${((Date.now() - t1) / ticks).toFixed(2)} ms/tick`);
