// Run the simulation without graphics: node tools/headless.mjs [seed] [ticks]
import { World } from '../src/world.js';
const seed = +(process.argv[2] ?? 1), ticks = +(process.argv[3] ?? 2000);
const t0 = Date.now();
const w = new World(seed);
w.on((e) => {
  if (e.type === 'milestone') console.log(`[${e.tick}] ★ ${e.text}`);
});
const P = w.planet;
let land = 0; for (let i = 0; i < P.n; i++) land += !P.water[i];
console.log(`cells=${P.n} land=${(land / P.n * 100).toFixed(1)}%  gen ${Date.now() - t0}ms`);
const t1 = Date.now();
for (let t = 1; t <= ticks; t++) {
  w.step();
  if (t % 200 === 0) {
    const h = w.history[w.history.length - 1];
    const top = w.life.livingSpecies().slice(0, 3).map((s) => {
      const tr = w.life.speciesTraits(s);
      return `${s.name}(${s.count} sz${tr.size.toFixed(1)} d${tr.diet.toFixed(2)} aq${tr.aquatic.toFixed(2)} T${tr.tempPref.toFixed(0)})`;
    }).join(', ');
    console.log(`t=${t} pop=${h.pop} land=${h.land} sea=${h.sea} carn=${h.carn} species=${h.species} total=${w.life.speciesById.size} plants=${h.plants.toFixed(2)} | ${top}`);
  }
}
const ms = (Date.now() - t1) / ticks;
console.log(`avg ${ms.toFixed(2)} ms/tick; deaths`, w.life.deaths);
