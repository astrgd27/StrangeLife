// Run one zone as individuals without graphics and report how behaviour evolved:
//   node tools/microcosm.mjs [seed] [planetTicks] [seconds]
import { World } from '../src/world.js';
import { Microcosm } from '../src/microcosm.js';
const seed = +(process.argv[2] ?? 7), ticks = +(process.argv[3] ?? 400), secs = +(process.argv[4] ?? 300);
const w = new World(seed, { scenario: 'oxygen' });
for (let t = 0; t < ticks; t++) w.step();
const E = w.eco;
// the zone with the most kinds of animal
let best = 0, bz = 0;
for (let z = 0; z < E.Z; z++) { const n = E.speciesIn(z).filter((q) => q.sp.ph.animal).length + (E.zSea[z] > 0.2 && E.zLand[z] > 0.2 ? 1 : 0); if (n > best) { best = n; bz = z; } }
const m = new Microcosm(w, bz, 1);
const f = (k) => `F${k.forage.toFixed(2)} E${k.evade.toFixed(2)} H${k.hunt.toFixed(2)} K${k.herd.toFixed(2)}`;
console.log(`zone ${bz}: sea ${m.seaFrac.toFixed(2)}, ${m.groups.length} animal species, ${m.agents.length} individuals`);
const t0 = Date.now();
for (let s = 0; s < secs * 30; s++) {
  m.step();
  if (s % (60 * 30) === 0 || s === secs * 30 - 1) console.log(`t=${m.time.toFixed(0)}s individuals=${m.agents.filter((a) => a.alive).length}`);
  for (const e of m.events.splice(0)) console.log(`  [${m.time.toFixed(0)}s] ${e.g.sp.name}: ${e.text}`);
}
console.log(`${((Date.now() - t0) / (secs * 30)).toFixed(2)} ms/step`);
for (const g of m.groups) console.log(`${g.sp.grade.padEnd(9)} ${g.sp.name.padEnd(26)} n0=${g.n0} now=${g.count} births=${g.births} eaten=${g.eaten} starved=${g.starved} old=${g.old} gen=${g.maxGen} | ${f(g.startSkills)} -> ${f(g.skills)}`);
const ch = m.writeBack();
for (const c of ch) console.log(`writeback ${c.sp.name}: imax x${(E.tImax[c.sp.slot] / c.sp.eco.imax).toFixed(2)} vuln x${(E.tVuln[c.sp.slot] / c.sp.eco.vuln).toFixed(2)} ${c.behaviours.join(', ')}`);
