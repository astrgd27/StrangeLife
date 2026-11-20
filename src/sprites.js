// Procedural organisms: every species is drawn from its own genome. Its body plan comes from the
// genes that matter for survival (segments, limbs, shells, wings, size, brain), and its looks from
// heritable genes that don't: colours, markings, ornaments and proportions. Looks drift slowly from
// parent to daughter species, so a family shares a family look while each species is its own.
// Drawing is plain Canvas 2D, side view facing right (some animals from above), fitted to radius R.

import { GI, looks } from './genome.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const wrap = (h) => ((h % 1) + 1) % 1;
const hsl = (h, s, l, a = 1) => `hsla(${Math.round(wrap(h) * 360)},${Math.round(clamp(s) * 100)}%,${Math.round(clamp(l) * 100)}%,${a})`;
// a colour usable directly as a fill style, or called with an alpha and a lightness change
function T(h, s, l) {
  const f = (a = 1, dl = 0) => hsl(h, s, l + dl, a);
  f.toString = () => hsl(h, s, l);
  f.h = h; f.s = s; f.l = l;
  return f;
}

function hashRng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- colours ----------

// Colours from the genome: body, dark, light, belly, accent and a marking colour. Animals are
// drab (browns, olives, sea greys) unless the display gene makes them showy; plants vary in leaf
// green and flower colour, fungi in cap colour.
export function palette(sp, L = looks(sp)) {
  const disp = sp.genes[GI.display], k = sp.kingdom, gr = sp.grade;
  const h = L.hue, a = L.accent, sh = L.shade;
  const lt = (base, span = 0.24) => base + (sh - 0.5) * span;
  const P = (body, dark, accent, x = {}) => ({ body, dark, accent, line: dark, light: x.light || body, belly: x.belly || null, pat: x.pat || dark, wood: x.wood || T(0.07, 0.35, 0.32), ...x });
  if (gr === 'diatom') return P(T(0.1 + 0.06 * h, 0.5, lt(0.58)), T(0.1, 0.4, 0.3), T(0.12, 0.3, 0.82));
  if (k === 'plant') {
    let lh = 0.22 + 0.17 * h, ls = 0.4 + 0.25 * ((h * 5) % 1);
    if (gr === 'seaweed') { const f = Math.min(2, Math.floor(h * 3)); lh = [0.3, 0.1, 0.97][f] + (h * 9 % 1) * 0.03; ls = [0.5, 0.45, 0.5][f]; }
    return P(T(lh, ls, lt(0.38, 0.18)), T(lh + 0.02, ls, lt(0.22, 0.1)), T(a, 0.75, 0.6), {
      light: T(lh - 0.03, ls + 0.05, lt(0.52, 0.18)), wood: T(0.06 + 0.05 * h, 0.32, lt(0.3, 0.14)),
      fruit: T(a + 0.08, 0.8, 0.48), centre: T(0.12 + 0.05 * ((a * 7) % 1), 0.85, 0.55),
    });
  }
  if (k === 'fungus') {
    const caps = [[0.1, 0.25, 0.86], [0.08, 0.42, 0.56], [0.06, 0.45, 0.34], [0.0, 0.72, 0.46], [0.07, 0.8, 0.52], [0.13, 0.75, 0.56], [0.8, 0.3, 0.46], [0.55, 0.25, 0.6]];
    const [ch, cs, cl] = caps[Math.floor(h * caps.length) % caps.length];
    return P(T(ch, cs, cl + (sh - 0.5) * 0.12), T(ch, cs * 0.8, cl * 0.55), T(a, 0.6, 0.6), { light: T(0.1, 0.22, 0.88), pat: T(0.1, 0.2, 0.93) });
  }
  if (k === 'bacteria') return gr === 'cyano'
    ? P(T(0.42 + 0.1 * h, 0.55, lt(0.45)), T(0.45, 0.5, 0.26), T(0.38, 0.6, 0.7), { light: T(0.42, 0.5, 0.65) })
    : P(T(0.5 + 0.2 * h, 0.45, lt(0.58)), T(0.56, 0.4, 0.32), T(a, 0.6, 0.75), { light: T(0.55, 0.4, 0.78) });
  if (k === 'archaea') return P(T(0.7 + 0.16 * h, 0.45, lt(0.58)), T(0.75, 0.4, 0.32), T(a, 0.5, 0.78), { light: T(0.75, 0.4, 0.78) });
  if (k === 'protist') return P(T(0.42 + 0.25 * h, 0.4, lt(0.62), 0.9), T(0.5, 0.35, 0.3), T(a, 0.65, 0.55), { light: T(0.5, 0.35, 0.82) });
  // animals
  const wet = sp.habitat === 0 || sp.habitat === 3, ph = sp.ph || {};
  const showy = disp > 0.55;
  let bh, bs;
  if (showy) { bh = h; bs = 0.4 + 0.45 * disp; }
  else if (ph.covering === 'fur') { bh = 0.025 + 0.1 * h; bs = 0.14 + 0.36 * ((h * 7) % 1); }
  else if (wet) { bh = 0.42 + 0.24 * h; bs = 0.12 + 0.3 * ((h * 5) % 1); }
  else { bh = 0.02 + 0.24 * h; bs = 0.18 + 0.32 * ((h * 5) % 1); }
  const bl = 0.27 + 0.38 * sh;
  const accent = T(a, showy ? 0.8 : 0.5, showy ? 0.56 : 0.5);
  return P(T(bh, bs, bl), T(bh, bs * 0.9, bl * 0.48), accent, {
    light: T(bh, bs * 0.7, Math.min(0.9, bl + 0.22)), belly: T(bh, bs * 0.45, Math.min(0.9, bl + 0.3)),
    pat: showy ? accent : sh > 0.38 ? T(bh, bs, bl * 0.42) : T(bh, bs * 0.5, bl + 0.3),
    wood: T(0.08, 0.3, 0.32),
  });
}

// ---------- drawing helpers ----------

const P2 = () => new Path2D();
function ellipse(p, x, y, rx, ry, rot = 0) { p.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); p.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); return p; }

function blobPath(p, x, y, rx, ry, rng, wobble = 0.15, n = 9) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 + (rng() - 0.5) * 2 * wobble;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  for (let i = 0; i <= n; i++) {
    const q = pts[i % n], r = pts[(i + 1) % n];
    const mx = (q[0] + r[0]) / 2, my = (q[1] + r[1]) / 2;
    if (i === 0) p.moveTo(mx, my); else p.quadraticCurveTo(q[0], q[1], mx, my);
  }
  p.closePath();
  return p;
}

// fill a body: outline (drawn first and twice as wide, so merged shapes show one silhouette),
// the base colour, a pale belly, markings, and soft top-lit shading
function skin(ctx, path, C, L, rng, box, px, o = {}) {
  const [x0, y0, x1, y1] = box;
  ctx.lineJoin = 'round';
  if (o.outline !== false) { ctx.strokeStyle = o.line || C.line; ctx.lineWidth = px * 2.4; ctx.stroke(path); }
  ctx.fillStyle = o.fill || C.body; ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  if (o.belly && C.belly) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0.55, C.belly(0)); g.addColorStop(0.78, C.belly(0.9)); g.addColorStop(1, C.belly(1));
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  if (o.pattern !== false && L) markings(ctx, L, C, rng, x0, y0, x1, y1, o.u ?? (y1 - y0) * (0.12 + 0.2 * L.patSize), o);
  if (o.texture) o.texture();
  if (o.shade !== false) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.42, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.restore();
}

// markings inside the current clip: spots, stripes, bands, mottling, a dark back or eyespots
function markings(ctx, L, C, rng, x0, y0, x1, y1, u, o = {}) {
  const w = x1 - x0, h = y1 - y0, p = o.forcePattern || L.pattern;
  if (p === 'plain' || u <= 0) return;
  ctx.save();
  ctx.fillStyle = o.pat || C.pat; ctx.strokeStyle = o.pat || C.pat; ctx.lineCap = 'round';
  if (p === 'spots') {
    const r = u * 0.45;
    for (let y = y0 + u * 0.7; y < y1; y += u * 1.6) for (let x = x0 + u * (0.4 + rng() * 0.8); x < x1; x += u * 1.8) {
      if (rng() < 0.12) continue;
      ctx.beginPath(); ctx.ellipse(x + (rng() - 0.5) * u * 0.5, y + (rng() - 0.5) * u * 0.5, r * (0.7 + 0.5 * rng()), r * (0.6 + 0.4 * rng()), rng() * 3, 0, TAU); ctx.fill();
    }
  } else if (p === 'stripes') {
    const step = u * 1.5;
    ctx.lineWidth = u * 0.5;
    if (o.stripesAlong) for (let y = y0 + step * 0.5; y < y1; y += step) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y + u * 0.2); ctx.stroke(); }
    else for (let x = x0 + step * 0.4; x < x1; x += step) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x - u * 0.7, (y0 + y1) / 2, x + u * 0.1, y1); ctx.stroke(); }
  } else if (p === 'bands') {
    const n = L.patSize > 0.5 ? 2 : 3, bw = w / (n * 2.6);
    for (let i = 0; i < n; i++) { const x = x0 + w * (i + 0.65) / (n + 0.4); ctx.fillRect(x - bw / 2, y0, bw, h); }
  } else if (p === 'mottled') {
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = i % 3 ? (o.pat || C.pat) : C.light;
      ctx.fill(blobPath(P2(), x0 + rng() * w, y0 + rng() * h, u * (0.5 + rng()), u * (0.4 + 0.8 * rng()), rng, 0.35, 7));
    }
  } else if (p === 'dark back') {
    const g = ctx.createLinearGradient(0, y0, 0, y1), d = L.showy ? C.accent : C.dark;
    g.addColorStop(0, d(0.9)); g.addColorStop(0.36 + 0.12 * L.patSize, d(0.75)); g.addColorStop(0.5 + 0.12 * L.patSize, d(0));
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  } else if (p === 'eyespots') {
    const r = o.eyeR || Math.min(h * 0.22, u * 1.1), pts = o.eyespots || [[x0 + w * 0.42, y0 + h * 0.45]];
    for (const [x, y] of pts) {
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16120e'; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,235,0.9)'; ctx.beginPath(); ctx.arc(x - r * 0.18, y - r * 0.18, r * 0.2, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// an eye: iris, pupil and a glint. kind: 'mammal' (dark), 'reptile' (golden, slit), 'fish', 'bird'
function eye(ctx, x, y, r, kind = 'bird') {
  const iris = kind === 'mammal' ? '#2a1a10' : kind === 'reptile' ? '#d9b23a' : kind === 'fish' ? '#d8d0b0' : kind === 'bug' ? '#1a1410' : '#e0b040';
  ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0c0a08'; ctx.beginPath();
  if (kind === 'reptile') ctx.ellipse(x, y, r * 0.25, r * 0.8, 0, 0, TAU); else ctx.arc(x, y, r * (kind === 'mammal' ? 0.7 : 0.55), 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, TAU); ctx.fill();
}

// thick stroked limb with an outline
function limb(ctx, pts, w, fill, line, px) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = w + px * 2.2; ctx.stroke(); }
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}
function line(ctx, pts, w, col) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
function curve(ctx, x0, y0, cx, cy, x1, y1, w, col) {
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
}
function dot(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function tri(ctx, ax, ay, bx, by, cx, cy, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }

// scale and centre a drawing laid out in its own units into the circle of radius R; returns the
// size of one pixel in those units
function fit(ctx, R, box, fill = 0.94) {
  const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
  const k = Math.min((2 * R * fill) / w, (1.84 * R * fill) / h);
  ctx.scale(k, k);
  ctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  return 1 / k;
}

// fur: a fringe of short strokes along the top of a shape
function furFringe(ctx, path, box, C, px, rng) {
  const [x0, y0, x1, y1] = box;
  ctx.save(); ctx.clip(path);
  ctx.strokeStyle = C.dark(0.45); ctx.lineWidth = px * 1.1;
  const n = Math.round((x1 - x0) / (px * 4));
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + rng()) * (x1 - x0) / n, y = y0 + rng() * (y1 - y0) * 0.7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - px * 2, y + px * 4); ctx.stroke();
  }
  ctx.restore();
}
function scaleTexture(ctx, box, C, px) {
  const [x0, y0, x1, y1] = box, s = Math.max(px * 4, (y1 - y0) * 0.09);
  ctx.strokeStyle = C.dark(0.28); ctx.lineWidth = px;
  for (let y = y0, r = 0; y < y1; y += s * 0.7, r++) for (let x = x0 + (r % 2) * s * 0.5; x < x1; x += s) { ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0.2, Math.PI - 0.2); ctx.stroke(); }
}

// ---------- microbes ----------

function drawMicrobe(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, gr = sp.grade, f = L.ornament;
  ctx.lineWidth = Math.max(1, R * 0.05);
  if (gr === 'cyano' && f === 'mats') {
    // a stromatolite: layered mounds built by mats of cyanobacteria
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? C.body : C.light; ctx.beginPath();
      ctx.ellipse(0, R * 0.75, R * (0.85 - k * 0.11), R * (0.95 - k * 0.13), 0, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = C.dark; ctx.fillRect(-R * 0.9, R * 0.72, R * 1.8, R * 0.1);
    return;
  }
  const cell = (x, y, a, s, shape) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = C.body; ctx.strokeStyle = C.dark;
    const p = P2();
    if (shape === 'lobed') blobPath(p, 0, 0, s * 1.1, s * 0.85, rng, 0.28, 7);
    else if (shape === 'squares') p.rect(-s, -s, s * 2, s * 2);
    else if (shape === 'rods') p.roundRect(-s * 1.4, -s * 0.55, s * 2.8, s * 1.1, s * 0.55);
    else if (shape === 'spirals') {
      ctx.lineWidth = s * 0.5; ctx.lineCap = 'round'; ctx.strokeStyle = C.body; ctx.beginPath();
      for (let k = 0; k <= 24; k++) { const t = k / 24, xx = -s * 1.6 + t * s * 3.2, yy = Math.sin(t * TAU * 1.6) * s * 0.45; if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke(); ctx.restore(); return;
    } else if (shape === 'commas') { p.moveTo(-s * 1.2, -s * 0.2); p.quadraticCurveTo(0, -s * 1.1, s * 1.2, -s * 0.3); p.quadraticCurveTo(s * 1.3, s * 0.4, s * 0.9, s * 0.2); p.quadraticCurveTo(0, -s * 0.4, -s * 1.2, s * 0.4); p.closePath(); }
    else ellipse(p, 0, 0, s, s);
    ctx.stroke(p); ctx.fill(p);
    ctx.save(); ctx.clip(p); dot(ctx, -s * 0.3, -s * 0.35, s * 0.45, 'rgba(255,255,255,0.25)'); ctx.restore();
    if (gr === 'cyano') { dot(ctx, 0, 0, s * 0.3, C.accent); }
    ctx.restore();
  };
  const shape = gr === 'cyano' ? 'spheres' : f || 'spheres';
  if (gr === 'cyano' && f === 'filaments') {
    // a bead-chain filament, with a bigger nitrogen-fixing cell
    const n = 9;
    for (let i = 0; i < n; i++) { const t = i / (n - 1), x = -R * 0.85 + t * R * 1.7, y = Math.sin(t * 5 + L.build * 3) * R * 0.3; cell(x, y, 0, R * (i === 4 ? 0.16 : 0.12), 'spheres'); }
    return;
  }
  const colony = ph.level >= 1 || gr === 'cyano';
  if (!colony) {
    cell(R * 0.05, 0, -0.3 + L.build, R * 0.38, shape);
    if (ph.motile) {
      ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.04);
      const nf = 1 + Math.floor(L.reach * 3);
      for (let j = 0; j < nf; j++) {
        ctx.beginPath(); const y0 = (j - (nf - 1) / 2) * R * 0.12; ctx.moveTo(-R * 0.45, y0);
        for (let k = 1; k <= 8; k++) ctx.lineTo(-R * 0.45 - k * R * 0.06, y0 + Math.sin(k * 1.4 + j) * R * 0.08);
        ctx.stroke();
      }
    }
  } else {
    const n = 4 + Math.round(L.build * 4);
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.4, r = R * (0.3 + 0.2 * rng()); cell(Math.cos(a) * r, Math.sin(a) * r, a, R * 0.2, shape); }
  }
}

function drawProtist(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, gr = sp.grade, f = L.ornament;
  ctx.lineWidth = Math.max(1, R * 0.04); ctx.lineCap = 'round';
  if (gr === 'foram') {
    // a chalky shell of chambers, with thread-like pseudopods
    ctx.strokeStyle = C.accent(0.7); ctx.lineWidth = Math.max(1, R * 0.015);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4); ctx.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95); ctx.stroke(); }
    ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.035);
    const ch = (x, y, r, k) => { ctx.fillStyle = k % 2 ? '#efe6d2' : '#d8c8a6'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); };
    if (f === 'a chain') for (let k = 0; k < 6; k++) ch(-R * 0.55 + k * R * 0.22, R * 0.1 * Math.sin(k), R * (0.1 + 0.025 * k), k);
    else if (f === 'a star') { for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; tri(ctx, Math.cos(a - 0.2) * R * 0.3, Math.sin(a - 0.2) * R * 0.3, Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, Math.cos(a + 0.2) * R * 0.3, Math.sin(a + 0.2) * R * 0.3, '#e6dcc4'); } ch(0, 0, R * 0.35, 1); }
    else for (let k = 6; k >= 0; k--) { const a = k * 0.9, r = R * (0.1 + 0.05 * k); ch(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r, k); }
    return;
  }
  if (gr === 'algae') {
    if (f === 'a ball colony' || ph.level === 1) {
      // a hollow ball of cells, with daughter colonies inside
      ctx.fillStyle = C.light(0.35); ctx.strokeStyle = C.dark; ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, TAU); ctx.fill(); ctx.stroke();
      for (let k = 0; k < 40; k++) { const a = k * 2.4, r = R * 0.78 * Math.sqrt((k + 0.5) / 40); dot(ctx, Math.cos(a) * r, Math.sin(a) * r, R * 0.04, C.body); }
      for (const [x, y] of [[-0.25, -0.15], [0.25, 0.2]]) { ctx.fillStyle = C.body; ctx.beginPath(); ctx.arc(x * R, y * R, R * 0.17, 0, TAU); ctx.fill(); ctx.stroke(); }
      return;
    }
    if (f === 'a desmid') {
      // two mirror-image half cells joined at a narrow waist
      for (const s of [-1, 1]) { const p = blobPath(P2(), s * R * 0.42, 0, R * 0.42, R * 0.5, rng, 0.08, 12); ctx.strokeStyle = C.dark; ctx.stroke(p); ctx.fillStyle = C.body; ctx.fill(p); ctx.save(); ctx.clip(p); dot(ctx, s * R * 0.42, 0, R * 0.25, C.dark(0.4)); ctx.restore(); }
      return;
    }
  }
  if (f === 'a spiky shell') {
    // a radiolarian: a glassy lattice ball with long spines
    ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(1, R * 0.03);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; line(ctx, [[0, 0], [Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95]], Math.max(1, R * 0.03), C.dark); }
    ctx.fillStyle = C.light; ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, TAU); ctx.fill(); ctx.strokeStyle = C.dark; ctx.stroke();
    ctx.strokeStyle = C.dark(0.6);
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(Math.cos(k) * R * 0.25, Math.sin(k * 1.7) * R * 0.25, R * 0.12, 0, TAU); ctx.stroke(); }
    return;
  }
  if (f === 'a stalk') {
    // a bell-shaped cell on a coiled stalk
    ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.04); ctx.beginPath(); ctx.moveTo(0, R * 0.9);
    for (let k = 1; k <= 12; k++) ctx.lineTo(Math.sin(k * 1.3) * R * 0.08, R * 0.9 - k * R * 0.07); ctx.stroke();
    const p = P2(); p.moveTo(-R * 0.45, -R * 0.45); p.quadraticCurveTo(-R * 0.3, R * 0.05, 0, R * 0.08); p.quadraticCurveTo(R * 0.3, R * 0.05, R * 0.45, -R * 0.45); p.closePath();
    ctx.stroke(p); ctx.fillStyle = C.body; ctx.fill(p);
    for (let k = 0; k < 9; k++) line(ctx, [[-R * 0.45 + k * R * 0.11, -R * 0.45], [-R * 0.47 + k * R * 0.11, -R * 0.6]], Math.max(1, R * 0.02), C.dark);
    return;
  }
  const one = (x, y, s) => {
    const p = P2();
    if (f === 'a ciliate') { p.moveTo(x - s * 1.2, y); p.bezierCurveTo(x - s * 1.2, y - s, x + s * 1.3, y - s * 0.9, x + s * 1.2, y); p.bezierCurveTo(x + s, y + s * 0.6, x + s * 0.2, y + s * 0.2, x - s * 0.1, y + s * 0.65); p.bezierCurveTo(x - s * 0.6, y + s * 0.9, x - s * 1.2, y + s * 0.6, x - s * 1.2, y); }
    else if (f === 'a flagellate' || gr === 'algae') { p.moveTo(x + s * 1.1, y); p.bezierCurveTo(x + s, y - s * 0.8, x - s * 0.6, y - s * 0.7, x - s * 0.9, y); p.bezierCurveTo(x - s * 0.6, y + s * 0.7, x + s, y + s * 0.8, x + s * 1.1, y); }
    else blobPath(p, x, y, s * 1.1, s, rng, 0.32, 8);
    ctx.strokeStyle = C.dark; ctx.stroke(p); ctx.fillStyle = C.body; ctx.fill(p);
    ctx.save(); ctx.clip(p);
    if (sp.chloro) for (let k = 0; k < 5; k++) dot(ctx, x + (rng() - 0.5) * s * 1.2, y + (rng() - 0.5) * s, s * 0.22, hsl(0.3, 0.6, 0.38));
    dot(ctx, x + s * 0.1, y - s * 0.05, s * 0.3, C.dark(0.7));
    for (let k = 0; k < 3; k++) dot(ctx, x + (rng() - 0.5) * s, y + (rng() - 0.5) * s * 0.8, s * 0.1, C.light);
    ctx.restore();
    if (f === 'a ciliate') { ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(0.6, s * 0.04); for (let k = 0; k < 22; k++) { const a = (k / 22) * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 1.2, y + Math.sin(a) * s * 0.85); ctx.lineTo(x + Math.cos(a) * s * 1.42, y + Math.sin(a) * s * 1.05); ctx.stroke(); } }
    else if (f === 'a flagellate' || gr === 'algae') {
      ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(0.6, s * 0.06);
      for (const d of gr === 'algae' ? [-0.3, 0.3] : [0]) { ctx.beginPath(); ctx.moveTo(x + s * 1.1, y + d * s); for (let k = 1; k <= 7; k++) ctx.lineTo(x + s * 1.1 + k * s * 0.18, y + d * s * (1 + k * 0.5) + Math.sin(k * 1.5) * s * 0.15); ctx.stroke(); }
      if (gr === 'algae') dot(ctx, x + s * 0.7, y - s * 0.2, s * 0.12, '#d33');
    } else { ctx.fillStyle = C.body(0.8); for (let k = 0; k < 3; k++) { const a = rng() * TAU; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.45, s * 0.2, a, 0, TAU); ctx.fill(); } }
  };
  if (ph.level === 0) one(0, 0, R * 0.55);
  else {
    ctx.strokeStyle = C.dark; ctx.globalAlpha = 0.3; ctx.fillStyle = C.light; ctx.beginPath(); ctx.arc(0, 0, R * 0.85, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; one(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.17); }
    one(0, 0, R * 0.17);
  }
}

