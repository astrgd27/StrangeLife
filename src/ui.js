// HTML panels: stats, species list, charts, tree of life, inspector, toasts.

import { speciesColor, hslToRgb } from './life.js';
import { YEARS_PER_TICK } from './world.js';

const $ = (id) => document.getElementById(id);
const fmtMyr = (tick) => (tick * YEARS_PER_TICK / 1e6).toFixed(2);
const rgb = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function dietLabel(d) { return d < 0.3 ? 'Grazer' : d < 0.6 ? 'Omnivore' : 'Predator'; }
export function habitatLabel(a) { return a > 0.7 ? 'Marine' : a > 0.3 ? 'Amphibious' : 'Terrestrial'; }
function dietClass(d) { return d < 0.3 ? 'graze' : d < 0.6 ? 'omni' : 'hunt'; }
function habitatClass(a) { return a > 0.7 ? 'sea' : a > 0.3 ? 'shore' : 'land'; }
function sizeLabel(s) { return s < 0.6 ? 'Tiny' : s < 1.1 ? 'Small' : s < 1.8 ? 'Medium' : s < 2.4 ? 'Large' : 'Huge'; }

export class UI {
  constructor(renderer, hooks) {
    this.r = renderer;
    this.hooks = hooks;
    this.tab = 'species';
    this.activeSpecies = 0;
    this.inspect = null; // { kind: 'creature', index } | { kind: 'cell', cell }
    this.timers = { stats: 0, list: 0, charts: 0, tree: 0, insp: 0 };

    document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
    $('btn-collapse').addEventListener('click', () => {
      const p = $('panel');
      p.classList.toggle('collapsed');
      $('btn-collapse').title = p.classList.contains('collapsed') ? 'Show panel' : 'Hide panel';
    });
    $('species-list').addEventListener('click', (e) => {
      const li = e.target.closest('[data-sp]');
      if (!li) return;
      const id = +li.dataset.sp;
      this.setActiveSpecies(this.activeSpecies === id ? 0 : id);
    });
    $('tree').addEventListener('click', (e) => this.treeClick(e));
    $('inspector').addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'close') { this.inspect = null; this.r.selected = -1; this.r.follow = false; $('inspector').hidden = true; }
      if (act === 'follow') { this.r.follow = !this.r.follow; this.renderInspector(); }
      if (act === 'highlight') { const sp = +a.dataset.sp; this.setActiveSpecies(this.activeSpecies === sp ? 0 : sp); }
    });
  }

  setWorld(world) {
    this.world = world;
    this.announced = new Set();
    this.activeSpecies = 0;
    this.inspect = null;
    $('inspector').hidden = true;
    $('chronicle').innerHTML = '';
    $('toasts').innerHTML = '';
    world.on((e) => this.onEvent(e));
    this.chronicle(0, 'Life begins: Protocella primordialis appears in a warm shallow sea.');
    this.timers = { stats: 0, list: 0, charts: 0, tree: 0, insp: 0 };
  }

  showTab(tab) {
    if (narrow()) $('inspector').hidden = true;
    this.tab = tab;
    document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-body').forEach((s) => (s.hidden = s.dataset.body !== tab));
    $('panel').classList.remove('collapsed');
    this.timers.list = this.timers.charts = this.timers.tree = 0;
  }

  setActiveSpecies(id) {
    this.activeSpecies = id;
    this.r.highlightSpecies = id;
    this.timers.list = this.timers.tree = 0;
    if (this.inspect) this.renderInspector();
  }

  // ---------- events ----------

  onEvent(e) {
    if (e.type === 'milestone') {
      this.toast(e.text, e.bad ? 'bad' : 'star');
      this.chronicle(e.tick, e.text, e.bad);
    } else if (e.type === 'extinction') {
      const msg = `${e.species.name} went extinct (peak population ${e.species.peak}).`;
      this.chronicle(e.tick, msg, true);
      if (e.species.peak >= 60) this.toast(msg, 'bad');
    }
  }

  toast(text, kind = '') {
    const ol = $('toasts');
    const li = document.createElement('li');
    li.className = kind;
    li.textContent = text;
    ol.appendChild(li);
    while (ol.children.length > (narrow() ? 2 : 4)) ol.firstChild.remove();
    setTimeout(() => li.classList.add('out'), 5200);
    setTimeout(() => li.remove(), 5900);
  }

  chronicle(tick, text, bad = false) {
    const li = document.createElement('li');
    if (bad) li.className = 'bad';
    li.innerHTML = `<span class="t">${fmtMyr(tick)} My</span><span>${esc(text)}</span>`;
    $('chronicle').prepend(li);
    const ol = $('chronicle');
    while (ol.children.length > 150) ol.lastChild.remove();
  }

  // ---------- periodic refresh ----------

  update(now) {
    const W = this.world, L = W.life, t = this.timers;
    if (now - t.stats > 250) {
      t.stats = now;
      $('clock-value').textContent = fmtMyr(W.tick);
      $('stat-pop').textContent = L.count.toLocaleString();
      const h = W.history[W.history.length - 1];
      $('stat-species').textContent = h ? h.established : 1;
      $('stat-temp').textContent = h ? `${h.temp.toFixed(1)}°C` : '—';
      let ext = 0;
      for (const sp of L.speciesById.values()) if (sp.died >= 0 && sp.peak >= 8) ext++;
      $('stat-extinct').textContent = ext;
      this.announceSpecies();
    }
    if (this.tab === 'species' && now - t.list > 700) { t.list = now; this.renderSpecies(); }
    if (this.tab === 'history' && now - t.charts > 1000) { t.charts = now; this.drawPopChart(); this.drawClimateChart(); }
    if (this.tab === 'tree' && now - t.tree > 1500) { t.tree = now; this.drawTree(); }
    if (this.inspect && now - t.insp > 300) { t.insp = now; this.renderInspector(); }
  }

  announceSpecies() {
    const L = this.world.life;
    for (const sp of L.speciesById.values()) {
      if (sp.count >= 12 && !this.announced.has(sp.id)) {
        this.announced.add(sp.id);
        if (!sp.parent) continue;
        const parent = L.speciesById.get(sp.parent);
        const t = L.speciesTraits(sp);
        this.chronicle(sp.born, `${sp.name} arises from ${parent.name}: ${sizeLabel(t.size).toLowerCase()} ${habitatLabel(t.aquatic).toLowerCase()} ${dietLabel(t.diet).toLowerCase()}.`);
      }
    }
  }

  renderSpecies() {
    const L = this.world.life;
    const living = L.livingSpecies().filter((s) => s.count >= 5 || s.id === this.activeSpecies);
    $('species-summary').textContent = `${living.length} living species · ${L.speciesById.size - living.length} extinct or ephemeral lineages. Click one to highlight it on the planet.`;
    const rows = living.slice(0, 60).map((sp) => {
      const t = L.speciesTraits(sp);
      const active = sp.id === this.activeSpecies;
      let detail = '';
      if (active) {
        const parent = sp.parent ? L.speciesById.get(sp.parent) : null;
        detail = `<dl class="sp-detail">
          <dt>Appeared</dt><dd>${fmtMyr(sp.born)} My${parent ? ` from <i>${esc(parent.name)}</i>` : ''}</dd>
          <dt>Peak</dt><dd>${sp.peak.toLocaleString()} individuals</dd>
          <dt>Size</dt><dd>${t.size.toFixed(2)} (${sizeLabel(t.size).toLowerCase()})</dd>
          <dt>Speed</dt><dd>${t.speed.toFixed(2)} cells per step</dd>
          <dt>Diet</dt><dd>${Math.round(t.diet * 100)}% meat</dd>
          <dt>Climate</dt><dd>${t.tempPref.toFixed(0)}°C ± ${t.tempTol.toFixed(0)}°</dd>
          <dt>Brood</dt><dd>${t.brood < 0.4 ? 'Many small young' : t.brood < 0.7 ? 'Balanced' : 'Few large young'}</dd>
        </dl>`;
      }
      return `<li class="sp${active ? ' active' : ''}" data-sp="${sp.id}">
        <span class="sw${t.diet > 0.5 ? ' hunter' : ''}" style="background:${rgb(speciesColor(sp))}"></span>
        <span class="nm">${esc(sp.name)}</span>
        <span class="ct">${sp.count.toLocaleString()}</span>
        <span class="tags">
          <span class="tag ${habitatClass(t.aquatic)}">${habitatLabel(t.aquatic)}</span>
          <span class="tag ${dietClass(t.diet)}">${dietLabel(t.diet)}</span>
          <span class="tag">${sizeLabel(t.size)}</span>
          ${t.tempPref < 0 ? '<span class="tag sea">Cold-adapted</span>' : t.tempPref > 27 ? '<span class="tag omni">Heat-loving</span>' : ''}
        </span>${detail}</li>`;
    });
    $('species-list').innerHTML = rows.join('') || '<li class="muted">No life. Use the 🧬 tool to seed some.</li>';
  }

  // ---------- charts ----------

  prepCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight || +cv.getAttribute('height');
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  drawPopChart() {
    const cv = $('chart-pop');
    const { ctx, w, h } = this.prepCanvas(cv);
    const H = this.world.history;
    const L = this.world.life;
    if (H.length < 2) return emptyChart(ctx, w, h);
    const ids = new Set();
    let max = 1;
    for (const s of H) { for (const k in s.bySpecies) ids.add(+k); max = Math.max(max, s.pop); }
    const order = [...ids].sort((a, b) => a - b);
    const pad = { l: 34, r: 6, t: 6, b: 16 };
    const X = (i) => pad.l + (i / (H.length - 1)) * (w - pad.l - pad.r);
    const Y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
    grid(ctx, w, h, pad, max, (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v)));
    const base = new Float32Array(H.length);
    for (const id of order) {
      const sp = L.speciesById.get(id);
      if (!sp) continue;
      const top = new Float32Array(H.length);
      let any = false;
      for (let i = 0; i < H.length; i++) { const v = H[i].bySpecies[id] || 0; top[i] = base[i] + v; if (v) any = true; }
      if (!any) continue;
      const dim = this.activeSpecies && this.activeSpecies !== id;
      ctx.fillStyle = rgb(speciesColor(sp, 0.55), dim ? 0.18 : 0.9);
      ctx.beginPath();
      for (let i = 0; i < H.length; i++) ctx.lineTo(X(i), Y(top[i]));
      for (let i = H.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(base[i]));
      ctx.closePath();
      ctx.fill();
      base.set(top);
    }
    timeAxis(ctx, w, h, pad, H);
  }

  drawClimateChart() {
    const cv = $('chart-climate');
    const { ctx, w, h } = this.prepCanvas(cv);
    const H = this.world.history;
    if (H.length < 2) return emptyChart(ctx, w, h);
    const pad = { l: 34, r: 34, t: 8, b: 16 };
    const X = (i) => pad.l + (i / (H.length - 1)) * (w - pad.l - pad.r);
    let smax = 5, tmin = Infinity, tmax = -Infinity;
    for (const s of H) { smax = Math.max(smax, s.established); tmin = Math.min(tmin, s.temp); tmax = Math.max(tmax, s.temp); }
    tmin = Math.floor(tmin - 1); tmax = Math.ceil(tmax + 1);
    grid(ctx, w, h, pad, smax, (v) => Math.round(v));
    const css = getComputedStyle(document.documentElement);
    const line = (vals, lo, hi, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
      vals.forEach((v, i) => ctx.lineTo(X(i), h - pad.b - ((v - lo) / (hi - lo)) * (h - pad.t - pad.b)));
      ctx.stroke();
    };
    line(H.map((s) => s.established), 0, smax, css.getPropertyValue('--leaf'));
    line(H.map((s) => s.temp), tmin, tmax, css.getPropertyValue('--sun'));
    ctx.fillStyle = css.getPropertyValue('--sun');
    ctx.font = '10px ' + css.getPropertyValue('--font-mono');
    ctx.textAlign = 'left';
    ctx.fillText(`${tmax}°`, w - pad.r + 4, pad.t + 8);
    ctx.fillText(`${tmin}°`, w - pad.r + 4, h - pad.b);
    timeAxis(ctx, w, h, pad, H);
  }

  // ---------- tree of life ----------

  drawTree() {
    const L = this.world.life;
    const now = this.world.tick;
    const all = [...L.speciesById.values()];
    const shown = all.filter((s) => s.peak >= 8 || (s.count >= 3));
    const shownSet = new Set(shown.map((s) => s.id));
    const parentOf = (s) => {
      let p = s.parent;
      while (p && !shownSet.has(p)) p = L.speciesById.get(p)?.parent || 0;
      return p;
    };
    const kids = new Map();
    const roots = [];
    for (const s of shown) {
      const p = parentOf(s);
      s._p = p;
      if (!p) roots.push(s); else { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(s); }
    }
    const rows = [];
    const walk = (s) => {
      rows.push(s);
      const ch = (kids.get(s.id) || []).sort((a, b) => a.born - b.born);
      for (const c of ch) walk(c);
    };
    roots.sort((a, b) => a.born - b.born).forEach(walk);

    const cv = $('tree');
    const wrap = cv.parentElement;
    const rowH = rows.length > 120 ? 6 : rows.length > 50 ? 10 : 15;
    const w = wrap.clientWidth;
    const h = Math.max(120, rows.length * rowH + 28);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    const { ctx } = this.prepCanvas(cv);
    const css = getComputedStyle(document.documentElement);
    const pad = { l: 8, r: 8, t: 10, b: 18 };
    const X = (t) => pad.l + (t / Math.max(1, now)) * (w - pad.l - pad.r);
    const rowY = new Map();
    rows.forEach((s, i) => rowY.set(s.id, pad.t + i * rowH + rowH / 2));
    this.treeRows = rows.map((s) => ({ id: s.id, y: rowY.get(s.id) }));
    this.treeRowH = rowH;

    let lastLabelY = -99;
    for (const s of rows) {
      const y = rowY.get(s.id);
      const alive = s.count > 0;
      const dim = this.activeSpecies && this.activeSpecies !== s.id;
      const col = speciesColor(s, alive ? 0.6 : 0.4);
      const x0 = X(s.born), x1 = X(alive ? now : s.died);
      if (s._p) {
        ctx.strokeStyle = rgb(col, dim ? 0.08 : 0.28);
        ctx.lineWidth = 0.75;
        ctx.beginPath(); ctx.moveTo(x0, rowY.get(s._p)); ctx.lineTo(x0, y); ctx.stroke();
      }
      ctx.strokeStyle = rgb(col, dim ? 0.2 : alive ? 1 : 0.55);
      ctx.lineWidth = alive ? Math.min(rowH - 2, 1.5 + Math.sqrt(s.count) * 0.25) : 1.2;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(Math.max(x0 + 1.5, x1), y); ctx.stroke();
      if (!alive) { ctx.fillStyle = rgb(col, dim ? 0.2 : 0.7); ctx.fillRect(x1 - 1, y - 2.5, 2, 5); }
      if (rowH >= 10 && (alive || s.peak > 80) && y - lastLabelY >= 11) {
        lastLabelY = y;
        ctx.font = `${rowH >= 15 ? 11 : 9}px ${css.getPropertyValue('--font-body')}`;
        ctx.fillStyle = dim ? 'rgba(200,210,230,0.3)' : alive ? css.getPropertyValue('--ink') : css.getPropertyValue('--ink-dim');
        const label = s.name;
        const tw = ctx.measureText(label).width;
        // place label above its line, kept inside the canvas
        const lx = Math.min(Math.max(x0 + 3, pad.l), w - pad.r - tw);
        ctx.fillText(label, lx, y - 3);
      }
    }
    ctx.fillStyle = css.getPropertyValue('--ink-dim');
    ctx.font = '10px ' + css.getPropertyValue('--font-mono');
    ctx.textAlign = 'left'; ctx.fillText('0 My', pad.l, h - 5);
    ctx.textAlign = 'right'; ctx.fillText(`${fmtMyr(now)} My`, w - pad.r, h - 5);
    ctx.textAlign = 'left';
  }

  treeClick(e) {
    if (!this.treeRows) return;
    const rect = $('tree').getBoundingClientRect();
    const y = e.clientY - rect.top;
    const row = this.treeRows.find((r) => Math.abs(r.y - y) <= this.treeRowH / 2);
    if (row) this.setActiveSpecies(this.activeSpecies === row.id ? 0 : row.id);
  }

  // ---------- inspector ----------

  showCreature(i) { this.inspect = { kind: 'creature', index: i }; this.r.selected = i; this.renderInspector(); }
  showCell(c) { this.inspect = { kind: 'cell', cell: c }; this.r.selected = -1; this.r.follow = false; this.renderInspector(); }

  renderInspector() {
    const el = $('inspector');
    const W = this.world;
    let html = '<button class="close" data-act="close" aria-label="Close">×</button>';
    let cell;
    if (this.inspect.kind === 'creature') {
      const info = W.creatureInfo(this.inspect.index);
      if (!info) {
        html += `<h4>It died</h4><div class="sub">This creature is no longer alive. Click another.</div>`;
        el.innerHTML = html; el.hidden = false; this.inspect = null; return;
      }
      const t = info.traits, sp = info.species;
      const maxE = 10 * t.size;
      const [r, g, b] = hslToRgb(t.hue, 0.75, 0.55);
      cell = info.cell;
      html += `<h4><span style="color:rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})">●</span> <i>${esc(sp.name)}</i></h4>
        <div class="sub">${habitatLabel(t.aquatic)} ${dietLabel(t.diet).toLowerCase()} · generation ${info.generation}</div>
        <dl>
          <dt>Size</dt><dd>${t.size.toFixed(2)} · ${sizeLabel(t.size)}</dd>
          <dt>Speed</dt><dd>${t.speed.toFixed(2)}</dd>
          <dt>Diet</dt><dd>${Math.round(t.diet * 100)}% meat</dd>
          <dt>Habitat</dt><dd>${Math.round(t.aquatic * 100)}% aquatic</dd>
          <dt>Comfort</dt><dd>${t.tempPref.toFixed(0)}°C ± ${t.tempTol.toFixed(0)}°</dd>
          <dt>Age</dt><dd>${(info.age * YEARS_PER_TICK / 1000).toFixed(0)} ky</dd>
          <dt>Energy</dt><dd><div class="bar"><i style="width:${Math.max(0, Math.min(100, (info.energy / maxE) * 100))}%"></i></div></dd>
        </dl>
        <div class="actions">
          <button class="ghost" data-act="follow">${this.r.follow ? 'Stop following' : 'Follow'}</button>
          <button class="ghost" data-act="highlight" data-sp="${sp.id}">${this.activeSpecies === sp.id ? 'Clear highlight' : 'Highlight species'}</button>
        </div><hr>`;
    } else {
      cell = this.inspect.cell;
    }
    const d = W.describeCell(cell);
    const height = d.water ? `${Math.round(d.elev * 5200).toLocaleString()} m` : `${Math.round(W.planet.heightAboveSea(cell) * 6000).toLocaleString()} m`;
    html += `${this.inspect.kind === 'cell' ? `<h4>${d.biome}</h4><div class="sub">${latLon(W.planet.grid.pos, cell)}</div>` : `<div class="sub">Standing in: <b>${d.biome}</b></div>`}
      <dl>
        <dt>Temperature</dt><dd>${d.temp.toFixed(1)}°C</dd>
        <dt>Rainfall</dt><dd>${Math.round(d.moist * 100)}%</dd>
        <dt>${d.water ? 'Depth' : 'Altitude'}</dt><dd>${height}</dd>
        <dt>Plant life</dt><dd><div class="bar"><i style="width:${Math.min(100, d.plant * 100)}%"></i></div></dd>
        <dt>Creatures here</dt><dd>${d.creatures}</dd>
      </dl>`;
    el.innerHTML = html;
    if (el.hidden && narrow()) $('panel').classList.add('collapsed');
    el.hidden = false;
  }
}

