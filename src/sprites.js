// Procedural organisms: every species is drawn from its own genome, so body plans visibly change
// down the tree of life (shells lost, legs gained, segments fused, wings, bigger brains).
// Drawing is plain Canvas 2D, side view, facing right, fitted into a circle of radius R.

import { GI } from './genome.js';

const TAU = Math.PI * 2;
const hsl = (h, s, l, a = 1) => `hsla(${Math.round(((h % 1) + 1) % 1 * 360)},${Math.round(s * 100)}%,${Math.round(l * 100)}%,${a})`;

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

// colours from the genome: a body colour, a darker shade, and a showy accent
function palette(sp) {
  const g = sp.genes, h = g[GI.hue], disp = g[GI.display];
  const k = sp.kingdom;
  if (sp.grade === 'diatom') return { body: hsl(0.11 + 0.04 * h, 0.55, 0.55, 0.9), dark: hsl(0.1, 0.4, 0.3), accent: hsl(0.12, 0.3, 0.8) };
  if (k === 'plant') return { body: hsl(0.25 + 0.12 * (h - 0.5), 0.55, 0.42), dark: hsl(0.27, 0.5, 0.26), accent: hsl(h, 0.75, 0.62), wood: hsl(0.07, 0.4, 0.3) };
  if (k === 'fungus') return { body: hsl(0.05 + 0.1 * h, 0.45 + 0.3 * disp, 0.5), dark: hsl(0.07, 0.3, 0.3), accent: hsl(0.1, 0.25, 0.85) };
  if (k === 'bacteria') return sp.grade === 'cyano'
    ? { body: hsl(0.45 + 0.08 * h, 0.55, 0.45), dark: hsl(0.47, 0.5, 0.28), accent: hsl(0.4, 0.6, 0.7) }
    : { body: hsl(0.55 + 0.12 * h, 0.45, 0.58), dark: hsl(0.58, 0.4, 0.33), accent: hsl(0.6, 0.6, 0.8) };
  if (k === 'archaea') return { body: hsl(0.72 + 0.12 * h, 0.45, 0.58), dark: hsl(0.75, 0.4, 0.32), accent: hsl(0.8, 0.5, 0.8) };
  if (k === 'protist') return { body: hsl(0.45 + 0.2 * h, 0.4, 0.6, 0.9), dark: hsl(0.5, 0.35, 0.32), accent: hsl(0.08, 0.6, 0.55) };
  // animals: muted unless the genome is showy; furry ones come in browns, greys and russets
  const s = 0.3 + 0.55 * disp;
  const wood = hsl(0.08, 0.35, 0.35);
  if (sp.ph?.covering === 'fur' && disp < 0.6) {
    const fh = 0.04 + 0.08 * h, fs = 0.15 + 0.3 * ((h * 7) % 1);
    return { body: hsl(fh, fs, 0.42 + 0.15 * ((h * 3) % 1)), dark: hsl(fh, fs, 0.24), accent: hsl(h + 0.5, 0.6, 0.6), belly: hsl(fh, fs * 0.6, 0.75), wood };
  }
  return { body: hsl(h, s, 0.5), dark: hsl(h, s * 0.8, 0.28), accent: hsl(h + 0.5, 0.8, 0.6), belly: hsl(h, s * 0.6, 0.72), wood };
}

function blob(ctx, x, y, rx, ry, rng, wobble = 0.15, n = 9) {
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 + (rng() - 0.5) * 2 * wobble;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  const p = pts[0], q = pts[1];
  ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  ctx.closePath();
}

function eye(ctx, x, y, r) {
  ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.55, 0, TAU); ctx.fill();
}

// ---------- microbes ----------

function drawMicrobe(ctx, sp, R, C, rng) {
  const g = sp.genes, ph = sp.ph;
  const rod = g[GI.segments] > 0.35, colony = g[GI.adhesion] > 0.35 || sp.grade === 'cyano';
  const n = colony ? (sp.grade === 'cyano' ? 6 : 4) : 1;
  ctx.lineWidth = Math.max(1, R * 0.06);
  const cell = (x, y, a, s) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = C.body; ctx.strokeStyle = C.dark;
    if (sp.kingdom === 'archaea') blob(ctx, 0, 0, s * (rod ? 1.3 : 1), s * 0.85, rng, 0.25, 7);
    else if (rod) { ctx.beginPath(); ctx.roundRect(-s * 1.3, -s * 0.6, s * 2.6, s * 1.2, s * 0.6); }
    else { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); }
    ctx.fill(); ctx.stroke();
    if (sp.grade === 'cyano') { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, TAU); ctx.fill(); }
    if (ph.motile && n === 1) {
      ctx.beginPath(); ctx.moveTo(-s * (rod ? 1.3 : 1), 0);
      for (let k = 1; k <= 6; k++) ctx.lineTo(-s * (rod ? 1.3 : 1) - k * s * 0.35, Math.sin(k * 1.6) * s * 0.35);
      ctx.stroke();
    }
    ctx.restore();
  };
  if (n === 1) cell(R * 0.1, 0, -0.3, R * 0.42);
  else if (sp.grade === 'cyano') for (let i = 0; i < n; i++) cell(-R * 0.75 + i * R * 0.3, Math.sin(i * 0.9) * R * 0.25, 0, R * 0.18);
  else for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.4; cell(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38, a, R * 0.24); }
}