// ---------- plants ----------

// a leafy crown in overlapping clumps, lit from above
function crown(ctx, x, y, rx, ry, C, rng, n = 7) {
  const parts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rng(); parts.push([x + Math.cos(a) * rx * 0.55, y + Math.sin(a) * ry * 0.5, rx * (0.45 + 0.2 * rng()), ry * (0.45 + 0.2 * rng())]); }
  parts.push([x, y, rx * 0.6, ry * 0.6]);
  const all = P2();
  for (const [px_, py, r1, r2] of parts) blobPath(all, px_, py, r1, r2, rng, 0.18, 8);
  ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, rx * 0.05); ctx.stroke(all);
  ctx.fillStyle = C.body; ctx.fill(all);
  ctx.save(); ctx.clip(all);
  for (const [px_, py, r1, r2] of parts) { ctx.fillStyle = C.light(0.55); ctx.fill(blobPath(P2(), px_ - r1 * 0.15, py - r2 * 0.25, r1 * 0.6, r2 * 0.5, rng, 0.2, 7)); }
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.fillRect(x - rx * 1.3, y - ry * 1.3, rx * 2.6, ry * 2.6);
  ctx.restore();
  return all;
}

// a flower of the species' form
function flower(ctx, x, y, s, form, C, a = 0) {
  if (s < 0.6) { dot(ctx, x, y, Math.max(0.6, s), C.accent); return; }
  if (form === 'bell flowers') {
    const p = P2(); p.moveTo(x - s * 0.7, y + s); p.quadraticCurveTo(x - s * 0.8, y - s * 0.6, x, y - s * 0.7); p.quadraticCurveTo(x + s * 0.8, y - s * 0.6, x + s * 0.7, y + s); p.lineTo(x + s * 0.35, y + s * 0.8); p.lineTo(x, y + s * 1.05); p.lineTo(x - s * 0.35, y + s * 0.8); p.closePath();
    ctx.fillStyle = C.accent; ctx.fill(p); ctx.strokeStyle = C.accent(1, -0.2); ctx.lineWidth = Math.max(0.5, s * 0.1); ctx.stroke(p);
  } else if (form === 'cup flowers') {
    for (const d of [-1, 0, 1]) { ctx.fillStyle = d ? C.accent : C.accent(1, 0.08); ctx.beginPath(); ctx.ellipse(x + d * s * 0.45, y, s * 0.45, s * 0.9, d * 0.35, 0, TAU); ctx.fill(); }
  } else if (form === 'flower spikes') {
    for (let k = 0; k < 6; k++) dot(ctx, x + (k % 2 ? s * 0.25 : -s * 0.25), y + s * 1.2 - k * s * 0.45, s * (0.42 - k * 0.04), k % 2 ? C.accent : C.accent(1, 0.1));
  } else if (form === 'flower clusters') {
    for (let k = 0; k < 7; k++) { const q = (k / 7) * TAU; dot(ctx, x + Math.cos(q) * s * 0.7, y + Math.sin(q) * s * 0.45, s * 0.32, C.accent); }
    dot(ctx, x, y, s * 0.3, C.centre || C.accent);
  } else {
    const n = 8;
    for (let k = 0; k < n; k++) { const q = (k / n) * TAU + a; ctx.fillStyle = C.accent; ctx.beginPath(); ctx.ellipse(x + Math.cos(q) * s * 0.6, y + Math.sin(q) * s * 0.6, s * 0.55, s * 0.22, q, 0, TAU); ctx.fill(); }
    dot(ctx, x, y, s * 0.35, C.centre || '#f2d04a');
  }
}

function drawPlant(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, gr = sp.grade, f = L.ornament;
  const base = R * 0.88, px = Math.max(0.6, R / 40);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (gr === 'algae') return drawProtist(ctx, sp, R, C, rng, L);
  if (gr === 'diatom') {
    // glass boxes: round (centric), boat-shaped (pennate), or a star-shaped chain, finely etched
    ctx.lineWidth = Math.max(1, R * 0.035);
    const box = (x, y, round, rot, s) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      const p = round ? ellipse(P2(), 0, 0, s * 0.6, s * 0.6) : ellipse(P2(), 0, 0, s, s * 0.3);
      ctx.strokeStyle = C.dark; ctx.stroke(p); ctx.fillStyle = C.body; ctx.fill(p);
      ctx.save(); ctx.clip(p); ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(0.5, s * 0.04);
      if (round) for (let k = 0; k < 16; k++) line(ctx, [[0, 0], [Math.cos(k / 16 * TAU) * s, Math.sin(k / 16 * TAU) * s]], Math.max(0.5, s * 0.03), C.accent);
      else { for (let k = -6; k <= 6; k++) line(ctx, [[k * s * 0.14, -s * 0.3], [k * s * 0.14, s * 0.3]], Math.max(0.5, s * 0.03), C.accent); line(ctx, [[-s, 0], [s, 0]], Math.max(0.5, s * 0.04), C.dark); }
      ctx.restore(); ctx.restore();
    };
    if (f === 'star chains') for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; box(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42, false, a, R * 0.42); }
    else for (let i = 0; i < 3; i++) box((i - 1) * R * 0.55, (i % 2 ? 0.28 : -0.22) * R, f === 'round boxes', 0.4 + i * 0.5, R * 0.4);
    return;
  }
  if (gr === 'waterplant') {
    ctx.fillStyle = 'rgba(60,110,170,0.32)'; ctx.fillRect(-R, R * 0.12, R * 2, R * 0.85);
    ctx.strokeStyle = 'rgba(160,200,240,0.5)'; ctx.lineWidth = px; ctx.beginPath(); ctx.moveTo(-R, R * 0.12); ctx.lineTo(R, R * 0.12); ctx.stroke();
    if (f === 'reeds') {
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * R * 0.2 + (rng() - 0.5) * R * 0.08, h = R * (1.2 + 0.5 * rng());
        curve(ctx, x, base, x + R * 0.05, base - h * 0.5, x + (rng() - 0.5) * R * 0.25, base - h, R * 0.05, i % 2 ? C.body : C.dark);
        if (i % 2 === 0) { ctx.fillStyle = C.wood; ctx.beginPath(); ctx.roundRect(x - R * 0.05, base - h * 0.75, R * 0.1, R * 0.28, R * 0.05); ctx.fill(); }
      }
      return;
    }
    const pad = (x, y, r) => { const p = P2(); p.moveTo(x, y); p.arc(x, y, r, 0.25, TAU - 0.05); p.closePath(); skin(ctx, p, C, null, rng, [x - r, y - r * 0.5, x + r, y + r * 0.5], px * 0.6, { pattern: false }); ctx.strokeStyle = C.dark(0.5); ctx.lineWidth = px * 0.7; for (let k = 0; k < 6; k++) { const q = 0.5 + k; line(ctx, [[x, y], [x + Math.cos(q) * r * 0.9, y + Math.sin(q) * r * 0.45]], px * 0.6, C.dark(0.5)); } };
    if (f === 'floating rosettes') {
      for (const [x, y, s] of [[-R * 0.45, R * 0.2, 0.8], [R * 0.4, R * 0.3, 0.7], [0, R * 0.12, 1]]) for (let k = 0; k < 7; k++) { const q = (k / 7) * TAU; ctx.fillStyle = k % 2 ? C.body : C.light; ctx.beginPath(); ctx.ellipse(x + Math.cos(q) * R * 0.15 * s, y + Math.sin(q) * R * 0.06 * s, R * 0.17 * s, R * 0.09 * s, q, 0, TAU); ctx.fill(); }
      return;
    }
    ctx.save(); ctx.scale(1, 0.5);
    for (const [x, y, r] of [[-R * 0.45, R * 0.5, R * 0.34], [R * 0.42, R * 0.7, R * 0.3], [0, R * 1.15, R * 0.32]]) pad(x, y, r);
    ctx.restore();
    if (ph.display > 0.4) { curve(ctx, 0, R * 0.12, R * 0.02, 0, 0, -R * 0.12, px * 1.5, C.dark); flower(ctx, 0, -R * 0.2, R * 0.22, 'cup flowers', C); }
    return;
  }
  if (gr === 'seaweed') {
    const n = 3 + Math.round(sp.genes[GI.segments] * 3);
    ctx.fillStyle = '#5a5248'; ctx.beginPath(); ctx.ellipse(0, base + R * 0.05, R * 0.45, R * 0.12, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < n; i++) {
      const x0 = (i - (n - 1) / 2) * R * 0.2, h = R * (1.1 + 0.55 * rng()), col = i % 2 ? C.body : C.light;
      if (f === 'kelp blades' || f === 'air bladders') {
        const pts = []; for (let k = 0; k <= 8; k++) pts.push([x0 + Math.sin(k * 0.9 + i) * R * 0.14, base - (h * k) / 8]);
        line(ctx, pts, R * 0.035, C.dark);
        for (let k = 2; k <= 8; k += 2) { const [x, y] = pts[k]; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + (k % 4 ? R * 0.1 : -R * 0.1), y, R * 0.16, R * 0.055, k % 4 ? 0.6 : -0.6, 0, TAU); ctx.fill(); if (f === 'air bladders') dot(ctx, x, y + R * 0.02, R * 0.05, C.light(1, 0.12)); }
      } else if (f === 'frilly red fronds') {
        const p = P2(); p.moveTo(x0, base);
        for (let k = 1; k <= 10; k++) p.lineTo(x0 + Math.sin(k * 2.2 + i) * R * 0.16 * (k / 10 + 0.3), base - (h * k) / 10);
        for (let k = 10; k >= 1; k--) p.lineTo(x0 + Math.sin(k * 2.2 + i) * R * 0.16 * (k / 10 + 0.3) + R * 0.1, base - (h * k) / 10 + R * 0.04);
        p.closePath(); ctx.fillStyle = col; ctx.fill(p);
      } else {
        const br = (x, y, a, len, d) => { if (d > 3) return; const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; line(ctx, [[x, y], [ex, ey]], R * (0.07 - d * 0.013), col); br(ex, ey, a - 0.45, len * 0.72, d + 1); br(ex, ey, a + 0.4, len * 0.72, d + 1); };
        br(x0, base, -Math.PI / 2 + (rng() - 0.5) * 0.4, h * 0.38, 0);
      }
    }
    return;
  }
  if (gr === 'moss') {
    const mb = R * 0.62;
    ctx.fillStyle = '#5a5248'; ctx.beginPath(); ctx.ellipse(0, mb + R * 0.18, R * 0.9, R * 0.22, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { const p = P2(); p.arc(-R * 0.68 + i * R * 0.27, mb, R * (0.24 + 0.08 * rng()), Math.PI, 0); skin(ctx, p, C, null, rng, [-R, mb - R * 0.35, R, mb], px * 0.5, { pattern: false }); }
    if (f === 'star moss' || f === 'feathery moss') {
      for (let i = 0; i < 9; i++) {
        const x = -R * 0.7 + i * R * 0.17, y = mb - R * (0.15 + 0.12 * rng());
        if (f === 'star moss') for (let k = 0; k < 5; k++) { const q = (k / 5) * TAU; line(ctx, [[x, y], [x + Math.cos(q) * R * 0.08, y + Math.sin(q) * R * 0.08]], px * 1.2, C.light); }
        else { line(ctx, [[x, y + R * 0.1], [x + R * 0.05, y - R * 0.18]], px, C.light); for (let k = 0; k < 4; k++) line(ctx, [[x + k * R * 0.012, y + R * 0.05 - k * R * 0.06], [x + k * R * 0.012 + R * 0.07, y - k * R * 0.06]], px * 0.8, C.light); }
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = -R * 0.45 + i * R * 0.3; curve(ctx, x, mb - R * 0.2, x - R * 0.04, mb - R * 0.55, x + R * 0.05, mb - R * 0.8, px * 1.4, C.wood);
      ctx.fillStyle = f === 'spore capsules' ? C.accent(1, -0.15) : C.wood; ctx.beginPath(); ctx.ellipse(x + R * 0.06, mb - R * 0.86, R * 0.05, R * 0.09, 0.3, 0, TAU); ctx.fill();
    }
    return;
  }
  const tall = R * (0.95 + 0.85 * ph.size);
  if (gr === 'fern') {
    const tree = ph.size > 0.45;
    const top = tree ? base - tall * 0.95 : base;
    if (tree) { limb(ctx, [[0, base], [R * 0.03, base - tall * 0.5], [0, top]], R * 0.12, C.wood, C.dark(0.6), px); for (let k = 1; k < 6; k++) line(ctx, [[-R * 0.06, base - k * tall * 0.15], [R * 0.06, base - k * tall * 0.15 - R * 0.03]], px, C.dark(0.6)); }
    const n = tree ? 7 : 5, len0 = tree ? R * 0.75 : tall;
    for (let i = 0; i < n; i++) {
      const a = tree ? -Math.PI / 2 + (i - (n - 1) / 2) * 0.5 : -Math.PI / 2 + (i - (n - 1) / 2) * 0.42;
      const len = len0 * (i === (n - 1) / 2 ? 1 : 0.82 + 0.1 * Math.sin(i));
      const ex = Math.cos(a) * len, ey = top + Math.sin(a) * len * (tree ? 0.6 : 1) + (tree ? R * 0.15 : 0);
      const cx = ex * 0.3, cy = top - len * (tree ? 0.45 : 0.8);
      curve(ctx, 0, top, cx, cy, ex, ey, Math.max(px, R * 0.035), C.dark);
      const leaflets = f === 'lacy fronds' ? 9 : 7;
      for (let k = 1; k < leaflets; k++) {
        const t = k / leaflets, qx = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * cx + t * t * ex, qy = (1 - t) * (1 - t) * top + 2 * (1 - t) * t * cy + t * t * ey;
        const lw = R * (f === 'broad fronds' ? 0.13 : 0.1) * (1 - t * 0.7);
        ctx.fillStyle = k % 2 ? C.body : C.light;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(qx + s * lw * 0.6, qy - lw * 0.2, lw, lw * (f === 'lacy fronds' ? 0.28 : 0.4), s * 0.6 + a + Math.PI / 2, 0, TAU); ctx.fill(); }
      }
      if (f === 'fiddleheads' && i % 2) { ctx.strokeStyle = C.light; ctx.lineWidth = px * 1.5; ctx.beginPath(); ctx.arc(ex, ey - R * 0.05, R * 0.06, 0, Math.PI * 1.6); ctx.stroke(); }
    }
    return;
  }
  if (gr === 'grass') {
    const n = 8 + Math.round(L.build * 5);
    for (let i = 0; i < n; i++) {
      const x0 = (i - (n - 1) / 2) * R * (f === 'tufts' ? 0.08 : 0.15), h = R * (0.85 + 0.6 * rng()) * (f === 'canes' ? 1.15 : 1), lean = (rng() - 0.5) * R * (f === 'tufts' ? 0.9 : 0.45);
      if (f === 'canes') {
        line(ctx, [[x0, base], [x0 + lean * 0.3, base - h]], R * 0.06, i % 2 ? C.body : C.light);
        for (let k = 1; k < 5; k++) line(ctx, [[x0 + lean * 0.3 * k / 5 - R * 0.035, base - h * k / 5], [x0 + lean * 0.3 * k / 5 + R * 0.035, base - h * k / 5]], px * 1.2, C.dark);
        ctx.fillStyle = C.body; ctx.beginPath(); ctx.ellipse(x0 + lean * 0.3 + R * 0.1, base - h * 0.85, R * 0.14, R * 0.035, -0.4, 0, TAU); ctx.fill();
        continue;
      }
      curve(ctx, x0, base, x0, base - h * 0.6, x0 + lean, base - h, Math.max(px, R * 0.045), i % 2 ? C.body : C.light);
      if (i % 3 === 1) {
        const tx = x0 + lean, ty = base - h;
        if (f === 'feathery plumes') { ctx.fillStyle = C.light(0.8, 0.25); ctx.beginPath(); ctx.ellipse(tx, ty - R * 0.1, R * 0.07, R * 0.2, lean / R, 0, TAU); ctx.fill(); }
        else if (f === 'seed spikes') for (let k = 0; k < 5; k++) { ctx.fillStyle = C.wood(1, 0.25); ctx.beginPath(); ctx.ellipse(tx + (k % 2 ? R * 0.03 : -R * 0.03), ty - k * R * 0.05, R * 0.03, R * 0.05, k % 2 ? 0.5 : -0.5, 0, TAU); ctx.fill(); }
      }
    }
    return;
  }
  if (gr === 'cactus') {
    ctx.fillStyle = '#b89a6a'; ctx.beginPath(); ctx.ellipse(0, base + R * 0.02, R * 0.7, R * 0.08, 0, 0, TAU); ctx.fill();
    const spines = (p, box) => { skin(ctx, p, C, null, rng, box, px, { pattern: false, texture: () => { for (let k = 0; k < 30; k++) { const x = box[0] + rng() * (box[2] - box[0]), y = box[1] + rng() * (box[3] - box[1]); line(ctx, [[x, y], [x + R * 0.04, y - R * 0.03]], px * 0.7, C.accent(0.8, 0.3)); } } }); };
    const col = (p, x, y0, y1, w) => p.roundRect(x - w / 2, y1, w, y0 - y1, w / 2);
    if (f === 'a barrel') { const p = ellipse(P2(), 0, base - R * 0.45, R * 0.55, R * 0.48); spines(p, [-R * 0.55, base - R * 0.95, R * 0.55, base]); for (let k = -2; k <= 2; k++) curve(ctx, k * R * 0.18, base - R * 0.9, k * R * 0.28, base - R * 0.45, k * R * 0.18, base - R * 0.02, px, C.dark(0.6)); }
    else if (f === 'pads') { const p = P2(); for (const [x, y, r, a] of [[0, base - R * 0.3, 0.32, 0], [-R * 0.3, base - R * 0.75, 0.26, -0.5], [R * 0.32, base - R * 0.8, 0.25, 0.4], [0.02, base - R * 1.1, 0.2, 0.1]]) ellipse(p, x, y, R * r * 0.75, R * r, a); spines(p, [-R * 0.6, base - R * 1.35, R * 0.6, base]); }
    else {
      const p = P2(); col(p, 0, base, base - tall * 0.95, R * 0.34);
      if (f !== 'a column') { col(p, -R * 0.38, base - tall * 0.32, base - tall * 0.72, R * 0.2); p.rect(-R * 0.38, base - tall * 0.42, R * 0.3, R * 0.12); col(p, R * 0.38, base - tall * 0.22, base - tall * 0.6, R * 0.2); p.rect(R * 0.08, base - tall * 0.32, R * 0.3, R * 0.12); }
      spines(p, [-R * 0.5, base - tall, R * 0.5, base]);
      for (const x of [-R * 0.07, R * 0.07]) line(ctx, [[x, base - tall * 0.9], [x, base]], px, C.dark(0.5));
    }
    if (ph.display > 0.45) flower(ctx, 0, f === 'a barrel' ? base - R * 0.92 : f === 'pads' ? base - R * 1.3 : base - tall * 0.97, R * 0.13, 'cup flowers', C);
    return;
  }
  if (gr === 'vine') {
    // a vine twining up a tree trunk
    ctx.fillStyle = C.wood; ctx.fillRect(-R * 0.12, base - tall, R * 0.24, tall);
    ctx.strokeStyle = C.dark(0.4); ctx.lineWidth = px; for (let k = 0; k < 4; k++) line(ctx, [[-R * 0.06 + k * R * 0.04, base], [-R * 0.06 + k * R * 0.04, base - tall]], px * 0.7, C.dark(0.25));
    const pts = []; for (let k = 0; k <= 24; k++) pts.push([Math.sin(k * 0.85) * R * 0.22, base - (tall * k) / 24]);
    line(ctx, pts, Math.max(px, R * 0.04), C.dark);
    for (let k = 1; k < 11; k++) {
      const y = base - (tall * k) / 11, x = Math.sin(k * 1.9) * R * 0.26 + (k % 2 ? R * 0.16 : -R * 0.16), s = R * 0.13;
      const p = P2();
      if (f === 'lobed leaves') for (let j = -1; j <= 1; j++) ellipse(p, x + j * s * 0.45, y - Math.abs(j) * s * 0.1 + (j ? 0 : -s * 0.2), s * 0.45, s * 0.6, j * 0.5);
      else { p.moveTo(x, y + s * 0.8); p.bezierCurveTo(x - s * 1.2, y, x - s * 0.5, y - s * 0.9, x, y - s * 0.35); p.bezierCurveTo(x + s * 0.5, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.8); }
      ctx.fillStyle = k % 2 ? C.body : C.light; ctx.fill(p);
    }
    if (ph.display > 0.45 || f === 'trumpet flowers') for (let k = 2; k < 10; k += 3) {
      const x = Math.sin(k * 1.8) * R * 0.32, y = base - (tall * k) / 10;
      if (f === 'trumpet flowers') { const p = P2(); p.moveTo(x, y); p.lineTo(x + R * 0.18, y - R * 0.08); p.lineTo(x + R * 0.18, y + R * 0.1); p.closePath(); ctx.fillStyle = C.accent; ctx.fill(p); }
      else flower(ctx, x, y, R * 0.08, 'daisy flowers', C);
    }
    return;
  }
  // trees: conifers, and flowering plants that grew tall
  if (gr === 'conifer' || (gr === 'flower' && ph.size > 0.45)) {
    const b = L.build, conifer = gr === 'conifer';
    // crown shape: narrow → classic → spreading → umbrella (→ palm, for flowering trees)
    const shape = conifer ? (b < 0.3 ? 'spire' : b < 0.72 ? 'cone' : 'umbrella') : ['column', 'round', 'spreading', 'umbrella', 'palm'][Math.min(4, Math.floor(b * 5))];
    const trunkTop = base - tall * (shape === 'umbrella' ? 0.78 : shape === 'palm' ? 0.85 : 0.28 + 0.24 * L.snout);
    const wide = 0.78 + 0.45 * L.reach;
    const tw = R * (0.08 + 0.06 * ph.size);
    // trunk, slightly tapered, with a couple of branches for spreading crowns
    const tp = P2(); tp.moveTo(-tw, base); tp.quadraticCurveTo(-tw * 0.6, (base + trunkTop) / 2, -tw * 0.5, trunkTop); tp.lineTo(tw * 0.5, trunkTop); tp.quadraticCurveTo(tw * 0.6 + (shape === 'palm' ? R * 0.2 : 0), (base + trunkTop) / 2, tw, base); tp.closePath();
    skin(ctx, tp, { ...C, body: C.wood, line: C.wood(1, -0.15) }, null, rng, [-tw, trunkTop, tw, base], px, { pattern: false });
    if (shape === 'spreading' || shape === 'umbrella') for (const s of [-1, 1]) curve(ctx, 0, trunkTop + R * 0.15, s * R * 0.2, trunkTop - R * 0.05, s * R * 0.45, trunkTop - R * 0.18, tw * 0.6, C.wood);
    if (conifer) {
      ctx.fillStyle = C.dark;
      const tiers = shape === 'umbrella' ? 2 : (shape === 'spire' ? 4 : 3) + Math.round(L.tail * 3);
      const lowest = (base - trunkTop) / tall;
      for (let k = 0; k < tiers; k++) {
        let y, w, hgt;
        if (shape === 'umbrella') { y = base - tall * (0.62 + k * 0.12); w = R * (0.85 - k * 0.25) * wide; hgt = R * 0.32; }
        else { y = base - tall * (lowest * 0.8 + k * ((0.98 - lowest * 0.8) / tiers)); w = R * (shape === 'spire' ? 0.3 - k * 0.15 / tiers : 0.8 - k * 0.55 / tiers) * wide; hgt = tall * (shape === 'spire' ? 0.3 : 0.24 + 0.5 / tiers); }
        const p = P2(); p.moveTo(-w, y); p.quadraticCurveTo(-w * 0.3, y - hgt * 0.3, 0, y - hgt); p.quadraticCurveTo(w * 0.3, y - hgt * 0.3, w, y);
        if (f === 'drooping needles') { p.lineTo(w * 0.9, y + R * 0.08); p.lineTo(w * 0.6, y + R * 0.02); p.lineTo(w * 0.3, y + R * 0.07); p.lineTo(0, y + R * 0.02); p.lineTo(-w * 0.3, y + R * 0.07); p.lineTo(-w * 0.6, y + R * 0.02); p.lineTo(-w * 0.9, y + R * 0.08); }
        p.closePath();
        skin(ctx, p, { ...C, body: k % 2 ? C.body(1, -0.06) : C.dark(1, 0.04), line: C.dark(1, -0.1) }, null, rng, [-w, y - hgt, w, y], px, { pattern: false });
        if (f !== 'drooping needles' && R > 14) for (let j = 0; j < 2; j++) { const cx = (j ? 0.45 : -0.4) * w, cy = y - R * 0.04; ctx.fillStyle = C.wood(1, 0.12); ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.04, R * (f === 'big cones' ? 0.045 : 0.025), R * (f === 'big cones' ? 0.09 : 0.05), 0, 0, TAU); ctx.fill(); }
      }
      return;
    }
    let crownPath;
    if (shape === 'palm') {
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI, ex = Math.cos(a) * R * 0.75, ey = trunkTop + Math.sin(a) * R * 0.35 + R * 0.25;
        curve(ctx, 0, trunkTop, ex * 0.5, trunkTop - R * 0.3, ex, ey, R * 0.06, k % 2 ? C.body : C.light);
        for (let j = 1; j < 6; j++) { const t = j / 6, qx = 2 * (1 - t) * t * ex * 0.5 + t * t * ex, qy = (1 - t) * (1 - t) * trunkTop + 2 * (1 - t) * t * (trunkTop - R * 0.3) + t * t * ey; line(ctx, [[qx, qy], [qx + R * 0.02, qy + R * 0.12]], px * 1.2, C.body); }
      }
      if (ph.display > 0.6) for (let k = 0; k < 3; k++) dot(ctx, (k - 1) * R * 0.08, trunkTop + R * 0.08, R * 0.06, C.fruit);
      return;
    }
    const cw = Math.min(1, wide * 0.85);
    if (shape === 'column') crownPath = crown(ctx, 0, base - tall * 0.66, R * 0.36 * cw, tall * 0.42, C, rng, 6);
    else if (shape === 'round') crownPath = crown(ctx, 0, base - tall * 0.7, R * 0.72 * cw, tall * 0.36, C, rng, 7);
    else if (shape === 'spreading') crownPath = crown(ctx, 0, base - tall * 0.66, R * 0.95 * cw, tall * 0.3, C, rng, 9);
    else crownPath = crown(ctx, 0, base - tall * 0.86, R * 0.98 * cw, R * 0.2, C, rng, 8);
    if (ph.display > 0.6) {
      ctx.save(); ctx.clip(crownPath);
      for (let k = 0; k < 9; k++) flower(ctx, (rng() - 0.5) * R * 1.6, base - tall * (shape === 'umbrella' ? 0.9 : 0.72) + (rng() - 0.5) * tall * 0.45, R * 0.07, f, C, rng());
      ctx.restore();
    }
    return;
  }
  // a herb (one to three stems), with the species' flower form
  const stems = 1 + Math.round(L.build * 2);
  for (let s = 0; s < stems; s++) {
    const x0 = (s - (stems - 1) / 2) * R * 0.38, h = tall * (s === Math.floor(stems / 2) ? 0.9 : 0.7), lean = (s - (stems - 1) / 2) * R * 0.15;
    const top = [x0 + lean, base - h];
    curve(ctx, x0, base, x0 + R * 0.08, base - h * 0.5, top[0], top[1], Math.max(px, R * 0.05), C.dark);
    for (const d of [-1, 1]) {
      const ly = base - h * (0.25 + 0.15 * (d + 1)), lx = x0 + d * R * 0.2;
      const p = P2(); p.moveTo(x0, ly + R * 0.05); p.quadraticCurveTo(lx, ly - R * 0.15, lx + d * R * 0.12, ly - R * 0.05); p.quadraticCurveTo(lx, ly + R * 0.08, x0, ly + R * 0.05);
      ctx.fillStyle = C.body; ctx.fill(p);
    }
    const fs = R * (0.14 + 0.1 * L.patSize) * (stems > 1 ? 0.85 : 1);
    if (f === 'bell flowers') { curve(ctx, top[0], top[1], top[0] + R * 0.15, top[1] - R * 0.05, top[0] + R * 0.2, top[1] + R * 0.05, px * 1.4, C.dark); flower(ctx, top[0] + R * 0.2, top[1] + R * 0.15, fs * 0.8, f, C); flower(ctx, top[0] - R * 0.05, top[1] + R * 0.25, fs * 0.6, f, C); }
    else flower(ctx, top[0], top[1] - (f === 'flower spikes' ? fs * 0.8 : 0), fs, f, C, s);
  }
}

