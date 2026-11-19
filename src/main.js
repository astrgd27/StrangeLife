// Entry point: builds the world, wires tools and controls, runs the loop.

import * as THREE from 'three';
import { World } from './world.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { PRESETS } from './life.js';

const $ = (id) => document.getElementById(id);

const TOOLS = [
  { id: 'inspect', icon: '🔍', name: 'Inspect', hint: 'Click a creature or a place to learn about it. Drag to spin the planet.' },
  { id: 'raise', icon: '⛰️', name: 'Raise land', hint: 'Paint to lift the ground. Push the seabed above the waves to make new land.', paint: true },
  { id: 'lower', icon: '🌊', name: 'Lower land', hint: 'Paint to sink the ground and carve out seas and straits.', paint: true },
  { id: 'heat', icon: '🔥', name: 'Warm', hint: 'Paint to warm the local climate. Melt ice caps, bake deserts.', paint: true },
  { id: 'cool', icon: '❄️', name: 'Cool', hint: 'Paint to cool the local climate. Grow glaciers.', paint: true },
  { id: 'wet', icon: '🌧️', name: 'Rain', hint: 'Paint to bring rain. Deserts turn to grassland and forest.', paint: true },
  { id: 'dry', icon: '🏜️', name: 'Drought', hint: 'Paint to dry the land out.', paint: true },
  { id: 'seed', icon: '🧬', name: 'Seed life', hint: 'Click to release a new species. Pick the organism below.' },
  { id: 'meteor', icon: '☄️', name: 'Meteor', hint: 'Click to strike. Wipes out life nearby and plunges the planet into an impact winter.' },
];
const SPEEDS = [0, 8, 30, 120, 480]; // ticks per second

const params = new URLSearchParams(location.search);
let seed = +params.get('seed') || Math.floor(Math.random() * 99999) + 1;
let world = new World(seed);
const renderer = new Renderer($('view'), world);
const ui = new UI(renderer, {});
ui.setWorld(world);
$('seed-input').value = seed;

let tool = 'inspect';
let speed = 2;

// ---------- tools ----------

const toolList = $('tool-list');
TOOLS.forEach((t, i) => {
  const b = document.createElement('button');
  b.className = 'tool';
  b.dataset.tool = t.id;
  b.title = `${t.name} (${i + 1})`;
  b.setAttribute('aria-label', t.name);
  b.innerHTML = `<span aria-hidden="true">${t.icon}</span><span class="k">${i + 1}</span>`;
  b.addEventListener('click', () => setTool(t.id));
  toolList.appendChild(b);
});
for (const [k, p] of Object.entries(PRESETS)) {
  const o = document.createElement('option');
  o.value = k; o.textContent = p.label;
  $('seed-preset').appendChild(o);
}
$('seed-preset').value = 'grazer';

function setTool(id) {
  tool = id;
  const t = TOOLS.find((x) => x.id === id);
  toolList.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === id));
  $('tool-title').textContent = t.name;
  $('tool-hint').textContent = t.hint;
  $('opt-brush').hidden = !t.paint;
  $('opt-preset').hidden = id !== 'seed';
  const c = renderer.controls;
  // painting tools take the left button; spin with the right
  c.mouseButtons = t.paint
    ? { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  $('view').classList.toggle('painting', id !== 'inspect');
  if (id === 'inspect') renderer.showCursor(-1);
}
setTool('inspect');
if (window.innerWidth <= 680) $('panel').classList.add('collapsed');

// keep floating panels clear of the top bar and toolbar, whatever their wrapped height
const ro = new ResizeObserver(() => {
  const root = document.documentElement.style;
  root.setProperty('--topbar-h', document.querySelector('.topbar').offsetHeight + 'px');
  root.setProperty('--tools-h', document.querySelector('.tools').offsetHeight + 'px');
});
ro.observe(document.querySelector('.topbar'));
ro.observe(document.querySelector('.tools'));