function drawProtist(ctx, sp, R, C, rng) {
  const g = sp.genes, ph = sp.ph, colony = ph.level === 1;
  if (sp.grade === 'foram') {
    // a chambered chalky shell with thread-like pseudopods
    ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(1, R * 0.02);
    for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4); ctx.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95); ctx.stroke(); }
    ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.04);
    for (let k = 6; k >= 0; k--) {
      const a = k * 0.9, r = R * (0.1 + 0.05 * k);
      ctx.fillStyle = k % 2 ? '#efe6d2' : '#dccfb2'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    return;
  }
  ctx.lineWidth = Math.max(1, R * 0.05);
  const one = (x, y, s) => {
    ctx.fillStyle = C.body; ctx.strokeStyle = C.dark;
    if (ph.motile && sp.trophic !== 4) { ctx.beginPath(); ctx.ellipse(x, y, s * 1.25, s * 0.8, -0.2, 0, TAU); }
    else blob(ctx, x, y, s, s, rng, sp.trophic === 4 ? 0.35 : 0.18, sp.trophic === 4 ? 7 : 10);
    ctx.fill(); ctx.stroke();
    if (sp.chloro) { ctx.fillStyle = hsl(0.3, 0.6, 0.4); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + (rng() - 0.5) * s, y + (rng() - 0.5) * s, s * 0.2, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(x + s * 0.15, y - s * 0.1, s * 0.28, 0, TAU); ctx.fill();
    if (ph.motile && !colony) {
      ctx.strokeStyle = C.dark;
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 1.2, y + Math.sin(a) * s * 0.78); ctx.lineTo(x + Math.cos(a) * s * 1.45, y + Math.sin(a) * s * 0.98); ctx.stroke(); }
    }
  };
  if (!colony) one(0, 0, R * 0.55);
  else {
    ctx.strokeStyle = C.dark; ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, TAU); ctx.globalAlpha = 0.35; ctx.fillStyle = C.body; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; one(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.17); }
    one(0, 0, R * 0.17);
  }
}

// ---------- plants and fungi ----------