// ---------- fungi and lichens ----------

function drawFungus(ctx, sp, R, C, rng, L) {
  const base = R * 0.82, f = L.ornament, px = Math.max(0.6, R / 40);
  ctx.lineCap = 'round';
  if (sp.grade === 'lichen') {
    // on a rock: crusts, leafy lobes, shrubby tufts or hanging beards
    if (f === 'beards') {
      ctx.fillStyle = C.wood || '#5a4632'; ctx.fillRect(-R, -R * 0.75, R * 2, R * 0.18);
      for (let i = 0; i < 9; i++) { const x = -R * 0.8 + i * R * 0.2; const pts = [[x, -R * 0.6]]; for (let k = 1; k < 7; k++) pts.push([x + Math.sin(k + i) * R * 0.06, -R * 0.6 + k * R * (0.18 + 0.05 * rng())]); line(ctx, pts, Math.max(px, R * 0.04), i % 2 ? '#b9c4a0' : '#9fb08a'); }
      return;
    }
    ctx.fillStyle = '#6d6a66'; ctx.fill(blobPath(P2(), 0, R * 0.25, R * 0.88, R * 0.58, rng, 0.12, 9));
    const tint = [T(0.18, 0.5, 0.58), T(0.09, 0.7, 0.55), T(0.4, 0.2, 0.62), T(0.14, 0.75, 0.6)][Math.floor(L.hue * 4) % 4];
    for (let i = 0; i < 10; i++) {
      const x = (rng() - 0.5) * R * 1.1, y = R * 0.15 + (rng() - 0.6) * R * 0.6;
      if (f === 'shrubby tufts') { for (let k = 0; k < 4; k++) line(ctx, [[x, y], [x + (k - 1.5) * R * 0.05, y - R * (0.15 + 0.1 * rng())]], Math.max(px, R * 0.035), tint); }
      else if (f === 'leafy lobes') { ctx.fillStyle = i % 3 ? tint : tint(1, 0.12); ctx.fill(blobPath(P2(), x, y, R * 0.16, R * 0.1, rng, 0.45, 9)); }
      else { ctx.fillStyle = i % 3 ? tint : tint(1, -0.1); ctx.fill(blobPath(P2(), x, y, R * (0.1 + 0.1 * rng()), R * (0.07 + 0.06 * rng()), rng, 0.3, 7)); }
    }
    return;
  }
  if (sp.grade === 'fungi') {
    for (let i = 0; i < 9; i++) {
      const pts = []; let x = (rng() - 0.5) * R * 1.4, y = base; pts.push([x, y]);
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * R * 0.5; y -= R * 0.3; pts.push([x, y]); }
      line(ctx, pts, Math.max(px, R * 0.04), C.light);
      if (f === 'tufts') for (let k = 0; k < 4; k++) line(ctx, [[x, y], [x + (k - 1.5) * R * 0.06, y - R * 0.1]], px, C.light); else dot(ctx, x, y, R * 0.08, C.body);
    }
    return;
  }
  // mushrooms: a cap (dome, flat, pointed), brackets on a log, a puffball or coral branches
  if (f === 'brackets') {
    const p = P2(); p.roundRect(-R * 0.3, -R * 0.9, R * 0.6, R * 1.8, R * 0.08);
    skin(ctx, p, { ...C, body: T(0.07, 0.3, 0.3), line: T(0.07, 0.3, 0.2) }, null, rng, [-R * 0.3, -R * 0.9, R * 0.3, R * 0.9], px, { pattern: false });
    for (const [y, w] of [[-R * 0.35, 0.55], [R * 0.1, 0.7], [R * 0.5, 0.5]]) {
      const q = P2(); q.moveTo(R * 0.25, y - R * 0.12); q.quadraticCurveTo(R * (0.3 + w), y - R * 0.12, R * (0.3 + w), y + R * 0.02); q.quadraticCurveTo(R * 0.6, y + R * 0.08, R * 0.25, y + R * 0.06); q.closePath();
      skin(ctx, q, C, L, rng, [R * 0.25, y - R * 0.12, R * (0.3 + w), y + R * 0.08], px, { pattern: false });
      for (let k = 1; k < 3; k++) curve(ctx, R * 0.3, y - R * 0.12 + k * R * 0.05, R * (0.3 + w * 0.8), y - R * 0.1 + k * R * 0.04, R * (0.28 + w), y + k * R * 0.02, px, C.dark(0.5));
    }
    return;
  }
  if (f === 'a puffball') {
    for (const [x, r] of [[-R * 0.3, 0.42], [R * 0.35, 0.3]]) { const p = ellipse(P2(), x, base - R * r * 0.85, R * r, R * r * 0.85); skin(ctx, p, C, L, rng, [x - R * r, base - R * r * 1.7, x + R * r, base], px, { u: R * 0.08 }); }
    return;
  }
  if (f === 'coral branches') {
    const br = (x, y, a, len, d) => { if (d > 3) return; const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; line(ctx, [[x, y], [ex, ey]], R * (0.12 - d * 0.022), d % 2 ? C.body : C.body(1, 0.06)); br(ex, ey, a - 0.4, len * 0.75, d + 1); br(ex, ey, a + 0.4, len * 0.75, d + 1); };
    br(0, base, -Math.PI / 2, R * 0.45, 0);
    return;
  }
  const n = sp.genes[GI.size] > 0.5 ? 1 : 2 + (L.build > 0.6 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 1 : [0.9, 0.7, 0.55][i], x = n === 1 ? 0 : [-R * 0.25, R * 0.38, -R * 0.62][i];
    const stemH = R * (0.45 + 0.55 * L.reach) * s, top = base - stemH, cw = R * 0.55 * s * (0.8 + 0.4 * L.build);
    const sp_ = P2(); sp_.roundRect(x - R * 0.09 * s, top, R * 0.18 * s, stemH, R * 0.06 * s);
    skin(ctx, sp_, { ...C, body: C.light, line: C.dark(0.6) }, null, rng, [x - R * 0.1, top, x + R * 0.1, base], px, { pattern: false });
    if (L.ornament && L.oi === 1) line(ctx, [[x - R * 0.12 * s, top + stemH * 0.3], [x + R * 0.12 * s, top + stemH * 0.3]], R * 0.04 * s, C.light(1, -0.1));
    const cp = P2();
    if (f === 'a pointed cap') { cp.moveTo(x - cw * 0.75, top + R * 0.02); cp.quadraticCurveTo(x - cw * 0.5, top - R * 0.5 * s, x, top - R * 0.75 * s); cp.quadraticCurveTo(x + cw * 0.5, top - R * 0.5 * s, x + cw * 0.75, top + R * 0.02); cp.closePath(); }
    else if (f === 'a flat cap') { cp.moveTo(x - cw * 1.1, top + R * 0.04); cp.quadraticCurveTo(x - cw, top - R * 0.2 * s, x, top - R * 0.22 * s); cp.quadraticCurveTo(x + cw, top - R * 0.2 * s, x + cw * 1.1, top + R * 0.04); cp.closePath(); }
    else { cp.moveTo(x - cw, top + R * 0.02); cp.bezierCurveTo(x - cw, top - R * 0.55 * s, x + cw, top - R * 0.55 * s, x + cw, top + R * 0.02); cp.closePath(); }
    skin(ctx, cp, C, L.pattern === 'spots' || L.pattern === 'mottled' ? L : null, rng, [x - cw * 1.1, top - R * 0.75 * s, x + cw * 1.1, top + R * 0.04], px, { u: R * 0.1 * s });
    ctx.strokeStyle = C.dark(0.45); ctx.lineWidth = px * 0.8;
    for (let k = -3; k <= 3; k++) line(ctx, [[x + k * cw * 0.12, top + R * 0.03], [x + k * cw * 0.2, top + R * 0.06]], px * 0.8, C.dark(0.5));
  }
}

// ---------- invertebrates ----------

function drawRadial(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, g = sp.genes, gr = sp.grade, f = L.ornament, px = Math.max(0.6, R / 40);
  ctx.lineCap = 'round';
  if (gr === 'starfish') {
    if (f === 'an urchin') {
      for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; line(ctx, [[Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.32 + R * 0.1], [Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.85 + R * 0.1]], Math.max(px, R * 0.03), k % 2 ? C.dark : C.accent); }
      const p = ellipse(P2(), 0, R * 0.12, R * 0.48, R * 0.38);
      skin(ctx, p, C, L, rng, [-R * 0.48, -R * 0.26, R * 0.48, R * 0.5], px, { u: R * 0.08 });
      return;
    }
    const arms = f === 'many arms' ? 8 + Math.round(L.build * 6) : 5, thin = f === 'thin arms';
    const inner = thin ? R * 0.22 : R * (0.24 + 0.12 * L.build), outer = R * 0.9;
    const p = P2();
    if (thin) {
      ellipse(p, 0, 0, inner, inner);
      skin(ctx, p, C, L, rng, [-inner, -inner, inner, inner], px, { u: R * 0.06 });
      for (let k = 0; k < arms; k++) { const a = -Math.PI / 2 + (k / arms) * TAU, pts = []; for (let j = 0; j <= 8; j++) { const t = j / 8, r = inner + (outer - inner) * t; pts.push([Math.cos(a + Math.sin(t * 4 + k) * 0.25) * r, Math.sin(a + Math.sin(t * 4 + k) * 0.25) * r]); } limb(ctx, pts, R * 0.07 * (1 - 0.3), C.body, C.line, px); }
      return;
    }
    for (let k = 0; k <= arms * 2; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / arms, r = k % 2 ? inner : outer;
      if (k === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else { const am = a - Math.PI / arms / 2, rm = (r + (k % 2 ? outer : inner)) * 0.5; p.quadraticCurveTo(Math.cos(am) * rm * 1.05, Math.sin(am) * rm * 1.05, Math.cos(a) * r, Math.sin(a) * r); }
    }
    p.closePath();
    skin(ctx, p, C, L, rng, [-R, -R, R, R], px, { u: R * 0.08, shade: false });
    ctx.save(); ctx.clip(p);
    const g2 = ctx.createRadialGradient(-R * 0.2, -R * 0.2, 0, 0, 0, R); g2.addColorStop(0, 'rgba(255,255,255,0.25)'); g2.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = g2; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    for (let k = 0; k < arms; k++) { const a = -Math.PI / 2 + (k * TAU) / arms; for (let j = 1; j < 5; j++) dot(ctx, Math.cos(a) * R * 0.17 * j, Math.sin(a) * R * 0.17 * j, R * 0.03, C.light); }
    ctx.restore();
    return;
  }
  if (!ph.motile) {
    // sponges and corals: a vase, branches, a fan, a brain shape or a cluster of tubes
    ctx.fillStyle = '#5a5248'; ctx.beginPath(); ctx.ellipse(0, R * 0.9, R * 0.7, R * 0.1, 0, 0, TAU); ctx.fill();
    const coral = ph.partner === 'algae', base = R * 0.88;
    const polyps = (path, box) => { if (!coral) return; ctx.save(); ctx.clip(path); for (let k = 0; k < 40; k++) dot(ctx, box[0] + rng() * (box[2] - box[0]), box[1] + rng() * (box[3] - box[1]), R * 0.025, C.light); ctx.restore(); };
    if (f === 'branches') {
      const br = (x, y, a, len, d) => { if (d > 3) return; const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; limb(ctx, [[x, y], [ex, ey]], R * (0.15 - d * 0.025), C.body, C.line, px); br(ex, ey, a - 0.5 + 0.2 * L.build, len * 0.72, d + 1); br(ex, ey, a + 0.45, len * 0.72, d + 1); };
      br(0, base, -Math.PI / 2, R * 0.55, 0);
      if (coral) for (let k = 0; k < 18; k++) dot(ctx, (rng() - 0.5) * R * 1.4, base - rng() * R * 1.5, R * 0.025, C.light);
    } else if (f === 'a fan') {
      const p = P2(); p.moveTo(0, base); p.lineTo(-R * 0.85, -R * 0.35); p.quadraticCurveTo(0, -R * 1.05, R * 0.85, -R * 0.35); p.closePath();
      ctx.fillStyle = C.body(0.85); ctx.fill(p);
      for (let k = -6; k <= 6; k++) line(ctx, [[0, base], [k * R * 0.13, -R * 0.55 - Math.cos(k / 6) * R * 0.2]], px * 1.2, C.dark);
      for (let k = 1; k < 5; k++) { ctx.strokeStyle = C.dark(0.6); ctx.lineWidth = px; ctx.beginPath(); ctx.arc(0, base, R * 0.3 * k, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke(); }
    } else if (f === 'a brain shape') {
      const p = P2(); p.moveTo(-R * 0.8, base); p.bezierCurveTo(-R * 0.85, -R * 0.2, R * 0.85, -R * 0.2, R * 0.8, base); p.closePath();
      skin(ctx, p, C, null, rng, [-R * 0.8, -R * 0.1, R * 0.8, base], px, { pattern: false, texture: () => { ctx.strokeStyle = C.dark(0.6); ctx.lineWidth = px * 1.3; for (let k = 0; k < 7; k++) { ctx.beginPath(); let x = -R * 0.8, y = base - k * R * 0.14; ctx.moveTo(x, y); for (let j = 0; j < 12; j++) { x += R * 0.14; ctx.lineTo(x, y + Math.sin(j * 1.7 + k) * R * 0.06); } ctx.stroke(); } } });
    } else if (f === 'tubes') {
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * R * 0.3, h = R * (0.9 + 0.7 * rng()), w = R * 0.13;
        const p = P2(); p.roundRect(x - w, base - h, w * 2, h, w * 0.4);
        skin(ctx, p, C, L, rng, [x - w, base - h, x + w, base], px, { u: R * 0.06 });
        ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(x, base - h + R * 0.02, w * 0.8, R * 0.04, 0, 0, TAU); ctx.fill();
      }
    } else {
      const w = R * (0.35 + 0.25 * L.build);
      const p = P2(); p.moveTo(-w * 0.55, base); p.quadraticCurveTo(-w * 1.25, -R * 0.1, -w, -R * 0.6); p.quadraticCurveTo(0, -R * 0.72, w, -R * 0.6); p.quadraticCurveTo(w * 1.25, -R * 0.1, w * 0.55, base); p.closePath();
      skin(ctx, p, C, L, rng, [-w * 1.25, -R * 0.7, w * 1.25, base], px, { u: R * 0.07, texture: () => { for (let k = 0; k < 12; k++) dot(ctx, (rng() - 0.5) * w * 1.8, (rng() - 0.3) * R * 1.2, R * 0.035, C.dark(0.6)); } });
      ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(0, -R * 0.6, w * 0.75, R * 0.08, 0, 0, TAU); ctx.fill();
      polyps(p, [-w, -R * 0.6, w, base]);
    }
    return;
  }
  // jellies: a bell (flat to tall) with tentacles; or a comb jelly
  const bh = R * (0.3 + 0.35 * L.build), bw = R * (0.72 - 0.15 * L.build);
  const bellCol = T(L.hue, 0.5, 0.68);
  if (f === 'comb rows') {
    const p = ellipse(P2(), 0, 0, R * 0.42, R * 0.7);
    ctx.fillStyle = bellCol(0.45); ctx.fill(p); ctx.strokeStyle = bellCol(0.9, -0.2); ctx.lineWidth = px * 1.2; ctx.stroke(p);
    for (let k = 0; k < 4; k++) { const x = (k - 1.5) * R * 0.2; for (let j = 0; j < 9; j++) { const y = -R * 0.55 + j * R * 0.13, hue = (j / 9 + k * 0.1) % 1; dot(ctx, x * Math.cos(y / R), y, R * 0.035, hsl(hue, 0.9, 0.65)); } }
    return;
  }
  const top = -R * 0.55, rim = top + bh;
  const p = P2(); p.moveTo(-bw, rim);
  if (f === 'a crested bell') { p.bezierCurveTo(-bw, top - bh * 0.2, -bw * 0.2, top - bh * 0.3, 0, top - bh * 0.6); p.bezierCurveTo(bw * 0.2, top - bh * 0.3, bw, top - bh * 0.2, bw, rim); }
  else p.bezierCurveTo(-bw, top - bh * 0.35, bw, top - bh * 0.35, bw, rim);
  for (let k = 8; k >= 0; k--) p.lineTo(-bw + (2 * bw * k) / 8, rim + (k % 2 ? R * 0.05 : 0));
  p.closePath();
  const n = 4 + Math.round(g[GI.segments] * 6), long = f === 'long tentacles';
  for (let i = 0; i < n; i++) {
    const x = -bw * 0.9 + (i * bw * 1.8) / (n - 1), pts = [[x, rim]];
    for (let k = 1; k <= 8; k++) pts.push([x + Math.sin(k * 0.9 + i) * R * 0.06, rim + k * R * (long ? 0.13 : 0.08)]);
    line(ctx, pts, Math.max(px * 0.8, R * 0.018), bellCol(0.75, 0.05));
  }
  if (f === 'frilly arms') for (let i = 0; i < 3; i++) { const x = (i - 1) * bw * 0.3, pts = []; for (let k = 0; k <= 10; k++) pts.push([x + Math.sin(k * 1.4 + i) * R * 0.07, rim + k * R * 0.07]); limb(ctx, pts, R * 0.07, C.accent(0.75), null, px); }
  ctx.fillStyle = bellCol(0.6); ctx.fill(p); ctx.strokeStyle = bellCol(0.9, -0.2); ctx.lineWidth = px * 1.2; ctx.stroke(p);
  ctx.save(); ctx.clip(p);
  markings(ctx, L, { ...C, pat: C.accent(0.7) }, rng, -bw, top - bh * 0.6, bw, rim, R * 0.1, { pat: C.accent(0.7) });
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-bw * 0.3, top + bh * 0.1, bw * 0.3, bh * 0.25, -0.4, 0, TAU); ctx.fill();
  for (let k = 0; k < 4; k++) { ctx.strokeStyle = C.accent(0.6); ctx.lineWidth = px * 1.5; ctx.beginPath(); ctx.arc((k - 1.5) * bw * 0.3, rim - bh * 0.25, bw * 0.12, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

function drawWorm(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament, px = Math.max(0.6, R / 40);
  const n = Math.max(6, ph.segments + 4), th = R * (0.1 + 0.1 * L.build);
  if (f === 'feathery gills') {
    // a fan worm: a tube with a crown of feathery gills
    const p = P2(); p.roundRect(-R * 0.12, -R * 0.05, R * 0.24, R * 0.95, R * 0.1);
    skin(ctx, p, { ...C, body: T(0.08, 0.2, 0.55), line: T(0.08, 0.2, 0.3) }, null, rng, [-R * 0.12, -R * 0.05, R * 0.12, R * 0.9], px, { pattern: false });
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.28, ex = Math.cos(a) * R * 0.85, ey = -R * 0.05 + Math.sin(a) * R * 0.85;
      line(ctx, [[0, -R * 0.05], [ex, ey]], px * 1.4, k % 2 ? C.accent : C.body);
      for (let j = 1; j < 7; j++) { const t = j / 7, x = ex * t, y = -R * 0.05 + (ey + R * 0.05) * t; line(ctx, [[x, y], [x + Math.cos(a + 1.3) * R * 0.06, y + Math.sin(a + 1.3) * R * 0.06]], px, k % 2 ? C.accent(0.8) : C.body(0.8)); }
    }
    return;
  }
  const pts = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push([-R * 0.85 + t * R * 1.6, Math.sin(t * 5 + L.tail * 2) * R * 0.22 * (f === 'frills' ? 0.4 : 1)]); }
  // flatworms (frills) are wide and flat; others round in section
  const wid = (i) => th * (f === 'frills' ? 2.2 : 1) * (0.7 + 0.3 * Math.sin((i / (n - 1)) * Math.PI));
  if (f === 'bristles') for (let i = 1; i < n - 1; i++) { const [x, y] = pts[i]; for (const s of [-1, 1]) line(ctx, [[x, y], [x - R * 0.04, y + s * (wid(i) + R * 0.12)]], px, C.accent(0.9)); }
  const body = P2();
  for (let i = 0; i < n; i++) ellipse(body, pts[i][0], pts[i][1], wid(i) * 1.05, wid(i));
  skin(ctx, body, C, L, rng, [-R, -R * 0.5, R, R * 0.5], px, { u: th * 0.8, texture: () => { for (let i = 1; i < n; i++) { ctx.strokeStyle = C.dark(0.35); ctx.lineWidth = px; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], wid(i), Math.PI * 0.6, Math.PI * 1.4); ctx.stroke(); } } });
  const [hx, hy] = pts[n - 1];
  if (f === 'tentacles') for (let k = 0; k < 4; k++) curve(ctx, hx, hy, hx + R * 0.15, hy + (k - 1.5) * R * 0.08, hx + R * 0.25, hy + (k - 1.5) * R * 0.18, px * 1.5, C.body);
  if (f === 'frills') { ctx.strokeStyle = C.accent; ctx.lineWidth = px * 1.5; ctx.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = pts[i]; ctx[i ? 'lineTo' : 'moveTo'](x, y - wid(i) * (i % 2 ? 1.02 : 0.9)); } ctx.stroke(); }
  if (ph.brain > 0.25) eye(ctx, hx + th * 0.2, hy - th * 0.35, Math.max(px, th * 0.28), 'bug');
}

