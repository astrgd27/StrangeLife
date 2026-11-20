// Entry point: builds the world, wires tools and controls, runs the loop.

import * as THREE from 'three';
import { World } from './world.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { TreeView } from './tree.js';
import { ZoneView } from './zoneview.js';
import { GRADES, GRADE_KEYS, MAXT, previewSpecies } from './ecosystem.js';
import { drawOrganism } from './sprites.js';
import { SLOTS, listSaves, saveToSlot, loadFromSlot, exportWorld, importWorld, describeSave } from './storage.js';

const $ = (id) => document.getElementById(id);

const TOOLS = [
  { id: 'inspect', key: '1', icon: '🔍', name: 'Inspect', hint: 'Click anywhere to see its climate and the life living there. Drag to spin the planet.' },
  { id: 'raise', key: '2', icon: '⛰️', name: 'Raise land', hint: 'Paint to lift the ground. Push the seabed up to make shallow seas, coasts and new land.', paint: true },
  { id: 'lower', key: '3', icon: '🌊', name: 'Lower land', hint: 'Paint to sink the ground and carve out seas and straits.', paint: true },
  { id: 'volcano', key: '4', icon: '🌋', name: 'Volcano', hint: 'Paint to build volcanoes. They vent CO₂ (warming the planet) and, under water, create hydrothermal vents where organic molecules form.', paint: true },
  { id: 'heat', key: '5', icon: '🔥', name: 'Warm', hint: 'Paint to warm the local climate.', paint: true },
  { id: 'cool', key: '6', icon: '❄️', name: 'Cool', hint: 'Paint to cool the local climate. Too much ice can tip the whole planet into a snowball.', paint: true },
  { id: 'wet', key: '7', icon: '🌧️', name: 'Rain', hint: 'Paint to bring rain. Deserts turn green once plants arrive.', paint: true },
  { id: 'dry', key: '8', icon: '🏜️', name: 'Drought', hint: 'Paint to dry the land out.', paint: true },
  { id: 'lightning', key: '9', icon: '⚡', name: 'Lightning', hint: 'Click to strike. Lightning in an oxygen-free sky makes amino acids in the water below (the Miller–Urey experiment).' },
  { id: 'comet', key: '0', icon: '☄️', name: 'Icy comet', hint: 'Click to drop a comet. It brings water (raising the seas) and organic molecules from space.' },
  { id: 'seed', key: '-', icon: '🧬', name: 'Seed life', hint: 'Click to release an organism adapted to the local temperature. It will only thrive if the planet can support it.' },
  { id: 'meteor', key: '=', icon: '💥', name: 'Asteroid', hint: 'Click to strike. Wipes out life nearby and plunges the planet into an impact winter.' },
];
const SPEEDS = [0, 8, 30, 120, 400]; // ticks per second

const params = new URLSearchParams(location.search);
let seed = +params.get('seed') || Math.floor(Math.random() * 99999) + 1;
let scenario = params.get('start') || 'barren';
let world = new World(seed, { scenario });
const renderer = new Renderer($('view'), world);
const ui = new UI(renderer, {
  dive: (z) => openZone(z),
  // the zone where a species is most abundant
  watch: (sp) => {
    const E = world.eco;
    let best = -1, bb = 0;
    for (let z = 0; z < E.Z; z++) { const b = E.B[z * MAXT + sp.slot]; if (b > bb) { bb = b; best = z; } }
    if (best >= 0) openZone(best);
  },
});
const zone = new ZoneView({
  toast: (t) => ui.toast(t, 'star'),
  onClose: (changes) => {
    renderer.updateIcons();
    for (const c of changes) {
      if (c.behaviours.length) ui.chronicle(world.tick, `🧠 Watched up close, ${c.sp.name} evolved new behaviour: it ${c.behaviours.join(', ')}.`);
    }
    const n = changes.length;
    if (n) ui.toast(`🧠 What ${n} species learned now shapes ${n === 1 ? 'its' : 'their'} populations across the planet.`, 'star');
    ui.renderLife();
  },
});
function openZone(z) {
  if (tree.isOpen) tree.toggle(false);
  zone.open(world, z);
  ui.firstCard('behaviour');
}
ui.setWorld(world);
const tree = new TreeView({ highlight: (sp) => { ui.setHighlight(sp); ui.showTab('life'); } });
tree.setWorld(world);
$('seed-input').value = seed;
$('scenario').value = scenario;