function drawPlant(ctx, sp, R, C, rng) {
  const g = sp.genes, ph = sp.ph, gr = sp.grade;
  const base = R * 0.85;
  ctx.lineCap = 'round';
  if (gr === 'algae') return drawProtist(ctx, sp, R, C, rng);
  if (gr === 'diatom') {
    // glass boxes: round (centric) or boat-shaped (pennate), etched with fine lines
    ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.04);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * R * 0.55, y = (i % 2 ? 0.25 : -0.2) * R, pen = (sp.id + i) % 2;
      ctx.fillStyle = C.body; ctx.beginPath();
      if (pen) ctx.ellipse(x, y, R * 0.42, R * 0.13, 0.4, 0, TAU); else ctx.arc(x, y, R * 0.24, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.accent;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); if (pen) { ctx.moveTo(x + k * R * 0.12, y - R * 0.08); ctx.lineTo(x + k * R * 0.12 + R * 0.04, y + R * 0.08); } else { ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(k) * R * 0.22, y + Math.sin(k) * R * 0.22); } ctx.stroke(); }
      ctx.strokeStyle = C.dark;
    }
    return;
  }
  if (gr === 'waterplant') {
    // lily pads on the surface and a flower
    ctx.fillStyle = 'rgba(60,110,170,0.35)'; ctx.fillRect(-R, R * 0.05, R * 2, R * 0.9);
    ctx.fillStyle = C.body;
    for (const [x, y, r] of [[-R * 0.45, R * 0.15, R * 0.32], [R * 0.4, R * 0.25, R * 0.28], [0, R * 0.5, R * 0.3]]) { ctx.beginPath(); ctx.arc(x, y, r, 0.3, TAU - 0.1); ctx.lineTo(x, y); ctx.fill(); }
    ctx.fillStyle = C.accent;
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * R * 0.15, -R * 0.05 + Math.sin(a) * R * 0.15, R * 0.18, R * 0.07, a, 0, TAU); ctx.fill(); }
    return;
  }
  if (gr === 'seaweed') {
    const n = 3 + Math.round(g[GI.segments] * 3);
    for (let i = 0; i < n; i++) {
      const x0 = (i - (n - 1) / 2) * R * 0.22, h = R * (1.1 + 0.5 * rng());
      ctx.strokeStyle = i % 2 ? C.body : C.dark; ctx.lineWidth = R * 0.14;
      ctx.beginPath(); ctx.moveTo(x0, base);
      for (let k = 1; k <= 8; k++) ctx.lineTo(x0 + Math.sin(k * 1.1 + i) * R * 0.15, base - (h * k) / 8);
      ctx.stroke();
    }
    return;
  }
  if (gr === 'moss') {
    const mb = R * 0.55;
    ctx.fillStyle = C.body;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-R * 0.62 + i * R * 0.31, mb, R * (0.3 + 0.08 * rng()), Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = C.dark;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-R * 0.45 + i * R * 0.31, mb, R * 0.18, Math.PI, 0); ctx.fill(); }
    ctx.strokeStyle = C.wood; ctx.lineWidth = R * 0.05;
    for (let i = 0; i < 4; i++) { const x = -R * 0.45 + i * R * 0.3; ctx.beginPath(); ctx.moveTo(x, mb - R * 0.25); ctx.lineTo(x + R * 0.05, mb - R * 0.8); ctx.stroke(); ctx.fillStyle = C.wood; ctx.beginPath(); ctx.ellipse(x + R * 0.05, mb - R * 0.85, R * 0.05, R * 0.09, 0, 0, TAU); ctx.fill(); }
    return;
  }
  const tall = R * (0.9 + 0.9 * ph.size);
  if (gr === 'fern') {
    ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.06;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.45;
      const len = tall * (i === 2 ? 1 : 0.8);
      ctx.beginPath(); ctx.moveTo(0, base);
      const ex = Math.cos(a) * len, ey = base + Math.sin(a) * len;
      ctx.quadraticCurveTo(ex * 0.3, base - len * 0.8, ex, ey); ctx.stroke();
      for (let k = 1; k < 7; k++) {
        const t = k / 7, px = ex * t * t * 0.9 + ex * 0.3 * 2 * t * (1 - t) * 0.3, py = base + (ey - base) * t;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - R * 0.14 * (1 - t), py - R * 0.08); ctx.moveTo(px, py); ctx.lineTo(px + R * 0.14 * (1 - t), py - R * 0.08); ctx.stroke();
      }
    }
    return;
  }
  if (gr === 'grass') {
    ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.06;
    for (let i = 0; i < 9; i++) {
      const x0 = (i - 4) * R * 0.14, h = R * (0.9 + 0.5 * rng()), lean = (rng() - 0.5) * R * 0.5;
      ctx.beginPath(); ctx.moveTo(x0, base); ctx.quadraticCurveTo(x0, base - h * 0.6, x0 + lean, base - h); ctx.stroke();
      if (i % 3 === 1) { ctx.fillStyle = C.wood; ctx.beginPath(); ctx.ellipse(x0 + lean, base - h, R * 0.05, R * 0.14, lean / R, 0, TAU); ctx.fill(); }
    }
    return;
  }
  if (gr === 'cactus') {
    ctx.fillStyle = C.body; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.04);
    const col = (x, y0, y1, w) => { ctx.beginPath(); ctx.roundRect(x - w / 2, y1, w, y0 - y1, w / 2); ctx.fill(); ctx.stroke(); };
    col(0, base, base - tall * 0.95, R * 0.38);
    col(-R * 0.42, base - tall * 0.35, base - tall * 0.75, R * 0.22); ctx.fillRect(-R * 0.42, base - tall * 0.4, R * 0.3, R * 0.14);
    col(R * 0.42, base - tall * 0.25, base - tall * 0.6, R * 0.22); ctx.fillRect(R * 0.12, base - tall * 0.3, R * 0.3, R * 0.14);
    ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(1, R * 0.02);
    for (let k = 0; k < 10; k++) { const y = base - tall * (0.1 + 0.08 * k); ctx.beginPath(); ctx.moveTo(-R * 0.19, y); ctx.lineTo(-R * 0.28, y - R * 0.04); ctx.moveTo(R * 0.19, y); ctx.lineTo(R * 0.28, y - R * 0.04); ctx.stroke(); }
    if (ph.display > 0.5) { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(0, base - tall * 0.97, R * 0.1, 0, TAU); ctx.fill(); }
    return;
  }
  if (gr === 'vine') {
    // a vine twining up a tree trunk, with leaves and a few flowers
    ctx.fillStyle = C.wood; ctx.fillRect(-R * 0.12, base - tall, R * 0.24, tall);
    ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.06;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) { const y = base - (tall * k) / 20, x = Math.sin(k * 0.9) * R * 0.22; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = C.body;
    for (let k = 1; k < 10; k++) { const y = base - (tall * k) / 10, x = Math.sin(k * 1.8) * R * 0.26; ctx.beginPath(); ctx.ellipse(x + (k % 2 ? R * 0.14 : -R * 0.14), y, R * 0.14, R * 0.08, k % 2 ? 0.5 : -0.5, 0, TAU); ctx.fill(); }
    if (ph.display > 0.45) { ctx.fillStyle = C.accent; for (let k = 2; k < 9; k += 3) { ctx.beginPath(); ctx.arc(Math.sin(k * 1.8) * R * 0.3, base - (tall * k) / 10, R * 0.08, 0, TAU); ctx.fill(); } }
    return;
  }
  // trees and flowering plants
  const flowers = ph.display > 0.6;
  if (gr === 'conifer' || (gr === 'flower' && ph.size > 0.45)) {
    ctx.fillStyle = C.wood; ctx.fillRect(-R * 0.08, base - tall * 0.35, R * 0.16, tall * 0.35);
    if (gr === 'conifer') {
      ctx.fillStyle = C.dark;
      for (let k = 0; k < 3; k++) { const y = base - tall * (0.25 + k * 0.25), w = R * (0.75 - k * 0.18); ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.lineTo(0, y - tall * 0.4); ctx.closePath(); ctx.fill(); }
    } else {
      ctx.fillStyle = C.body;
      blob(ctx, 0, base - tall * 0.7, R * 0.75, tall * 0.4, rng, 0.12, 11); ctx.fill();
      if (flowers) { ctx.fillStyle = C.accent; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc((rng() - 0.5) * R * 1.2, base - tall * 0.7 + (rng() - 0.5) * tall * 0.55, R * 0.08, 0, TAU); ctx.fill(); } }
    }
    return;
  }
  // a herb with flowers
  ctx.strokeStyle = C.dark; ctx.lineWidth = R * 0.07;
  ctx.beginPath(); ctx.moveTo(0, base); ctx.quadraticCurveTo(R * 0.15, base - tall * 0.5, 0, base - tall * 0.85); ctx.stroke();
  ctx.fillStyle = C.body;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * R * 0.25, base - tall * 0.35, R * 0.25, R * 0.1, s * -0.5, 0, TAU); ctx.fill(); }
  const fy = base - tall * 0.9, petals = 5 + Math.round(g[GI.segments] * 3);
  ctx.fillStyle = C.accent;
  for (let k = 0; k < petals; k++) { const a = (k / petals) * TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * R * 0.2, fy + Math.sin(a) * R * 0.2, R * 0.16, R * 0.09, a, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#f2d04a'; ctx.beginPath(); ctx.arc(0, fy, R * 0.1, 0, TAU); ctx.fill();
}

function drawFungus(ctx, sp, R, C, rng) {
  const base = R * 0.8;
  if (sp.grade === 'lichen') {
    // crusts and frilly tufts on a rock
    ctx.fillStyle = '#6d6a66'; blob(ctx, 0, R * 0.25, R * 0.85, R * 0.55, rng, 0.12, 9); ctx.fill();
    const tint = ['#b7c46a', '#d8a440', '#9fb8a4'][sp.id % 3];
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 3 ? tint : C.accent; blob(ctx, (rng() - 0.5) * R * 1.1, R * 0.2 + (rng() - 0.6) * R * 0.6, R * (0.12 + 0.1 * rng()), R * (0.08 + 0.07 * rng()), rng, 0.3, 7); ctx.fill(); }
    return;
  }
  if (sp.grade === 'fungi') {
    ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(1, R * 0.05);
    for (let i = 0; i < 9; i++) {
      ctx.beginPath(); let x = (rng() - 0.5) * R * 1.4, y = base; ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * R * 0.5; y -= R * 0.3; ctx.lineTo(x, y); }
      ctx.stroke(); ctx.fillStyle = C.body; ctx.beginPath(); ctx.arc(x, y, R * 0.1, 0, TAU); ctx.fill();
    }
    return;
  }
  const n = sp.genes[GI.size] > 0.5 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i ? R * 0.35 : -R * 0.3), s = n === 1 ? 1 : i ? 0.7 : 0.9;
    ctx.fillStyle = C.accent; ctx.fillRect(x - R * 0.1 * s, base - R * 0.8 * s, R * 0.2 * s, R * 0.8 * s);
    ctx.fillStyle = C.body; ctx.beginPath(); ctx.ellipse(x, base - R * 0.8 * s, R * 0.55 * s, R * 0.38 * s, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = C.accent; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + (k - 1) * R * 0.22 * s, base - R * (0.98 + (k === 1 ? 0.1 : 0)) * s, R * 0.06 * s, 0, TAU); ctx.fill(); }
  }
}