function drawMollusc(ctx, sp, R, C, rng, L) {
  const f = L.ornament, px = Math.max(0.6, R / 40), wet = sp.habitat === 0;
  ctx.lineCap = 'round';
  const shellC = { ...C, body: C.light(1, -0.05), pat: L.showy ? C.accent : C.dark, line: C.dark };
  if (f === 'two valves') {
    // a clam: two ribbed valves, with a siphon
    curve(ctx, -R * 0.55, -R * 0.05, -R * 0.75, -R * 0.4, -R * 0.65, -R * 0.62, R * 0.08, C.belly || C.body);
    const p = P2(); p.moveTo(-R * 0.75, R * 0.1); p.bezierCurveTo(-R * 0.8, -R * 0.65, R * 0.8, -R * 0.65, R * 0.75, R * 0.1); p.quadraticCurveTo(0, R * 0.42, -R * 0.75, R * 0.1);
    skin(ctx, p, shellC, L, rng, [-R * 0.8, -R * 0.5, R * 0.8, R * 0.35], px, { u: R * 0.1, stripesAlong: true, texture: () => { for (let k = -5; k <= 5; k++) line(ctx, [[k * R * 0.02, R * 0.32], [k * R * 0.15, -R * 0.55]], px, C.dark(0.4)); } });
    return;
  }
  // the foot and head
  const foot = P2(); foot.moveTo(-R * 0.85, R * 0.55); foot.quadraticCurveTo(0, R * 0.32, R * 0.6, R * 0.38); foot.quadraticCurveTo(R * 0.85, R * 0.4, R * 0.9, R * 0.6); foot.closePath();
  skin(ctx, foot, { ...C, body: C.belly || C.body }, null, rng, [-R * 0.85, R * 0.32, R * 0.9, R * 0.6], px, { pattern: false });
  if (wet && (f === 'a flat coil')) for (let k = 0; k < 6; k++) curve(ctx, R * 0.45, R * 0.15, R * 0.75, R * (0.05 + k * 0.08), R * (0.85 + 0.05 * Math.sin(k)), R * (0.2 + k * 0.1), px * 2, C.body);
  else { curve(ctx, R * 0.62, R * 0.4, R * 0.72, R * 0.15, R * 0.82, R * -0.05, px * 2, C.belly || C.body); curve(ctx, R * 0.55, R * 0.4, R * 0.6, R * 0.2, R * 0.62, R * 0.05, px * 2, C.belly || C.body); dot(ctx, R * 0.82, -R * 0.07, px * 1.5, '#111'); }
  if (f === 'a tall spire' || f === 'a cone shell') {
    const cone = f === 'a cone shell';
    const p = P2();
    if (cone) { p.moveTo(-R * 0.75, R * 0.35); p.lineTo(R * 0.35, R * 0.1); p.quadraticCurveTo(R * 0.55, R * 0.25, R * 0.35, R * 0.48); p.closePath(); }
    else { p.moveTo(-R * 0.15, R * 0.48); p.lineTo(-R * 0.6, -R * 0.75); p.lineTo(R * 0.45, R * 0.45); p.closePath(); }
    skin(ctx, p, shellC, L, rng, [-R * 0.75, -R * 0.75, R * 0.55, R * 0.5], px, { u: R * 0.08, texture: () => { if (!cone) for (let k = 1; k < 6; k++) line(ctx, [[-R * 0.6 + k * R * 0.1, -R * 0.75 + k * R * 0.24], [-R * 0.15 + k * R * 0.12, R * 0.48 - (6 - k) * R * 0.01]], px * 1.1, C.dark(0.6)); } });
    return;
  }
  // a coiled shell (flat coils are ammonite-like, with ribs)
  const cx = -R * 0.1, cy = R * 0.02, r0 = R * (f === 'a flat coil' ? 0.55 : 0.5);
  const p = ellipse(P2(), cx, cy, r0, r0);
  skin(ctx, p, shellC, L, rng, [cx - r0, cy - r0, cx + r0, cy + r0], px, { u: R * 0.08, texture: () => {
    ctx.strokeStyle = C.dark(0.7); ctx.lineWidth = px * 1.4; ctx.beginPath();
    for (let k = 0; k < 40; k++) { const a = k * 0.35, r = r0 * 0.92 * (1 - k / 44); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    if (f === 'a flat coil') for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; line(ctx, [[cx + Math.cos(a) * r0 * 0.55, cy + Math.sin(a) * r0 * 0.55], [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]], px, C.dark(0.35)); }
  } });
  if (f === 'a spiny shell') for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.95 + (k / 8) * Math.PI * 1.1; tri(ctx, cx + Math.cos(a - 0.12) * r0, cy + Math.sin(a - 0.12) * r0, cx + Math.cos(a) * r0 * 1.45, cy + Math.sin(a) * r0 * 1.45, cx + Math.cos(a + 0.12) * r0, cy + Math.sin(a + 0.12) * r0, C.light(1, -0.12)); }
}

function drawSquid(ctx, sp, R, C, rng, L) {
  const f = L.ornament, px = Math.max(0.6, R / 40);
  ctx.lineCap = 'round';
  if (f === 'eight arms') {
    // an octopus: a rounded mantle above eight curling arms
    for (let i = 0; i < 8; i++) {
      const a0 = 0.35 + (i / 7) * (Math.PI - 0.7), pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, a = a0 + Math.sin(t * 3 + i) * 0.4 * t, r = R * (0.15 + 0.75 * t); pts.push([Math.cos(a) * r * 1.1, R * 0.05 + Math.sin(a) * r * 0.85 - t * t * R * 0.1 * (i % 3)]); }
      ctx.lineWidth = R * 0.11; limb(ctx, pts, R * 0.1 * (0.9), i % 2 ? C.body : C.body(1, -0.04), C.line, px);
    }
    const p = P2(); p.moveTo(-R * 0.4, R * 0.15); p.bezierCurveTo(-R * 0.6, -R * 0.9, R * 0.6, -R * 0.9, R * 0.4, R * 0.15); p.closePath();
    skin(ctx, p, C, L, rng, [-R * 0.55, -R * 0.75, R * 0.55, R * 0.2], px, { u: R * 0.09 });
    eye(ctx, R * 0.22, R * 0.02, R * 0.08, 'reptile'); eye(ctx, -R * 0.2, R * 0.02, R * 0.07, 'reptile');
    return;
  }
  // a squid or cuttlefish: a mantle with fins, arms forward
  const long = f === 'long tentacles';
  for (let i = 0; i < 6; i++) { const y0 = -R * 0.12 + i * R * 0.05; limb(ctx, [[R * 0.25, y0], [R * 0.55, y0 + (i - 2.5) * R * 0.04], [R * 0.8, y0 + (i - 2.5) * R * 0.1]], R * 0.06, C.body, C.line, px); }
  if (long) for (const s of [-1, 1]) { line(ctx, [[R * 0.25, 0], [R * 0.95, s * R * 0.25]], px * 1.6, C.body); dot(ctx, R * 0.95, s * R * 0.25, R * 0.05, C.body); }
  const mw = R * (0.2 + 0.12 * L.build);
  const p = P2(); p.moveTo(-R * 0.9, 0); p.quadraticCurveTo(-R * 0.2, -mw * 1.6, R * 0.28, -mw); p.lineTo(R * 0.28, mw); p.quadraticCurveTo(-R * 0.2, mw * 1.6, -R * 0.9, 0);
  if (f === 'frilly fins') { for (let k = 0; k <= 8; k++) { const x = -R * 0.75 + k * R * 0.12; ctx.fillStyle = C.accent(0.7); ctx.beginPath(); ctx.arc(x, -mw * (1.1 - Math.abs(k - 4) * 0.05), R * 0.07, Math.PI, 0); ctx.arc(x, mw * (1.1 - Math.abs(k - 4) * 0.05), R * 0.07, 0, Math.PI); ctx.fill(); } }
  else { tri(ctx, -R * 0.9, 0, -R * 0.55, -mw * 1.5, -R * 0.45, -mw * 0.3, C.dark); tri(ctx, -R * 0.9, 0, -R * 0.55, mw * 1.5, -R * 0.45, mw * 0.3, C.dark); }
  if (f === 'a crest') tri(ctx, -R * 0.3, -mw * 1.1, -R * 0.1, -mw * 1.9, R * 0.1, -mw * 0.9, C.accent);
  skin(ctx, p, C, L, rng, [-R * 0.9, -mw * 1.3, R * 0.3, mw * 1.3], px, { u: R * 0.07 });
  eye(ctx, R * 0.15, -R * 0.04, R * 0.09, 'reptile');
}

// arthropods, in their own units (body length 1) and fitted to the circle
function drawArthropod(ctx, sp, R, C, rng, L) {
  if (sp.grade === 'socialinsect') return drawColony(ctx, sp, R, C, rng, L);
  const gr = sp.grade;
  if (gr === 'arachnid') return drawArachnid(ctx, sp, R, C, rng, L);
  if (gr === 'myriapod') return drawMyriapod(ctx, sp, R, C, rng, L);
  if (gr === 'arthropod' || sp.habitat === 0) return drawCrustacean(ctx, sp, R, C, rng, L);
  return drawInsect(ctx, sp, R, C, rng, L);
}

function antenna(ctx, x, y, len, up, px, col, feathery) {
  const pts = [[x, y], [x + len * 0.4, y - len * up * 0.7], [x + len, y - len * up]];
  line(ctx, pts, px * 1.2, col);
  if (feathery) for (let k = 1; k < 6; k++) { const t = k / 6, ax = x + len * t, ay = y - len * up * t; line(ctx, [[ax, ay], [ax + len * 0.08, ay - len * 0.12]], px, col); line(ctx, [[ax, ay], [ax + len * 0.12, ay + len * 0.02]], px, col); }
}

function drawInsect(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament;
  const beetle = !ph.flying || L.build > 0.62 || ph.armour > 0.5;
  const butterfly = ph.flying && !beetle && (L.showy || f === 'wing eyespots');
  const dragon = ph.flying && !beetle && !butterfly && L.build < 0.35;
  const ab = (0.45 + 0.3 * L.tail) * (dragon ? 1.6 : 1), th = 0.22, hd = 0.14 * (0.9 + 0.3 * L.snout);
  const hgt = 0.14 + 0.14 * L.build * (beetle ? 1.4 : 1);
  const legL = 0.25 + 0.3 * L.reach, antL = 0.15 + 0.45 * L.reach * (f === 'long antennae' ? 1.6 : 1);
  const xA = -ab / 2 - th / 2, xT = 0, xH = th / 2 + hd * 0.8;
  const wingSpan = butterfly ? 0.7 + 0.2 * L.reach : 0.45;
  const box = [xA - ab / 2 - (f === 'tail filaments' ? 0.35 : 0.02), -(butterfly ? wingSpan + hgt * 0.35 : ph.flying ? 0.35 : hgt + antL * 0.6) - 0.05, xH + hd + Math.max(antL * 0.7, f === 'horns' || f === 'big jaws' ? 0.2 : 0.05), hgt * 0.5 + legL * 0.75];
  const px = fit(ctx, R, box);
  const legCol = C.dark;
  const legs = (far) => { for (let i = 0; i < 3; i++) { const x = xT - th * 0.35 + i * th * 0.35, s = i - 1, big = i === 0 && L.reach > 0.6 && !ph.flying; const kx = x + s * 0.12 + (big ? -0.12 : 0), ky = hgt * 0.2 + legL * (big ? 0.15 : 0.45); line(ctx, [[x, hgt * 0.2], [kx, ky - (big ? 0.2 : 0)], [kx + s * 0.1 + (big ? -0.1 : 0), hgt * 0.4 + legL * 0.7]], px * (far ? 1.8 : 2.6) * (big ? 1.6 : 1), far ? legCol(0.55) : legCol); } };
  legs(true);
  if (f === 'tail filaments') for (let k = -1; k <= 1; k++) curve(ctx, xA - ab / 2, 0, xA - ab / 2 - 0.15, k * 0.05, xA - ab / 2 - 0.35, k * 0.12 - 0.05, px * 1.1, C.dark);
  // wings behind the body (butterflies and dragonflies spread them; flies fold them back)
  if (ph.flying && !beetle) {
    if (butterfly) {
      const W = wingSpan, y0 = -hgt * 0.35;
      const wC = { ...C, body: L.showy ? C.body : C.light, pat: C.accent };
      const wL = { ...L, pattern: f === 'wing eyespots' ? 'eyespots' : L.pattern === 'plain' ? 'bands' : L.pattern };
      const hw = P2(); hw.moveTo(xT - 0.02, y0); hw.bezierCurveTo(xT - W * 0.2, y0 - W * 0.15, xT - W * 0.75, y0 - W * 0.25, xT - W * 0.7, y0 - W * 0.05); hw.quadraticCurveTo(xT - W * 0.55, y0 + W * 0.12, xT - 0.1, y0 + 0.02); hw.closePath();
      skin(ctx, hw, wC, wL, rng, [xT - W * 0.8, y0 - W * 0.3, xT, y0 + W * 0.12], px, { u: W * 0.14, eyespots: [[xT - W * 0.5, y0 - W * 0.08]], eyeR: W * 0.08 });
      const fw = P2(); fw.moveTo(xT, y0); fw.bezierCurveTo(xT + W * 0.05, y0 - W * 0.6, xT - W * 0.1, y0 - W * 1.0, xT - W * 0.25, y0 - W * 1.0); fw.quadraticCurveTo(xT - W * 0.75, y0 - W * 0.85, xT - W * 0.55, y0 - W * 0.2); fw.quadraticCurveTo(xT - W * 0.3, y0 - W * 0.05, xT, y0); fw.closePath();
      skin(ctx, fw, wC, wL, rng, [xT - W * 0.75, y0 - W, xT + W * 0.05, y0], px, { u: W * 0.14, eyespots: [[xT - W * 0.3, y0 - W * 0.6]], eyeR: W * 0.11 });
      ctx.strokeStyle = C.dark(0.5); ctx.lineWidth = px; for (let k = 0; k < 4; k++) curve(ctx, xT, y0, xT - W * 0.1 * k, y0 - W * 0.5, xT - W * (0.15 + 0.15 * k), y0 - W * (0.95 - 0.12 * k), px * 0.8, C.dark(0.4));
    } else {
      const n = dragon ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const wl = dragon ? 0.6 : 0.5, p = P2(), x0 = xT - k * 0.08;
        ellipse(p, x0 - wl * 0.45, -hgt * 0.5 - (dragon ? 0.05 : 0.08), wl * 0.5, 0.09, dragon ? -0.15 + k * 0.25 : -0.35);
        ctx.fillStyle = 'rgba(220,235,255,0.5)'; ctx.fill(p); ctx.strokeStyle = 'rgba(150,170,200,0.9)'; ctx.lineWidth = px; ctx.stroke(p);
        ctx.save(); ctx.clip(p); for (let j = 0; j < 6; j++) line(ctx, [[x0, -hgt * 0.5], [x0 - wl, -hgt * 0.5 - 0.15 + j * 0.06]], px * 0.6, 'rgba(120,140,170,0.6)'); ctx.restore();
      }
    }
  }
  // body: abdomen, thorax, head
  const body = P2();
  ellipse(body, xA, 0, ab / 2, hgt * (dragon ? 0.5 : 0.75));
  ellipse(body, xT, -hgt * 0.05, th / 2, hgt * 0.62);
  ellipse(body, xH, -hgt * 0.1, hd, hd * 0.85);
  skin(ctx, body, C, L, rng, [xA - ab / 2, -hgt, xH + hd, hgt * 0.75], px, { u: hgt * 0.5 * (0.6 + 0.8 * L.patSize), outline: true });
  if (beetle && ph.flying) {
    // hard wing cases over the abdomen
    const p = P2(); p.moveTo(xT + th * 0.3, -hgt * 0.65); p.bezierCurveTo(xA, -hgt * 1.1, xA - ab * 0.55, -hgt * 0.6, xA - ab * 0.5, 0); p.lineTo(xT + th * 0.3, 0); p.closePath();
    skin(ctx, p, { ...C, body: C.body(1, -0.05) }, L, rng, [xA - ab / 2, -hgt * 1.1, xT + th * 0.3, 0], px, { u: hgt * 0.45 });
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(xA + ab * 0.1, -hgt * 0.6, ab * 0.2, hgt * 0.12, -0.2, 0, TAU); ctx.fill();
  }
  legs(false);
  // head parts
  antenna(ctx, xH + hd * 0.4, -hgt * 0.1 - hd * 0.6, antL, 0.9, px, C.dark, f === 'feathery antennae');
  if (f === 'horns') curve(ctx, xH + hd * 0.5, -hgt * 0.1, xH + hd * 1.6, -hgt * 0.2, xH + hd * 1.5, -hgt * 0.1 - 0.12 - 0.15 * L.orn, px * 3, C.dark);
  if (f === 'big jaws') for (const s of [-1, 1]) curve(ctx, xH + hd * 0.8, -hgt * 0.1 + s * hd * 0.2, xH + hd * 1.7, -hgt * 0.1 + s * hd * 0.6, xH + hd * 2.1, -hgt * 0.1 + s * hd * 0.1, px * 2.5, C.dark);
  eye(ctx, xH + hd * 0.35, -hgt * 0.1 - hd * 0.15, hd * 0.42, 'bug');
}

