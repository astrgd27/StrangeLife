// The zone view: dive into one zone and watch its animals as individuals (microcosm.js), with
// their evolving brains. The planet waits while you watch.

import { Microcosm, MW, MH } from './microcosm.js';
import { drawOrganism, spriteURL } from './sprites.js';
import { BIOMES } from './planet.js';
import { SENSES, ACTIONS, NI, NH, NO, behaviours } from './brain.js';
import { GRADES, KINGDOMS } from './ecosystem.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * 255 * k)},${Math.round(c[1] * 255 * k)},${Math.round(c[2] * 255 * k)})`;
const SPEEDS = [0, 1, 5, 20];

export class ZoneView {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.speed = 2;
    this.sel = null;
    this.sprites = new Map();
    $('zone-close').addEventListener('click', () => this.close());
    document.querySelectorAll('#zoneview [data-zspeed]').forEach((b) => b.addEventListener('click', () => this.setSpeed(+b.dataset.zspeed)));
    const cv = $('zone-canvas');
    cv.addEventListener('pointerdown', (e) => this.pick(e));
    $('zone-species').addEventListener('pointerdown', (e) => {
      const li = e.target.closest('[data-g]');
      if (!li || !this.m) return;
      const g = this.m.groups[+li.dataset.g];
      // select the best individual of that species
      this.sel = g.best && g.best.alive ? g.best : this.m.agents.find((a) => a.alive && a.g === g) || null;
    });
    window.addEventListener('resize', () => this.isOpen && this.layout());
  }

  get isOpen() { return !$('zoneview').hidden; }

  open(world, z) {
    this.world = world;
    this.m = new Microcosm(world, z);
    this.sel = null;
    this.sprites.clear();
    this.foodCanvas = null;
    this.lastFood = -1;
    this.lastPanel = 0;
    // what the place looks like: the zone's commonest sea and land biomes
    const P = world.planet, E = world.eco, cnt = new Map();
    for (let c = 0; c < P.n; c++) if (E.zoneOf[c] === z) cnt.set(P.biome[c], (cnt.get(P.biome[c]) || 0) + 1);
    let sea = 1, land = 7, ns = 0, nl = 0;
    for (const [b, n] of cnt) { if (BIOMES[b].water) { if (n > ns) { ns = n; sea = b; } } else if (n > nl) { nl = n; land = b; } }
    this.seaBiome = sea; this.landBiome = land;
    const T = E.zTs[z], Tl = E.zTl[z];
    $('zone-title').textContent = `${nl && ns ? `${BIOMES[land].name} and ${BIOMES[sea].name.toLowerCase()}` : nl ? BIOMES[land].name : BIOMES[sea].name}`;
    $('zone-sub').textContent = `${Math.round(ns ? T : Tl)}°C · ${this.m.groups.length ? `${this.m.groups.length} kinds of animal, ${this.m.agents.length} individuals` : 'no animals live here yet'}`;
    $('zoneview').hidden = false;
    document.body.classList.add('zone-open');
    $('zone-empty').hidden = this.m.groups.length > 0;
    this.setSpeed(this.speed);
    this.layout();
    this.hooks.onOpen?.();
  }

  close() {
    if (!this.isOpen) return;
    const changes = this.m ? this.m.writeBack() : [];
    $('zoneview').hidden = true;
    document.body.classList.remove('zone-open');
    this.hooks.onClose?.(changes, this.m);
    this.m = null;
  }

  setSpeed(s) {
    this.speed = s;
    document.querySelectorAll('#zoneview [data-zspeed]').forEach((b) => b.classList.toggle('active', +b.dataset.zspeed === s));
  }

  layout() {
    const cv = $('zone-canvas'), wrap = cv.parentElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    this.dpr = dpr;
    this.scale = Math.min(w / MW, h / MH);
    this.ox = (w - MW * this.scale) / 2;
    this.oy = (h - MH * this.scale) / 2;
  }

  pick(e) {
    if (!this.m) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left - this.ox) / this.scale, y = (e.clientY - r.top - this.oy) / this.scale;
    let best = null, bd = 40 * 40;
    for (const a of this.m.agents) {
      if (!a.alive) continue;
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < bd + a.g.r * a.g.r) { bd = d; best = a; }
    }
    this.sel = best;
  }

  sprite(sp, px = 64) {
    let c = this.sprites.get(sp.id);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = px;
    drawOrganism(c.getContext('2d'), sp, px / 2, px / 2, px * 0.45);
    this.sprites.set(sp.id, c);
    return c;
  }

  update(dt, now) {
    if (!this.isOpen || !this.m) return;
    const m = this.m;
    if (SPEEDS[this.speed]) m.update(dt * SPEEDS[this.speed]);
    for (const e of m.events.splice(0)) this.hooks.toast?.(`🧠 ${e.g.sp.name} has evolved: it ${e.text}.`);
    if (this.sel && !this.sel.alive) this.sel = null;
    this.draw();
    if (now - this.lastPanel > 400) { this.lastPanel = now; this.renderPanel(); }
  }

  // ---------- drawing ----------

  drawFood() {
    const m = this.m;
    if (!this.foodCanvas) { this.foodCanvas = document.createElement('canvas'); this.foodCanvas.width = MW; this.foodCanvas.height = MH; }
    const ctx = this.foodCanvas.getContext('2d');
    ctx.clearRect(0, 0, MW, MH);
    const CELL = 25, GW = MW / CELL;
    for (let c = 0; c < m.food.length; c++) {
      const f = m.food[c];
      if (f < 0.04) continue;
      const gx = c % GW, gy = Math.floor(c / GW);
      const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL;
      const list = m.isSea(x, y) ? m.producers.sea : m.producers.land;
      if (!list.length) continue;
      const sp = list[(gx * 7 + gy * 13) % list.length];
      const s = 10 + 22 * Math.min(1, f);
      ctx.globalAlpha = Math.min(1, 0.25 + f);
      ctx.drawImage(this.sprite(sp, 48), x - s / 2 + ((gy * 37) % 9) - 4, y - s / 2 + ((gx * 23) % 9) - 4, s, s);
    }
    ctx.globalAlpha = 1;
  }

  draw() {
    const m = this.m, cv = $('zone-canvas'), ctx = cv.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);
    ctx.beginPath(); ctx.rect(0, 0, MW, MH); ctx.clip();
    // land and sea
    const land = BIOMES[this.landBiome].color, sea = BIOMES[this.seaBiome].color;
    ctx.fillStyle = rgb(land, 0.85); ctx.fillRect(0, 0, MW, MH);
    if (m.seaFrac > 0) {
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let y = 0; y <= MH; y += 8) ctx.lineTo(m.coastX(y), y);
      ctx.lineTo(0, MH); ctx.closePath();
      const gr = ctx.createLinearGradient(0, 0, Math.max(1, m.coastX(MH / 2)), 0);
      gr.addColorStop(0, rgb(sea, 0.8)); gr.addColorStop(1, rgb(sea, 1.25));
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    }
    // plants, refreshed twice a second
    if (m.time - this.lastFood > 0.5 || this.lastFood < 0) { this.drawFood(); this.lastFood = m.time; }
    ctx.drawImage(this.foodCanvas, 0, 0);
    // creatures
    const sel = this.sel;
    if (sel) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.g.sense, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const line = (b, col) => { if (!b || !b.alive) return; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sel.x, sel.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      line(sel.threat, '#ff6b6b'); line(sel.prey, '#ffb347'); line(sel.mate, '#ff9ed8');
    }
    for (const a of m.agents) {
      if (!a.alive) continue;
      const s = a.g.r * 2.8, img = this.sprite(a.sp);
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.g.vmax > 0) {
        ctx.rotate(a.heading);
        if (Math.cos(a.heading) < 0) ctx.scale(1, -1);
      }
      if (sel && sel.g === a.g && sel !== a) ctx.globalAlpha = 0.95;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
      if (a === sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y, a.g.r + 6, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
    $('zone-clock').textContent = `${Math.floor(m.time / 60)}:${String(Math.floor(m.time % 60)).padStart(2, '0')} watched`;
  }

  // ---------- side panel ----------

  renderPanel() {
    const m = this.m;
    const bar = (v, label) => `<span class="zs"><span>${label}</span><span class="gbar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></i></span></span>`;
    const html = m.groups.map((g, i) => {
      const k = g.skills, d = g.diet;
      const feed = d.hunt && !d.graze ? bar(k.hunt, 'Hunting') : d.graze ? bar(k.forage, 'Foraging') : '';
      const notes = d.filter ? [] : behaviours(k, d);
      return `<li data-g="${i}" class="${this.sel?.g === g ? 'active' : ''}">
        <img src="${spriteURL(g.sp, 40)}" width="40" height="40" alt="">
        <div><div class="nm"><i>${esc(g.sp.name)}</i> <span class="muted">${GRADES[g.sp.grade].name}</span></div>
        <div class="muted small">${g.count} alive · generation ${g.maxGen} · ${g.births} born, ${g.eaten} eaten</div>
        ${d.filter ? '<div class="muted small">Filter-feeds in place</div>' : `<div class="zskills">${feed}${bar(k.evade, 'Escaping')}${bar(Math.max(0, k.herd), d.aquatic ? 'Schooling' : 'Herding')}</div>`}
        ${notes.length ? `<div class="znotes">${notes.map((n) => `<span class="tag">${n}</span>`).join('')}</div>` : ''}</div></li>`;
    }).join('');
    const list = $('zone-species');
    if (list._html !== html) { list.innerHTML = html; list._html = html; }
    const sel = this.sel, box = $('zone-selected');
    if (!sel) { box.innerHTML = '<p class="muted small">Click a creature to follow it and see its brain.</p>'; return; }
    box.innerHTML = `<div class="nm"><b><i>${esc(sel.sp.name)}</i></b> #${sel.id}</div>
      <div class="muted small">${sel.act} · generation ${sel.gen} · ${sel.kids} offspring · age ${Math.round(sel.age)} s</div>
      <div class="zs"><span>Energy</span><span class="gbar"><i style="width:${Math.round(Math.min(1, sel.energy / 2.2) * 100)}%"></i></span></div>
      <canvas id="zone-brain" width="560" height="300" aria-label="Its brain: senses on the left, actions on the right"></canvas>
      <div class="muted small">Its brain: senses (left) feed 6 neurons that choose where to go (right). Orange connections excite, blue ones inhibit; bright circles are active now.</div>`;
    this.drawBrain($('zone-brain'), sel);
  }

  drawBrain(cv, a) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const b = a.brain, x = a.inp;
    const hid = new Float32Array(NH);
    for (let h = 0; h < NH; h++) { let s = 0; for (let i = 0; i < NI; i++) s += b[h * NI + i] * x[i]; hid[h] = Math.tanh(s); }
    const col = (n, X) => Array.from({ length: n }, (_, i) => [X, 22 + (i * (H - 44)) / Math.max(1, n - 1)]);
    const I = col(NI, 120), Hn = col(NH, 300), O = col(NO, 430);
    const edge = (p, q, w) => {
      if (Math.abs(w) < 0.15) return;
      ctx.strokeStyle = w > 0 ? `rgba(255,170,80,${Math.min(0.9, Math.abs(w) * 0.5)})` : `rgba(110,170,255,${Math.min(0.9, Math.abs(w) * 0.5)})`;
      ctx.lineWidth = Math.min(4, Math.abs(w) * 2);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    };
    for (let h = 0; h < NH; h++) for (let i = 0; i < NI; i++) edge(I[i], Hn[h], b[h * NI + i]);
    const W1 = NH * NI;
    for (let o = 0; o < NO; o++) for (let h = 0; h < NH; h++) edge(Hn[h], O[o], b[W1 + o * (NH + 1) + h]);
    const node = (p, v) => { ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.85 * Math.min(1, Math.abs(v))})`; ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI * 2); ctx.fill(); };
    ctx.font = '15px system-ui, sans-serif'; ctx.fillStyle = '#c9d3e2'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    I.forEach((p, i) => { node(p, x[i]); ctx.fillStyle = '#c9d3e2'; ctx.fillText(SENSES[i], p[0] - 14, p[1]); });
    Hn.forEach((p, h) => node(p, hid[h]));
    ctx.textAlign = 'left';
    O.forEach((p, o) => { node(p, a.out[o]); ctx.fillStyle = '#c9d3e2'; ctx.fillText(ACTIONS[o], p[0] + 14, p[1]); });
  }
}
