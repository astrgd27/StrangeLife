// The zoo: creatures you brought home from finished runs. Each is a snapshot of a species (its
// genome, body, ecology, food web, behaviour and ancestry) kept in the browser, so you can visit,
// feed and play with it, and read its full profile, long after its planet is gone.

import { develop, ecology, describe, makeGenes, GENES, GENE_INFO, GI, NG } from './genome.js';
import { drawOrganism } from './sprites.js';
import { GRADES, KINGDOMS, TROPHIC_NAMES, HABITAT_NAMES, MAXT } from './ecosystem.js';
import { behaviours, probe } from './brain.js';
import { dietOf } from './microcosm.js';
import { EONS, formatYears } from './world.js';

const KEY = 'strangelife-zoo-v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- storage ----------

export function loadZoo() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function saveZoo(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

// ---------- snapshots ----------

const pick = (sp) => ({
  name: sp.name, grade: sp.grade, kingdom: sp.kingdom, domain: sp.domain, mito: !!sp.mito, chloro: !!sp.chloro, lichen: !!sp.lichen,
  habitat: sp.habitat, landAnc: !!sp.landAnc, trophic: sp.trophic, genes: Array.from(sp.genes, (v) => Math.round(v * 1000) / 1000),
  bornYears: sp.bornYears,
});

// everything worth keeping about a living species, from the world it lived in
export function snapshot(world, sp) {
  const E = world.eco, s = sp.slot;
  // ancestry back to the first cell (or to whatever was seeded)
  const lineage = [];
  for (let a = sp.parent ? E.species.get(sp.parent) : null, k = 0; a && k < 60; a = a.parent ? E.species.get(a.parent) : null, k++) lineage.push(pick(a));
  lineage.reverse();
  const names = (slots) => slots.map((q) => E.slots[q]).filter(Boolean).map((q) => ({ name: q.name, grade: q.grade }));
  const top = (vals) => vals.filter((v) => v[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map((v) => v[0]);
  const eats = names(top(E.alive.map((q) => [q, E.flow[s * MAXT + q]])));
  let eatenBy = names(top(E.alive.map((p) => [p, E.flow[p * MAXT + s]])));
  // plants are grazed from a shared pool: name the main grazers that live where it does
  if (!eatenBy.length && sp.trophic === 1) {
    const land = sp.habitat !== 0;
    eatenBy = E.alive.map((q) => E.slots[q]).filter((q) => q.trophic !== 6 && E.wProd[q.slot] > 0 && E.tHost[q.slot] < 0 && (q.habitat !== 0) === land)
      .sort((a, b) => b.total - a.total).slice(0, 3).map((q) => ({ name: q.name, grade: q.grade }));
  }
  const parasites = E.alive.map((q) => E.slots[q]).filter((q) => q.trophic === 6 && q.host === sp.id).slice(0, 4).map((q) => ({ name: q.name, grade: q.grade }));
  const host = sp.host ? E.species.get(sp.host) : null;
  return {
    id: `${world.seed}-${sp.id}-${Date.now().toString(36)}`,
    ...pick(sp),
    genus: sp.genus, pref: sp.pref, tol: sp.tol, n2: sp.n2, alt: sp.alt, sexual: !!sp.sexual,
    range: sp.range, peakRange: sp.peakRange, island: !!sp.island, allopatric: !!sp.allopatric, display: !!sp.display,
    keystone: !!sp.keystone, brain: sp.brain ? Array.from(sp.brain, (v) => Math.round(v * 1000) / 1000) : null, brainGens: sp.brainGens || 0,
    host: host ? { name: host.name, grade: host.grade } : null, eats, eatenBy, parasites,
    planet: {
      seed: world.seed, years: world.years, eon: EONS[world.eon]?.name, species: E.alive.length, everSpecies: E.species.size,
      o2: world.planet.o2, temp: world.planet.meanT, civ: world.civ && !world.civ.fallen ? world.civ.info?.name : null,
    },
    lineage,
    keptAt: new Date().toISOString(),
    nickname: '', fed: 0, played: 0,
  };
}

export function addToZoo(snaps) {
  const list = loadZoo();
  list.push(...snaps);
  return saveZoo(list);
}

// rebuild a drawable, developed species from a snapshot
let fakeId = 1;
export function revive(snap) {
  const genes = makeGenes({});
  const src = snap.genes || [];
  for (let k = 0; k < Math.min(NG, src.length); k++) genes[k] = src[k];
  const sp = {
    id: snap._id || (snap._id = fakeId++), genes, domain: snap.domain, mito: snap.mito, chloro: snap.chloro, lichen: snap.lichen,
    habitat: snap.habitat, landAnc: snap.landAnc, grade: snap.grade, kingdom: snap.kingdom, trophic: snap.trophic, host: 0,
  };
  sp.ph = develop(sp);
  sp.size = sp.ph.size;
  sp.eco = ecology(sp, sp.ph);
  sp.body = describe(sp.ph);
  return sp;
}

function portraitCanvas(sp, px) {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.height = Math.round(px * dpr);
  cv.style.width = cv.style.height = px + 'px';
  drawOrganism(cv.getContext('2d'), sp, cv.width / 2, cv.height / 2, cv.width * 0.42);
  return cv;
}
const portraitURL = (sp, px) => portraitCanvas(sp, px).toDataURL();

// ---------- the zoo view ----------

export class ZooView {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.pens = [];
    $('zoo-close').addEventListener('click', () => this.close());
    $('zoo-grid').addEventListener('click', (e) => this.onGrid(e));
    $('zoo-profile').addEventListener('click', (e) => {
      if (e.target.closest('[data-act=close-profile]') || e.target.id === 'zoo-profile') $('zoo-profile').hidden = true;
    });
    window.addEventListener('resize', () => this.isOpen && this.render());
  }

  get isOpen() { return !$('zoo').hidden; }

  open(highlight = []) {
    this.highlight = new Set(highlight);
    $('zoo').hidden = false;
    this.render();
    if (!this.raf) this.loop(performance.now());
  }

  close() {
    $('zoo').hidden = true;
    $('zoo-profile').hidden = true;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.hooks.onClose?.();
  }

  render() {
    const list = loadZoo();
    this.list = list;
    $('zoo-count').textContent = list.length ? `${list.length} creature${list.length > 1 ? 's' : ''} from ${new Set(list.map((s) => s.planet?.seed)).size} planet${new Set(list.map((s) => s.planet?.seed)).size > 1 ? 's' : ''}` : '';
    const grid = $('zoo-grid');
    if (!list.length) {
      grid.innerHTML = '<div class="zoo-empty"><p class="big">Your zoo is empty.</p><p class="muted">When you finish a run (Menu → End run), you can bring up to three living creatures here. They keep their genome, their body, their place in the food web and their ancestry.</p></div>';
      this.pens = [];
      return;
    }
    grid.innerHTML = list.map((s, i) => `<article class="pen${this.highlight?.has(s.id) ? ' fresh' : ''}" data-i="${i}">
      <canvas class="pen-view" data-i="${i}"></canvas>
      <div class="pen-info">
        <div><b>${esc(s.nickname || s.name)}</b>${s.nickname ? ` <i class="muted">${esc(s.name)}</i>` : ''}</div>
        <div class="muted small">${GRADES[s.grade]?.name || s.grade} · from planet ${s.planet?.seed} · ${formatYears(s.planet?.years || 0)}</div>
        <div class="pen-mood"><span class="gbar"><i style="width:${Math.min(100, 20 + 8 * (s.fed + s.played))}%"></i></span><span class="muted small">${moodText(s)}</span></div>
        <div class="pen-btns">
          <button class="small-btn" data-act="feed" data-i="${i}">${feedLabel(s)}</button>
          <button class="small-btn" data-act="play" data-i="${i}">${playLabel(s)}</button>
          <button class="primary small-btn" data-act="profile" data-i="${i}">Profile</button>
        </div>
      </div>
    </article>`).join('');
    // one living scene per enclosure
    this.pens = list.map((s, i) => new Pen(grid.querySelector(`canvas[data-i="${i}"]`), s));
  }

  onGrid(e) {
    const b = e.target.closest('[data-act]');
    const cv = e.target.closest('canvas.pen-view');
    if (cv) { const pen = this.pens[+cv.dataset.i]; pen?.tap(e); return; }
    if (!b) return;
    const i = +b.dataset.i, s = this.list[i], pen = this.pens[i];
    if (b.dataset.act === 'feed') { pen.feed(); s.fed++; this.persist(); this.refreshMood(i); }
    else if (b.dataset.act === 'play') { pen.play(); s.played++; this.persist(); this.refreshMood(i); }
    else if (b.dataset.act === 'profile') this.profile(i);
  }

  persist() { saveZoo(this.list); }

  refreshMood(i) {
    const s = this.list[i], el = $('zoo-grid').querySelector(`.pen[data-i="${i}"] .pen-mood`);
    if (el) el.innerHTML = `<span class="gbar"><i style="width:${Math.min(100, 20 + 8 * (s.fed + s.played))}%"></i></span><span class="muted small">${moodText(s)}</span>`;
  }

  loop(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    for (const p of this.pens) p.step(dt, now / 1000);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- the full species profile ----------

  profile(i) {
    const s = this.list[i], sp = revive(s), ph = sp.ph, eco = sp.eco, G = GRADES[s.grade] || {};
    const gene = (k) => s.genes[GI[k]] ?? 0;
    const bar = (label, v, info) => `<div class="gene" title="${esc(info)}"><span class="gn">${label}</span><span class="gbar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></i></span></div>`;
    const genes = GENES.filter((k) => k !== 'hue').map((k) => bar(k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), gene(k), GENE_INFO[k])).join('');
    const diet = { 0: 'chemicals from vents and the primordial soup', 1: 'sunlight (photosynthesis)', 2: 'dead matter (a decomposer)', 3: 'plants and microbes', 4: 'other animals', 5: 'plants and animals alike', 6: `its host${s.host ? `, <i>${esc(s.host.name)}</i>` : ''} (a parasite)` }[s.trophic];
    const life = [];
    if (ph.animal && ph.level === 3) {
      life.push(['Young', ph.care > 0.6 ? 'Few, and well looked after' : ph.care < 0.3 ? 'Many, left to chance' : 'A moderate number, with some care']);
      if (ph.metamorphosis > 0.6) life.push(['Growing up', 'The young live differently from the adults (metamorphosis)']);
      if (ph.sociality > 0.6) life.push(['Social life', ph.skeleton === 'endo' ? 'Lives in groups' : 'Colonies with a queen and workers']);
    }
    if (ph.toxins > 0.6) life.push(['Defences', 'Toxic to most grazers']);
    if (ph.partner) life.push(['Partners', { algae: 'Algae living in its tissues', gut: 'Gut microbes that digest plants', roots: 'Nitrogen-fixing root bacteria' }[ph.partner]]);
    let behaviour = '';
    if (s.brain) {
      const k = probe(Float32Array.from(s.brain)), d = dietOf(sp), b = behaviours(k, d);
      behaviour = `${b.length ? b.join(', ') : 'no special behaviour'} <span class="muted">(evolved over ${s.brainGens} watched generations)</span>`;
    }
    const nm = (q) => `<i>${esc(q.name)}</i> <span class="muted">(${(GRADES[q.grade]?.name || q.grade).toLowerCase()})</span>`;
    // the path of body plans from its earliest known ancestor
    const path = [];
    for (const a of [...s.lineage, s]) if (!path.length || path[path.length - 1].grade !== a.grade) path.push(a);
    const lineage = path.map((a) => {
      const r = revive(a);
      return `<li><img src="${portraitURL(r, 52)}" width="52" height="52" alt=""><span><b>${GRADES[a.grade]?.name || a.grade}</b><br><i class="muted small">${esc(a.name)}</i><br><span class="muted small">${formatYears(a.bornYears || 0)}</span></span></li>`;
    }).join('<li class="arrow">→</li>');
    const rows = (arr) => arr.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('zoo-profile-body').innerHTML = `
      <button class="ghost tree-close prof-close" data-act="close-profile" aria-label="Close">×</button>
      <div class="prof-head">
        <img class="prof-pic" src="${portraitURL(sp, 160)}" width="160" height="160" alt="">
        <div>
          <p class="eyebrow">${KINGDOMS[s.kingdom]?.name || ''} · ${KINGDOMS[s.kingdom]?.domain || ''}</p>
          <h2>${esc(s.nickname || s.name)}</h2>
          ${s.nickname ? `<p><i>${esc(s.name)}</i></p>` : ''}
          <p>${G.name || s.grade}${s.keystone ? ' · <span class="tag key">Keystone</span>' : ''}${s.island ? ' · <span class="tag h1">Island species</span>' : ''}</p>
          <p class="muted">${esc(sp.body)}</p>
          <button class="small-btn" data-act="rename" data-i="${i}">Give it a name</button>
          <button class="small-btn" data-act="release" data-i="${i}">Release</button>
        </div>
      </div>
      <div class="prof-cols">
        <section><h3>Where it came from</h3><dl>${rows([
          ['Planet', `seed ${s.planet?.seed}, ${formatYears(s.planet?.years || 0)} old (${s.planet?.eon || ''})`],
          ['Appeared', `${formatYears(s.bornYears || 0)}${s.allopatric ? ', when its population was cut off' : s.display ? ', split off by mate choice' : ''}`],
          ['Range', `${s.range} zones when you took it (peak ${s.peakRange})`],
          ['Its world', `${s.planet?.species} living species, ${s.planet?.everSpecies} ever; ${(s.planet?.o2 ?? 0).toFixed(0)}% oxygen, ${(s.planet?.temp ?? 0).toFixed(0)}°C${s.planet?.civ ? `; a civilization in the ${s.planet.civ}` : ''}`],
        ])}</dl></section>
        <section><h3>How it lives</h3><dl>${rows([
          ['Habitat', `${HABITAT_NAMES[s.habitat]}${s.habitat === 0 ? (s.n2 > 0.55 ? ', deep water' : s.n2 < 0.2 ? ', shallows' : '') : s.n2 < 0.25 ? ', dry places' : s.n2 > 0.7 ? ', wet places' : ''}`],
          ['Climate', `${(s.pref ?? 0).toFixed(0)}°C ± ${(s.tol ?? 0).toFixed(0)}°`],
          ['Eats', diet],
          ['Way of life', TROPHIC_NAMES[s.trophic]],
          ['Body size', G.size || ''],
          ['Needs O₂', eco.o2 ? `${eco.o2.toFixed(1)}% or more` : 'none'],
          ['Reproduction', s.sexual ? 'Sexual' : 'Asexual'],
          ...life,
          ...(behaviour ? [['Behaviour', behaviour]] : []),
        ])}</dl></section>
        <section><h3>Its food web</h3><dl>${rows([
          ...(s.eats?.length ? [['Ate', s.eats.map(nm).join(', ')]] : []),
          ...(s.eatenBy?.length ? [['Eaten by', s.eatenBy.map(nm).join(', ')]] : []),
          ...(s.parasites?.length ? [['Parasites', s.parasites.map(nm).join(', ')]] : []),
          ...(s.host ? [['Host', nm(s.host)]] : []),
        ]) || '<dd class="muted">No recorded feeding links.</dd>'}</dl></section>
        <section><h3>Cells</h3><dl>${rows([
          ['Domain', s.domain === 'eukaryote' ? 'Eukaryote (complex cells)' : s.domain === 'archaea' ? 'Archaea' : 'Bacteria'],
          ['Organelles', [s.mito && 'mitochondria', s.chloro && 'chloroplasts'].filter(Boolean).join(', ') || 'none'],
          ...(s.lichen ? [['Partnership', 'A fungus farming algae (a lichen)']] : []),
        ])}</dl></section>
      </div>
      <section><h3>Genome</h3><div class="genome prof-genome">${genes}</div></section>
      <section><h3>Its ancestry: ${path.length > 2 ? `${path.length - 1} changes of body plan` : path.length === 2 ? 'one change of body plan' : 'no change of body plan'} since ${path[0] ? (GRADES[path[0].grade]?.name || path[0].grade).toLowerCase() : 'the beginning'}</h3>
        <ol class="lineage">${lineage}</ol>
        <p class="muted small">${s.lineage.length} ancestral species back to ${s.lineage[0] ? `<i>${esc(s.lineage[0].name)}</i>` : 'its origin'}.</p></section>`;
    $('zoo-profile').hidden = false;
    $('zoo-profile-body').onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'rename') {
        const n = prompt('Name this creature:', s.nickname || '');
        if (n !== null) { s.nickname = n.trim().slice(0, 40); this.persist(); this.render(); this.profile(i); }
      } else if (b.dataset.act === 'release') {
        if (confirm(`Release ${s.nickname || s.name}? It will leave your zoo for good.`)) {
          this.list.splice(i, 1); this.persist(); $('zoo-profile').hidden = true; this.render();
        }
      }
    };
  }
}

