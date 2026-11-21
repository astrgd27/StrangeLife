// "Is it like Earth?": the five patterns of earthcheck.js drawn as charts, this planet beside
// Earth. Two series per chart, in a colour pair checked for colour-blind separation on the dark
// panel; every chart also has a verdict in words and a table of the numbers.

import { earthCheck, EARTH_TIMELINE, EARTH_LATITUDE, LAT_BANDS, EARTH_Z, EARTH_BODY, earthRank } from './earthcheck.js';
import { formatYears } from './world.js';
import { formatCount } from './richness.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PLANET = '#c27f22', EARTH = '#3d8fd6';
const INK = '#e2e8f1', DIM = '#8d9bb1', GRID = 'rgba(146,176,222,0.14)';

export class EarthView {
  constructor() {
    this.isOpen = false;
    $('earth-close').addEventListener('click', () => this.close());
    $('earth-refresh').addEventListener('click', () => this.render());
    window.addEventListener('resize', () => { if (this.isOpen) this.draw(); });
  }

  open(world) {
    this.world = world;
    this.isOpen = true;
    $('earthview').hidden = false;
    this.render();
  }

  close() { this.isOpen = false; $('earthview').hidden = true; }
  toggle(world) { if (this.isOpen) this.close(); else this.open(world); }

  render() {
    const r = (this.result = earthCheck(this.world));
    $('earth-sub').textContent = r.measured
      ? `${r.matches} of ${r.measured} patterns like Earth's · ${formatYears(this.world.years)} · ${this.world.eco.alive.length} species`
      : 'Not enough life yet to compare. Come back once animals and plants have spread.';
    $('earth-grid').innerHTML = r.checks.map((c, i) => `<article class="ec-card">
        <header><h3>${esc(c.title)}</h3>${verdict(c.ok)}</header>
        <div class="ec-chart"><canvas data-i="${i}" role="img" aria-label="${esc(c.title)}: ${esc(c.summary)}"></canvas><div class="ec-tip" hidden></div></div>
        <p>${esc(c.summary)}</p>
        <p class="muted small">${esc(c.earth || '')}${c.note ? ` ${esc(c.note)}` : ''}</p>
        ${table(c)}
      </article>`).join('');
    for (const cv of $('earth-grid').querySelectorAll('canvas')) {
      cv.addEventListener('pointermove', (e) => this.hover(cv, e));
      cv.addEventListener('pointerleave', () => { cv.nextElementSibling.hidden = true; });
    }
    this.draw();
  }

  draw() {
    for (const cv of $('earth-grid').querySelectorAll('canvas')) {
      const c = this.result.checks[+cv.dataset.i];
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      cv._hits = [];
      const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 30 };
      if (c.ok === null) { ctx.fillStyle = DIM; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Not enough to measure yet', w / 2, h / 2); continue; }
      CHARTS[c.key](ctx, box, c, cv._hits, this.world);
    }
  }

  hover(cv, e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, tip = cv.nextElementSibling;
    let best = null, bd = 28 * 28;
    for (const p of cv._hits || []) { const d = (p.x - x) ** 2 + (p.y - y) ** 2 * 0.25; if (d < bd) { bd = d; best = p; } }
    if (!best) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.innerHTML = `<span class="ec-key" style="background:${best.col}"></span>${best.text}`;
    tip.style.left = `${Math.min(r.width - 170, Math.max(0, best.x + 10))}px`;
    tip.style.top = `${Math.max(0, best.y - 34)}px`;
  }
}

function verdict(ok) {
  if (ok === null) return '<span class="ec-verdict wait">· Not yet</span>';
  return ok ? '<span class="ec-verdict good">✓ Like Earth</span>' : '<span class="ec-verdict bad">✗ Unlike Earth</span>';
}