let tool = 'inspect';
let speed = 2;

// ---------- tools ----------

const toolList = $('tool-list');
TOOLS.forEach((t) => {
  const b = document.createElement('button');
  b.className = 'tool';
  b.dataset.tool = t.id;
  b.title = `${t.name} (${t.key})`;
  b.setAttribute('aria-label', t.name);
  b.innerHTML = `<span aria-hidden="true">${t.icon}</span><span class="k">${t.key}</span>`;
  b.addEventListener('click', () => setTool(t.id));
  toolList.appendChild(b);
});
for (const g of GRADE_KEYS) {
  const o = document.createElement('option');
  o.value = g; o.textContent = `${GRADES[g].icon} ${GRADES[g].name}`;
  $('seed-preset').appendChild(o);
}
$('seed-preset').value = 'bacteria';

// organism designer: options for the chosen group
const TROPHIC_LABELS = ['Chemical energy (chemotroph)', 'Sunlight (photosynthesis)', 'Dead matter (decomposer)', 'Plants & microbes (grazer)', 'Other animals (predator)', 'Both (omnivore)'];
const HABITAT_LABELS = ['Sea', 'Coast (land and water)', 'Land', 'Rivers and lakes'];
function refreshDesigner() {
  const G = GRADES[$('seed-preset').value];
  $('d-trophic').innerHTML = G.trophics.map((t) => `<option value="${t}">${TROPHIC_LABELS[t]}</option>`).join('');
  $('d-habitat').innerHTML = G.habitats.map((h) => `<option value="${h}">${HABITAT_LABELS[h]}</option>`).join('');
  refreshDesignerLabels();
}
function refreshDesignerLabels() {
  const v = +$('d-size').value;
  $('d-size-out').textContent = v < 0.25 ? 'small' : v < 0.6 ? 'medium' : 'large';
  $('d-temp-out').textContent = `${$('d-temp').value}°C`;
  const adapt = $('d-adapt').checked;
  $('d-temp-wrap').hidden = adapt; $('d-n2-wrap').hidden = adapt;
  $('d-n2-label').textContent = +$('d-habitat').value === 0 ? 'Water depth (shallow → deep)' : 'Rainfall (desert → rainforest)';
  drawPreview();
}
// show the body the chosen genome will build
function drawPreview() {
  const g = $('seed-preset').value, open = $('designer').open;
  const sp = previewSpecies(g, open ? { trophic: +$('d-trophic').value, habitat: +$('d-habitat').value, size: +$('d-size').value } : {});
  const cv = $('d-preview'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawOrganism(ctx, sp, 64, 64, 54);
  $('d-preview-text').textContent = sp.grade === g ? sp.body : `${sp.body}. With these choices it grows into ${GRADES[sp.grade].name.toLowerCase()}.`;
}
$('seed-preset').addEventListener('change', refreshDesigner);
['d-size', 'd-temp', 'd-adapt', 'd-habitat', 'd-trophic'].forEach((id) => $(id).addEventListener('input', refreshDesignerLabels));
$('designer').addEventListener('toggle', drawPreview);
refreshDesigner();
function designerOptions() {
  if (!$('designer').open) return { seeded: true };
  const o = { seeded: true, trophic: +$('d-trophic').value, habitat: +$('d-habitat').value, size: +$('d-size').value };
  if (!$('d-adapt').checked) { o.pref = +$('d-temp').value; o.n2 = +$('d-n2').value; }
  const name = $('d-name').value.trim();
  if (name) o.name = name;
  return o;
}

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
let down = null;
let painting = false;
let hoverCell = -1;
let terrainEdited = false;
let lastClimateUpdate = 0;
const brushRadius = () => +$('brush-size').value;
const toolRadius = () => {
  const t = TOOLS.find((x) => x.id === tool);
  return t.paint ? brushRadius() : tool === 'meteor' ? 0.3 : tool === 'comet' ? 0.22 : tool === 'lightning' ? 0.06 : 0.12;
};

view.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType };
  const t = TOOLS.find((x) => x.id === tool);
  if (t.paint && e.pointerType === 'mouse' && e.button === 0) {
    painting = true;
    view.setPointerCapture(e.pointerId);
  }
});