// ---------- animals ----------

function drawRadial(ctx, sp, R, C, rng) {
  const ph = sp.ph, g = sp.genes;
  ctx.lineWidth = Math.max(1, R * 0.05);
  if (sp.grade === 'starfish') {
    const arms = 5, spiny = g[GI.segments] > 0.6;
    ctx.fillStyle = C.body; ctx.strokeStyle = C.dark;
    ctx.beginPath();
    for (let k = 0; k <= arms * 2; k++) { const a = -Math.PI / 2 + (k * Math.PI) / arms, r = k % 2 ? R * 0.32 : R * 0.88; if (k) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    if (spiny) { ctx.closePath(); ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.accent;
    if (spiny) for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; ctx.strokeStyle = C.dark; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55); ctx.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); ctx.stroke(); }
    else for (let k = 0; k < arms; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / arms; for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.2 * j, Math.sin(a) * R * 0.2 * j, R * 0.04, 0, TAU); ctx.fill(); } }
    return;
  }
  if (!ph.motile) {
    // sponge / coral: a vase or a branching colony
    if (g[GI.segments] > 0.5) {
      ctx.strokeStyle = C.body; ctx.lineCap = 'round'; ctx.lineWidth = R * 0.16;
      const br = (x, y, a, len, d) => { if (d > 3) return; const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); br(ex, ey, a - 0.5, len * 0.7, d + 1); br(ex, ey, a + 0.45, len * 0.7, d + 1); };
      br(0, R * 0.85, -Math.PI / 2, R * 0.6, 0);
    } else {
      ctx.fillStyle = C.body; ctx.strokeStyle = C.dark;
      ctx.beginPath(); ctx.moveTo(-R * 0.3, R * 0.85); ctx.lineTo(-R * 0.55, -R * 0.6); ctx.quadraticCurveTo(0, -R * 0.75, R * 0.55, -R * 0.6); ctx.lineTo(R * 0.3, R * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(0, -R * 0.62, R * 0.38, R * 0.1, 0, 0, TAU); ctx.fill();
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc((rng() - 0.5) * R * 0.6, (rng() - 0.3) * R, R * 0.06, 0, TAU); ctx.fill(); }
    }
    return;
  }
  // jellyfish: a bell and tentacles
  ctx.fillStyle = hsl(sp.genes[GI.hue], 0.5, 0.65, 0.75); ctx.strokeStyle = C.dark;
  ctx.beginPath(); ctx.ellipse(0, -R * 0.2, R * 0.65, R * 0.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  const n = 3 + Math.round(g[GI.segments] * 5);
  ctx.strokeStyle = hsl(sp.genes[GI.hue], 0.5, 0.6, 0.8);
  for (let i = 0; i < n; i++) {
    const x = -R * 0.55 + (i * R * 1.1) / (n - 1);
    ctx.beginPath(); ctx.moveTo(x, -R * 0.2);
    for (let k = 1; k <= 5; k++) ctx.lineTo(x + Math.sin(k + i) * R * 0.1, -R * 0.2 + k * R * 0.2);
    ctx.stroke();
  }
}

function drawWorm(ctx, sp, R, C) {
  const ph = sp.ph, n = Math.max(4, ph.segments + 2);
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1), x = -R * 0.8 + t * R * 1.5, y = Math.sin(t * 5) * R * 0.22;
    const r = R * (0.16 + 0.06 * Math.sin(t * Math.PI));
    ctx.fillStyle = i % 2 ? C.body : C.dark; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  if (ph.brain > 0.25) eye(ctx, R * 0.72, Math.sin(5) * R * 0.22 - R * 0.05, R * 0.07);
}

function drawMollusc(ctx, sp, R, C) {
  // a snail: a foot and a spiral shell
  ctx.fillStyle = C.belly || C.body; ctx.beginPath(); ctx.ellipse(0, R * 0.5, R * 0.85, R * 0.2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.belly || C.body; ctx.lineWidth = R * 0.05;
  ctx.beginPath(); ctx.moveTo(R * 0.7, R * 0.4); ctx.lineTo(R * 0.85, R * 0.05); ctx.moveTo(R * 0.6, R * 0.4); ctx.lineTo(R * 0.65, R * 0.05); ctx.stroke();
  ctx.fillStyle = C.body; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.06);
  ctx.beginPath(); ctx.arc(-R * 0.1, R * 0.05, R * 0.55, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 40; k++) { const a = k * 0.35, r = R * 0.5 * (1 - k / 44); const x = -R * 0.1 + Math.cos(a) * r, y = R * 0.05 + Math.sin(a) * r; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
}

function drawSquid(ctx, sp, R, C) {
  ctx.fillStyle = C.body; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.05);
  ctx.beginPath(); ctx.moveTo(-R * 0.9, 0); ctx.quadraticCurveTo(-R * 0.2, -R * 0.45, R * 0.25, -R * 0.25); ctx.lineTo(R * 0.25, R * 0.25); ctx.quadraticCurveTo(-R * 0.2, R * 0.45, -R * 0.9, 0); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.07; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const y0 = -R * 0.2 + i * R * 0.08; ctx.beginPath(); ctx.moveTo(R * 0.25, y0); ctx.quadraticCurveTo(R * 0.6, y0 + (i - 2.5) * R * 0.1, R * 0.9, y0 + (i - 2.5) * R * 0.18); ctx.stroke(); }
  eye(ctx, R * 0.12, -R * 0.08, R * 0.11);
}