function moodText(s) {
  const n = s.fed + s.played;
  return n === 0 ? 'Settling in' : n < 4 ? 'Curious' : n < 10 ? 'Content' : 'Thriving';
}
const feedLabel = (s) => (s.trophic === 1 ? '💧 Water' : s.trophic === 0 || s.trophic === 2 ? '🧪 Nutrients' : s.trophic === 4 ? '🥩 Feed' : '🌿 Feed');
const playLabel = (s) => (s.trophic === 1 ? '☀️ Sunlight' : revive(s).ph.animal ? '🎾 Play' : '✨ Tickle');

// ---------- an enclosure ----------

class Pen {
  constructor(cv, snap) {
    this.cv = cv; this.snap = snap;
    this.sp = revive(snap);
    this.kind = this.sp.ph.animal ? (this.sp.ph.motile ? 'animal' : 'sessile') : this.sp.ph.plant || this.sp.trophic === 1 && this.sp.ph.level >= 1 ? 'plant' : this.sp.ph.level <= 1 ? 'microbe' : 'fungus';
    this.wet = snap.habitat === 0 || snap.habitat === 3 || this.kind === 'microbe';
    this.size();
    this.x = this.w * 0.5; this.y = this.ground(); this.vx = (Math.random() - 0.5) * 30; this.vy = 0;
    this.face = 1; this.jump = 0; this.spin = 0; this.food = []; this.fx = []; this.split = 0;
    // a cached picture of the creature
    this.img = document.createElement('canvas');
    this.img.width = this.img.height = 128;
    drawOrganism(this.img.getContext('2d'), this.sp, 64, 64, 56);
  }