view.addEventListener('pointermove', (e) => {
  if (tool === 'inspect') return;
  hoverCell = renderer.pickCell(e.clientX, e.clientY);
  renderer.showCursor(hoverCell, toolRadius());
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
  const P = world.planet, E = world.eco;
  if (tool === 'inspect') {
    ui.inspect(cell);
  } else if (tool === 'seed') {
    const g = $('seed-preset').value;
    const sp = E.seed(g, E.zoneOf[cell], designerOptions());
    if (!sp) { ui.toast('Too many species alive to add another right now.', 'bad'); return; }
    if (!E.habitatOk(sp.habitat, E.zoneOf[cell])) ui.toast(`${GRADES[sp.grade].name} need ${['open sea', 'a coastline', 'dry land', 'a river or lake'][sp.habitat]} to live.`, 'bad');
    else ui.toast(`You seeded ${sp.icon} ${sp.name} (${GRADES[sp.grade].name.toLowerCase()}).`, 'star');
    ui.chronicle(world.tick, `${sp.icon} ${sp.name} was seeded onto the planet.`);
    renderer.updateIcons();
  } else if (tool === 'meteor') {
    renderer.launchMeteor(cell, () => {
      world.asteroid(cell);
      renderer.updateTerrain();
      renderer.updateIcons();
      ui.toast('💥 Asteroid impact! Life nearby is wiped out and dust darkens the sky.', 'bad');
      ui.chronicle(world.tick, 'An asteroid strikes. An impact winter follows.', true);
    });
  } else if (tool === 'comet') {
    renderer.launchMeteor(cell, () => {
      world.comet(cell);
      renderer.updateTerrain();
      ui.toast('☄️ A comet delivers water and organic molecules.', '');
    }, 'comet');
  } else if (tool === 'lightning') {
    renderer.lightning(cell);
    P.lightning(cell, 0.06);
    renderer.updateColors();
  } else if (t.paint && pointerType !== 'mouse') {
    applyPaint(cell, 0.25); // touch: a tap applies one dab
    finishStroke();
  }
}

function applyPaint(cell, dt) {
  if (cell < 0) return;
  const P = world.planet, r = brushRadius();
  switch (tool) {
    case 'raise': P.editElevation(cell, r, 0.45 * dt); terrainEdited = true; break;
    case 'lower': P.editElevation(cell, r, -0.45 * dt); terrainEdited = true; break;
    case 'volcano': P.volcano(cell, r, dt); terrainEdited = true; break;
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
  world.eco.updateEnvironment();
  renderer.updateIcons();
}

// ---------- keyboard ----------

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  const t = TOOLS.find((x) => x.key === e.key);
  if (t) setTool(t.id);
  else if (e.key === ' ') { e.preventDefault(); if (speed) { lastSpeed = speed; setSpeed(0); } else setSpeed(lastSpeed || 2); }
  else if (e.key === ']') setSpeed(speed + 1);
  else if (e.key === '[') setSpeed(speed - 1);
  else if (zone.isOpen) { if (e.key === 'Escape') zone.close(); return; }
  else if (e.key === 't' || e.key === 'T') tree.toggle();
  else if ((e.key === 'z' || e.key === 'Z') && (ui.inspectCell >= 0 || hoverCell >= 0)) openZone(world.eco.zoneOf[ui.inspectCell >= 0 ? ui.inspectCell : hoverCell]);
  else if (e.key === 'Escape' && tree.isOpen) tree.toggle(false);
  else if (e.key === 'Escape') { setTool('inspect'); $('intro').hidden = true; if (renderer.highlight) ui.setHighlight(null); }
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
  world.planet.globalTemp = v; world.planet.updateClimate(); world.eco.updateEnvironment(); renderer.updateColors();
});
const seaFmt = (v) => `${v > 0 ? '+' : ''}${Math.round(v * (v > 0 ? 6000 : 5200))} m`;
const refreshSea = bindRange('sea-level', 'out-sea', seaFmt, (v) => {
  world.planet.seaLevel = v; world.planet.terrainChanged(); world.eco.updateEnvironment(); renderer.updateTerrain(); renderer.updateIcons();
});
const refreshMut = bindRange('mutation', 'out-mut', (v) => `${v.toFixed(1)}×`, (v) => { world.eco.mutationRate = v; });
const refreshTrans = bindRange('transitions', 'out-trans', (v) => `${v.toFixed(1)}×`, (v) => { world.eco.transitionRate = v; });
const refreshDrift = bindRange('drift', 'out-drift', (v) => (v === 0 ? 'off' : `${v.toFixed(1)}×`), (v) => { world.tect.speed = v; });

