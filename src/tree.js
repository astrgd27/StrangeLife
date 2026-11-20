// Full-screen tree of life.
//
// Two views, the way palaeontologists draw it:
//  - Major groups: a spindle diagram (a "Romerogram"). One row per group (bacteria, algae, fish...);
//    the spindle's thickness over time is how many species that group had. It stays readable no
//    matter how many species have lived.
//  - Species: a phylogeny of individual species, filtered by kingdom or group, with names at the tips.

import { GRADES, KINGDOMS, KINGDOM_KEYS, TRANSITIONS, TROPHIC_NAMES, HABITAT_NAMES } from './ecosystem.js';
import { EONS, formatYears } from './world.js';

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// which group each group evolved from (the first transition listed that produces it)
const PARENT_GRADE = {};
for (const t of TRANSITIONS) if (!(t.to in PARENT_GRADE)) PARENT_GRADE[t.to] = t.from;

// living lineages end at the right edge, next to a pinned column of names
function sizeCanvas(cv, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export class TreeView {
  constructor(hooks) {
    this.hooks = hooks; // { highlight(sp) }
    this.mode = 'groups';
    this.show = 'key';     // 'key' = living + ancestors + major extinct; 'all'
    this.kingdom = null;
    this.grade = null;
    this.zoom = 1;
    this.rows = [];
    this.selected = null;
    this.lastDraw = 0;

    $('btn-tree').addEventListener('click', () => this.toggle(true));
    $('tree-close').addEventListener('click', () => this.toggle(false));
    $('tree-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      this.mode = b.dataset.mode;
      if (this.mode === 'groups') this.grade = null;
      this.selected = null;
      this.draw(true);
    });
    $('tree-show').addEventListener('change', (e) => { this.show = e.target.value; this.draw(true); });
    $('tree-kingdoms').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      this.kingdom = b.dataset.k === 'all' ? null : b.dataset.k;
      this.grade = null;
      this.draw(true);
    });
    $('tree-zoom-in').addEventListener('click', () => this.setZoom(this.zoom * 1.6));
    $('tree-zoom-out').addEventListener('click', () => this.setZoom(this.zoom / 1.6));
    $('tree-fit').addEventListener('click', () => this.setZoom(1));
    for (const cv of [$('tree-canvas'), $('tree-labels-canvas')]) {
      cv.addEventListener('mousemove', (e) => this.hover(e));
      cv.addEventListener('mouseleave', () => ($('tree-tip').hidden = true));
      cv.addEventListener('click', (e) => this.click(e));
    }
    // the axis and the names column stay pinned while the tree scrolls
    const sc = $('tree-scroll');
    sc.addEventListener('scroll', () => this.syncScroll());
    $('tree-labels').addEventListener('wheel', (e) => { sc.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
    $('tree-detail').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'globe' && this.selected?.sp) { this.hooks.highlight(this.selected.sp); this.toggle(false); }
      if (b.dataset.act === 'group' && this.selected?.grade) { this.mode = 'species'; this.grade = this.selected.grade; this.selected = null; this.draw(true); }
      if (b.dataset.act === 'clear-grade') { this.grade = null; this.draw(true); }
    });
    window.addEventListener('resize', () => this.isOpen && this.draw(true));
  }

  setWorld(world) { this.world = world; this.selected = null; this.grade = null; if (this.isOpen) this.draw(true); }

  get isOpen() { return !$('treeview').hidden; }

  toggle(open = !this.isOpen) {
    $('treeview').hidden = !open;
    if (open) {
      this.draw(true);
      // start at the present, where the action is
      const sc = $('tree-scroll');
      sc.scrollLeft = sc.scrollWidth;
    }
  }

  syncScroll() {
    const sc = $('tree-scroll');
    $('tree-labels-canvas').style.transform = `translateY(${-sc.scrollTop}px)`;
    $('tree-axis').style.transform = `translateX(${-sc.scrollLeft}px)`;
  }

  setZoom(z) {
    const sc = $('tree-scroll');
    const frac = (sc.scrollLeft + sc.clientWidth / 2) / Math.max(1, sc.scrollWidth);
    this.zoom = Math.max(1, Math.min(12, z));
    this.draw(true);
    sc.scrollLeft = frac * sc.scrollWidth - sc.clientWidth / 2;
  }

  update(now) {
    if (this.isOpen && now - this.lastDraw > 1500) this.draw();
  }

  // ---------- data ----------

  allSpecies() { return [...this.world.eco.species.values()]; }

  groupRows() {
    const W = this.world, now = W.tick;
    const groups = new Map();
    for (const sp of this.allSpecies()) {
      if (this.kingdom && sp.kingdom !== this.kingdom) continue;
      let g = groups.get(sp.grade);
      if (!g) groups.set(sp.grade, (g = { grade: sp.grade, first: sp.born, last: 0, living: 0, total: 0, species: [] }));
      g.first = Math.min(g.first, sp.born);
      g.last = Math.max(g.last, sp.died < 0 ? now : sp.died);
      if (sp.died < 0) g.living++;
      g.total++;
      g.species.push(sp);
    }
    // diversity through time (species alive per time bucket), via a difference array
    const N = 260;
    const t0 = this.t0 = W.eonTicks[0].tick;
    const span = Math.max(1, now - t0);
    let maxC = 1;
    for (const g of groups.values()) {
      const diff = new Float32Array(N + 1);
      for (const sp of g.species) {
        const a = Math.max(0, Math.floor(((sp.born - t0) / span) * N));
        const b = Math.min(N, Math.ceil((((sp.died < 0 ? now : sp.died) - t0) / span) * N));
        diff[a] += 1; diff[Math.max(a + 1, b)] -= 1;
      }
      g.curve = new Float32Array(N);
      let c = 0;
      for (let i = 0; i < N; i++) { c += diff[i]; g.curve[i] = c; if (c > maxC) maxC = c; }
    }
    this.maxC = maxC;
    // order as a tree: each group under the group it evolved from
    const kids = new Map(), roots = [];
    for (const g of groups.values()) {
      let p = PARENT_GRADE[g.grade];
      while (p && !groups.has(p)) p = PARENT_GRADE[p];
      g.parent = p || null;
      if (g.parent) { if (!kids.has(g.parent)) kids.set(g.parent, []); kids.get(g.parent).push(g); } else roots.push(g);
    }
    const rows = [];
    const walk = (g) => { rows.push(g); for (const c of (kids.get(g.grade) || []).sort((a, b) => a.first - b.first)) walk(c); };
    roots.sort((a, b) => a.first - b.first).forEach(walk);
    return rows;
  }

  speciesRows() {
    const E = this.world.eco;
    const all = this.allSpecies();
    const inScope = (s) => (!this.kingdom || s.kingdom === this.kingdom) && (!this.grade || s.grade === this.grade);
    const keep = new Set();
    for (const s of all) {
      if (!inScope(s)) continue;
      const wanted = s.died < 0 || this.show === 'all' || s.peakRange >= 250;
      if (!wanted) continue;
      // keep the line of ancestors within scope, so living species connect back to their roots
      for (let q = s; q && inScope(q) && !keep.has(q.id); q = E.species.get(q.parent)) keep.add(q.id);
    }
    let shown = all.filter((s) => keep.has(s.id));
    if (shown.length > 1500) {
      // too many to draw usefully: drop the smallest extinct ones
      const extinct = shown.filter((s) => s.died >= 0).sort((a, b) => b.peakRange - a.peakRange);
      const cut = new Set(extinct.slice(Math.max(0, 1500 - (shown.length - extinct.length))).map((s) => s.id));
      shown = shown.filter((s) => !cut.has(s.id));
    }
    const shownSet = new Set(shown.map((s) => s.id));
    const kids = new Map(), roots = [];
    for (const s of shown) {
      let p = s.parent;
      while (p && !shownSet.has(p)) p = E.species.get(p)?.parent || 0;
      s._p = p;
      if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(s); } else roots.push(s);
    }
    const rows = [];
    const walk = (s) => { rows.push(s); for (const c of (kids.get(s.id) || []).sort((a, b) => a.born - b.born)) walk(c); };
    roots.sort((a, b) => a.born - b.born).forEach(walk);
    // a single group or kingdom opens on its own stretch of time
    const first = rows.length ? Math.min(...rows.map((s) => s.born)) : 0;
    this.t0 = this.grade || this.kingdom ? Math.max(0, first - Math.round((this.world.tick - first) * 0.04)) : this.world.eonTicks[0].tick;
    return rows;
  }

  // ---------- drawing ----------

  draw(force = false) {
    if (!this.world) return;
    this.lastDraw = performance.now();
    const W = this.world;
    const groups = this.mode === 'groups';
    const rows = groups ? this.groupRows() : this.speciesRows();
    this.rows = rows;
    this.renderHeader();

    const sc = $('tree-scroll');
    const LW = $('tree-labels').clientWidth;
    const rowH = groups ? 40 : rows.length > 400 ? 14 : 20;
    this.rowH = rowH;
    const pw = Math.max(sc.clientWidth, Math.round(sc.clientWidth * this.zoom));
    const h = Math.max(sc.clientHeight, rows.length * rowH + 20);
    const ctx = sizeCanvas($('tree-canvas'), pw, h);
    const lctx = sizeCanvas($('tree-labels-canvas'), LW, h);
    const actx = sizeCanvas($('tree-axis'), pw, 36);
    const now = W.tick, t0 = this.t0;
    const X = (t) => 10 + ((t - t0) / Math.max(1, now - t0)) * (pw - 20);
    const ink = css('--ink'), dim = css('--ink-dim'), mono = css('--font-mono'), body = css('--font-body');

    // eon bands in the plot, eon names and dates on the pinned axis
    const marks = W.eonTicks;
    actx.font = `600 11px ${body}`;
    marks.forEach((m, i) => {
      const xa = X(Math.max(t0, m.tick)), xb = i + 1 < marks.length ? X(marks[i + 1].tick) : pw;
      if (xb <= 0 || (i + 1 < marks.length && marks[i + 1].tick <= t0)) return;
      if (i % 2 === 1) { ctx.fillStyle = 'rgba(146,176,222,0.05)'; ctx.fillRect(xa, 0, xb - xa, h); }
      ctx.fillStyle = 'rgba(146,176,222,0.22)'; ctx.fillRect(Math.round(xa), 0, 1, h);
      actx.fillStyle = 'rgba(146,176,222,0.3)'; actx.fillRect(Math.round(xa), 0, 1, 36);
      const name = EONS[m.eon].name.toUpperCase();
      if (xb - xa > actx.measureText(name).width + 14) { actx.fillStyle = ink; actx.fillText(name, Math.max(xa, 0) + 6, 14); }
    });
    actx.font = `10px ${mono}`;
    const nT = Math.max(1, Math.floor(pw / 120));
    for (let k = 0; k <= nT; k++) {
      const t = t0 + ((now - t0) * k) / nT, x = X(t);
      actx.fillStyle = dim;
      actx.textAlign = k === 0 ? 'left' : k === nT ? 'right' : 'center';
      actx.fillText(formatYears(W.yearsAt(t)), x, 30);
      ctx.fillStyle = 'rgba(146,176,222,0.1)'; ctx.fillRect(Math.round(x), 0, 1, h);
    }
    actx.textAlign = 'left';

    if (!rows.length) {
      ctx.fillStyle = dim; ctx.font = `14px ${body}`;
      ctx.fillText(W.eco.species.size ? 'Nothing matches these filters.' : 'No life yet. The tree begins with the first cell.', 24, 40);
      this.syncScroll();
      return;
    }
    const yOf = (i) => 8 + i * rowH + rowH / 2;
    const sel = this.selected;
    if (groups) this.drawGroups(ctx, lctx, rows, X, yOf, pw, now, sel);
    else this.drawSpecies(ctx, lctx, rows, X, yOf, pw, now, sel);
    this.syncScroll();
  }

  drawGroups(ctx, lctx, rows, X, yOf, plotR, now, sel) {
    const rowH = this.rowH, N = 260, t0 = this.t0, span = Math.max(1, now - t0);
    const idx = new Map(rows.map((g, i) => [g.grade, i]));
    const body = css('--font-body'), ink = css('--ink'), dim = css('--ink-dim');
    rows.forEach((g, i) => {
      const y = yOf(i), col = KINGDOMS[GRADES[g.grade].kingdom].color;
      const faded = sel && sel.grade !== g.grade;
      ctx.globalAlpha = faded ? 0.35 : 1;
      if (g.parent && idx.has(g.parent)) {
        const x = X(g.first);
        ctx.strokeStyle = col; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yOf(idx.get(g.parent))); ctx.lineTo(x, y); ctx.stroke();
        ctx.setLineDash([]);
      }
      // spindle: thickness = number of species alive at that time
      const half = (c) => (c > 0 ? 1.5 + Math.sqrt(c / this.maxC) * (rowH * 0.42 - 1.5) : 0);
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let k = 0; k < N; k++) ctx.lineTo(X(t0 + (k / N) * span), y - half(g.curve[k]));
      for (let k = N - 1; k >= 0; k--) ctx.lineTo(X(t0 + ((k + 1) / N) * span), y + half(g.curve[k]));
      ctx.closePath();
      ctx.globalAlpha *= 0.85; ctx.fill(); ctx.globalAlpha = faded ? 0.35 : 1;
      // origin marker
      ctx.beginPath(); ctx.arc(X(g.first), y, 3, 0, Math.PI * 2); ctx.fill();
      // label, in the pinned names column
      const G = GRADES[g.grade];
      lctx.globalAlpha = faded ? 0.4 : 1;
      lctx.font = `18px ${body}`;
      lctx.fillStyle = ink;
      lctx.fillText(G.icon, 10, y + 6);
      lctx.font = `600 13px ${body}`;
      lctx.fillStyle = g.living ? ink : dim;
      lctx.fillText(G.name, 38, y - 1);
      lctx.font = `11.5px ${body}`;
      lctx.fillStyle = dim;
      lctx.fillText(g.living ? `${g.living} living · ${g.total} ever` : `extinct · ${g.total} ever`, 38, y + 14);
      lctx.globalAlpha = 1;
      ctx.globalAlpha = 1;
    });
  }

  drawSpecies(ctx, lctx, rows, X, yOf, plotR, now, sel) {
    const rowH = this.rowH;
    const idx = new Map(rows.map((s, i) => [s.id, i]));
    const body = css('--font-body'), ink = css('--ink'), dim = css('--ink-dim');
    const big = rowH >= 18;
    rows.forEach((s, i) => {
      const y = yOf(i), alive = s.died < 0, col = KINGDOMS[s.kingdom].color;
      const faded = sel && sel.sp !== s;
      const x0 = X(s.born), x1 = alive ? plotR : X(s.died);
      ctx.globalAlpha = faded ? 0.3 : 1;
      if (s._p && idx.has(s._p)) {
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.globalAlpha *= 0.5;
        ctx.beginPath(); ctx.moveTo(x0 + 0.5, yOf(idx.get(s._p))); ctx.lineTo(x0 + 0.5, y); ctx.stroke();
        ctx.globalAlpha = faded ? 0.3 : 1;
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = alive ? Math.min(rowH - 6, 2 + Math.sqrt(s.range) * 0.15) : 1.5;
      if (!alive) ctx.globalAlpha *= 0.55;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(Math.max(x0 + 2, x1), y); ctx.stroke();
      if (!alive) { ctx.fillStyle = col; ctx.fillRect(x1 - 1, y - 4, 2, 8); }
      ctx.globalAlpha = faded ? 0.3 : 1;
      if (alive) {
        lctx.globalAlpha = faded ? 0.4 : 1;
        lctx.font = `${big ? 14 : 11}px ${body}`;
        lctx.fillStyle = ink;
        lctx.fillText(s.icon, 8, y + (big ? 5 : 4));
        lctx.font = `italic ${big ? 12.5 : 10.5}px ${body}`;
        lctx.fillText(s.name, big ? 30 : 24, y + 4);
        lctx.globalAlpha = 1;
      } else if (big) {
        const label = `† ${s.name}`;
        ctx.font = `italic 11px ${body}`;
        const tw = ctx.measureText(label).width;
        if (x1 + 6 + tw < plotR - 4) { ctx.fillStyle = dim; ctx.fillText(label, x1 + 6, y + 4); }
      }
      ctx.globalAlpha = 1;
    });
  }

  renderHeader() {
    const W = this.world, E = W.eco;
    const all = E.species.size, living = E.alive.length;
    $('tree-sub').textContent = all ? `${living} living species · ${all - living} extinct · ${new Set(this.allSpecies().map((s) => s.grade)).size} major groups have evolved` : 'No life yet';
    document.querySelectorAll('#tree-mode [data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === this.mode));
    $('tree-show-wrap').hidden = this.mode !== 'species';
    const chips = ['all', ...KINGDOM_KEYS].map((k) => {
      const active = (k === 'all' && !this.kingdom) || k === this.kingdom;
      const color = k === 'all' ? 'var(--ink-dim)' : KINGDOMS[k].color;
      return `<button data-k="${k}" class="${active ? 'active' : ''}" style="--k:${color}">${k === 'all' ? 'All kingdoms' : KINGDOMS[k].name}</button>`;
    }).join('');
    if ($('tree-kingdoms')._html !== chips) { $('tree-kingdoms').innerHTML = chips; $('tree-kingdoms')._html = chips; }
    this.renderDetail();
  }

  renderDetail() {
    const d = $('tree-detail'), s = this.selected;
    let html = '';
    if (this.mode === 'species' && this.grade) {
      html += `<span class="tree-scope">Showing <b>${GRADES[this.grade].icon} ${GRADES[this.grade].name}</b> <button class="linkish" data-act="clear-grade">show all groups</button></span>`;
    }
    if (s?.sp) {
      const sp = s.sp, G = GRADES[sp.grade], E = this.world.eco;
      const parent = sp.parent ? E.species.get(sp.parent) : null;
      html += `<span class="tree-sel"><b>${sp.icon} <i>${esc(sp.name)}</i></b> · ${G.name} · ${TROPHIC_NAMES[sp.trophic].toLowerCase()} · ${HABITAT_NAMES[sp.habitat].toLowerCase()} · appeared ${formatYears(this.world.yearsAt(sp.born))}${parent ? ` from <i>${esc(parent.name)}</i>` : ''} · ${sp.died < 0 ? `living in ${sp.range} zones` : `extinct ${formatYears(this.world.yearsAt(sp.died))}`}
        ${sp.died < 0 ? '<button class="primary small-btn" data-act="globe">Show range on globe</button>' : ''}</span>`;
    } else if (s?.grade) {
      html += `<span class="tree-sel"><b>${GRADES[s.grade].icon} ${GRADES[s.grade].name}</b> <button class="primary small-btn" data-act="group">See its species</button></span>`;
    } else if (!html) {
      html = `<span class="muted">${this.mode === 'groups' ? 'Each spindle is a major group; its thickness is how many species it had at the time. Click one to explore its species.' : 'Each line is a species, from its origin to now (or † extinction). Click one for details.'}</span>`;
    }
    if (d._html !== html) { d.innerHTML = html; d._html = html; }
  }

  // ---------- interaction ----------

  rowAt(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    const i = Math.floor((y - 8) / this.rowH);
    return i >= 0 && i < this.rows.length ? this.rows[i] : null;
  }

  hover(e) {
    const row = this.rowAt(e), tip = $('tree-tip');
    if (!row) { tip.hidden = true; return; }
    const W = this.world;
    if (this.mode === 'groups') {
      const G = GRADES[row.grade];
      tip.innerHTML = `<b>${G.icon} ${G.name}</b><br>${KINGDOMS[G.kingdom].name} · ${KINGDOMS[G.kingdom].domain}<br>First appeared ${formatYears(W.yearsAt(row.first))}<br>${row.living ? `${row.living} species living now` : 'Extinct'} · ${row.total} species in all<br><span class="muted">Body size ${G.size}</span>`;
    } else {
      const s = row, G = GRADES[s.grade];
      tip.innerHTML = `<b>${s.icon} <i>${esc(s.name)}</i></b><br>${G.name} · ${TROPHIC_NAMES[s.trophic]} · ${HABITAT_NAMES[s.habitat]}<br>Appeared ${formatYears(W.yearsAt(s.born))}<br>${s.died < 0 ? `Living in ${s.range} zones` : `Extinct ${formatYears(W.yearsAt(s.died))} (peak ${s.peakRange} zones)`}<br><span class="muted">Prefers ${s.pref.toFixed(0)}°C${s.allopatric ? ' · split off by isolation' : s.display ? ' · split by mate choice' : s.cospeciated ? ' · split with its host plant' : ''}${s.island ? ' · island species' : ''}</span>`;
    }
    tip.hidden = false;
    const pad = 14, tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - tw - 8, e.clientX + pad) + 'px';
    tip.style.top = Math.min(window.innerHeight - th - 8, e.clientY + pad) + 'px';
  }

  click(e) {
    const row = this.rowAt(e);
    if (!row) { this.selected = null; }
    else if (this.mode === 'groups') this.selected = this.selected?.grade === row.grade ? null : { grade: row.grade };
    else this.selected = this.selected?.sp === row ? null : { sp: row };
    this.draw(true);
  }
}
