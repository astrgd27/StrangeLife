// A microcosm: one zone of the planet simulated as individual creatures.
//
// At planet scale, life is populations. Dive into a zone and its animals become individuals, each
// with its own small evolving brain (brain.js). They smell out food, chase prey, flee danger,
// find mates, breed and die. Brains are inherited with mutations, so behaviour evolves while you
// watch: foraging, hunting, escape and herding or schooling (crowds confuse predators, and sexual
// species must find each other to breed). When you leave, each species keeps the brain of its most
// successful individual, and that changes how well it feeds and escapes across the whole planet.

import { makeBrain, think, mutateBrain, crossBrains, probe, behaviours, NI, NO } from './brain.js';
import { mulberry32, gaussian } from './rng.js';

export const MW = 1000, MH = 640;
const CELL = 25, GW = MW / CELL, GH = Math.ceil(MH / CELL);
const STEP = 1 / 30;

export function dietOf(sp) {
  const ph = sp.ph;
  const filter = !ph.motile || ph.level === 2 || ph.radial;
  return {
    graze: !filter && (sp.trophic === 3 || sp.trophic === 5),
    hunt: !filter && (sp.trophic === 4 || sp.trophic === 5),
    filter, aquatic: sp.habitat === 0,
  };
}

// how useful a set of skills is to a species, for deciding whether to keep a new brain
function fitness(k, diet) {
  return (diet.hunt && !diet.graze ? k.hunt : diet.hunt ? Math.max(k.hunt, k.forage) : k.forage) + k.evade + (k.herd > 0.3 ? 0.15 : 0);
}