document.querySelectorAll('#overlay-seg button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#overlay-seg button').forEach((x) => x.classList.toggle('active', x === b));
  renderer.overlay = b.dataset.overlay;
  renderer.updateColors();
}));
$('show-icons').addEventListener('change', (e) => { renderer.showIcons = e.target.checked; renderer.updateIcons(); });
$('show-bodies').addEventListener('change', (e) => { renderer.showBodies = e.target.checked; renderer.updateIcons(); });
$('show-clouds').addEventListener('change', (e) => (renderer.showClouds = e.target.checked));
$('show-atmo').addEventListener('change', (e) => (renderer.atmosphere.visible = e.target.checked));
$('show-cards').addEventListener('change', (e) => { ui.showCards = e.target.checked; if (!ui.showCards) { ui.cards = []; ui.renderCard(); } });
$('natural-events').addEventListener('change', (e) => (world.naturalEvents = e.target.checked));
$('ice-cycles').addEventListener('change', (e) => { world.planet.cycles = e.target.checked; world.planet.updateOrbital(); });
$('auto-rotate').addEventListener('change', (e) => (renderer.controls.autoRotate = e.target.checked));
$('btn-random-seed').addEventListener('click', () => ($('seed-input').value = Math.floor(Math.random() * 99999) + 1));
$('btn-new-world').addEventListener('click', () => newWorld(+$('seed-input').value || 1, $('scenario').value));

function newWorld(s, sc) {
  seed = s; scenario = sc;
  world = new World(seed, { scenario });
  world.eco.mutationRate = +$('mutation').value;
  world.eco.transitionRate = +$('transitions').value;
  world.naturalEvents = $('natural-events').checked;
  world.tect.speed = +$('drift').value;
  world.planet.cycles = $('ice-cycles').checked;
  renderer.setWorld(world);
  ui.setWorld(world);
  tree.setWorld(world);
  $('greenhouse').value = 0;
  $('sea-level').value = world.planet.seaLevel;
  refreshGreenhouse(); refreshSea(); refreshMut(); refreshTrans(); refreshDrift();
  ui.toast(`A new world forms (seed ${seed}).`, 'star');
  try { history.replaceState(null, '', `?seed=${seed}&start=${scenario}`); } catch { /* sandboxed */ }
}
$('sea-level').value = world.planet.seaLevel;
refreshSea();

// ---------- saved worlds ----------