const narrow = () => window.innerWidth <= 680;

function latLon(pos, c) {
  const x = pos[c * 3], y = pos[c * 3 + 1], z = pos[c * 3 + 2];
  const lat = Math.asin(y) * 180 / Math.PI, lon = Math.atan2(z, x) * 180 / Math.PI;
  return `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;
}

function grid(ctx, w, h, pad, max, fmt) {
  const css = getComputedStyle(document.documentElement);
  ctx.strokeStyle = 'rgba(146,176,222,0.12)';
  ctx.fillStyle = css.getPropertyValue('--ink-dim');
  ctx.font = '10px ' + css.getPropertyValue('--font-mono');
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  for (let k = 0; k <= 2; k++) {
    const v = (max * k) / 2;
    const y = h - pad.b - (k / 2) * (h - pad.t - pad.b);
    ctx.beginPath(); ctx.moveTo(pad.l, y + 0.5); ctx.lineTo(w - pad.r, y + 0.5); ctx.stroke();
    ctx.fillText(fmt(v), pad.l - 4, y + 3);
  }
  ctx.textAlign = 'left';
}

function timeAxis(ctx, w, h, pad, H) {
  const css = getComputedStyle(document.documentElement);
  ctx.fillStyle = css.getPropertyValue('--ink-dim');
  ctx.font = '10px ' + css.getPropertyValue('--font-mono');
  ctx.textAlign = 'left'; ctx.fillText(`${fmtMyr(H[0].tick)} My`, pad.l, h - 3);
  ctx.textAlign = 'right'; ctx.fillText(`${fmtMyr(H[H.length - 1].tick)} My`, w - pad.r, h - 3);
  ctx.textAlign = 'left';
}

function emptyChart(ctx, w, h) {
  ctx.fillStyle = 'rgba(200,210,230,0.4)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Collecting data…', w / 2, h / 2);
  ctx.textAlign = 'left';
}