function drawArthropod(ctx, sp, R, C) {
  const ph = sp.ph, g = sp.genes;
  const n = Math.max(2, Math.min(8, ph.segments + 1)), armour = ph.skeleton === 'exo';
  const len = R * 1.5, seg = len / (n + 0.8), y = R * 0.05;
  ctx.lineCap = 'round';
  // legs: one visible leg per pair, spread along the body
  ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.05);
  const nLegs = sp.grade === 'myriapod' ? n * 2 : ph.limbs * 2;
  for (let i = 0; i < nLegs; i++) {
    const x = -len / 2 + seg * 0.8 + ((i + 0.5) / nLegs) * (len - seg * 1.6);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (i % 2 ? 1 : -1) * R * 0.12, y + R * 0.28); ctx.lineTo(x + (i % 2 ? 1 : -1) * R * 0.2, y + R * 0.5); ctx.stroke();
  }
  if (ph.flying) {
    ctx.fillStyle = 'rgba(220,235,255,0.55)'; ctx.strokeStyle = 'rgba(160,180,210,0.9)'; ctx.lineWidth = Math.max(1, R * 0.03);
    ctx.beginPath(); ctx.ellipse(-R * 0.15, y - R * 0.45, R * 0.45, R * 0.2, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(R * 0.05, y - R * 0.4, R * 0.38, R * 0.16, -0.9, 0, TAU); ctx.fill(); ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + seg * (i + 0.5), r = seg * (0.62 + (i === n - 1 ? -0.05 : 0));
    ctx.fillStyle = i % 2 && armour ? C.dark : C.body; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * (armour ? 0.05 : 0.02));
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (armour ? 0.85 : 0.75), 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  const hx = len / 2 - seg * 0.1;
  ctx.fillStyle = C.body; ctx.beginPath(); ctx.arc(hx, y - R * 0.02, seg * 0.55, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.03);
  ctx.beginPath(); ctx.moveTo(hx, y - seg * 0.4); ctx.quadraticCurveTo(hx + R * 0.2, y - R * 0.5, hx + R * 0.35, y - R * 0.55); ctx.stroke();
  if (ph.brain > 0.2) eye(ctx, hx + seg * 0.2, y - seg * 0.1, R * 0.06);
  if (g[GI.display] > 0.6) { ctx.fillStyle = C.accent; for (let i = 0; i < n; i += 2) { ctx.beginPath(); ctx.arc(-len / 2 + seg * (i + 0.5), y - seg * 0.2, seg * 0.18, 0, TAU); ctx.fill(); } }
}