const saveStatus = (msg) => { $('save-status').textContent = msg; };
async function refreshSaves() {
  let saves = {};
  try { saves = await listSaves(); } catch (err) { saveStatus(err.message); }
  $('save-list').innerHTML = SLOTS.map((slot) => {
    const meta = saves[slot];
    return `<li><div class="save-name">${slot === 'auto' ? 'Autosave' : `Slot ${slot}`}<span class="muted small">${describeSave(meta)}</span></div>
      <div class="save-btns">${slot !== 'auto' ? `<button class="ghost" data-save="${slot}">Save</button>` : ''}<button class="ghost" data-load="${slot}" ${meta ? '' : 'disabled'}>Load</button></div></li>`;
  }).join('');
}
function adoptWorld(w, msg) {
  world = w;
  world.naturalEvents = $('natural-events').checked;
  renderer.setWorld(world);
  ui.setWorld(world);
  tree.setWorld(world);
  $('seed-input').value = world.seed; $('scenario').value = world.scenario;
  $('mutation').value = world.eco.mutationRate; $('transitions').value = world.eco.transitionRate;
  $('drift').value = world.tect.speed; $('greenhouse').value = world.planet.globalTemp; $('sea-level').value = world.planet.seaLevel;
  $('ice-cycles').checked = world.planet.cycles !== false;
  refreshGreenhouse(); refreshSea(); refreshMut(); refreshTrans(); refreshDrift();
  lastSea = world.planet.seaLevel; lastTerrain = world.planet.terrainVersion;
  ui.chronicle(world.tick, msg);
  ui.toast(msg, 'star');
}
$('save-list').addEventListener('click', async (e) => {
  const s = e.target.closest('[data-save]'), l = e.target.closest('[data-load]');
  try {
    if (s) { saveStatus('Saving…'); await saveToSlot(world, s.dataset.save); saveStatus(`Saved to slot ${s.dataset.save}.`); }
    if (l) { saveStatus('Loading…'); const w = await loadFromSlot(l.dataset.load); adoptWorld(w, `Loaded a saved world (${l.dataset.load === 'auto' ? 'autosave' : 'slot ' + l.dataset.load}).`); saveStatus('Loaded.'); }
  } catch (err) { saveStatus(`Couldn't ${s ? 'save' : 'load'}: ${err.message}`); }
  refreshSaves();
});
$('btn-export').addEventListener('click', async () => {
  try { await exportWorld(world); saveStatus('World file downloaded. (Inside some embedded viewers downloads are blocked; use a save slot instead.)'); }
  catch (err) { saveStatus(`Couldn't export: ${err.message}`); }
});
$('btn-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try { saveStatus('Opening…'); adoptWorld(await importWorld(f), `Opened a world from ${f.name}.`); saveStatus('Opened.'); }
  catch (err) { saveStatus(`Couldn't open that file: ${err.message}`); }
  e.target.value = '';
});
let lastAutosave = performance.now();
setInterval(async () => {
  if (!$('autosave').checked || speed === 0 || performance.now() - lastAutosave < 120000) return;
  lastAutosave = performance.now();
  try { await saveToSlot(world, 'auto'); refreshSaves(); } catch { /* storage unavailable */ }
}, 10000);
refreshSaves();

$('btn-help').addEventListener('click', () => ($('intro').hidden = false));
$('btn-start').addEventListener('click', () => ($('intro').hidden = true));
$('intro').addEventListener('click', (e) => { if (e.target.id === 'intro') $('intro').hidden = true; });

// ---------- loop ----------

let last = performance.now();
let acc = 0;
let ticksSinceRefresh = 0;
let lastSea = world.planet.seaLevel;
let lastTerrain = world.planet.terrainVersion;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // up close in a zone: the planet waits
  if (zone.isOpen) { zone.update(dt, now); ui.update(now); requestAnimationFrame(frame); return; }
  acc += dt * SPEEDS[speed];
  const t0 = performance.now();
  const budget = speed >= 4 ? 22 : 14; // ms of simulation per frame
  while (acc >= 1 && performance.now() - t0 < budget) {
    world.step();
    acc -= 1;
    ticksSinceRefresh++;
  }
  if (acc > 3) acc = 1; // can't keep up at this speed: drop ticks instead of spiralling

  if (painting && hoverCell >= 0) applyPaint(hoverCell, dt);
  if (ticksSinceRefresh >= 6) {
    ticksSinceRefresh = 0;
    // continents drift and sea level rises as comets and volcanoes add water: redraw the globe
    if (world.planet.terrainVersion !== lastTerrain) {
      lastTerrain = world.planet.terrainVersion;
      renderer.updateTerrain();
      if (Math.abs(world.planet.seaLevel - lastSea) > 0.002) { lastSea = world.planet.seaLevel; $('sea-level').value = lastSea; refreshSea(); }
    } else renderer.updateColors();
    renderer.updateIcons();
  }
  renderer.render(dt);
  ui.update(now);
  tree.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// expose for debugging in the console
window.strangelife = { get world() { return world; }, renderer, ui, tree, zone };