function drawArachnid(ctx, sp, R, C, rng, L) {
  // seen from above: abdomen, cephalothorax, eight legs; scorpions add a tail and claws
  const f = L.ornament, scorp = f === 'pincers' || f === 'a tail sting';
  const legL = (0.35 + 0.45 * L.reach) * (f === 'long legs' ? 1.5 : 1), abR = 0.2 + 0.12 * L.build;
  const box = [-0.45 - (scorp ? 0.35 : 0) - legL * 0.2, -legL * 0.95, 0.45 + (f === 'pincers' ? 0.35 : 0.1), legL * 0.95];
  const px = fit(ctx, R, box);
  const cx = 0.12, ax = scorp ? -0.15 : -0.25;
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const bx = cx - 0.03 * i;
    const kx = bx + Math.cos(Math.PI / 2 * s - (i - 1.5) * 0.45 * s) * legL * 0.5 * (i < 2 ? 0.5 : -0.2) + (i < 2 ? 0.15 : -0.15), ky = s * legL * 0.55;
    const fx = kx + (i < 2 ? 0.2 : -0.25) * legL, fy = s * legL * 0.9;
    line(ctx, [[bx, s * 0.05], [kx, ky], [fx, fy]], px * (f === 'hairy legs' ? 4 : 2.2), C.dark);
    if (f === 'hairy legs') for (let k = 1; k < 6; k++) { const t = k / 6, x = kx + (fx - kx) * t, y = ky + (fy - ky) * t; line(ctx, [[x, y], [x + 0.03, y + s * 0.02]], px, C.dark(0.6)); }
  }
  if (scorp) {
    const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, a = Math.PI + t * Math.PI * 0.9; pts.push([ax - 0.2 + Math.cos(a) * 0.25 * (1 + t), Math.sin(a) * 0.15 * t * 2]); }
    limb(ctx, pts, 0.07, C.body, C.line, px);
    const [tx, ty] = pts[pts.length - 1]; tri(ctx, tx, ty, tx + 0.08, ty - 0.06, tx + 0.05, ty + 0.04, C.dark);
  }
  if (f === 'pincers') for (const s of [-1, 1]) { limb(ctx, [[cx + 0.1, s * 0.06], [cx + 0.25, s * 0.18], [cx + 0.38, s * 0.15]], 0.045, C.body, C.line, px); const p = ellipse(P2(), cx + 0.45, s * 0.15, 0.1, 0.06, s * 0.3); skin(ctx, p, C, null, rng, [cx + 0.35, s * 0.15 - 0.06, cx + 0.55, s * 0.15 + 0.06], px, { pattern: false }); }
  else for (const s of [-1, 1]) line(ctx, [[cx + 0.12, s * 0.04], [cx + 0.22, s * 0.08]], px * 2.5, C.dark);
  const body = P2();
  if (scorp) for (let k = 0; k < 5; k++) ellipse(body, ax + 0.03 - k * 0.07, 0, 0.07, abR * 0.65);
  else ellipse(body, ax, 0, abR * 1.15, abR);
  ellipse(body, cx, 0, 0.14, 0.12);
  skin(ctx, body, C, L, rng, [ax - abR * 1.2, -abR, cx + 0.14, abR], px, { u: abR * 0.35 });
  for (const [dx, dy] of [[0.08, -0.03], [0.08, 0.03], [0.06, -0.06], [0.06, 0.06]]) dot(ctx, cx + dx, dy, 0.016, '#0c0a08');
}

function drawMyriapod(ctx, sp, R, C, rng, L) {
  const f = L.ornament, n = Math.max(8, sp.ph.segments + 6), w = 0.05 + 0.04 * L.build;
  const box = [-0.55, -0.32, 0.6 + (f === 'long antennae' ? 0.2 : 0.08), 0.32];
  const px = fit(ctx, R, box);
  const pts = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push([-0.5 + t * 1.0, Math.sin(t * 6 + L.tail * 3) * 0.12]); }
  const legC = f === 'bright legs' ? C.accent : C.dark;
  for (let i = 0; i < n - 1; i++) { const [x, y] = pts[i]; for (const s of [-1, 1]) line(ctx, [[x, y], [x + 0.02, y + s * (w + 0.06 + 0.05 * L.reach)], [x - 0.02, y + s * (w + 0.1 + 0.07 * L.reach)]], px * 1.3, legC); }
  const body = P2(); for (let i = 0; i < n; i++) ellipse(body, pts[i][0], pts[i][1], 0.06, w * (i === n - 1 ? 1.1 : 1));
  skin(ctx, body, C, { ...L, pattern: L.pattern === 'plain' ? 'plain' : 'bands' }, rng, [-0.56, -0.25, 0.56, 0.25], px, { pattern: false, texture: () => { for (let i = 0; i < n; i += 2) { const [x, y] = pts[i]; ctx.fillStyle = L.pattern === 'plain' ? C.dark(0.25) : C.pat; ctx.beginPath(); ctx.ellipse(x, y, 0.03, w, 0, 0, TAU); ctx.fill(); } } });
  if (f === 'spines') for (let i = 0; i < n; i++) { const [x, y] = pts[i]; for (const s of [-1, 1]) tri(ctx, x - 0.02, y + s * w * 0.6, x, y + s * (w + 0.05), x + 0.02, y + s * w * 0.6, C.accent); }
  const [hx, hy] = pts[n - 1];
  for (const s of [-1, 1]) antenna(ctx, hx + 0.03, hy + s * 0.02, f === 'long antennae' ? 0.28 : 0.15, s * -0.6, px, C.dark, false);
}

function drawCrustacean(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament;
  if (f === 'a horned shield') {
    // a trilobite-like shield: three lobes and many segments, from above
    const px = fit(ctx, R, [-0.6, -0.42, 0.6, 0.42]);
    for (let i = 0; i < 9; i++) { const x = -0.38 + i * 0.07; for (const s of [-1, 1]) line(ctx, [[x, s * 0.22], [x - 0.02, s * 0.32]], px * 1.4, C.dark); }
    const p = P2(); p.moveTo(0.48, 0); p.bezierCurveTo(0.48, -0.3, 0.2, -0.32, 0.12, -0.3); p.lineTo(-0.45, -0.18); p.quadraticCurveTo(-0.58, 0, -0.45, 0.18); p.lineTo(0.12, 0.3); p.bezierCurveTo(0.2, 0.32, 0.48, 0.3, 0.48, 0);
    skin(ctx, p, C, L, rng, [-0.58, -0.32, 0.48, 0.32], px, { u: 0.06, texture: () => { for (let i = 0; i < 9; i++) line(ctx, [[0.08 - i * 0.065, -0.26 + i * 0.008], [0.08 - i * 0.065, 0.26 - i * 0.008]], px, C.dark(0.6)); line(ctx, [[0.45, -0.07], [-0.5, -0.06]], px, C.dark(0.5)); line(ctx, [[0.45, 0.07], [-0.5, 0.06]], px, C.dark(0.5)); } });
    for (const s of [-1, 1]) { tri(ctx, 0.15, s * 0.28, -0.25, s * 0.4, 0.05, s * 0.25, C.dark); dot(ctx, 0.3, s * 0.12, 0.035, '#1a1410'); }
    return;
  }
  const crab = L.build > 0.6;
  const claws = f === 'big claws' ? 1 + 0.6 * L.orn : 0.55;
  if (crab) {
    // a crab from above: a wide shell, walking legs and claws
    const px = fit(ctx, R, [-0.62, -0.5, 0.62 + 0.1 * claws, 0.5]);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const x = -0.1 - i * 0.07; line(ctx, [[x, s * 0.15], [x - 0.08 - i * 0.04, s * (0.35 + 0.05 * L.reach)], [x - 0.15 - i * 0.07, s * (0.45 + 0.05 * L.reach)]], px * 3, C.dark); }
    for (const s of [-1, 1]) { limb(ctx, [[0.15, s * 0.15], [0.3, s * 0.3], [0.4, s * 0.28]], 0.05, C.body, C.line, px); const p = ellipse(P2(), 0.45, s * 0.25, 0.13 * claws, 0.08 * claws, s * -0.4); skin(ctx, p, C, null, rng, [0.3, -0.4, 0.62, 0.4], px, { pattern: false }); line(ctx, [[0.48, s * 0.22], [0.58 + 0.05 * claws, s * 0.16]], px * 2, C.dark); }
    const p = P2(); p.moveTo(0.32, 0); p.bezierCurveTo(0.32, -0.32, -0.35, -0.38, -0.32, 0); p.bezierCurveTo(-0.35, 0.38, 0.32, 0.32, 0.32, 0);
    skin(ctx, p, C, L, rng, [-0.35, -0.32, 0.32, 0.32], px, { u: 0.07 });
    if (f === 'spines') for (let k = 0; k < 7; k++) { const a = -1.3 + k * 0.43; tri(ctx, Math.cos(a) * 0.28, Math.sin(a) * 0.28, Math.cos(a) * 0.38, Math.sin(a) * 0.38, Math.cos(a + 0.12) * 0.28, Math.sin(a + 0.12) * 0.28, C.dark); }
    for (const s of [-1, 1]) { line(ctx, [[0.3, s * 0.06], [0.37, s * 0.08]], px * 1.5, C.dark); dot(ctx, 0.38, s * 0.08, 0.025, '#111'); }
    if (f === 'long antennae') for (const s of [-1, 1]) curve(ctx, 0.32, s * 0.03, 0.5, s * 0.05, 0.62, s * 0.2, px, C.dark);
    return;
  }
  // a shrimp or lobster from the side: a curved, segmented tail, long antennae, legs beneath
  const nSeg = 6, len = 0.9;
  const px = fit(ctx, R, [-0.58, -0.4 - (f === 'long antennae' ? 0.1 : 0), 0.62 + 0.15 * claws, 0.38]);
  for (let i = 0; i < 5; i++) { const x = 0.05 + i * 0.05; line(ctx, [[x, 0.05], [x + 0.02, 0.2 + 0.08 * L.reach], [x + 0.05, 0.28 + 0.08 * L.reach]], px * 1.3, C.dark); }
  const segs = []; for (let i = 0; i < nSeg; i++) { const t = i / (nSeg - 1), a = 0.9 * t; segs.push([0.0 - Math.sin(a) * 0.45 - 0.05, -0.03 + (1 - Math.cos(a)) * 0.35 * (0.6 + 0.4 * L.tail), 0.1 - t * 0.04]); }
  const body = P2();
  ellipse(body, 0.22, -0.05, 0.25, 0.12 + 0.04 * L.build);
  for (const [x, y, r] of segs) ellipse(body, x, y, r * 0.75, r);
  const [tx, ty] = segs[segs.length - 1];
  const fan = f === 'a tail fan' ? 0.16 : 0.09;
  for (let k = -2; k <= 2; k++) { const p = ellipse(P2(), tx - 0.02 - fan * 0.5, ty + 0.04 + k * 0.025, fan * 0.6, 0.03, 0.9 + k * 0.3); ctx.fillStyle = C.body(1, -0.05); ctx.fill(p); }
  skin(ctx, body, C, L, rng, [-0.5, -0.2, 0.47, 0.3], px, { u: 0.06, texture: () => { for (const [x, y, r] of segs) { ctx.strokeStyle = C.dark(0.4); ctx.lineWidth = px; ctx.beginPath(); ctx.arc(x, y, r, -1.6, 1.2); ctx.stroke(); } } });
  if (f === 'spines') for (let k = 0; k < 5; k++) tri(ctx, 0.05 + k * 0.07, -0.15, 0.08 + k * 0.07, -0.25, 0.11 + k * 0.07, -0.15, C.dark);
  // a rostrum, eyes, antennae and claws
  tri(ctx, 0.42, -0.1, 0.62, -0.12, 0.44, -0.04, C.body(1, -0.08));
  if (f === 'big claws' || claws > 0.9) { limb(ctx, [[0.35, 0.04], [0.45, 0.14], [0.55, 0.06]], 0.04, C.body, C.line, px); const p = ellipse(P2(), 0.6, 0.04, 0.1 * claws, 0.05 * claws, -0.3); skin(ctx, p, C, null, rng, [0.5, -0.05, 0.75, 0.12], px, { pattern: false }); }
  const al = f === 'long antennae' ? 0.75 : 0.4;
  curve(ctx, 0.42, -0.12, 0.3, -0.38, -0.1 - al * 0.3, -0.35 - al * 0.1, px * 1.1, C.dark);
  curve(ctx, 0.43, -0.11, 0.6, -0.3, 0.6, -0.35, px, C.dark);
  eye(ctx, 0.4, -0.13, 0.03, 'bug');
}

// ants, bees and termites: a few colony members
function drawColony(ctx, sp, R, C, rng, L) {
  const f = L.ornament, bee = sp.trophic === 3 && sp.ph.flying;
  const bodyC = bee ? T(0.11 + 0.04 * L.accent, 0.75, 0.52) : C.body, stripe = bee ? T(0.08, 0.3, 0.15) : C.dark;
  const one = (x, y, s, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const px = 1;
    for (const dx of [-0.15, 0.05, 0.25]) for (const sg of [-1, 1]) line(ctx, [[dx * s, 0], [dx * s + 0.15 * s, sg * 0.35 * s], [dx * s + 0.05 * s, sg * 0.55 * s]], Math.max(1, s * 0.05), stripe);
    if (bee) { ctx.fillStyle = 'rgba(220,235,255,0.6)'; ctx.beginPath(); ctx.ellipse(-0.05 * s, -0.3 * s, 0.28 * s, 0.13 * s, -0.4, 0, TAU); ctx.fill(); }
    const body = P2(); ellipse(body, -0.45 * s, 0, 0.32 * s * (bee ? 1.1 : 1), 0.24 * s); ellipse(body, 0.05 * s, 0, 0.17 * s, 0.12 * s); ellipse(body, 0.4 * s, 0, 0.16 * s * (f === 'big jaws' ? 1.2 : 1), 0.14 * s);
    skin(ctx, body, { ...C, body: bodyC, line: stripe }, null, rng, [-0.8 * s, -0.25 * s, 0.6 * s, 0.25 * s], px, { pattern: false, texture: () => { if (bee || f === 'a stinger') for (const dx of [-0.6, -0.45, -0.3]) { ctx.fillStyle = stripe; ctx.fillRect(dx * s, -0.25 * s, 0.07 * s, 0.5 * s); } } });
    const al = f === 'long antennae' ? 1.4 : 1;
    for (const sg of [-1, 1]) line(ctx, [[0.5 * s, sg * 0.08 * s], [0.62 * s, sg * 0.35 * s * al], [0.82 * s * al, sg * 0.3 * s * al]], Math.max(1, s * 0.04), stripe);
    if (f === 'big jaws') for (const sg of [-1, 1]) curve(ctx, 0.52 * s, sg * 0.05 * s, 0.7 * s, sg * 0.12 * s, 0.75 * s, 0, Math.max(1, s * 0.05), stripe);
    if (f === 'a stinger') tri(ctx, -0.75 * s, -0.03 * s, -0.92 * s, 0, -0.75 * s, 0.03 * s, stripe);
    ctx.restore();
  };
  one(-R * 0.25, -R * 0.35, R * 0.75, 0.15);
  one(R * 0.3, R * 0.1, R * 0.7, -0.3);
  one(-R * 0.35, R * 0.45, R * 0.6, 0.4);
}

// ---------- backboned animals ----------

// Vertebrates are laid out in their own units (body length 1), then fitted to the circle, so a
// long neck, long tail or big ornament all still fit.
function drawVertebrate(ctx, sp, R, C, rng, L) {
  const gr = sp.grade;
  const wet = sp.habitat === 0 || sp.habitat === 3 || gr === 'fish';
  if (gr === 'whale' || (wet && sp.ph.endo && gr !== 'fish')) return drawWhale(ctx, sp, R, C, rng, L);
  if (gr === 'fish' || (wet && gr !== 'amphibian' && gr !== 'crocodile' && gr !== 'turtle' && gr !== 'bird' && gr !== 'snake')) return drawFish(ctx, sp, R, C, rng, L);
  if (gr === 'snake') return drawSnake(ctx, sp, R, C, rng, L);
  if (gr === 'turtle') return drawTurtle(ctx, sp, R, C, rng, L);
  if (gr === 'bird') return drawBird(ctx, sp, R, C, rng, L);
  if (gr === 'bat' || gr === 'pterosaur') return drawFlyer(ctx, sp, R, C, rng, L);
  if (gr === 'primate' || gr === 'sapient') return drawUpright(ctx, sp, R, C, rng, L);
  if (gr === 'dinosaur' && sp.trophic === 4) return drawBiped(ctx, sp, R, C, rng, L);
  return drawQuad(ctx, sp, R, C, rng, L);
}

// proportions for four-legged groups: body height, legs, neck, snout, tail, sprawl, neck angle
const QUAD = {
  mammal: [1, 0.9, 0.45, 1, 0.8, 0, 0.8],
  rodent: [1.3, 0.5, 0.15, 0.7, 1.1, 0, 0.5],
  carnivoran: [0.95, 1.05, 0.5, 1.05, 0.95, 0, 0.6],
  ungulate: [1, 1.45, 1, 1.25, 0.35, 0, 1.0],
  reptile: [0.72, 0.55, 0.3, 1, 1.35, 0.6, 0.25],
  amphibian: [0.85, 0.55, 0.12, 0.6, 0.9, 0.7, 0.1],
  crocodile: [0.7, 0.42, 0.22, 2.2, 1.15, 0.6, 0.08],
  dinosaur: [1.05, 1.05, 0.55, 0.9, 1.2, 0, 0.6],
};