export class Microcosm {
  constructor(world, z, seed) {
    const E = (this.E = world.eco);
    this.world = world;
    this.z = z;
    this.rng = mulberry32(seed ?? ((z * 7919 + world.tick * 31) >>> 0));
    this.time = 0;
    this.nextId = 1;
    this.events = [];
    this.acc = 0;
    // sea on the left, land on the right, a wavy shore between
    const s = E.zSea[z], l = E.zLand[z];
    this.seaFrac = s + l < 0.01 ? 1 : s / (s + l);
    if (this.seaFrac > 0.93) this.seaFrac = 1.3;
    else if (this.seaFrac < 0.07) this.seaFrac = -0.3;
    else this.seaFrac = Math.max(0.2, Math.min(0.8, this.seaFrac));
    // plant food: patchy, as rich as the zone's producers
    const life = E.speciesIn(z);
    this.life = life;
    const prod = { sea: [], land: [], fresh: [] };
    for (const { sp, b } of life) {
      if (sp.trophic !== 1) continue;
      if (sp.habitat === 0 || sp.habitat === 1) prod.sea.push({ sp, b });
      if (sp.habitat === 1 || sp.habitat === 2) prod.land.push({ sp, b });
      if (sp.habitat === 3) prod.fresh.push({ sp, b });
    }
    for (const k in prod) prod[k].sort((a, b) => b.b - a.b);
    this.producers = { sea: prod.sea.slice(0, 3).map((q) => q.sp), land: prod.land.slice(0, 3).map((q) => q.sp), fresh: prod.fresh.slice(0, 3).map((q) => q.sp) };
    const capS = prod.sea.length ? 0.25 + 0.75 * E.coverS[z] : 0.04;
    const capL = prod.land.length ? 0.25 + 0.75 * E.coverL[z] : 0.04;
    const capF = prod.fresh.length ? 0.6 : 0.05;
    // a river winds across the land if the zone has fresh water
    this.river = this.seaFrac < 1 && E.zFw[z] > 0.02 ? { w: 24 + 70 * Math.min(1, E.zFw[z] * 6), ph: this.rng() * 6, y0: MH * (0.3 + 0.4 * this.rng()) } : null;
    this.cap = new Float32Array(GW * GH);
    this.food = new Float32Array(GW * GH);
    const ph1 = this.rng() * 6, ph2 = this.rng() * 6;
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL;
      const patch = 0.5 + 0.25 * Math.sin(x / 70 + ph1) * Math.sin(y / 55 + ph2) + 0.25 * Math.sin((x + y) / 33 + ph2);
      const c = gy * GW + gx;
      this.cap[c] = (this.isSea(x, y) ? capS : this.inRiver(x, y) ? capF : capL) * Math.max(0, Math.min(1, patch * 1.4 - 0.15));
      this.food[c] = this.cap[c] * (0.5 + 0.4 * this.rng());
    }
    // the animals of this zone, as individuals in proportion to their numbers
    const animals = life.filter(({ sp }) => sp.ph?.animal && this.randomPos(sp.habitat));
    const tot = animals.reduce((a, q) => a + Math.sqrt(q.b), 0) || 1;
    this.groups = [];
    this.agents = [];
    for (const { sp, b } of animals) {
      const diet = dietOf(sp), ph = sp.ph;
      const n = Math.max(3, Math.min(36, Math.round((150 * Math.sqrt(b)) / tot)));
      const g = {
        sp, diet, n0: n, cap: Math.min(60, n * 2 + 4), count: 0,
        births: 0, eaten: 0, starved: 0, old: 0, maxGen: 0, food: 0,
        brain: sp.brain ? Float32Array.from(sp.brain) : makeBrain(diet, this.rng, gaussian),
        r: 5 + 15 * ph.size,
        vmax: diet.filter ? 0 : (25 + 110 * ph.motility) * (ph.flying ? 1.4 : 1),
        sense: 90 + 150 * ph.brain + 40 * ph.size,
        life: 35 + 80 * ph.size + 30 * ph.brain,
        meta: 0.035 * (0.6 + ph.size) * (ph.endo ? 1.4 : 1),
        vuln: sp.eco?.vuln ?? 0.5,
        edible: E.tPool[sp.slot] === 2 || diet.filter,
        notes: new Set(), skills: null,
      };
      g.skills = probe(g.brain);
      g.startSkills = g.skills;
      if (!diet.filter) for (const b of behaviours(g.skills, diet)) g.notes.add(b);
      this.groups.push(g);
      for (let k = 0; k < n; k++) {
        const p = this.randomPos(sp.habitat);
        this.spawn(g, k === 0 ? g.brain : mutateBrain(g.brain, this.rng, gaussian), p[0], p[1], 0, 0.8 + 0.6 * this.rng());
      }
    }
    this.byId = new Map(this.groups.map((g) => [g.sp.id, g]));
  }

  // ---------- the place ----------

  coastX(y) { return MW * this.seaFrac + 40 * Math.sin(y / 90) + 22 * Math.sin(y / 37 + 1.3); }
  isSea(x, y) { return x < this.coastX(y); }
  riverY(x) { const r = this.river; return r.y0 + 55 * Math.sin(x / 110 + r.ph) + 25 * Math.sin(x / 41 + 2 * r.ph); }
  inRiver(x, y) { return !!this.river && !this.isSea(x, y) && Math.abs(y - this.riverY(x)) < this.river.w / 2; }
  allowed(h, x, y) {
    if (x < 0 || y < 0 || x > MW || y > MH) return false;
    if (h === 0) return this.isSea(x, y);
    if (h === 2) return !this.isSea(x, y);
    if (h === 3) return this.inRiver(x, y);
    return Math.abs(x - this.coastX(y)) < 170;
  }
  randomPos(h) {
    for (let k = 0; k < 300; k++) {
      const x = 15 + this.rng() * (MW - 30), y = 15 + this.rng() * (MH - 30);
      if (this.allowed(h, x, y)) return [x, y];
    }
    return null;
  }
  foodAt(x, y) {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    return gx < 0 || gy < 0 || gx >= GW || gy >= GH ? 0 : this.food[gy * GW + gx];
  }

  // ---------- creatures ----------

  spawn(g, brain, x, y, gen, energy = 1) {
    const a = {
      id: this.nextId++, g, sp: g.sp, x, y, vx: 0, vy: 0, heading: this.rng() * Math.PI * 2,
      energy, age: 0, brain, gen, kids: 0, alive: true, act: 'wandering',
      kin: 0, threat: null, prey: null, mate: null,
      inp: new Float32Array(NI), out: new Float32Array(NO),
    };
    this.agents.push(a);
    g.count++;
    if (gen > g.maxGen) g.maxGen = gen;
    return a;
  }

  canEat(A, B) {
    return A.g.diet.hunt && A.g !== B.g && B.g.edible && B.g.r <= A.g.r * 1.5;
  }

  die(a, why) {
    a.alive = false;
    a.g.count--;
    a.g[why]++;
  }

  // advance real time (seconds), in fixed steps
  update(dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 40) { this.step(); this.acc -= STEP; n++; }
    if (this.acc > STEP * 4) this.acc = 0;
  }

  step() {
    const dt = STEP, rng = this.rng, A = this.agents;
    this.time += dt;
    this.ticks = (this.ticks || 0) + 1;
    // plants regrow
    const food = this.food, cap = this.cap;
    for (let c = 0; c < food.length; c++) food[c] += 0.06 * (cap[c] - food[c]) * dt;
    // senses (every other step)
    const sense = this.ticks % 2 === 0;
    if (sense) this.senseAll();
    for (const a of A) {
      if (!a.alive) continue;
      const g = a.g;
      a.age += dt;
      if (g.vmax > 0) {
        const o = a.out;
        let sx = o[0], sy = o[1];
        const m = Math.hypot(sx, sy);
        if (m < 0.08) { a.heading += gaussian(rng) * 0.3; sx = Math.cos(a.heading); sy = Math.sin(a.heading); }
        else { sx /= m; sy /= m; }
        const v = o[2] * g.vmax;
        const k = Math.min(1, dt * 4);
        a.vx += (sx * v - a.vx) * k;
        a.vy += (sy * v - a.vy) * k;
        const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
        if (this.allowed(g.sp.habitat, nx, ny)) { a.x = nx; a.y = ny; }
        else { a.vx *= -0.5; a.vy *= -0.5; a.heading += Math.PI * (0.5 + rng()); }
        const sp2 = (a.vx * a.vx + a.vy * a.vy) / (g.vmax * g.vmax + 1e-6);
        if (sp2 > 0.01) a.heading = Math.atan2(a.vy, a.vx);
        a.energy -= g.meta * (0.7 + 0.8 * sp2) * dt;
      } else {
        a.energy -= g.meta * 0.5 * dt;
      }
      // feeding
      if (g.diet.graze) {
        const gx = Math.floor(a.x / CELL), gy = Math.floor(a.y / CELL), c = gy * GW + gx;
        if (c >= 0 && c < food.length && food[c] > 0.02) {
          const eat = Math.min(food[c], (0.25 + g.r / 40) * dt);
          food[c] -= eat;
          a.energy += eat * (g.diet.hunt ? 1.3 : 1.7);
          g.food += eat;
          a.act = 'grazing';
        }
      } else if (g.diet.filter) {
        a.energy += (0.03 + 0.06 * this.foodAt(a.x, a.y)) * dt;
        a.act = 'filter-feeding';
      }
      if (g.diet.hunt && a.prey && a.prey.alive) {
        const B = a.prey, d = Math.hypot(B.x - a.x, B.y - a.y);
        if (d < g.r + B.g.r + 3) {
          // crowds confuse predators: each nearby relative makes a prey animal harder to single out
          const p = dt * 5 * B.g.vuln / (1 + 0.4 * B.kin);
          if (rng() < p) {
            this.die(B, 'eaten');
            a.energy = Math.min(3, a.energy + 0.5 + B.g.r / 25);
            g.food += 1;
            a.act = 'feeding';
          }
        }
      }
      // breeding: well-fed animals reproduce; sexual species need a partner nearby
      if (a.energy > 1.8 && g.count < g.cap) {
        const mate = g.sp.sexual ? a.mate : null;
        if (!g.sp.sexual || (mate && mate.alive && mate.energy > 1.3)) {
          let brain = mate ? crossBrains(a.brain, mate.brain, rng) : a.brain;
          brain = mutateBrain(brain, rng, gaussian);
          const c = this.spawn(g, brain, a.x + gaussian(rng) * 6, a.y + gaussian(rng) * 6, Math.max(a.gen, mate?.gen ?? 0) + 1, 0.9);
          if (!this.allowed(g.sp.habitat, c.x, c.y)) { c.x = a.x; c.y = a.y; }
          a.energy -= 0.9; a.kids++;
          if (mate) { mate.energy -= 0.4; mate.kids++; }
          g.births++;
          a.act = 'breeding';
        } else if (g.sp.sexual) a.act = 'looking for a mate';
      }
      if (a.energy <= 0) this.die(a, 'starved');
      else if (a.age > g.life * (0.8 + 0.4 * ((a.id * 0.618) % 1))) this.die(a, 'old');
    }
    if (this.ticks % 30 === 0) this.agents = A.filter((a) => a.alive);
    if (this.ticks % 30 === 0) this.census();
  }

  // what each creature notices: food by smell, the nearest danger and prey, nearby kin and mates
  senseAll() {
    const A = this.agents, n = A.length;
    for (let i = 0; i < n; i++) {
      const a = A[i];
      if (!a.alive) continue;
      const g = a.g, R = g.sense, R2 = R * R;
      let tD = R2, pD = R2, mD = 60 * 60, kx = 0, ky = 0, kn = 0;
      a.threat = a.prey = a.mate = null;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b = A[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        if (b.g === g) {
          kx += dx; ky += dy; kn++;
          if (d2 < mD && b.energy > 1.3) { mD = d2; a.mate = b; }
        } else {
          if (d2 < tD && this.canEat(b, a)) { tD = d2; a.threat = b; }
          if (d2 < pD && this.canEat(a, b)) { pD = d2; a.prey = b; }
        }
      }
      a.kin = kn;
      if (g.vmax === 0) continue;
      const x = a.inp;
      x.fill(0);
      // smell: which way the food is richer (only food the animal can reach counts)
      const d = Math.min(60, R * 0.4), h = g.sp.habitat;
      const F = (px, py) => (this.allowed(h, px, py) ? this.foodAt(px, py) : 0);
      x[0] = Math.max(-1, Math.min(1, (F(a.x + d, a.y) - F(a.x - d, a.y)) * 3));
      x[1] = Math.max(-1, Math.min(1, (F(a.x, a.y + d) - F(a.x, a.y - d)) * 3));
      const dir = (b, ix) => {
        if (!b) return;
        const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1, near = 1 - dd / R;
        x[ix] = (dx / dd) * near; x[ix + 1] = (dy / dd) * near;
      };
      dir(a.threat, 2);
      dir(a.prey, 4);
      if (kn) { const dd = Math.hypot(kx, ky) || 1, s = Math.min(1, kn / 4); x[6] = (kx / dd) * s; x[7] = (ky / dd) * s; }
      x[8] = 1 - Math.min(1, a.energy / 2);
      x[9] = 1;
      think(a.brain, x, a.out);
      if (a.threat && x[2] * a.vx + x[3] * a.vy < 0) a.act = 'fleeing';
      else if (a.prey) a.act = 'hunting';
      else if (a.act !== 'grazing' && a.act !== 'breeding') a.act = kn > 2 ? 'with its group' : 'wandering';
    }
  }

  // once a second: the most successful individual of each species shows what its kind has learned
  census() {
    for (const g of this.groups) {
      let best = null, bs = -1;
      for (const a of this.agents) {
        if (a.g !== g || !a.alive) continue;
        const s = a.kids * 2 + a.energy + a.gen * 0.5;
        if (s > bs) { bs = s; best = a; }
      }
      g.best = best;
      if (best) {
        g.brain = best.brain;
        g.skills = probe(best.brain);
        if (!g.diet.filter) for (const b of behaviours(g.skills, g.diet)) {
          if (!g.notes.has(b)) { g.notes.add(b); if (this.time > 3) this.events.push({ g, text: b }); }
        }
      }
      // a few migrants arrive from neighbouring zones when a local population dies out
      if (g.count < 2 && Math.floor(this.time) % 6 === 0) {
        for (let k = 0; k < 2; k++) {
          const p = this.randomPos(g.sp.habitat);
          if (p) this.spawn(g, mutateBrain(g.brain, this.rng, gaussian), p[0], p[1], g.maxGen, 1.1);
        }
      }
    }
  }

  // Leaving the zone: each species takes home the brain of its most successful individual. The
  // change spreads to its whole population on the planet (and to future daughter species).
  writeBack() {
    const changes = [];
    for (const g of this.groups) {
      const sp = g.sp;
      // animals that sit still and filter the water have no use for a steering brain
      if (sp.died >= 0 || g.births < 3 || !g.brain || g.diet.filter) continue;
      // keep it only if it's an improvement: one small population's bad luck doesn't undo what
      // the species has learned elsewhere
      const k = probe(g.brain), old = sp.brain ? probe(sp.brain) : g.startSkills;
      if (fitness(k, g.diet) <= fitness(old, g.diet)) continue;
      sp.brain = Float32Array.from(g.brain);
      sp.skills = k;
      sp.brainGens = (sp.brainGens || 0) + g.maxGen;
      this.E.setParams(sp);
      changes.push({ sp, gens: g.maxGen, behaviours: behaviours(sp.skills, g.diet) });
    }
    return changes;
  }
}