function table(c) {
  let rows = [];
  if (c.key === 'lat' && c.per) rows = c.per.map((v, i) => [`${LAT_BANDS[i]}–${LAT_BANDS[i + 1]}°`, v.toFixed(1), `${Math.round(EARTH_LATITUDE[i] * 100)}%`]);
  else if (c.key === 'size' && c.counts?.length) rows = c.counts.map((v, i) => [`class ${i + 1}`, v, `${Math.round(EARTH_BODY[i] * 100)}%`]);
  else if (c.key === 'area' && c.pts?.length) rows = c.pts.map(([a, s]) => [`${Math.round(10 ** a)} zones`, Math.round(10 ** s), '']);
  else if (c.key === 'time' && c.events?.length) rows = c.events.map((ev) => [formatYears(ev.years), `${formatCount(ev.from)} → ${formatCount(ev.to)} species`, '']);
  if (!rows.length) return '';
  const head = { lat: ['Latitude', 'Species per zone', 'Earth (share of tropics)'], size: ['Size, small → large', 'Animal species', 'Earth (share of peak)'], area: ['Area', 'Species', ''], time: ['Drop', 'Animal species', ''] }[c.key];
  return `<details class="ec-table"><summary>Numbers</summary><table><thead><tr>${head.filter(Boolean).map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.slice(0, head.filter(Boolean).length).map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
}

// ---------- chart parts ----------

function axes(ctx, b, yTicks, xTicks, yLabel) {
  ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  for (const [v, label] of yTicks) { const y = b.Y(v); ctx.beginPath(); ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); ctx.stroke(); ctx.fillStyle = DIM; ctx.textAlign = 'right'; ctx.fillText(label, b.x0 - 6, y); }
  ctx.textBaseline = 'top';
  // the outermost labels are anchored inwards so they never run off the chart
  xTicks.forEach(([v, label], i) => { const x = b.X(v), w = ctx.measureText(label).width; ctx.textAlign = x - w / 2 < 2 ? 'left' : x + w / 2 > b.x1 + 12 ? 'right' : 'center'; ctx.fillText(label, ctx.textAlign === 'left' ? Math.max(2, x - 8) : ctx.textAlign === 'right' ? b.x1 + 6 : x, b.y1 + 8); });
  if (yLabel) { ctx.save(); ctx.translate(10, (b.y0 + b.y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(yLabel, 0, 0); ctx.restore(); }
}
function scale(b, xmin, xmax, ymin, ymax) {
  b.X = (v) => b.x0 + ((v - xmin) / (xmax - xmin || 1)) * (b.x1 - b.x0);
  b.Y = (v) => b.y1 - ((v - ymin) / (ymax - ymin || 1)) * (b.y1 - b.y0);
  return b;
}
function line(ctx, pts, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
}
function dot(ctx, x, y, col) { ctx.fillStyle = '#0c1321'; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
function bar(ctx, x, w, y, y0, col) {
  const h = y0 - y;
  if (h < 0.5) return;
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, [Math.min(4, h), Math.min(4, h), 0, 0]); ctx.fill();
}
function endLabel(ctx, x, y, text, col) {
  ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = col; ctx.fillRect(x - ctx.measureText(text).width - 14, y - 11, 8, 3);
  ctx.fillStyle = INK; ctx.fillText(text, x, y - 2);
}

const CHARTS = {
  time(ctx, box, c, hits) {
    const b = scale(box, 0, 1, 0, 1.05);
    axes(ctx, b, [[0, '0'], [0.5, '50%'], [1, 'peak']], [[0, 'first animals'], [0.5, 'halfway'], [1, 'now']]);
    const earth = EARTH_TIMELINE.map(([ma, v]) => [b.X((541 - ma) / 541), b.Y(v), ma, v]);
    line(ctx, earth.map(([x, y]) => [x, y]), EARTH);
    for (const [x, y, ma, v] of earth) hits.push({ x, y, col: EARTH, text: `Earth, ${ma} million years ago: ${Math.round(v * 100)}% of today's diversity` });
    const pts = c.series.map(([t, v, s, yrs]) => [b.X(t), b.Y(v), s, yrs]);
    line(ctx, pts.map(([x, y]) => [x, y]), PLANET);
    const step = Math.max(1, Math.floor(pts.length / 60));
    pts.forEach(([x, y, s, yrs], i) => { if (i % step === 0) hits.push({ x, y, col: PLANET, text: `This planet, ${formatYears(yrs)}: ${c.est ? `about ${formatCount(s)}` : s} animal species` }); });
    for (const ev of c.events) { const x = b.X(ev.x), y = b.Y(ev.to / Math.max(...c.series.map((p) => p[2]))); ctx.fillStyle = PLANET; ctx.beginPath(); ctx.moveTo(x - 5, y + 8); ctx.lineTo(x + 5, y + 8); ctx.lineTo(x, y + 2); ctx.closePath(); ctx.fill(); hits.push({ x, y: y + 6, col: PLANET, text: `A drop of ${Math.round((1 - ev.to / ev.from) * 100)}%: ${formatCount(ev.from)} → ${formatCount(ev.to)} animal species` }); }
    endLabel(ctx, b.x1, b.Y(1) - 2, 'Earth', EARTH);
    endLabel(ctx, b.x1, Math.min(b.y1, pts[pts.length - 1][1] + 16), 'This planet', PLANET);
  },
  lat(ctx, box, c, hits) {
    const n = c.rel.length, b = scale(box, 0, n, 0, 1.05);
    axes(ctx, b, [[0, '0'], [0.5, '50%'], [1, 'most']], c.rel.map((_, i) => [i + 0.5, `${LAT_BANDS[i]}–${LAT_BANDS[i + 1]}°`]));
    const bw = (b.x1 - b.x0) / n;
    c.rel.forEach((v, i) => { const x = b.x0 + i * bw + bw * 0.2; bar(ctx, x, bw * 0.6, b.Y(v), b.y1, PLANET); hits.push({ x: x + bw * 0.3, y: b.Y(v), col: PLANET, text: `This planet, ${LAT_BANDS[i]}–${LAT_BANDS[i + 1]}°: ${c.per[i].toFixed(1)} species per zone` }); });
    const e = EARTH_LATITUDE.map((v, i) => [b.X(i + 0.5), b.Y(v)]);
    line(ctx, e, EARTH); e.forEach(([x, y], i) => { dot(ctx, x, y, EARTH); hits.push({ x, y, col: EARTH, text: `Earth, ${LAT_BANDS[i]}–${LAT_BANDS[i + 1]}°: ${Math.round(EARTH_LATITUDE[i] * 100)}% of tropical richness` }); });
    endLabel(ctx, b.x1, b.Y(1) + 4, 'Earth', EARTH);
    endLabel(ctx, b.x1, b.Y(1) + 20, 'This planet', PLANET);
  },
  area(ctx, box, c, hits) {
    const [a0, s0] = c.pts[0], aMax = c.pts[c.pts.length - 1][0];
    const sMax = Math.max(c.pts[c.pts.length - 1][1], s0 + EARTH_Z[1] * aMax) + 0.05;
    const b = scale(box, 0, Math.max(2.15, aMax + 0.05), Math.max(0, s0 - 0.2), sMax);
    const yt = []; for (let v = Math.ceil(Math.max(0, s0 - 0.2) * 2) / 2; v <= sMax; v += 0.5) yt.push([v, `${Math.round(10 ** v)}`]);
    axes(ctx, b, yt, [[0, '1 zone'], [1, '10'], [2, '100 zones']], 'species');
    // Earth's usual range of z, from the same starting point
    ctx.fillStyle = 'rgba(61,143,214,0.22)';
    ctx.beginPath(); ctx.moveTo(b.X(a0), b.Y(s0)); ctx.lineTo(b.X(aMax), b.Y(s0 + EARTH_Z[1] * (aMax - a0))); ctx.lineTo(b.X(aMax), b.Y(s0 + EARTH_Z[0] * (aMax - a0))); ctx.closePath(); ctx.fill();
    line(ctx, [[b.X(a0), b.Y(s0)], [b.X(aMax), b.Y(s0 + 0.25 * (aMax - a0))]], EARTH);
    hits.push({ x: b.X(aMax), y: b.Y(s0 + 0.25 * (aMax - a0)), col: EARTH, text: 'Earth: z between 0.15 and 0.35 (line at 0.25)' });
    const pts = c.pts.map(([a, s]) => [b.X(a), b.Y(s), a, s]);
    line(ctx, pts.map(([x, y]) => [x, y]), PLANET);
    for (const [x, y, a, s] of pts) { dot(ctx, x, y, PLANET); hits.push({ x, y, col: PLANET, text: `This planet: ${Math.round(10 ** s)} species in ${Math.round(10 ** a)} zone${Math.round(10 ** a) > 1 ? 's' : ''}` }); }
    endLabel(ctx, b.X(1.1), b.Y(s0 + EARTH_Z[1] * (1.1 - a0)) - 6, "Earth's range", EARTH);
    endLabel(ctx, b.x1, pts[pts.length - 1][1] + 18, `This planet (z ${c.z.toFixed(2)})`, PLANET);
  },
  size(ctx, box, c, hits) {
    const n = 10, b = scale(box, 0, n, 0, 1.05);
    axes(ctx, b, [[0, '0'], [0.5, '50%'], [1, 'most']], [[0.5, 'smallest'], [5, 'body size →'], [9.5, 'largest']]);
    const bw = (b.x1 - b.x0) / n;
    c.rel.forEach((v, i) => { const x = b.x0 + i * bw + 2; bar(ctx, x, bw - 4, b.Y(v), b.y1, PLANET); hits.push({ x: x + bw / 2, y: b.Y(v), col: PLANET, text: `This planet: ${c.counts[i]} animal species in size class ${i + 1}` }); });
    const e = EARTH_BODY.map((v, i) => [b.X(i + 0.5), b.Y(v)]);
    line(ctx, e, EARTH); e.forEach(([x, y], i) => { dot(ctx, x, y, EARTH); hits.push({ x, y, col: EARTH, text: `Earth: ${Math.round(EARTH_BODY[i] * 100)}% of the commonest size class` }); });
    endLabel(ctx, b.x1, b.Y(1) + 4, 'Earth', EARTH);
    endLabel(ctx, b.x1, b.Y(1) + 20, 'This planet', PLANET);
  },
  common(ctx, box, c, hits) {
    const low = Math.min(-4, Math.floor(Math.min(...c.pts.map((p) => p[1])))), b = scale(box, 0, 1, low, 0.15);
    const yt = []; for (let v = 0; v >= low; v -= 1) yt.push([v, v === 0 ? '1' : `1/${10 ** -v >= 1000 ? `${10 ** (-v - 3)}k` : 10 ** -v}`]);
    axes(ctx, b, yt, [[0, 'commonest'], [0.5, 'rank →'], [1, 'rarest']]);
    const e = []; for (let r = 0.005; r <= 0.995; r += 0.01) e.push([b.X(r), b.Y(Math.max(low, earthRank(r))), r]);
    line(ctx, e.map(([x, y]) => [x, y]), EARTH);
    for (let k = 0; k < e.length; k += 10) hits.push({ x: e[k][0], y: e[k][1], col: EARTH, text: `Earth (log-normal): rank ${Math.round(e[k][2] * 100)}%, ${(10 ** earthRank(e[k][2])).toPrecision(2)}× the commonest` });
    const pts = c.pts.map(([r, v]) => [b.X(r), b.Y(Math.max(low, v)), r, v]);
    line(ctx, pts.map(([x, y]) => [x, y]), PLANET);
    const step = Math.max(1, Math.floor(pts.length / 40));
    pts.forEach(([x, y, r, v], i) => { if (i % step === 0) hits.push({ x, y, col: PLANET, text: `This planet: species ranked ${i + 1}, ${(10 ** v).toPrecision(2)}× the commonest` }); });
    endLabel(ctx, b.x1, b.Y(earthRank(0.97)) - 4, 'Earth', EARTH);
    endLabel(ctx, b.x1, Math.min(b.y1, pts[pts.length - 1][1] + 18), 'This planet', PLANET);
  },
};