function drawQuad(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, gr = sp.grade, f = L.ornament, osz = 0.55 + 0.9 * L.orn;
  const Q = QUAD[gr] || QUAD.mammal;
  const frog = gr === 'amphibian' && L.tail < 0.45;
  const sauropod = gr === 'dinosaur' && L.reach > 0.5;
  const fur = ph.covering === 'fur', mammal = fur || gr === 'mammal' || gr === 'rodent' || gr === 'carnivoran' || gr === 'ungulate';
  const H = frog ? 0.5 : (0.3 + 0.28 * L.build) * Q[0];
  const legLen = ph.limbs ? (0.2 + 0.38 * L.reach) * Q[1] * (sauropod ? 1.2 : 1) : 0;
  const neck = frog ? 0 : (0.05 + 0.3 * L.reach) * Q[2] * (sauropod ? 3.2 : 1);
  const hr = H * (frog ? 0.55 : gr === 'rodent' ? 0.48 : 0.4) * (1 + 0.2 * ph.brain) * (sauropod ? 0.5 : 1);
  const snoutL = frog ? hr * 0.2 : hr * (0.25 + 1.2 * L.snout) * Q[3] * (f === 'a trunk' ? 0.6 : 1);
  const tailL = frog ? 0 : (0.08 + 0.75 * L.tail) * Q[4] * (sauropod ? 1.4 : 1);
  const sprawl = Q[5], ang = sauropod ? 0.95 : Q[6];
  // layout
  const gy = H * 0.4 + legLen;
  const nb = [0.36, -H * 0.18];
  const hx = frog ? 0.42 : nb[0] + Math.cos(ang) * neck + hr * 0.5, hy = frog ? -H * 0.2 : nb[1] - Math.sin(ang) * neck - (mammal ? hr * 0.2 : 0);
  const sx = hx + hr * 0.55 + snoutL, sy = hy + hr * (mammal ? 0.35 : 0.2);
  const tailUp = f === 'a bushy tail' || f === 'a tufted tail' ? -1 : gr === 'reptile' || gr === 'crocodile' || gr === 'dinosaur' ? 0.4 : 0.8;
  const tx = -0.5 - tailL, ty = gr === 'reptile' || gr === 'crocodile' ? gy * 0.7 : tailUp * H * 0.55;
  const top = Math.min(-H * 0.6, hy - hr * (1.2 + (f === 'antlers' || f === 'spiral horns' || f === 'curved horns' || f === 'big ears' || f === 'tufted ears' || f === 'a crest' || f === 'horns' || f === 'a frill' ? 1.8 * osz : 0.4)), f === 'a back sail' || f === 'back plates' ? -H * (0.6 + 0.6 * osz) : 0, ty - H * 0.4);
  const box = [Math.min(tx - 0.05, -0.56), top, Math.max(sx + 0.04 + (f === 'a trunk' ? 0.05 : 0), 0.58), gy + 0.03];
  const px = fit(ctx, R, box, 0.95);
  const legW = H * (gr === 'ungulate' ? 0.16 : sauropod ? 0.3 : 0.22) * (frog ? 1.3 : 1);
  const pairs = Math.max(0, Math.min(ph.limbs, 4));
  const legX = (i) => (pairs <= 1 ? (frog ? -0.1 : 0) : -0.3 + (i * 0.62) / (pairs - 1));
  const leg = (i, far) => {
    const x = legX(i) + (far ? 0.05 : 0), y0 = H * 0.15, hind = pairs > 1 && i === 0;
    let pts;
    if (frog && hind) {
      // a folded jumping leg: a big thigh, the shin tucked back, a long foot forward
      const th = ellipse(P2(), -0.22 + (far ? 0.04 : 0), H * 0.12, 0.2, 0.11, -0.45);
      skin(ctx, th, far ? { ...C, body: C.dark(1, 0.05) } : C, null, rng, [-0.42, -0.05, 0, 0.3], px, { pattern: false });
      limb(ctx, [[-0.06, H * 0.22], [-0.32, gy - 0.04], [-0.02, gy]], legW * 0.7, far ? C.dark(1, 0.05) : C.body, far ? null : C.line, px);
      return;
    }
    if (frog) pts = [[x + 0.3, y0], [x + 0.36, gy - 0.05], [x + 0.42, gy]];
    else if (sprawl) pts = [[x, y0], [x + (hind ? -0.1 : 0.1), y0 + legLen * 0.25], [x + (hind ? -0.05 : 0.12), gy], [x + (hind ? 0.02 : 0.2), gy]];
    else pts = [[x, y0], [x + (hind ? -0.05 : 0.04), y0 + legLen * 0.55], [x + (hind ? 0.02 : 0.02), gy - 0.01]];
    limb(ctx, pts, legW * (far ? 0.9 : 1), far ? C.dark(1, 0.05) : C.body, far ? null : C.line, px);
    const [fx, fy] = pts[pts.length - 1];
    if (gr === 'ungulate') { ctx.fillStyle = '#2a2018'; ctx.fillRect(fx - legW * 0.6, fy - legW * 0.5, legW * 1.2, legW * 0.6); }
    else if (!far && (gr === 'carnivoran' || gr === 'reptile' || gr === 'crocodile' || gr === 'dinosaur')) for (let k = 0; k < 3; k++) line(ctx, [[fx + legW * 0.2, fy], [fx + legW * (0.6 + k * 0.1), fy + legW * (k - 1) * 0.25]], px * 1.2, '#2a2018');
  };
  for (let i = 0; i < pairs; i++) leg(i, true);
  // things behind the body: tail, back ornaments, ears, mane, frill
  const thin = mammal && f !== 'a bushy tail';
  if (tailL > 0.02) {
    const tw = thin ? H * (gr === 'rodent' ? 0.06 : 0.12) : H * 0.35;
    const tp = P2(); tp.moveTo(-0.45, -H * 0.25); tp.quadraticCurveTo(-0.5 - tailL * 0.5, (ty - H * 0.25) * 0.5 + (thin ? H * 0.3 : H * 0.15), tx, ty); tp.quadraticCurveTo(-0.5 - tailL * 0.4, (ty + H * 0.2) * 0.5 + (thin ? H * 0.35 : H * 0.2), -0.45, H * 0.15);
    if (thin) curve(ctx, -0.46, -H * 0.15, -0.5 - tailL * 0.5, (ty - H * 0.15) / 2 + H * 0.35, tx, ty, tw + px * 2, C.line), curve(ctx, -0.46, -H * 0.15, -0.5 - tailL * 0.5, (ty - H * 0.15) / 2 + H * 0.35, tx, ty, tw, C.body);
    else if (f === 'a bushy tail') { const p = ellipse(P2(), (tx - 0.45) / 2, (ty - H * 0.1) / 2, (tailL + 0.1) * 0.55, H * 0.32, Math.atan2(ty + H * 0.1, tx + 0.45)); skin(ctx, p, C, L, rng, [tx, ty - H * 0.4, -0.4, H * 0.3], px, { pattern: L.pattern === 'bands' || L.pattern === 'stripes' }); }
    else skin(ctx, tp, C, L, rng, [tx, Math.min(ty, -H * 0.3), -0.4, Math.max(ty, H * 0.2)], px, { u: H * 0.2 });
    if (f === 'a tufted tail') { const p = ellipse(P2(), tx, ty, H * 0.15 * osz, H * 0.1 * osz, 0.5); skin(ctx, p, { ...C, body: C.dark }, null, rng, [tx - 0.1, ty - 0.1, tx + 0.1, ty + 0.1], px, { pattern: false }); }
    if (f === 'a tail club') { const p = ellipse(P2(), tx, ty, H * 0.22 * osz, H * 0.16 * osz); skin(ctx, p, { ...C, body: C.dark(1, 0.05) }, null, rng, [tx - 0.1, ty - 0.1, tx + 0.1, ty + 0.1], px, { pattern: false }); }
  }
  if (f === 'a back sail') { const p = P2(); p.moveTo(-0.35, -H * 0.35); p.quadraticCurveTo(0, -H * (0.5 + 1.1 * osz), 0.3, -H * 0.4); p.closePath(); skin(ctx, p, { ...C, body: C.accent(1, -0.05) }, null, rng, [-0.35, -H * 1.6, 0.3, -H * 0.3], px, { pattern: false, texture: () => { for (let k = 0; k < 7; k++) line(ctx, [[-0.3 + k * 0.09, -H * 0.4], [-0.3 + k * 0.09, -H * 1.6]], px, C.dark(0.5)); } }); }
  if (f === 'back plates') for (let k = 0; k < 6; k++) { const x = -0.4 + k * 0.14, hgt = H * (0.35 + 0.35 * Math.sin((k + 0.5) / 6 * Math.PI)) * osz; const p = P2(); p.moveTo(x - 0.06, -H * 0.4); p.lineTo(x, -H * 0.4 - hgt); p.lineTo(x + 0.06, -H * 0.4); p.closePath(); skin(ctx, p, { ...C, body: C.accent }, null, rng, [x - 0.06, -H - hgt, x + 0.06, -H * 0.4], px, { pattern: false }); }
  if (f === 'a mane' && gr === 'carnivoran') { const p = blobPath(P2(), hx - hr * 0.6, hy + hr * 0.2, hr * 1.5 * osz, hr * 1.6 * osz, rng, 0.2, 12); skin(ctx, p, { ...C, body: C.dark(1, 0.08) }, null, rng, [hx - hr * 2.5, hy - hr * 2, hx + hr, hy + hr * 2], px, { pattern: false }); }
  if (f === 'a frill') { const p = ellipse(P2(), hx - hr * 0.5, hy - hr * 0.2, hr * 1.5 * osz, hr * 1.7 * osz); skin(ctx, p, { ...C, body: C.accent }, null, rng, [hx - hr * 2, hy - hr * 2, hx + hr, hy + hr * 1.5], px, { pattern: false, texture: () => { for (let k = 0; k < 9; k++) { const a = Math.PI * 0.5 + (k / 8) * Math.PI; line(ctx, [[hx - hr * 0.5, hy - hr * 0.2], [hx - hr * 0.5 + Math.cos(a) * hr * 2, hy - hr * 0.2 + Math.sin(a) * hr * 2]], px, C.dark(0.4)); } } }); }
  // ears (behind the head)
  if (mammal && gr !== 'ungulate' || (gr === 'ungulate' && f !== 'antlers')) {
    const big = f === 'big ears' ? 1.8 * osz : 1, round = gr === 'rodent';
    const ex = hx - hr * 0.3, ey = hy - hr * 0.6;
    const p = P2();
    if (round) ellipse(p, ex, ey - hr * 0.3 * big, hr * 0.42 * big, hr * 0.48 * big);
    else { p.moveTo(ex - hr * 0.35, ey + hr * 0.1); p.quadraticCurveTo(ex - hr * 0.3 * big, ey - hr * 0.9 * big, ex + hr * 0.05, ey - hr * 1.0 * big); p.quadraticCurveTo(ex + hr * 0.2, ey - hr * 0.3, ex + hr * 0.35, ey + hr * 0.1); p.closePath(); }
    skin(ctx, p, C, null, rng, [ex - hr, ey - hr * 1.6 * big, ex + hr, ey + hr * 0.2], px, { pattern: false });
    ctx.save(); ctx.clip(p); dot(ctx, ex, ey - hr * 0.35 * big, hr * 0.25 * big, C.belly ? C.belly(0.8) : C.light); ctx.restore();
    if (f === 'tufted ears') line(ctx, [[ex + hr * 0.05, ey - hr * 1.0], [ex + hr * 0.05, ey - hr * 1.5 * osz]], px * 2, C.dark);
  }
  // the silhouette: body, neck, head and snout as one shape
  const sil = P2();
  const hump = f === 'a hump' ? H * 0.5 * osz : 0;
  sil.moveTo(-0.5, 0);
  sil.bezierCurveTo(-0.5, -H * 0.58, 0.05 - (hump ? 0.1 : 0), -H * 0.62 - hump * 1.5, 0.48, -H * 0.3);
  sil.bezierCurveTo(0.56, -H * 0.05, 0.54, H * 0.35, 0.28, H * 0.47);
  sil.bezierCurveTo(0.05, H * 0.55, -0.3, H * 0.55, -0.45, H * 0.35);
  sil.bezierCurveTo(-0.53, H * 0.2, -0.53, H * 0.08, -0.5, 0);
  sil.closePath();
  if (!frog) {
    const nw = Math.max(hr * 0.8, H * 0.35);
    sil.moveTo(nb[0] - nw * 0.6, nb[1] - H * 0.15);
    sil.quadraticCurveTo((nb[0] + hx) / 2 - nw * 0.3, (nb[1] + hy) / 2 - nw * 0.4, hx - hr * 0.2, hy - hr * 0.7);
    sil.lineTo(hx + hr * 0.2, hy + hr * 0.6);
    sil.quadraticCurveTo((nb[0] + hx) / 2 + nw * 0.4, (nb[1] + hy) / 2 + nw * 0.5, nb[0] + nw * 0.5, nb[1] + H * 0.35);
    sil.closePath();
  }
  ellipse(sil, hx, hy, hr * (frog ? 1.15 : 1), hr * (frog ? 0.75 : 0.9));
  // snout: tapering forward; wide and flat for frogs and crocodiles
  sil.moveTo(hx, hy - hr * 0.55);
  sil.quadraticCurveTo(hx + snoutL * 0.6, hy - hr * (gr === 'crocodile' ? 0.35 : 0.45), sx, sy - hr * (gr === 'crocodile' ? 0.15 : 0.22));
  sil.quadraticCurveTo(sx + hr * 0.15, sy, sx, sy + hr * 0.12);
  sil.quadraticCurveTo(hx + snoutL * 0.5, sy + hr * 0.3, hx, hy + hr * 0.6);
  sil.closePath();
  const bx = [-0.55, Math.min(-H * 0.65 - hump * 1.5, hy - hr), Math.max(sx, 0.56), H * 0.55];
  skin(ctx, sil, C, L, rng, bx, px, { belly: true, u: H * (0.14 + 0.22 * L.patSize), eyespots: [[-0.28, -H * 0.05]], eyeR: H * 0.2, texture: () => {
    if (fur) furFringe(ctx, sil, [bx[0], bx[1], bx[2], bx[1] + H * 0.3], C, px, rng);
    if (ph.covering === 'scales') scaleTexture(ctx, bx, C, px);
    if (ph.armour > 0.6) for (let k = 0; k < 6; k++) line(ctx, [[-0.3 + k * 0.1, -H * 0.55], [-0.32 + k * 0.1, H * 0.25]], px * 1.6, C.dark(0.6));
  } });
  for (let i = 0; i < pairs; i++) leg(i, false);
  // head details
  const ex = hx + hr * 0.2, ey = hy - hr * 0.2, er = hr * (gr === 'rodent' ? 0.26 : 0.2) * (frog ? 1.4 : 1);
  if (mammal) { dot(ctx, sx - hr * 0.02, sy - hr * 0.05, hr * 0.13, '#1a1410'); }
  if (sp.trophic === 4) { for (let k = 0; k < 4; k++) { const t = 0.45 + k * 0.13, x = hx + (sx - hx) * t, y = hy + (sy - hy) * t + hr * 0.2; tri(ctx, x - hr * 0.05, y, x, y + hr * 0.16, x + hr * 0.05, y, '#f2ecdc'); } }
  if (f === 'sabre teeth') tri(ctx, hx + snoutL * 0.5, sy + hr * 0.15, hx + snoutL * 0.55, sy + hr * (0.6 + 0.6 * osz), hx + snoutL * 0.65, sy + hr * 0.15, '#f4eedd');
  line(ctx, [[hx + snoutL * 0.3, sy + hr * 0.18], [sx - hr * 0.05, sy + hr * 0.08]], px * 1.1, C.dark(0.7));
  if (f === 'long whiskers' || gr === 'rodent' || gr === 'carnivoran') { const wl = hr * (f === 'long whiskers' ? 1.6 * osz : 0.8); for (let k = -1; k <= 1; k++) line(ctx, [[sx - hr * 0.15, sy], [sx + wl * 0.6, sy + k * wl * 0.3 - wl * 0.05]], px * 0.8, 'rgba(240,235,220,0.75)'); }
  if (f === 'a trunk') { curve(ctx, sx - hr * 0.1, sy, sx + hr * 0.6, sy + hr * 1.2, sx + hr * 0.2, gy * 0.8, hr * 0.35 + px * 2, C.line); curve(ctx, sx - hr * 0.1, sy, sx + hr * 0.6, sy + hr * 1.2, sx + hr * 0.2, gy * 0.8, hr * 0.35, C.body); }
  if (frog) { const p = ellipse(P2(), hx - hr * 0.05, hy - hr * 0.62, er * 1.3, er * 1.15); skin(ctx, p, C, null, rng, [hx - hr, hy - hr, hx + hr, hy], px, { pattern: false }); }
  eye(ctx, frog ? hx - hr * 0.02 : ex, frog ? hy - hr * 0.68 : ey - (gr === 'crocodile' ? hr * 0.4 : 0), er, mammal ? 'mammal' : 'reptile');
  // head ornaments
  const hornC = T(0.09, 0.2, 0.75), antlerC = T(0.08, 0.3, 0.45);
  if (f === 'antlers') { const br = (x, y, a, len, d) => { if (d > 2) return; const exx = x + Math.cos(a) * len, eyy = y + Math.sin(a) * len; line(ctx, [[x, y], [exx, eyy]], hr * 0.14 * (1 - d * 0.25), antlerC); br(exx, eyy, a - 0.5, len * 0.65, d + 1); br(exx, eyy, a + 0.45, len * 0.65, d + 1); }; br(hx - hr * 0.1, hy - hr * 0.7, -Math.PI / 2 - 0.35, hr * 0.9 * osz, 0); }
  if (f === 'spiral horns') { line(ctx, [[hx - hr * 0.1, hy - hr * 0.7], [hx - hr * 0.9 * osz, hy - hr * 2.4 * osz]], hr * 0.16, hornC); for (let k = 1; k < 6; k++) { const t = k / 6, x = hx - hr * 0.1 - hr * 0.8 * osz * t, y = hy - hr * 0.7 - hr * 1.7 * osz * t; line(ctx, [[x - hr * 0.08, y], [x + hr * 0.08, y - hr * 0.08]], px, C.dark(0.5)); } }
  if (f === 'curved horns') { ctx.strokeStyle = hornC; ctx.lineWidth = hr * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(hx - hr * 0.5, hy - hr * 0.5, hr * 0.6 * osz, -0.3, Math.PI * 1.25, true); ctx.stroke(); }
  if (f === 'a nose horn' || (f === 'horns' && gr !== 'ungulate')) { const hx2 = f === 'a nose horn' ? hx + snoutL * 0.7 : hx; const hy2 = f === 'a nose horn' ? sy - hr * 0.3 : hy - hr * 0.7; tri(ctx, hx2 - hr * 0.15, hy2 + hr * 0.1, hx2 + hr * 0.05, hy2 - hr * 1.1 * osz, hx2 + hr * 0.2, hy2 + hr * 0.1, hornC); if (f === 'horns') tri(ctx, hx2 - hr * 0.5, hy2 + hr * 0.15, hx2 - hr * 0.45, hy2 - hr * 0.9 * osz, hx2 - hr * 0.25, hy2 + hr * 0.1, hornC); }
  if (f === 'a crest') { const p = P2(); p.moveTo(hx - hr * 0.6, hy - hr * 0.5); p.quadraticCurveTo(hx - hr * 0.9, hy - hr * 2 * osz, hx + hr * 0.4, hy - hr * 0.8); p.closePath(); skin(ctx, p, { ...C, body: C.accent }, null, rng, [hx - hr, hy - hr * 2.2, hx + hr, hy], px, { pattern: false }); }
  if (f === 'quills') for (let k = 0; k < 12; k++) { const x = -0.42 + k * 0.07, y = -H * 0.5 + Math.abs(k - 5) * 0.004; line(ctx, [[x, y + H * 0.15], [x - 0.08, y - H * 0.35 * osz]], px * 1.6, k % 2 ? C.light : C.dark); }
  if (f === 'spines' || f === 'back spines') for (let k = 0; k < 8; k++) { const x = -0.38 + k * 0.1; tri(ctx, x - 0.035, -H * 0.5, x, -H * (0.6 + 0.3 * osz), x + 0.035, -H * 0.5, C.dark); }
  if (f === 'a dewlap' || f === 'a throat sac') { const p = ellipse(P2(), hx + hr * 0.1, hy + hr * 0.9, hr * 0.5 * osz, hr * 0.6 * osz); skin(ctx, p, { ...C, body: C.accent }, null, rng, [hx - hr, hy, hx + hr, hy + hr * 1.6], px, { pattern: false }); }
  if (f === 'warts') for (let k = 0; k < 14; k++) dot(ctx, -0.4 + rng() * 0.8, -H * 0.4 + rng() * H * 0.5, H * 0.04, C.dark(0.5));
  if (f === 'frilly gills') for (const d of [-1, 0, 1]) { const x0 = hx - hr * 0.6, y0 = hy + d * hr * 0.3; for (let k = 0; k < 4; k++) line(ctx, [[x0, y0], [x0 - hr * 0.3 - k * hr * 0.1, y0 + d * hr * 0.4 - hr * 0.5 + k * hr * 0.1]], px * 1.6, C.accent); }
  if (f === 'a nose knob') dot(ctx, sx - hr * 0.1, sy - hr * 0.25, hr * 0.25 * osz, C.dark);
  if (f === 'a mane' && gr === 'ungulate') for (let k = 0; k < 8; k++) { const t = k / 8, x = nb[0] + (hx - nb[0]) * t - 0.02, y = nb[1] - H * 0.2 + (hy - hr * 0.7 - nb[1] + H * 0.2) * t; line(ctx, [[x, y], [x - 0.04, y - H * 0.2 * osz]], px * 2, C.dark); }
}

// two-legged hunters (theropods): a balancing tail, strong legs, small arms, toothy jaws
function drawBiped(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament, osz = 0.55 + 0.9 * L.orn, feath = ph.covering === 'feathers';
  const H = 0.28 + 0.18 * L.build, legLen = 0.3 + 0.3 * L.reach, hr = 0.11 + 0.05 * L.build, snoutL = hr * (0.6 + 1.1 * L.snout);
  const tailL = 0.35 + 0.45 * L.tail;
  const gy = H * 0.4 + legLen;
  const hx = 0.55 + 0.1 * L.reach, hy = -H * 0.75 - 0.1 * L.reach;
  const box = [-0.45 - tailL, Math.min(hy - hr * (1.3 + (f === 'a crest' || f === 'horns' ? osz : 0)), f === 'a back sail' ? -H * (0.6 + 1.1 * osz) : -1), hx + hr + snoutL + 0.03, gy + 0.03];
  const px = fit(ctx, R, box, 0.95);
  const legP = (far) => { const x = -0.05 + (far ? 0.06 : 0); return [[x, 0], [x + 0.1, H * 0.4 + legLen * 0.35], [x - 0.02, gy - 0.05], [x + 0.1, gy]]; };
  limb(ctx, legP(true), H * 0.3, C.dark(1, 0.05), null, px);
  if (f === 'a back sail') { const p = P2(); p.moveTo(-0.3, -H * 0.4); p.quadraticCurveTo(0, -H * (0.6 + 1.1 * osz), 0.25, -H * 0.45); p.closePath(); skin(ctx, p, { ...C, body: C.accent }, null, rng, [-0.3, -H * 1.7, 0.25, -H * 0.3], px, { pattern: false }); }
  const sil = P2();
  sil.moveTo(-0.45 - tailL, -H * 0.15);
  sil.quadraticCurveTo(-0.3, -H * 0.55, 0.05, -H * 0.5);
  sil.quadraticCurveTo(0.35, -H * 0.5, hx - hr * 0.5, hy - hr * 0.3);
  sil.lineTo(hx, hy + hr * 0.8);
  sil.quadraticCurveTo(0.35, H * 0.1, 0.1, H * 0.45);
  sil.quadraticCurveTo(-0.2, H * 0.45, -0.45 - tailL, -H * 0.1);
  sil.closePath();
  ellipse(sil, hx, hy, hr * 1.1, hr * 0.85);
  sil.moveTo(hx, hy - hr * 0.7); sil.quadraticCurveTo(hx + snoutL * 0.6, hy - hr * 0.5, hx + hr * 0.6 + snoutL, hy); sil.lineTo(hx + hr * 0.5 + snoutL, hy + hr * 0.4); sil.quadraticCurveTo(hx + snoutL * 0.5, hy + hr * 0.8, hx, hy + hr * 0.7); sil.closePath();
  skin(ctx, sil, C, L, rng, [-0.45 - tailL, hy - hr, hx + hr + snoutL, H * 0.5], px, { belly: true, u: H * (0.15 + 0.2 * L.patSize), texture: () => { if (ph.covering === 'scales') scaleTexture(ctx, [-0.8, hy - hr, hx + hr + snoutL, H * 0.5], C, px); } });
  if (feath) for (let k = 0; k < 16; k++) { const x = -0.45 - tailL + k * (0.6 + tailL) / 16; line(ctx, [[x, -H * 0.4 + (k < 8 ? 0.05 : 0)], [x - 0.04, -H * 0.55]], px * 1.4, C.dark(0.6)); }
  limb(ctx, legP(false), H * 0.32, C.body, C.line, px);
  for (let k = 0; k < 3; k++) line(ctx, [[0.08, gy], [0.14 + k * 0.025, gy + (k - 1) * 0.015]], px * 1.4, '#2a2018');
  // little arms
  limb(ctx, [[0.3, -H * 0.1], [0.38, H * 0.05], [0.44, 0]], H * 0.08, C.body, C.line, px);
  if (feath) for (let k = 0; k < 4; k++) line(ctx, [[0.32 + k * 0.03, H * 0.0], [0.28 + k * 0.03, H * 0.18]], px * 1.4, C.accent);
  for (let k = 0; k < 5; k++) { const x = hx + hr * 0.4 + k * snoutL * 0.17; tri(ctx, x - hr * 0.06, hy + hr * 0.3, x, hy + hr * 0.5, x + hr * 0.06, hy + hr * 0.3, '#f2ecdc'); }
  line(ctx, [[hx + hr * 0.2, hy + hr * 0.3], [hx + hr * 0.5 + snoutL, hy + hr * 0.25]], px, C.dark);
  eye(ctx, hx + hr * 0.15, hy - hr * 0.25, hr * 0.22, 'reptile');
  if (f === 'a crest') { const p = P2(); p.moveTo(hx - hr * 0.3, hy - hr * 0.6); p.quadraticCurveTo(hx + hr * 0.2, hy - hr * (1 + osz), hx + hr * 0.9 + snoutL * 0.4, hy - hr * 0.55); p.closePath(); ctx.fillStyle = C.accent; ctx.fill(p); }
  if (f === 'horns') for (const d of [0, 0.6]) tri(ctx, hx - hr * 0.1 + d * hr, hy - hr * 0.6, hx + d * hr, hy - hr * (0.9 + 0.6 * osz), hx + hr * 0.15 + d * hr, hy - hr * 0.6, C.dark);
  if (f === 'spines' || f === 'back plates') for (let k = 0; k < 7; k++) { const x = -0.4 + k * 0.1; tri(ctx, x - 0.035, -H * 0.5, x, -H * (0.6 + 0.4 * osz), x + 0.035, -H * 0.5, f === 'back plates' ? C.accent : C.dark); }
  if (f === 'a frill') { ctx.strokeStyle = C.accent; ctx.lineWidth = hr * 0.25; ctx.beginPath(); ctx.arc(hx - hr * 0.5, hy, hr * (0.9 + 0.5 * osz), Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); }
}