function setSpeed(s) {
  speed = Math.max(0, Math.min(SPEEDS.length - 1, s));
  document.querySelectorAll('.speed button').forEach((b) => b.classList.toggle('active', +b.dataset.speed === speed));
}
document.querySelectorAll('.speed button').forEach((b) => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
setSpeed(2);
let lastSpeed = 2;

// ---------- pointer input ----------

const view = $('view');
let down = null;      // pointer-down info
let painting = false;
let hoverCell = -1;
let terrainEdited = false;
let lastClimateUpdate = 0;
const brushRadius = () => +$('brush-size').value;

view.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType, t: performance.now() };
  const t = TOOLS.find((x) => x.id === tool);
  if (t.paint && e.pointerType === 'mouse' && e.button === 0) {
    painting = true;
    view.setPointerCapture(e.pointerId);
  }
});

view.addEventListener('pointermove', (e) => {
  if (tool === 'inspect') return;
  hoverCell = renderer.pickCell(e.clientX, e.clientY);
  const t = TOOLS.find((x) => x.id === tool);
  renderer.showCursor(hoverCell, t.paint ? brushRadius() : tool === 'meteor' ? 0.3 : 0.12);
});

view.addEventListener('pointerleave', () => { if (!painting) renderer.showCursor(-1); });

window.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const wasPainting = painting;
  painting = false;
  if (wasPainting) finishStroke();
  if (moved < 6 && e.target === view && down.button === 0) click(e.clientX, e.clientY, down.type);
  down = null;
});

function click(x, y, pointerType) {
  const cell = renderer.pickCell(x, y);
  if (cell < 0) return;
  const t = TOOLS.find((q) => q.id === tool);
  if (tool === 'inspect') {
    const i = renderer.nearestCreature(cell);
    if (i >= 0) ui.showCreature(i); else ui.showCell(cell);
  } else if (tool === 'seed') {
    const p = PRESETS[$('seed-preset').value];
    const genes = p.genes.slice();
    genes[6] = Math.random();
    const sp = world.life.seed(cell, genes, 40);
    ui.toast(`You seeded ${sp.name} (${p.label.toLowerCase()}).`, 'star');
    ui.chronicle(world.tick, `${sp.name} was seeded onto the planet.`);
  } else if (tool === 'meteor') {
    renderer.launchMeteor(cell, () => {
      const killed = world.life.disaster(cell, 0.3);
      world.planet.impact(cell);
      renderer.updateTerrain();
      const msg = `Meteor impact! ${killed.toLocaleString()} creatures killed. Dust darkens the sky.`;
      ui.toast(msg, 'bad');
      ui.chronicle(world.tick, msg, true);
    });
  } else if (t.paint && pointerType !== 'mouse') {
    // touch: a tap applies one dab
    applyPaint(cell, 0.25);
    finishStroke();
  }
}

function applyPaint(cell, dt) {
  if (cell < 0) return;
  const P = world.planet, r = brushRadius();
  switch (tool) {
    case 'raise': P.editElevation(cell, r, 0.45 * dt); terrainEdited = true; break;
    case 'lower': P.editElevation(cell, r, -0.45 * dt); terrainEdited = true; break;
    case 'heat': P.editClimate(cell, r, 14 * dt, 0); break;
    case 'cool': P.editClimate(cell, r, -14 * dt, 0); break;
    case 'wet': P.editClimate(cell, r, 0, 0.6 * dt); break;
    case 'dry': P.editClimate(cell, r, 0, -0.6 * dt); break;
  }
  const now = performance.now();
  if (now - lastClimateUpdate > 90) { P.updateClimate(); lastClimateUpdate = now; }
  if (terrainEdited) renderer.updateTerrain(); else renderer.updateColors();
}

function finishStroke() {
  if (terrainEdited) { world.planet.terrainChanged(); renderer.updateTerrain(); terrainEdited = false; }
  else { world.planet.updateClimate(); renderer.updateColors(); }
}