  size() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width || 300; this.h = r.height || 190;
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    this.dpr = dpr;
    this.scale = (this.kind === 'plant' || this.kind === 'fungus' ? 0.85 : 0.45 + 0.25 * this.sp.size) * this.h;
  }

  ground() { return this.wet ? this.h * 0.5 : this.h * 0.68; }

  tap(e) {
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - this.x, y - this.y) < this.scale * 0.6) { this.jump = 0.6; this.fx.push({ x: this.x, y: this.y - this.scale * 0.5, t: 0, ch: this.sp.ph.animal ? '❗' : '✨' }); }
    else if (this.kind === 'animal') this.target = { x, y }; // come here
  }

  feed() {
    const n = 4;
    for (let k = 0; k < n; k++) {
      const x = this.w * (0.15 + 0.7 * Math.random());
      this.food.push({ x, y: -10 - 30 * k, vy: 40 + 30 * Math.random(), kind: this.sp.trophic });
    }
  }

  play() {
    if (this.kind === 'animal' || this.kind === 'sessile') { this.jump = 1; this.spin = 1; for (let k = 0; k < 5; k++) this.fx.push({ x: this.x + (Math.random() - 0.5) * 40, y: this.y - this.scale * 0.4, t: -k * 0.1, ch: '💛' }); }
    else if (this.kind === 'microbe') { this.split = 1.5; this.fx.push({ x: this.x, y: this.y - 30, t: 0, ch: '✨' }); }
    else { this.bloom = 1.5; for (let k = 0; k < 8; k++) this.fx.push({ x: this.x + (Math.random() - 0.5) * this.scale, y: this.y - this.scale * (0.3 + 0.5 * Math.random()), t: -k * 0.08, ch: this.sp.trophic === 1 ? '☀️' : '✨' }); }
  }

  step(dt, t) {
    const ctx = this.cv.getContext('2d'), w = this.w, h = this.h, g = this.ground();
    // food falls; animals go after it, plants and microbes absorb it where it lands
    for (const f of this.food) { f.vy += 120 * dt; f.y = Math.min(f.y + f.vy * dt, this.wet ? g + 10 : g + 6); }
    if (this.kind === 'animal') {
      const goal = this.food.length ? this.food.reduce((a, b) => (Math.abs(a.x - this.x) < Math.abs(b.x - this.x) ? a : b)) : this.target;
      if (goal) {
        const dx = goal.x - this.x, dy = this.wet ? (goal.y ?? this.y) - this.y : 0;
        this.vx += Math.sign(dx) * 140 * dt; if (this.wet) this.vy += Math.sign(dy) * 80 * dt;
        if (Math.abs(dx) < 12 && (!this.wet || Math.abs(dy) < 20)) {
          if (goal === this.target) this.target = null;
          else { this.food.splice(this.food.indexOf(goal), 1); this.jump = 0.35; this.fx.push({ x: this.x, y: this.y - this.scale * 0.4, t: 0, ch: '😋' }); }
        }
      } else if (Math.random() < dt * 0.6) this.vx += (Math.random() - 0.5) * 80;
      this.vx *= 1 - dt * 1.5; this.vy *= 1 - dt * 1.5;
      this.x = Math.max(this.scale * 0.4, Math.min(w - this.scale * 0.4, this.x + this.vx * dt));
      if (this.wet) this.y = Math.max(h * 0.18, Math.min(h * 0.82, this.y + this.vy * dt + Math.sin(t * 2) * 0.2));
      if (Math.abs(this.vx) > 3) this.face = this.vx > 0 ? 1 : -1;
    } else {
      // stationary life takes in food that reaches it
      for (const f of this.food) if (f.y >= (this.wet ? g + 10 : g + 6) - 1) { f.gone = true; this.bloom = Math.max(this.bloom || 0, 0.6); }
      this.food = this.food.filter((f) => !f.gone);
      if (this.kind === 'microbe') { this.x = w * 0.5 + Math.sin(t * 0.7) * w * 0.2; this.y = h * 0.5 + Math.cos(t * 1.1) * h * 0.12; }
    }
    this.jump = Math.max(0, this.jump - dt * 1.6); this.spin = Math.max(0, this.spin - dt * 1.2);
    this.split = Math.max(0, (this.split || 0) - dt); this.bloom = Math.max(0, (this.bloom || 0) - dt);

    // draw
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.backdrop(ctx, w, h, g, t);
    ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const f of this.food) ctx.fillText(f.kind === 1 ? '💧' : f.kind === 4 ? '🍖' : f.kind === 3 || f.kind === 5 ? '🌱' : '•', f.x, f.y);
    const s = this.scale * (1 + 0.08 * Math.sin(t * 3) * (this.kind === 'microbe' ? 1 : 0.3)) * (1 + 0.15 * this.bloom);
    const hop = Math.sin(this.jump * Math.PI) * this.scale * 0.35;
    const draw = (x, y, sc = 1) => {
      ctx.save();
      ctx.translate(x, y - (this.kind === 'plant' || this.kind === 'fungus' || (this.kind === 'sessile' && !this.wet) ? s * 0.42 : 0) - hop);
      if (this.kind === 'plant') ctx.rotate(Math.sin(t * 1.3) * 0.04);
      if (this.spin) ctx.rotate(this.spin * Math.PI * 2);
      if (this.kind === 'animal') ctx.scale(this.face * sc, sc); else ctx.scale(sc, sc);
      ctx.drawImage(this.img, -s / 2, -s / 2, s, s);
      ctx.restore();
    };
    if (this.split > 0) { const d = Math.sin(Math.min(1, this.split) * Math.PI) * s * 0.4; draw(this.x - d, this.y, 0.8); draw(this.x + d, this.y, 0.8); }
    else draw(this.x, this.kind === 'animal' && !this.wet ? g : this.kind === 'animal' || this.kind === 'microbe' ? this.y : g);
    for (const p of this.fx) {
      p.t += dt;
      if (p.t < 0) continue;
      ctx.globalAlpha = Math.max(0, 1 - p.t);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(p.ch, p.x, p.y - p.t * 30);
    }
    ctx.globalAlpha = 1;
    this.fx = this.fx.filter((p) => p.t < 1);
  }

  backdrop(ctx, w, h, g, t) {
    const hab = this.snap.habitat;
    if (this.wet) {
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, hab === 3 ? '#2d6a8e' : '#1f5b8f'); gr.addColorStop(1, hab === 3 ? '#183c50' : '#0b2a4a');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let k = 0; k < 6; k++) { const x = (k * 53 + t * 12) % w, y = h - ((t * 20 + k * 37) % h); ctx.beginPath(); ctx.arc(x, y, 2 + (k % 3), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(214,190,140,0.35)'; ctx.fillRect(0, h * 0.9, w, h * 0.1);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, g);
      sky.addColorStop(0, '#20324f'); sky.addColorStop(1, '#3d5876');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, g);
      ctx.fillStyle = this.snap.n2 < 0.25 ? '#a78a5a' : this.snap.n2 > 0.7 ? '#2f5d34' : '#4f7a3a';
      ctx.fillRect(0, g, w, h - g);
      if (hab === 1) { ctx.fillStyle = '#2a6390'; ctx.fillRect(0, g + (h - g) * 0.45, w * 0.45, (h - g) * 0.55); }
    }
  }
}