function drawBird(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament, osz = 0.55 + 0.9 * L.orn;
  const water = sp.habitat === 1 || sp.habitat === 3, raptor = sp.trophic === 4;
  const bodyL = 0.55 + 0.15 * L.build, H = 0.3 + 0.12 * L.build;
  const legLen = 0.12 + 0.45 * L.reach * L.reach, neck = 0.04 + 0.35 * Math.max(0, L.reach - 0.45) * 2;
  const hr = 0.11 + 0.03 * ph.brain, bill = hr * (0.6 + (raptor ? 0.6 : 1.8) * L.snout);
  const tailL = (0.12 + 0.35 * L.tail) * (f === 'long tail plumes' ? 1.6 + osz : f === 'a fan tail' ? 1.2 : 1);
  const bx = 0, by = 0;
  const hx = bodyL * 0.42 + neck * 0.4 + hr * 0.3, hy = -H * 0.45 - neck * 0.9;
  const gy = H * 0.45 + legLen;
  const box = [-bodyL * 0.5 - tailL - 0.02, Math.min(hy - hr * (1.3 + (f === 'a crest' || f === 'head plumes' ? 1.3 * osz : 0)), f === 'a fan tail' ? -H * 0.4 - tailL * 0.9 : 0), hx + hr * 0.7 + bill + 0.03, Math.max(gy, f === 'a wattle' ? hy + hr * 2 : 0) + 0.03];
  const px = fit(ctx, R, box, 0.95);
  // legs and feet
  for (const d of [0.04, -0.04]) { line(ctx, [[bx + d, H * 0.3], [bx + d + 0.02, gy - 0.02]], px * (2 + legLen * 3), d > 0 ? '#c9953a' : '#a07428'); line(ctx, [[bx + d - 0.03, gy], [bx + d + 0.06, gy]], px * 1.6, '#a07428'); }
  // tail feathers
  const tc = { ...C, body: f === 'long tail plumes' ? C.accent : C.dark(1, 0.08) };
  if (f === 'a fan tail') { for (let k = -4; k <= 4; k++) { const a = Math.PI + 0.3 + k * 0.14 - 0.6; const p = ellipse(P2(), -bodyL * 0.4 + Math.cos(a) * tailL * 0.5, -H * 0.2 + Math.sin(a) * tailL * 0.6 - tailL * 0.3, tailL * 0.5, 0.04, a); skin(ctx, p, k % 2 ? tc : { ...tc, body: C.accent }, null, rng, [-1, -1, 0, 0.2], px, { pattern: false }); dot(ctx, -bodyL * 0.4 + Math.cos(a) * tailL * 0.9, -H * 0.2 + Math.sin(a) * tailL * 1.1 - tailL * 0.3, 0.025, C.dark); } }
  else for (let k = -1; k <= 1; k++) { const p = P2(); const tx = -bodyL * 0.45 - tailL, ty = -H * 0.05 + k * 0.04 + (f === 'long tail plumes' ? tailL * 0.25 : 0); p.moveTo(-bodyL * 0.3, -H * 0.1); p.quadraticCurveTo(-bodyL * 0.5, ty - 0.03, tx, ty); p.quadraticCurveTo(-bodyL * 0.45, ty + 0.06, -bodyL * 0.3, H * 0.1); skin(ctx, p, tc, null, rng, [tx, ty - 0.05, -0.2, ty + 0.1], px, { pattern: false }); }
  // neck and head with the body
  const sil = P2();
  ellipse(sil, bx, by, bodyL * 0.5, H * 0.5, -0.12);
  sil.moveTo(bodyL * 0.25, -H * 0.35); sil.quadraticCurveTo(bodyL * 0.38, hy + hr * 0.5, hx - hr * 0.4, hy); sil.lineTo(hx + hr * 0.2, hy + hr * 0.6); sil.quadraticCurveTo(bodyL * 0.48, -H * 0.1, bodyL * 0.42, H * 0.15); sil.closePath();
  ellipse(sil, hx, hy, hr, hr * 0.92);
  if (f === 'a crest' || f === 'head plumes') {
    for (let k = 0; k < 4; k++) { const ang = -Math.PI / 2 - 0.3 - k * 0.25; line(ctx, [[hx - hr * 0.2, hy - hr * 0.6], [hx - hr * 0.2 + Math.cos(ang) * hr * (f === 'head plumes' ? 2.6 : 1.5) * osz, hy - hr * 0.6 + Math.sin(ang) * hr * (f === 'head plumes' ? 1.6 : 1.5) * osz]], px * (f === 'head plumes' ? 1.6 : 3.2), C.accent); }
  }
  skin(ctx, sil, C, L, rng, [-bodyL * 0.5, hy - hr, hx + hr, H * 0.5], px, { belly: true, u: H * (0.12 + 0.2 * L.patSize) });
  // folded wing, with feather rows
  const wing = P2(); wing.moveTo(bodyL * 0.3, -H * 0.3); wing.bezierCurveTo(bodyL * 0.1, -H * 0.55, -bodyL * 0.45, -H * 0.3, -bodyL * 0.62 - tailL * 0.25, H * 0.05); wing.bezierCurveTo(-bodyL * 0.2, H * 0.2, bodyL * 0.15, H * 0.15, bodyL * 0.3, -H * 0.3);
  skin(ctx, wing, { ...C, body: L.showy ? C.dark(1, 0.1) : C.dark(1, 0.12), pat: C.accent }, { ...L, pattern: L.pattern === 'eyespots' ? 'spots' : L.pattern === 'plain' ? 'plain' : 'bands' }, rng, [-bodyL * 0.7, -H * 0.5, bodyL * 0.3, H * 0.2], px, { u: H * 0.12, texture: () => { for (let k = 0; k < 4; k++) line(ctx, [[-bodyL * (0.1 + k * 0.13), -H * 0.25], [-bodyL * (0.25 + k * 0.13), H * 0.1]], px, C.dark(0.6)); } });
  // bill: hooked for hunters, broad for water birds, long and thin for probers, short for seeds
  const by2 = hy + hr * 0.1, bl = hx + hr * 0.75;
  const billC = T(0.11, 0.65, raptor ? 0.4 : 0.55);
  const p = P2();
  if (raptor) { p.moveTo(bl - hr * 0.1, by2 - hr * 0.35); p.quadraticCurveTo(bl + bill, by2 - hr * 0.35, bl + bill, by2 + hr * 0.25); p.quadraticCurveTo(bl + bill * 0.6, by2 + hr * 0.05, bl - hr * 0.1, by2 + hr * 0.25); }
  else if (water && L.snout < 0.6) { p.moveTo(bl - hr * 0.1, by2 - hr * 0.25); p.quadraticCurveTo(bl + bill * 0.6, by2 - hr * 0.3, bl + bill, by2 + hr * 0.05); p.quadraticCurveTo(bl + bill * 0.6, by2 + hr * 0.3, bl - hr * 0.1, by2 + hr * 0.25); }
  else { p.moveTo(bl - hr * 0.1, by2 - hr * 0.25); p.lineTo(bl + bill, by2 + hr * (L.snout > 0.7 ? 0.25 : 0.05)); p.lineTo(bl - hr * 0.1, by2 + hr * 0.25); }
  p.closePath();
  skin(ctx, p, { ...C, body: billC, line: billC(1, -0.2) }, null, rng, [bl, by2 - hr * 0.4, bl + bill, by2 + hr * 0.4], px, { pattern: false });
  if (f === 'a casque') { const q = P2(); q.moveTo(bl - hr * 0.15, by2 - hr * 0.3); q.quadraticCurveTo(bl + bill * 0.2, by2 - hr * (0.9 + 0.8 * osz), bl + bill * 0.6, by2 - hr * 0.3); q.closePath(); skin(ctx, q, { ...C, body: C.accent }, null, rng, [bl, by2 - hr * 2, bl + bill, by2], px, { pattern: false }); }
  if (f === 'a wattle') { const q = ellipse(P2(), bl + hr * 0.1, by2 + hr * (0.6 + 0.4 * osz), hr * 0.25, hr * (0.4 + 0.4 * osz)); ctx.fillStyle = T(0.99, 0.75, 0.48); ctx.fill(q); }
  if (L.showy) { ctx.fillStyle = C.accent(0.85); ctx.beginPath(); ctx.ellipse(hx + hr * 0.15, hy - hr * 0.15, hr * 0.45, hr * 0.32, 0, 0, TAU); ctx.fill(); }
  eye(ctx, hx + hr * 0.25, hy - hr * 0.15, hr * 0.22, raptor ? 'reptile' : 'bird');
}

function drawFlyer(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, gr = sp.grade, f = L.ornament, osz = 0.55 + 0.9 * L.orn, bat = gr === 'bat';
  const span = 0.9 + 0.3 * L.reach, bw = 0.3 + 0.1 * L.build, hr = 0.12;
  const crestUp = gr === 'pterosaur' && (f === 'a sail crest' || f === 'a blade crest') ? 0.3 * osz : 0;
  const box = [-span, -span * 0.6 - crestUp, span, 0.35 + (f === 'a throat pouch' ? 0.1 : 0)];
  const px = fit(ctx, R, box, 0.97);
  const wingC = { ...C, body: bat ? C.dark(0.92, 0.06) : C.dark(0.9, 0.12), line: C.dark(1, -0.1) };
  for (const s of [-1, 1]) {
    const p = P2(); p.moveTo(s * bw * 0.3, -0.05); p.lineTo(s * span * 0.35, -span * 0.55); p.lineTo(s * span, -span * 0.4);
    if (bat) for (let k = 0; k < 3; k++) { const fx = s * span * (0.85 - k * 0.22), fy = -span * 0.1 + k * 0.08; p.quadraticCurveTo(s * span * (0.8 - k * 0.2), fy - 0.12, fx, fy + 0.12); }
    else p.quadraticCurveTo(s * span * 0.5, -span * 0.15, s * bw * 0.3, 0.12);
    p.lineTo(s * bw * 0.3, 0.12); p.closePath();
    skin(ctx, p, wingC, null, rng, [Math.min(0, s * span), -span * 0.6, Math.max(0, s * span), 0.2], px, { pattern: false });
    line(ctx, [[s * bw * 0.3, -0.05], [s * span * 0.35, -span * 0.55], [s * span, -span * 0.4]], px * 2, C.dark(1, -0.05));
    if (bat) for (let k = 0; k < 3; k++) line(ctx, [[s * span * 0.35, -span * 0.55], [s * span * (0.85 - k * 0.22), -span * 0.1 + k * 0.08 + 0.12]], px * 1.2, C.dark(1, 0.1));
  }
  const body = P2(); ellipse(body, 0, 0.05, bw * 0.5, 0.2); ellipse(body, 0, -0.18, hr, hr * 0.9);
  if (bat) { const big = f === 'big ears' ? 1.6 * osz : 1; for (const s of [-1, 1]) { const q = P2(); q.moveTo(s * hr * 0.3, -0.25); q.lineTo(s * hr * (0.6 + 0.3 * big), -0.25 - hr * 1.2 * big); q.lineTo(s * hr * 0.9, -0.18); q.closePath(); skin(ctx, q, C, null, rng, [-0.3, -0.6, 0.3, -0.1], px, { pattern: false }); } }
  else { const q = P2(); q.moveTo(hr * 0.5, -0.24); q.lineTo(hr + 0.25 + 0.2 * L.snout, -0.16); q.lineTo(hr * 0.5, -0.12); q.closePath(); body.addPath(q); }
  skin(ctx, body, C, L, rng, [-bw * 0.5, -0.3, bw * 0.5 + 0.4, 0.25], px, { u: 0.06, texture: () => { if (ph.covering === 'fur') furFringe(ctx, body, [-0.2, -0.3, 0.2, 0.1], C, px, rng); } });
  if (gr === 'pterosaur') {
    if (f === 'a sail crest') { const q = P2(); q.moveTo(-hr * 0.5, -0.24); q.quadraticCurveTo(-hr, -0.3 - 0.35 * osz, hr * 0.6, -0.26); q.closePath(); ctx.fillStyle = C.accent; ctx.fill(q); }
    if (f === 'a blade crest') tri(ctx, -hr * 0.2, -0.22, -hr * 1.8, -0.3 - 0.25 * osz, hr * 0.2, -0.26, C.accent);
    if (f === 'a throat pouch') { ctx.fillStyle = C.accent(0.85); ctx.beginPath(); ctx.ellipse(hr + 0.1, -0.08, 0.12, 0.07 + 0.04 * osz, 0, 0, TAU); ctx.fill(); }
  } else if (f === 'a nose leaf') tri(ctx, -hr * 0.2, -0.13, 0, -0.24 - 0.05 * osz, hr * 0.2, -0.13, C.accent);
  else if (f === 'a mane') { ctx.fillStyle = C.accent(0.8); ctx.beginPath(); ctx.ellipse(0, -0.06, bw * 0.45, 0.07, 0, 0, TAU); ctx.fill(); }
  for (const s of bat ? [-1, 1] : [1]) eye(ctx, s * hr * 0.4, -0.2, hr * 0.18, bat ? 'mammal' : 'reptile');
}

function drawFish(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament, osz = 0.55 + 0.9 * L.orn;
  const shark = sp.trophic === 4 && ph.size > 0.4 && !L.showy && !ph.endo;
  const eel = L.build < 0.12 && !shark;
  const H = eel ? 0.13 : 0.2 + 0.42 * L.build * (shark ? 0.6 : 1);
  const tailT = L.tail < 0.33 ? 'round' : L.tail < 0.7 ? 'forked' : 'lunate';
  const snout = (0.04 + 0.16 * L.snout) * (shark ? 1.4 : 1), sword = f === 'a sword' ? 0.35 * osz : 0;
  const tailS = H * (0.55 + 0.4 * L.tail) * (eel ? 0.6 : 1);
  const finUp = f === 'a sail fin' ? H * (0.6 + 1.0 * osz) : shark ? H * 0.75 : H * 0.4;
  const box = [-0.5 - tailS * 0.9, -H * 0.5 - finUp - (f === 'a lure' ? 0.18 : 0) - 0.02, 0.5 + snout + sword + 0.02, H * 0.5 + (f === 'streamer fins' ? H * (0.6 + osz) : H * 0.45) + (f === 'barbels' ? 0.06 : 0)];
  const px = fit(ctx, R, box, 0.97);
  const finC = { ...C, body: L.showy ? C.accent(0.85) : C.dark(0.85, 0.08), line: C.dark(0.9, -0.05) };
  const fin = (p, bx) => { skin(ctx, p, finC, null, rng, bx, px, { pattern: false, shade: false, texture: () => { for (let k = 0; k < 6; k++) line(ctx, [[bx[0] + (bx[2] - bx[0]) * k / 6, bx[3]], [bx[0] + (bx[2] - bx[0]) * (k + 0.5) / 6, bx[1]]], px * 0.7, C.dark(0.3)); } }); };
  // tail fin
  const tb = -0.5 + (eel ? 0.02 : 0.06), tp = P2();
  if (tailT === 'round') { tp.moveTo(tb, -H * 0.12); tp.quadraticCurveTo(tb - tailS * 1.2, -tailS * 0.8, tb - tailS, 0); tp.quadraticCurveTo(tb - tailS * 1.2, tailS * 0.8, tb, H * 0.12); }
  else if (shark) { tp.moveTo(tb, -H * 0.1); tp.lineTo(tb - tailS * 0.9, -tailS * 1.1); tp.lineTo(tb - tailS * 0.35, 0); tp.lineTo(tb - tailS * 0.55, tailS * 0.55); tp.lineTo(tb, H * 0.1); }
  else { const d = tailT === 'lunate' ? 1.05 : 0.8; tp.moveTo(tb, -H * 0.1); tp.quadraticCurveTo(tb - tailS * 0.5, -tailS * 0.5, tb - tailS * 0.9, -tailS * d); tp.quadraticCurveTo(tb - tailS * (tailT === 'lunate' ? 0.35 : 0.5), 0, tb - tailS * 0.9, tailS * d); tp.quadraticCurveTo(tb - tailS * 0.5, tailS * 0.5, tb, H * 0.1); }
  tp.closePath(); fin(tp, [tb - tailS, -tailS, tb, tailS]);
  // dorsal fin(s)
  const dp = P2();
  if (f === 'spiny fins') { dp.moveTo(-0.3, -H * 0.42); for (let k = 0; k <= 7; k++) { const x = -0.3 + k * 0.08; dp.lineTo(x + 0.02, -H * 0.45 - finUp * (k % 2 ? 0.55 : 1.1)); dp.lineTo(x + 0.06, -H * 0.45); } dp.closePath(); }
  else if (shark) { dp.moveTo(-0.08, -H * 0.42); dp.quadraticCurveTo(-0.02, -H * 0.5 - finUp, -0.12, -H * 0.5 - finUp); dp.quadraticCurveTo(0.05, -H * 0.55, 0.12, -H * 0.4); dp.closePath(); }
  else if (eel) { dp.moveTo(-0.45, -H * 0.4); dp.quadraticCurveTo(0, -H * 0.5 - finUp * 0.4, 0.3, -H * 0.38); dp.closePath(); }
  else { dp.moveTo(-0.25, -H * 0.42); dp.quadraticCurveTo(-0.15, -H * 0.5 - finUp, 0.05 - (f === 'a sail fin' ? 0 : 0.1), -H * 0.45 - finUp * 0.9); dp.quadraticCurveTo(0.15, -H * 0.5, 0.15, -H * 0.4); dp.closePath(); }
  fin(dp, [-0.3, -H * 0.5 - finUp, 0.2, -H * 0.4]);
  // anal and pelvic fins, and streamers
  const ap = P2(); ap.moveTo(-0.32, H * 0.38); ap.quadraticCurveTo(-0.3, H * 0.6 + (f === 'streamer fins' ? H * (0.6 + osz) : 0), -0.18 - (f === 'streamer fins' ? 0.1 : 0), H * 0.55 + (f === 'streamer fins' ? H * (0.5 + osz) : 0)); ap.lineTo(-0.12, H * 0.4); ap.closePath(); fin(ap, [-0.35, H * 0.38, -0.1, H]);
  if (f === 'streamer fins') for (let k = 0; k < 2; k++) curve(ctx, 0.15 - k * 0.04, H * 0.42, 0.05, H * (0.9 + osz * 0.6), -0.05 - k * 0.05, H * (1.0 + osz * 0.7), px * 1.5, finC.body);
  // the body
  const body = P2();
  body.moveTo(-0.5, 0);
  body.bezierCurveTo(-0.4, -H * 0.62, 0.3, -H * 0.62, 0.5 + snout * 0.6, -H * 0.12);
  body.quadraticCurveTo(0.5 + snout, -H * 0.02, 0.5 + snout, H * 0.04);
  body.bezierCurveTo(0.35, H * 0.55, -0.35, H * 0.62, -0.5, 0);
  body.closePath();
  skin(ctx, body, C, L, rng, [-0.5, -H * 0.62, 0.5 + snout, H * 0.62], px, { belly: true, u: H * (0.15 + 0.22 * L.patSize), texture: () => { if (ph.covering === 'scales' && !shark) scaleTexture(ctx, [-0.5, -H * 0.6, 0.45, H * 0.6], C, px); } });
  // pectoral fin, gills, eye, mouth
  const pp = P2(); pp.moveTo(0.22, H * 0.05); pp.quadraticCurveTo(0.08, H * 0.25, 0.04, H * 0.35); pp.quadraticCurveTo(0.15, H * 0.3, 0.28, H * 0.12); pp.closePath(); fin(pp, [0.04, H * 0.05, 0.28, H * 0.35]);
  if (shark) for (let k = 0; k < 4; k++) line(ctx, [[0.24 + k * 0.03, -H * 0.15], [0.22 + k * 0.03, H * 0.1]], px * 1.1, C.dark(0.6));
  else { ctx.strokeStyle = C.dark(0.6); ctx.lineWidth = px * 1.2; ctx.beginPath(); ctx.arc(0.18, 0, H * 0.4, -0.7, 0.7); ctx.stroke(); }
  const ex = 0.36 + snout * 0.4, ey = -H * 0.12;
  eye(ctx, ex, ey, Math.max(H * 0.1, 0.025) * (shark ? 0.7 : 1), 'fish');
  line(ctx, [[0.5 + snout - 0.01, H * 0.06], [0.44 + snout * 0.5, H * (shark ? 0.18 : 0.1)]], px * 1.4, C.dark);
  if (sp.trophic === 4) for (let k = 0; k < 3; k++) tri(ctx, 0.44 + snout * 0.5 + k * 0.025, H * 0.08, 0.45 + snout * 0.5 + k * 0.025, H * 0.13, 0.46 + snout * 0.5 + k * 0.025, H * 0.08, '#f2ecdc');
  if (f === 'a sword') { const p = P2(); p.moveTo(0.5 + snout, -H * 0.06); p.lineTo(0.5 + snout + sword, -H * 0.02); p.lineTo(0.5 + snout, H * 0.02); p.closePath(); ctx.fillStyle = C.dark; ctx.fill(p); }
  if (f === 'barbels') for (let k = 0; k < 2; k++) curve(ctx, 0.46 + snout, H * 0.08, 0.5 + snout, H * 0.3 + k * 0.03, 0.4 + snout - k * 0.06, H * 0.4 + k * 0.05, px * 1.3, C.dark);
  if (f === 'a lure') { curve(ctx, 0.35 + snout, -H * 0.4, 0.5 + snout, -H * 0.5 - 0.18, 0.55 + snout + 0.05, -H * 0.4 - 0.05, px * 1.3, C.dark); const g = ctx.createRadialGradient(0.6 + snout, -H * 0.4 - 0.05, 0, 0.6 + snout, -H * 0.4 - 0.05, 0.05); g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.5, 'rgba(160,255,230,0.8)'); g.addColorStop(1, 'rgba(160,255,230,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0.6 + snout, -H * 0.4 - 0.05, 0.05, 0, TAU); ctx.fill(); }
  // legs on a fish that walks ashore (fins becoming limbs)
  if (sp.habitat === 1 && ph.limbs) for (const x of [0.1, -0.25]) limb(ctx, [[x, H * 0.4], [x + 0.05, H * 0.6], [x + 0.1, H * 0.62]], H * 0.12, C.body, C.line, px);
}

function drawWhale(ctx, sp, R, C, rng, L) {
  const f = L.ornament, osz = 0.55 + 0.9 * L.orn;
  // stout whales have big blunt heads; slender, long-snouted ones are dolphins with a beak
  const H = 0.24 + 0.2 * L.build, beak = L.snout > 0.55 && L.build < 0.6 ? 0.05 + 0.12 * (L.snout - 0.55) * 2 : 0;
  const finUp = f === 'a tall fin' ? H * (0.6 + 0.9 * osz) : H * (0.25 + 0.2 * L.reach), flip = f === 'long flippers' ? 0.25 + 0.22 * osz : 0.1;
  const tusk = f === 'a tusk' ? 0.38 * osz : 0, head = 0.5;
  const box = [-0.76, -H * 0.5 - finUp - 0.02, head + beak + tusk + 0.03, H * 0.5 + flip * 0.9 + 0.02];
  const px = fit(ctx, R, box, 0.97);
  const finC = { ...C, body: C.dark(1, 0.04) };
  // flukes, flat and seen almost edge-on
  const tp = P2(); tp.moveTo(-0.44, -H * 0.06); tp.quadraticCurveTo(-0.58, -H * 0.1, -0.76, -H * 0.3); tp.quadraticCurveTo(-0.66, -H * 0.04, -0.64, 0); tp.quadraticCurveTo(-0.66, H * 0.06, -0.76, H * 0.22); tp.quadraticCurveTo(-0.58, H * 0.08, -0.44, H * 0.06); tp.closePath();
  skin(ctx, tp, finC, null, rng, [-0.76, -H * 0.3, -0.44, H * 0.22], px, { pattern: false });
  // dorsal fin, set well back
  const dp = P2(); dp.moveTo(-0.22, -H * 0.36); dp.quadraticCurveTo(-0.2, -H * 0.45 - finUp, -0.3, -H * 0.42 - finUp); dp.quadraticCurveTo(-0.12, -H * 0.5, -0.04, -H * 0.42); dp.closePath();
  skin(ctx, dp, finC, null, rng, [-0.3, -H * 0.5 - finUp, -0.04, -H * 0.35], px, { pattern: false });
  const hump = f === 'a hump' ? H * 0.3 * osz : 0;
  const body = P2();
  body.moveTo(-0.46, -H * 0.06);
  body.bezierCurveTo(-0.25, -H * 0.4 - hump, 0.05, -H * 0.58 - hump * 0.5, 0.32, -H * 0.5);
  if (beak) { body.quadraticCurveTo(head - 0.02, -H * 0.42, head, -H * 0.12); body.lineTo(head + beak, -H * 0.04); body.lineTo(head + beak, H * 0.02); body.lineTo(head - 0.02, H * 0.06); }
  else { body.bezierCurveTo(head, -H * 0.48, head + 0.04, -H * 0.1, head, H * 0.12); }
  body.bezierCurveTo(head - 0.05, H * 0.45, 0.1, H * 0.55, -0.15, H * 0.42);
  body.quadraticCurveTo(-0.38, H * 0.25, -0.46, H * 0.06);
  body.closePath();
  skin(ctx, body, C, { ...L, pattern: L.pattern === 'plain' ? 'dark back' : L.pattern }, rng, [-0.46, -H * 0.6, head + beak, H * 0.55], px, { belly: true, u: H * 0.22, eyespots: [[0.0, -H * 0.05]], eyeR: H * 0.14, texture: () => { if (L.build > 0.55) for (let k = 0; k < 7; k++) line(ctx, [[head - 0.05 - k * 0.05, H * 0.25], [head - 0.15 - k * 0.05, H * 0.48]], px, C.dark(0.35)); } });
  const fp = P2(); fp.moveTo(0.2, H * 0.22); fp.quadraticCurveTo(0.16, H * 0.4 + flip * 0.5, 0.08 - flip * 0.35, H * 0.42 + flip * 0.85); fp.quadraticCurveTo(0.16, H * 0.38, 0.28, H * 0.22); fp.closePath();
  skin(ctx, fp, finC, null, rng, [0, H * 0.2, 0.28, H + flip], px, { pattern: false });
  if (f === 'long flippers') for (let k = 0; k < 4; k++) dot(ctx, 0.16 - k * flip * 0.1, H * 0.35 + k * flip * 0.18, 0.012, C.light);
  // a long mouth line, a small eye just behind it, and a blowhole
  const my = beak ? H * 0.0 : H * 0.15;
  curve(ctx, head + beak - 0.01, my, (head + 0.2) / 2, my + H * 0.12, 0.2, my + H * 0.02, px * 1.4, C.dark);
  eye(ctx, 0.2, my - H * 0.08, Math.max(0.018, H * 0.07), 'mammal');
  ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(0.25, -H * 0.5 - hump * 0.3, 0.02, 0.008, 0, 0, TAU); ctx.fill();
  if (f === 'a tusk') { const p = P2(); p.moveTo(head + beak - 0.01, -H * 0.05); p.lineTo(head + beak + tusk, -H * 0.18); p.lineTo(head + beak - 0.01, H * 0.02); p.closePath(); ctx.fillStyle = '#efe6d0'; ctx.fill(p); for (let k = 1; k < 7; k++) { const x = head + beak + k * tusk / 7; line(ctx, [[x, -H * 0.13 + k * 0.0], [x - 0.02, -H * 0.03]], px * 0.7, 'rgba(120,100,70,0.6)'); } }
}

function drawSnake(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament, osz = 0.55 + 0.9 * L.orn;
  const th = 0.07 + 0.07 * L.build, waves = 1.2 + 0.8 * L.tail;
  const pts = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40; pts.push([-0.5 + t * 0.95, Math.sin(t * Math.PI * 2 * waves + 0.5) * 0.18 * (1 - 0.35 * t)]); }
  const [hx, hy] = pts[40];
  const box = [-0.55, -0.32 - (f === 'horns' ? 0.08 : 0) - (f === 'a hood' ? th * osz : 0), hx + 0.14 + 0.06 * L.snout, 0.32 + (f === 'a hood' ? th * osz : 0)];
  const px = fit(ctx, R, box, 0.97);
  const w = (i) => th * (i < 6 ? 0.35 + i * 0.11 : i > 34 ? 1 - (i - 34) * 0.04 : 1);
  // body: thick outline, then fill, then pattern dabs along the body
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i <= 40; i++) line(ctx, [pts[i - 1], pts[i]], w(i) * 2 + px * 2.4, C.line);
  for (let i = 1; i <= 40; i++) line(ctx, [pts[i - 1], pts[i]], w(i) * 2, C.body);
  for (let i = 1; i <= 40; i++) line(ctx, [[pts[i - 1][0], pts[i - 1][1] + w(i) * 0.5], [pts[i][0], pts[i][1] + w(i) * 0.5]], w(i) * 0.7, C.belly ? C.belly(0.6) : C.light(0.5));
  const p = L.pattern, step = Math.max(2, Math.round(2 + 4 * L.patSize));
  for (let i = 3; i < 38; i += step) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1], a = Math.atan2(y2 - y, x2 - x), r = w(i);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = C.pat;
    if (p === 'bands' || p === 'stripes') ctx.fillRect(-r * 0.3, -r, r * (p === 'bands' ? 0.9 : 0.5), r * 2);
    else if (p === 'spots' || p === 'eyespots') { ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.45, 0, TAU); ctx.fill(); }
    else if (p === 'dark back' || p === 'mottled') { ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.3); ctx.lineTo(0, -r); ctx.lineTo(r * 0.8, -r * 0.3); ctx.lineTo(0, r * 0.3); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  if (f === 'a rattle') for (let k = 0; k < 4; k++) dot(ctx, pts[0][0] - k * th * 0.4, pts[0][1], th * (0.45 - k * 0.05), T(0.1, 0.3, 0.6 - k * 0.05));
  // head
  const hl = th * (1.8 + 0.8 * L.snout), hw = th * 1.25;
  if (f === 'a hood') { const q = ellipse(P2(), hx - th * 0.8, hy, th * 1.5, hw * (1.3 + osz)); skin(ctx, q, C, null, rng, [hx - th * 2.5, hy - hw * 2.5, hx, hy + hw * 2.5], px, { pattern: false, texture: () => { dot(ctx, hx - th, hy - hw * 0.6, th * 0.3, C.accent); dot(ctx, hx - th, hy + hw * 0.6, th * 0.3, C.accent); } }); }
  const head = P2(); head.moveTo(hx - th * 0.5, hy - hw * 0.8); head.quadraticCurveTo(hx + hl, hy - hw, hx + hl, hy); head.quadraticCurveTo(hx + hl, hy + hw * 0.9, hx - th * 0.5, hy + hw * 0.8); head.closePath();
  skin(ctx, head, C, null, rng, [hx - th, hy - hw, hx + hl, hy + hw], px, { pattern: false });
  if (f === 'horns') tri(ctx, hx + hl * 0.3, hy - hw * 0.7, hx + hl * 0.35, hy - hw * (1.6 + osz), hx + hl * 0.5, hy - hw * 0.7, C.dark);
  if (f === 'a crest') for (let k = 0; k < 4; k++) tri(ctx, hx - th * 2 - k * th, hy - th * 0.9, hx - th * 1.5 - k * th, hy - th * (1.6 + 0.6 * osz), hx - th - k * th, hy - th * 0.9, C.accent);
  eye(ctx, hx + hl * 0.55, hy - hw * 0.35, hw * 0.28, 'reptile');
  line(ctx, [[hx + hl, hy + hw * 0.1], [hx + hl + th * 1.2, hy + hw * 0.2], [hx + hl + th * 1.5, hy]], px * 1.3, '#d24');
}