// fur, feathers or scales over a body ellipse
function covering(ctx, ph, x, y, rx, ry, C) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
  if (ph.covering === 'fur') {
    ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(0.6, rx * 0.025); ctx.globalAlpha = 0.6;
    for (let k = 0; k < 16; k++) { const px = x - rx + (k + 0.5) * (2 * rx) / 16, py = y - ry * 0.8; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - rx * 0.06, py + ry * 0.35); ctx.stroke(); }
  } else if (ph.covering === 'feathers') {
    ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(0.6, rx * 0.03); ctx.globalAlpha = 0.5;
    for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(x - rx + (k + 0.5 + (row % 2) * 0.5) * (2 * rx) / 7, y - ry * 0.6 + row * ry * 0.4, rx * 0.12, 0, Math.PI); ctx.stroke(); }
  } else if (ph.covering === 'scales') {
    ctx.fillStyle = C.dark; ctx.globalAlpha = 0.35;
    for (let row = 0; row < 4; row++) for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(x - rx + (k + 0.5 + (row % 2) * 0.5) * (2 * rx) / 9, y - ry * 0.7 + row * ry * 0.38, rx * 0.04, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function membraneWing(ctx, x, y, span, up, C, fingers) {
  ctx.fillStyle = C.dark; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(x - span * 0.2, y); ctx.lineTo(x - span * 0.1, y - up); ctx.lineTo(x - span * 0.9, y - up * 0.6);
  ctx.quadraticCurveTo(x - span * 0.6, y - up * 0.1, x - span * 0.45, y + up * 0.1); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  if (fingers) { ctx.strokeStyle = C.body; ctx.lineWidth = Math.max(1, span * 0.03); for (const f of [0.4, 0.65]) { ctx.beginPath(); ctx.moveTo(x - span * 0.1, y - up); ctx.lineTo(x - span * f, y + up * 0.05 - up * 0.2 * f); ctx.stroke(); } }
}

function drawVertebrate(ctx, sp, R, C) {
  const ph = sp.ph, g = sp.genes, gr = sp.grade;
  const wet = sp.habitat === 0 || sp.habitat === 3 || gr === 'fish';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (gr === 'snake') {
    ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.2;
    ctx.beginPath();
    for (let k = 0; k <= 30; k++) { const t = k / 30, x = -R * 0.85 + t * R * 1.5, y = R * 0.15 + Math.sin(t * 9) * R * 0.25 * (1 - 0.4 * t); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = C.dark; ctx.lineWidth = R * 0.05; ctx.setLineDash([R * 0.08, R * 0.12]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.body; ctx.beginPath(); ctx.ellipse(R * 0.68, R * 0.15 + Math.sin(9) * R * 0.15, R * 0.18, R * 0.12, 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d24'; ctx.lineWidth = R * 0.03; ctx.beginPath(); ctx.moveTo(R * 0.84, R * 0.2); ctx.lineTo(R * 0.98, R * 0.22); ctx.stroke();
    eye(ctx, R * 0.74, R * 0.12, R * 0.045);
    return;
  }
  if (gr === 'turtle') {
    ctx.fillStyle = C.belly || C.body;
    for (const x of [-R * 0.45, R * 0.35]) { ctx.beginPath(); ctx.ellipse(x, R * 0.3, R * 0.12, R * 0.2, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(R * 0.68, 0, R * 0.2, R * 0.14, 0, 0, TAU); ctx.fill();
    eye(ctx, R * 0.76, -R * 0.03, R * 0.04);
    ctx.fillStyle = C.body; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.05);
    ctx.beginPath(); ctx.ellipse(-R * 0.05, R * 0.1, R * 0.65, R * 0.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (const [x, y] of [[-0.35, -0.1], [0.05, -0.2], [0.35, -0.05]]) { ctx.moveTo(x * R + R * 0.15, y * R); ctx.arc(x * R, y * R, R * 0.15, 0, TAU); } ctx.stroke();
    return;
  }
  if (gr === 'bat' || gr === 'pterosaur') {
    // wings spread on both sides
    membraneWing(ctx, R * 0.05, -R * 0.02, R * 1.0, R * 0.6, C, gr === 'bat');
    ctx.save(); ctx.scale(-1, 1); membraneWing(ctx, R * 0.05, -R * 0.02, R * 0.9, R * 0.55, C, gr === 'bat'); ctx.restore();
    ctx.fillStyle = C.body; ctx.beginPath(); ctx.ellipse(0, R * 0.05, R * 0.3, R * 0.16, 0, 0, TAU); ctx.fill();
    covering(ctx, ph, 0, R * 0.05, R * 0.3, R * 0.16, C);
    if (gr === 'bat') {
      ctx.beginPath(); ctx.arc(R * 0.32, -R * 0.02, R * 0.14, 0, TAU); ctx.fill();
      ctx.fillStyle = C.dark; ctx.beginPath(); ctx.moveTo(R * 0.25, -R * 0.1); ctx.lineTo(R * 0.24, -R * 0.35); ctx.lineTo(R * 0.36, -R * 0.12); ctx.fill();
      eye(ctx, R * 0.38, -R * 0.04, R * 0.04);
    } else {
      ctx.beginPath(); ctx.moveTo(R * 0.25, -R * 0.05); ctx.lineTo(R * 0.95, R * 0.05); ctx.lineTo(R * 0.25, R * 0.1); ctx.fill();
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.moveTo(R * 0.3, -R * 0.05); ctx.lineTo(R * 0.1, -R * 0.4); ctx.lineTo(R * 0.42, -R * 0.05); ctx.fill();
      eye(ctx, R * 0.35, -R * 0.0, R * 0.04);
    }
    return;
  }
  if (gr === 'dinosaur') {
    const pred = sp.trophic === 4, feathered = ph.covering === 'feathers';
    ctx.fillStyle = C.body; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.04);
    if (pred) {
      // a two-legged hunter: big head, small arms, balancing tail
      ctx.strokeStyle = C.dark; ctx.lineWidth = R * 0.11;
      ctx.beginPath(); ctx.moveTo(-R * 0.05, R * 0.1); ctx.lineTo(-R * 0.1, R * 0.5); ctx.lineTo(R * 0.02, R * 0.78); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(R * 0.12, R * 0.1); ctx.lineTo(R * 0.15, R * 0.5); ctx.lineTo(R * 0.28, R * 0.78); ctx.stroke();
      ctx.fillStyle = C.body;
      ctx.beginPath(); ctx.moveTo(-R * 0.95, -R * 0.05); ctx.quadraticCurveTo(-R * 0.3, -R * 0.35, R * 0.35, -R * 0.35); ctx.lineTo(R * 0.4, R * 0.15); ctx.quadraticCurveTo(-R * 0.3, R * 0.25, -R * 0.95, -R * 0.05); ctx.fill();
      covering(ctx, ph, 0, -R * 0.1, R * 0.45, R * 0.25, C);
      ctx.beginPath(); ctx.ellipse(R * 0.55, -R * 0.42, R * 0.3, R * 0.18, 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.moveTo(R * 0.35, -R * 0.05); ctx.lineTo(R * 0.5, R * 0.08); ctx.stroke();
      eye(ctx, R * 0.62, -R * 0.48, R * 0.05);
    } else {
      // a long-necked giant on pillar legs
      ctx.strokeStyle = C.dark; ctx.lineWidth = R * 0.14;
      for (const x of [-R * 0.3, -R * 0.1, R * 0.15, R * 0.3]) { ctx.beginPath(); ctx.moveTo(x, R * 0.15); ctx.lineTo(x, R * 0.7); ctx.stroke(); }
      ctx.fillStyle = C.body;
      ctx.beginPath(); ctx.moveTo(-R * 0.98, R * 0.25); ctx.quadraticCurveTo(-R * 0.6, -R * 0.15, -R * 0.2, -R * 0.2); ctx.quadraticCurveTo(R * 0.5, -R * 0.25, R * 0.45, R * 0.25); ctx.closePath(); ctx.fill();
      covering(ctx, ph, 0, R * 0.05, R * 0.45, R * 0.22, C);
      ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.14; ctx.beginPath(); ctx.moveTo(R * 0.3, -R * 0.05); ctx.quadraticCurveTo(R * 0.55, -R * 0.4, R * 0.62, -R * 0.75); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(R * 0.7, -R * 0.78, R * 0.13, R * 0.08, 0, 0, TAU); ctx.fill();
      eye(ctx, R * 0.74, -R * 0.8, R * 0.035);
    }
    if (feathered || g[GI.display] > 0.6) { ctx.strokeStyle = C.accent; ctx.lineWidth = R * 0.05; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-R * 0.1 + k * R * 0.12, -R * 0.3); ctx.lineTo(-R * 0.15 + k * R * 0.12, -R * 0.45); ctx.stroke(); } }
    return;
  }
  if (gr === 'primate') {
    ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.12;
    ctx.beginPath(); ctx.moveTo(-R * 0.15, R * 0.15); ctx.quadraticCurveTo(-R * 0.6, R * 0.1, -R * 0.75, -R * 0.4); ctx.stroke(); // tail
    ctx.beginPath(); ctx.moveTo(-R * 0.1, R * 0.2); ctx.lineTo(-R * 0.15, R * 0.75); ctx.moveTo(R * 0.12, R * 0.2); ctx.lineTo(R * 0.2, R * 0.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.1, -R * 0.2); ctx.lineTo(R * 0.45, R * 0.15); ctx.lineTo(R * 0.5, R * 0.5); ctx.stroke();
    ctx.fillStyle = C.body; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.25, R * 0.35, 0.2, 0, TAU); ctx.fill();
    covering(ctx, ph, 0, 0, R * 0.25, R * 0.35, C);
    ctx.beginPath(); ctx.arc(R * 0.15, -R * 0.48, R * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = C.belly || C.accent; ctx.beginPath(); ctx.ellipse(R * 0.22, -R * 0.44, R * 0.12, R * 0.13, 0, 0, TAU); ctx.fill();
    eye(ctx, R * 0.24, -R * 0.5, R * 0.04);
    return;
  }
  if (gr === 'sapient') {
    ctx.fillStyle = C.body; ctx.strokeStyle = C.body; ctx.lineWidth = R * 0.16;
    ctx.beginPath(); ctx.moveTo(-R * 0.15, R * 0.9); ctx.lineTo(0, R * 0.25); ctx.lineTo(R * 0.15, R * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.4, R * 0.15); ctx.lineTo(0, -R * 0.2); ctx.lineTo(R * 0.4, R * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.2, R * 0.38, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -R * 0.6, R * 0.24, 0, TAU); ctx.fill();
    eye(ctx, R * 0.08, -R * 0.63, R * 0.05);
    return;
  }
  const bigHead = 0.18 + 0.12 * ph.brain;
  const L = R * (wet ? 1.45 : gr === 'crocodile' ? 1.5 : gr === 'rodent' ? 0.95 : 1.25), H = R * (gr === 'whale' ? 0.75 : wet ? 0.62 : gr === 'crocodile' ? 0.38 : gr === 'rodent' ? 0.62 : 0.56);
  const legLen = gr === 'ungulate' ? 1.5 : gr === 'crocodile' ? 0.6 : 1;
  const by = wet ? 0 : -R * 0.05 - (legLen - 1) * R * 0.25;
  // legs
  if (!wet && ph.limbs) {
    ctx.strokeStyle = C.dark; ctx.lineWidth = R * (gr === 'bird' ? 0.05 : 0.11);
    const pairs = Math.min(ph.limbs, gr === 'bird' ? 1 : 3);
    for (let i = 0; i < pairs; i++) {
      const x = pairs === 1 ? 0 : -L * 0.3 + (i * L * 0.6) / (pairs - 1);
      const sprawl = gr === 'amphibian' || gr === 'reptile' || gr === 'crocodile' ? 0.15 : 0;
      ctx.beginPath(); ctx.moveTo(x, by + H * 0.3); ctx.lineTo(x + sprawl * R, by + R * 0.45 * legLen); ctx.lineTo(x + sprawl * R + R * 0.08, by + R * 0.6 * legLen); ctx.stroke();
    }
  }
  // wings
  if (ph.flying) {
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.moveTo(-L * 0.1, by - H * 0.2); ctx.quadraticCurveTo(-L * 0.35, by - R * 1.0, -L * 0.6, by - R * 0.85); ctx.quadraticCurveTo(-L * 0.3, by - R * 0.45, L * 0.1, by - H * 0.1); ctx.fill();
  }
  // tail
  ctx.fillStyle = C.body;
  if (wet) {
    ctx.beginPath(); ctx.moveTo(-L * 0.45, by);
    if (gr === 'whale') { ctx.lineTo(-L * 0.62, by - H * 0.6); ctx.lineTo(-L * 0.55, by); ctx.lineTo(-L * 0.62, by + H * 0.6); }
    else { ctx.lineTo(-L * 0.68, by - H * 0.75); ctx.lineTo(-L * 0.6, by); ctx.lineTo(-L * 0.68, by + H * 0.75); }
    ctx.closePath(); ctx.fill();
  } else if (gr !== 'bird' && gr !== 'ungulate') {
    const furry = ph.covering === 'fur';
    ctx.strokeStyle = C.body; ctx.lineWidth = R * (gr === 'rodent' ? 0.035 : gr === 'carnivoran' ? 0.13 : furry ? 0.07 : 0.14);
    ctx.beginPath(); ctx.moveTo(-L * 0.4, by); ctx.quadraticCurveTo(-L * 0.6, by + H * 0.2, -L * (gr === 'rodent' ? 0.95 : 0.72), by - H * 0.3 * (furry ? 1 : -0.5)); ctx.stroke();
  }
  // body
  ctx.fillStyle = C.body; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, R * 0.04);
  ctx.beginPath(); ctx.ellipse(0, by, L * 0.45, H * 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (C.belly) { ctx.fillStyle = C.belly; ctx.beginPath(); ctx.ellipse(L * 0.05, by + H * 0.2, L * 0.3, H * 0.22, 0, 0, TAU); ctx.fill(); }
  if (!wet) covering(ctx, ph, 0, by, L * 0.45, H * 0.5, C);
  if (gr === 'crocodile' || ph.armour > 0.6) { ctx.fillStyle = C.dark; for (let k = 0; k < 6; k++) { const x = -L * 0.35 + k * L * 0.13; ctx.beginPath(); ctx.moveTo(x, by - H * 0.45); ctx.lineTo(x + L * 0.05, by - H * 0.75); ctx.lineTo(x + L * 0.1, by - H * 0.45); ctx.fill(); } }
  // fins
  if (wet && ph.limbs) {
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.moveTo(L * 0.05, by + H * 0.3); ctx.lineTo(-L * 0.1, by + H * 0.9); ctx.lineTo(L * 0.18, by + H * 0.35); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L * 0.05, by - H * 0.45); ctx.lineTo(-L * 0.2, by - H * 1.0); ctx.lineTo(L * 0.12, by - H * 0.45); ctx.fill();
  }
  // head
  const hx = L * 0.45, hr = R * bigHead;
  ctx.fillStyle = C.body;
  if (!wet) {
    ctx.beginPath(); ctx.arc(hx, by - H * 0.35, hr, 0, TAU); ctx.fill();
    // snouts: long jaws for crocodiles, muzzles for carnivores and hoofed mammals, a trunk for giants
    if (gr === 'crocodile') { ctx.beginPath(); ctx.moveTo(hx, by - H * 0.5); ctx.lineTo(hx + R * 0.55, by - H * 0.2); ctx.lineTo(hx, by - H * 0.1); ctx.fill(); }
    else if (gr === 'carnivoran' || gr === 'ungulate') { ctx.beginPath(); ctx.ellipse(hx + hr * 0.9, by - H * 0.25, hr * 0.6, hr * 0.38, 0.2, 0, TAU); ctx.fill(); }
    if (gr === 'ungulate' && ph.size > 0.75) { ctx.strokeStyle = C.body; ctx.lineWidth = hr * 0.45; ctx.beginPath(); ctx.moveTo(hx + hr * 0.8, by - H * 0.2); ctx.quadraticCurveTo(hx + hr * 1.4, by + H * 0.4, hx + hr * 1.1, by + H * 0.9); ctx.stroke(); }
  }
  const ey = wet ? by - H * 0.1 : by - H * 0.4;
  if (gr === 'ungulate' && ph.size <= 0.75) {
    ctx.strokeStyle = C.wood || '#8a6a45'; ctx.lineWidth = Math.max(1, hr * 0.18);
    ctx.beginPath(); ctx.moveTo(hx - hr * 0.2, ey - hr * 0.7); ctx.lineTo(hx - hr * 0.6, ey - hr * 2); ctx.moveTo(hx - hr * 0.45, ey - hr * 1.4); ctx.lineTo(hx - hr * 1.0, ey - hr * 1.7); ctx.moveTo(hx + hr * 0.1, ey - hr * 0.8); ctx.lineTo(hx + hr * 0.3, ey - hr * 1.9); ctx.stroke();
  }
  if (gr === 'carnivoran') { ctx.fillStyle = C.dark; for (const dx of [-0.5, 0.1]) { ctx.beginPath(); ctx.moveTo(hx + hr * dx, ey - hr * 0.6); ctx.lineTo(hx + hr * (dx + 0.15), ey - hr * 1.6); ctx.lineTo(hx + hr * (dx + 0.45), ey - hr * 0.7); ctx.fill(); } }
  if (gr === 'rodent') { ctx.fillStyle = C.belly || C.accent; ctx.beginPath(); ctx.arc(hx - hr * 0.3, ey - hr * 0.9, hr * 0.55, 0, TAU); ctx.fill(); }
  if (gr === 'bird') { ctx.fillStyle = '#e3b23c'; ctx.beginPath(); ctx.moveTo(hx + hr * 0.8, ey - hr * 0.1); ctx.lineTo(hx + hr * 1.8, ey + hr * 0.15); ctx.lineTo(hx + hr * 0.8, ey + hr * 0.4); ctx.fill(); }
  if (gr === 'mammal') { ctx.fillStyle = C.dark; ctx.beginPath(); ctx.moveTo(hx - hr * 0.5, ey - hr * 0.6); ctx.lineTo(hx - hr * 0.2, ey - hr * 1.5); ctx.lineTo(hx + hr * 0.1, ey - hr * 0.7); ctx.fill(); }
  if (gr === 'amphibian') { ctx.fillStyle = C.body; ctx.beginPath(); ctx.arc(hx + hr * 0.1, ey - hr * 0.3, hr * 0.45, 0, TAU); ctx.fill(); }
  eye(ctx, wet ? L * 0.32 : hx + hr * 0.3, ey, R * (0.05 + 0.03 * ph.brain));
  // display: a crest or stripes
  if (g[GI.display] > 0.6) {
    ctx.strokeStyle = C.accent; ctx.lineWidth = R * 0.06;
    if (gr === 'bird' || gr === 'reptile') { ctx.beginPath(); ctx.moveTo(hx - hr * 0.3, ey - hr * 0.8); ctx.lineTo(hx - hr * 0.9, ey - hr * 1.6); ctx.moveTo(hx, ey - hr * 0.9); ctx.lineTo(hx - hr * 0.3, ey - hr * 1.8); ctx.stroke(); }
    else for (let k = 0; k < 3; k++) { const x = -L * 0.2 + k * L * 0.15; ctx.beginPath(); ctx.moveTo(x, by - H * 0.45); ctx.lineTo(x - L * 0.05, by + H * 0.2); ctx.stroke(); }
  }
}

// ---------- entry points ----------

export function drawOrganism(ctx, sp, cx, cy, R) {
  if (!sp.ph) return;
  const C = palette(sp), rng = hashRng(sp.id), ph = sp.ph, gr = sp.grade;
  ctx.save();
  ctx.translate(cx, cy);
  if (!ph.euk) drawMicrobe(ctx, sp, R, C, rng);
  else if (sp.kingdom === 'plant') drawPlant(ctx, sp, R, C, rng);
  else if (sp.kingdom === 'fungus') drawFungus(ctx, sp, R, C, rng);
  else if (!ph.animal) drawProtist(ctx, sp, R, C, rng);
  else if (ph.level === 2 || ph.radial) drawRadial(ctx, sp, R, C, rng);
  else if (gr === 'squid') drawSquid(ctx, sp, R, C);
  else if (gr === 'worm') drawWorm(ctx, sp, R, C);
  else if (gr === 'mollusc') drawMollusc(ctx, sp, R, C);
  else if (ph.skeleton !== 'endo') drawArthropod(ctx, sp, R, C);
  else drawVertebrate(ctx, sp, R, C);
  ctx.restore();
}

// a cached picture of a species, as an image URL (for the panels and the tree of life)
const cache = new Map();
export function spriteURL(sp, px = 64) {
  if (typeof document === 'undefined' || !sp.ph) return '';
  const key = `${sp.id}|${px}|${sp.grade}|${sp.genes[GI.size].toFixed(2)}`;
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