// ---------- keyboard ----------

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key >= '1' && e.key <= '9') setTool(TOOLS[+e.key - 1].id);
  else if (e.key === ' ') { e.preventDefault(); if (speed) { lastSpeed = speed; setSpeed(0); } else setSpeed(lastSpeed || 2); }
  else if (e.key === ']') setSpeed(speed + 1);
  else if (e.key === '[') setSpeed(speed - 1);
  else if (e.key === 'Escape') { setTool('inspect'); $('intro').hidden = true; }
  else if (e.key === 'h' || e.key === 'H') $('intro').hidden = !$('intro').hidden;
});

// ---------- world panel ----------

const bindRange = (id, out, fmt, apply) => {
  const el = $(id);
  const f = () => { $(out).textContent = fmt(+el.value); apply(+el.value); };
  el.addEventListener('input', f);
  return () => { $(out).textContent = fmt(+el.value); };
};
const refreshGreenhouse = bindRange('greenhouse', 'out-greenhouse', (v) => `${v > 0 ? '+' : ''}${v}°C`, (v) => {
  world.planet.globalTemp = v; world.planet.updateClimate(); renderer.updateColors();
});
const refreshSea = bindRange('sea-level', 'out-sea', (v) => `${v > 0 ? '+' : ''}${Math.round(v * (v > 0 ? 6000 : 5200))} m`, (v) => {
  world.planet.seaLevel = v; world.planet.terrainChanged(); renderer.updateTerrain();
});
const refreshMut = bindRange('mutation', 'out-mut', (v) => `${v.toFixed(1)}×`, (v) => { world.life.mutationRate = v; });
const refreshGrowth = bindRange('growth', 'out-growth', (v) => `${v.toFixed(2)}×`, (v) => { world.planet.plantGrowth = 0.035 * v; });

document.querySelectorAll('#overlay-seg button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#overlay-seg button').forEach((x) => x.classList.toggle('active', x === b));
  renderer.overlay = b.dataset.overlay;
  renderer.updateColors();
}));
$('show-clouds').addEventListener('change', (e) => (renderer.showClouds = e.target.checked));
$('show-atmo').addEventListener('change', (e) => (renderer.atmosphere.visible = e.target.checked));
$('show-life').addEventListener('change', (e) => (renderer.grazers.visible = renderer.hunters.visible = e.target.checked));
$('auto-rotate').addEventListener('change', (e) => (renderer.controls.autoRotate = e.target.checked));
$('btn-random-seed').addEventListener('click', () => ($('seed-input').value = Math.floor(Math.random() * 99999) + 1));
$('btn-new-world').addEventListener('click', () => newWorld(+$('seed-input').value || 1));

function newWorld(s) {
  seed = s;
  world = new World(seed);
  renderer.setWorld(world);
  ui.setWorld(world);
  // apply current slider settings to the fresh world
  world.life.mutationRate = +$('mutation').value;
  world.planet.plantGrowth = 0.035 * +$('growth').value;
  $('greenhouse').value = 0; $('sea-level').value = 0;
  refreshGreenhouse(); refreshSea(); refreshMut(); refreshGrowth();
  ui.toast(`A new world forms (seed ${seed}).`, 'star');
  try { history.replaceState(null, '', `?seed=${seed}`); } catch { /* sandboxed */ }
}

$('btn-help').addEventListener('click', () => ($('intro').hidden = false));
$('btn-start').addEventListener('click', () => ($('intro').hidden = true));
$('intro').addEventListener('click', (e) => { if (e.target.id === 'intro') $('intro').hidden = true; });

// ---------- loop ----------

let last = performance.now();
let acc = 0;
let ticksSinceColor = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const tps = SPEEDS[speed];
  acc += dt * tps;
  const t0 = performance.now();
  while (acc >= 1 && performance.now() - t0 < 14) {
    world.step();
    acc -= 1;
    ticksSinceColor++;
  }
  if (acc > 3) acc = 1; // can't keep up at this speed: drop ticks instead of spiralling

  if (painting && hoverCell >= 0) applyPaint(hoverCell, dt);
  if (ticksSinceColor >= 6) { renderer.updateColors(); ticksSinceColor = 0; }

  renderer.render(dt, tps > 40 ? 1 : Math.min(1, acc));
  ui.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// expose for debugging in the console
window.strangelife = { get world() { return world; }, renderer, ui };