function drawTurtle(ctx, sp, R, C, rng, L) {
  const f = L.ornament, osz = 0.55 + 0.9 * L.orn, wet = sp.habitat !== 2;
  const dome = f === 'a high dome' ? 0.5 + 0.2 * osz : f === 'a flat shell' ? 0.22 : 0.36;
  const box = [-0.62, -dome - (f === 'a spiky shell' ? 0.12 : 0.03), 0.62 + 0.1 * L.reach, 0.3];
  const px = fit(ctx, R, box, 0.95);
  const skinC = { ...C, body: C.belly || C.light };
  // legs or flippers, head and tail
  if (wet) { for (const [x, s] of [[0.25, 1], [-0.3, -1]]) { const p = ellipse(P2(), x + s * 0.1, 0.12, 0.2, 0.06, s * 0.5); skin(ctx, p, skinC, null, rng, [x - 0.2, 0, x + 0.3, 0.25], px, { pattern: false }); } }
  else for (const x of [-0.3, 0.25]) limb(ctx, [[x, 0.05], [x, 0.22]], 0.12, skinC.body, C.line, px);
  const nk = 0.1 + 0.15 * L.reach;
  const head = P2(); head.moveTo(0.42, -0.02); head.quadraticCurveTo(0.42 + nk, -0.06, 0.48 + nk, -0.08); head.arc(0.48 + nk + 0.04, -0.06, 0.08, Math.PI, Math.PI * 2.4); head.quadraticCurveTo(0.42 + nk, 0.08, 0.42, 0.1); head.closePath();
  skin(ctx, head, skinC, L, rng, [0.4, -0.15, 0.62 + nk, 0.1], px, { u: 0.04 });
  eye(ctx, 0.52 + nk, -0.08, 0.022, 'reptile');
  tri(ctx, -0.45, 0, -0.6, 0.05, -0.45, 0.08, skinC.body);
  // the shell: a dome of scutes, with a ridge or spikes
  const sh = P2(); sh.moveTo(-0.5, 0.1); sh.bezierCurveTo(-0.5, -dome * 1.3, 0.45, -dome * 1.3, 0.48, 0.1); sh.closePath();
  const shellC = { ...C, body: C.body, pat: L.showy ? C.accent : C.dark };
  skin(ctx, sh, shellC, L, rng, [-0.5, -dome, 0.48, 0.1], px, { u: 0.07, texture: () => {
    ctx.strokeStyle = C.dark(0.75); ctx.lineWidth = px * 1.6;
    for (const [x, y] of [[-0.25, -dome * 0.45], [0.0, -dome * 0.65], [0.25, -dome * 0.45]]) { ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * TAU; const xx = x + Math.cos(a) * 0.13, yy = y + Math.sin(a) * dome * 0.32; if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); }
    line(ctx, [[-0.5, 0.05], [0.48, 0.05]], px * 2, C.dark(0.6));
  } });
  if (f === 'a ridged shell') for (let k = 0; k < 5; k++) dot(ctx, -0.3 + k * 0.15, -dome * (0.8 + 0.15 * Math.sin((k + 0.5) / 5 * Math.PI)), 0.035, C.dark);
  if (f === 'a spiky shell') for (let k = 0; k < 8; k++) { const a = Math.PI + 0.25 + (k / 7) * (Math.PI - 0.5); const x = Math.cos(a) * 0.45, y = Math.sin(a) * dome * 0.95 + 0.05; tri(ctx, x - 0.03, y + 0.02, x + Math.cos(a) * 0.08, y + Math.sin(a) * 0.1, x + 0.03, y + 0.02, C.dark); }
}

// primates (sitting) and thinking beings (standing)
function drawUpright(ctx, sp, R, C, rng, L) {
  const ph = sp.ph, f = L.ornament, osz = 0.55 + 0.9 * L.orn, sap = sp.grade === 'sapient';
  const bw = 0.17 + 0.1 * L.build, armL = 0.35 + 0.3 * L.reach, hr = 0.15 + 0.05 * ph.brain, tail = sap ? 0 : L.tail > 0.35 ? 0.2 + 0.5 * L.tail : 0;
  const legL = sap ? 0.45 + 0.15 * L.reach : 0.25;
  const box = [-0.35 - tail * 0.8, -0.55 - hr * (2 + (f === 'a crest' || f === 'a mane' || f === 'long hair' ? osz * 0.8 : 0)), 0.45, 0.4 + legL * (sap ? 1 : 0.4)];
  const px = fit(ctx, R, box, 0.95);
  const gy = sap ? 0.35 + legL : 0.42;
  if (tail) { curve(ctx, -bw * 0.6, 0.3, -0.35 - tail * 0.4, 0.4, -0.3 - tail * 0.8, -0.1 - tail * 0.3, 0.05 + px * 2, C.line); curve(ctx, -bw * 0.6, 0.3, -0.35 - tail * 0.4, 0.4, -0.3 - tail * 0.8, -0.1 - tail * 0.3, 0.05, C.body); }
  // far arm, legs
  limb(ctx, [[-0.02, -0.28], [-0.12, -0.28 + armL * 0.5], [-0.05, -0.28 + armL]], 0.07, C.dark(1, 0.06), null, px);
  if (sap) for (const d of [-0.05, 0.06]) limb(ctx, [[d, 0.25], [d + 0.02, 0.25 + legL * 0.5], [d, gy]], 0.09, d < 0 ? C.dark(1, 0.06) : C.body, d < 0 ? null : C.line, px);
  else limb(ctx, [[-0.05, 0.25], [0.18, 0.2], [0.15, gy], [0.23, gy]], 0.09, C.body, C.line, px);
  if (f === 'a mane' || f === 'long hair') { const p = blobPath(P2(), 0.02, -0.55 + hr * 0.5, hr * 1.5 * osz, hr * (f === 'long hair' ? 2.4 : 1.7) * osz, rng, 0.15, 11); skin(ctx, p, { ...C, body: f === 'long hair' ? T(L.accent, 0.4, 0.3) : C.dark(1, 0.08) }, null, rng, [-0.3, -0.9, 0.3, 0.1], px, { pattern: false }); }
  const body = P2(); body.moveTo(-bw, 0.3); body.quadraticCurveTo(-bw * 1.1, -0.3, -bw * 0.35, -0.42); body.lineTo(bw * 0.35, -0.42); body.quadraticCurveTo(bw * 1.1, -0.3, bw, 0.3); body.quadraticCurveTo(0, 0.38, -bw, 0.3); body.closePath();
  ellipse(body, 0.02, -0.55, hr, hr * 1.05);
  skin(ctx, body, C, sap && f !== 'body paint' ? null : L, rng, [-bw * 1.1, -0.55 - hr, bw * 1.1, 0.38], px, { belly: !sap, u: 0.06, texture: () => { if (ph.covering === 'fur' && !sap) furFringe(ctx, body, [-bw, -0.5, bw, 0.3], C, px, rng); } });
  // clothing for thinking beings: a tunic in their accent colour
  if (sap) { const p = P2(); p.moveTo(-bw * 1.02, 0.32); p.quadraticCurveTo(-bw * 1.05, -0.2, -bw * 0.5, -0.3); p.lineTo(bw * 0.5, -0.3); p.quadraticCurveTo(bw * 1.05, -0.2, bw * 1.02, 0.32); p.closePath(); skin(ctx, p, { ...C, body: C.accent(1, -0.05), pat: C.accent(1, -0.25) }, { ...L, pattern: L.pattern === 'eyespots' ? 'spots' : L.pattern }, rng, [-bw, -0.3, bw, 0.32], px, { u: 0.05 }); }
  // near arm, holding a spear if it's a thinking being
  if (sap) line(ctx, [[0.2, -0.75], [0.12, gy + 0.02]], px * 2.5, T(0.08, 0.35, 0.35));
  if (sap) tri(ctx, 0.18, -0.75, 0.21, -0.88, 0.235, -0.74, '#9aa4ad');
  limb(ctx, [[0.04, -0.3], [0.13, -0.3 + armL * 0.5], [0.16, -0.28 + armL * (sap ? 0.6 : 1)]], 0.07, C.body, C.line, px);
  // the face: ears, a bare-skinned muzzle, small dark eyes under a brow
  const fx = 0.06, fy = -0.53;
  const faceC = f === 'a bright face' ? C.accent : sap ? T(0.07, 0.35, 0.55 + 0.15 * L.shade) : T(0.06, 0.25, 0.6 + 0.12 * L.shade);
  if (!sap) { const p = ellipse(P2(), fx - hr * 0.85, fy - hr * 0.05, hr * 0.3, hr * 0.35); skin(ctx, p, C, null, rng, [fx - hr * 1.2, fy - hr * 0.4, fx - hr * 0.5, fy + hr * 0.3], px, { pattern: false }); dot(ctx, fx - hr * 0.85, fy - hr * 0.05, hr * 0.15, faceC); }
  const fp = P2(); fp.moveTo(fx - hr * 0.35, fy - hr * 0.35); fp.bezierCurveTo(fx + hr * 0.3, fy - hr * 0.6, fx + hr * 1.0, fy - hr * 0.4, fx + hr * 0.95, fy + hr * 0.15); fp.bezierCurveTo(fx + hr * 0.95, fy + hr * 0.7, fx - hr * 0.1, fy + hr * 0.85, fx - hr * 0.3, fy + hr * 0.3); fp.closePath();
  skin(ctx, fp, { ...C, body: faceC, line: faceC(1, -0.2) }, null, rng, [fx - hr * 0.4, fy - hr * 0.6, fx + hr, fy + hr * 0.8], px, { pattern: false });
  line(ctx, [[fx - hr * 0.05, fy - hr * 0.3], [fx + hr * 0.75, fy - hr * 0.28]], px * 2, C.dark(0.8));
  for (const ex of [fx + hr * 0.15, fx + hr * 0.6]) { dot(ctx, ex, fy - hr * 0.08, hr * 0.12, '#1a120c'); dot(ctx, ex - hr * 0.03, fy - hr * 0.11, hr * 0.04, 'rgba(255,255,255,0.8)'); }
  dot(ctx, fx + hr * 0.82, fy + hr * 0.2, hr * 0.06, C.dark(0.7));
  curve(ctx, fx + hr * 0.3, fy + hr * 0.5, fx + hr * 0.55, fy + hr * 0.58, fx + hr * 0.78, fy + hr * 0.45, px * 1.2, C.dark(0.8));
  if (f === 'a beard') { const p = P2(); p.moveTo(fx - hr * 0.1, fy + hr * 0.4); p.quadraticCurveTo(fx + hr * 0.3, fy + hr * (1 + osz * 0.8), fx + hr * 0.75, fy + hr * 0.4); p.closePath(); ctx.fillStyle = C.light; ctx.fill(p); }
  if (f === 'a crest') { const p = P2(); p.moveTo(-hr * 0.5, -0.55 - hr * 0.7); p.quadraticCurveTo(0.02, -0.55 - hr * (1.4 + osz * 0.8), hr * 0.6, -0.55 - hr * 0.75); p.closePath(); ctx.fillStyle = C.accent; ctx.fill(p); }
  if (f === 'body paint') for (let k = 0; k < 3; k++) line(ctx, [[fx + hr * 0.05, fy + hr * (0.15 + k * 0.12)], [fx + hr * 0.6, fy + hr * (0.15 + k * 0.12)]], px * 1.2, C.accent);
}

// ---------- entry points ----------

export function drawOrganism(ctx, sp, cx, cy, R) {
  if (!sp.ph) return;
  const L = looks(sp), C = palette(sp, L), rng = hashRng(sp.id || 1), ph = sp.ph, gr = sp.grade;
  ctx.save();
  ctx.translate(cx, cy);
  if (!ph.euk) drawMicrobe(ctx, sp, R, C, rng, L);
  else if (sp.kingdom === 'plant') drawPlant(ctx, sp, R, C, rng, L);
  else if (sp.kingdom === 'fungus') drawFungus(ctx, sp, R, C, rng, L);
  else if (!ph.animal) drawProtist(ctx, sp, R, C, rng, L);
  else if (ph.level === 2 || ph.radial || gr === 'sponge' || gr === 'jelly') drawRadial(ctx, sp, R, C, rng, L);
  else if (gr === 'squid') drawSquid(ctx, sp, R, C, rng, L);
  else if (gr === 'worm') drawWorm(ctx, sp, R, C, rng, L);
  else if (gr === 'mollusc') drawMollusc(ctx, sp, R, C, rng, L);
  else if (ph.skeleton !== 'endo') drawArthropod(ctx, sp, R, C, rng, L);
  else drawVertebrate(ctx, sp, R, C, rng, L);
  ctx.restore();
}

// a cached picture of a species, as an image URL (for the panels and the tree of life)
const cache = new Map();
export function spriteURL(sp, px = 64) {
  if (typeof document === 'undefined' || !sp.ph) return '';
  const key = `${sp.id}|${px}|${sp.grade}|${sp.genes[GI.size].toFixed(2)}|${sp.genes[GI.ornament].toFixed(3)}`;
  let url = cache.get(key);
  if (url) return url;
  const dpr = Math.min(2, window.devicePixelRatio || 1), n = Math.round(px * dpr);
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d');
  drawOrganism(ctx, sp, n / 2, n / 2, n * 0.42);
  url = cv.toDataURL();
  if (cache.size > 600) cache.clear();
  cache.set(key, url);
  return url;
}
