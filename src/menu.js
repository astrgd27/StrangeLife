// The main menu and the in-game menu: play a new world, continue, load, the zoo, options, how to
// play, and ending a run (when you can take up to three creatures home to the zoo).

import { SLOTS, listSaves, describeSave } from './storage.js';
import { spriteURL } from './sprites.js';
import { GRADES, KINGDOMS } from './ecosystem.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const SCENARIOS = [
  { id: 'barren', name: 'A young planet', icon: '🌋', blurb: 'The default world. Scalding seas under a thick CO₂ sky, battered by comets, with no life at all. Shape it, or wait, until the first cell appears; then follow life all the way from microbes to whatever comes next.' },
];

// options kept between visits (each maps to a control in the World tab)
const OPTIONS = [
  { id: 'show-cards', label: 'Discovery cards', hint: 'Pop-up cards explaining each first: oxygen, animals, forests…' },
  { id: 'show-icons', label: 'Life icons on the globe' },
  { id: 'show-bodies', label: 'Draw evolved bodies on the globe (off: emoji)' },
  { id: 'show-clouds', label: 'Clouds' },
  { id: 'show-atmo', label: 'Atmosphere glow' },
  { id: 'auto-rotate', label: 'Slowly turn the planet' },
  { id: 'natural-events', label: 'Natural events (asteroids, comets)' },
  { id: 'ice-cycles', label: 'Ice-age cycles' },
  { id: 'autosave', label: 'Autosave every 2 minutes' },
];
const OPT_KEY = 'strangelife-options-v1';

export function applySavedOptions() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(OPT_KEY) || '{}'); } catch { /* storage blocked */ }
  for (const o of OPTIONS) {
    const el = $(o.id);
    if (el && saved[o.id] !== undefined && el.checked !== saved[o.id]) { el.checked = saved[o.id]; el.dispatchEvent(new Event('change')); }
  }
}
function storeOptions() {
  const out = {};
  for (const o of OPTIONS) { const el = $(o.id); if (el) out[o.id] = el.checked; }
  try { localStorage.setItem(OPT_KEY, JSON.stringify(out)); } catch { /* storage blocked */ }
}

export class GameMenu {
  constructor(hooks) {
    this.hooks = hooks;
    this.inGame = false;
    $('menu').addEventListener('click', (e) => this.onClick(e));
    $('menu').addEventListener('change', (e) => this.onChange(e));
  }

  get isOpen() { return !$('menu').hidden; }

  show(screen = this.inGame ? 'pause' : 'title') {
    this.screen = screen;
    $('menu').hidden = false;
    $('menu').classList.toggle('ingame', this.inGame);
    document.body.classList.toggle('at-title', !this.inGame);
    this.render();
  }

  hide() { $('menu').hidden = true; document.body.classList.remove('at-title'); }

  async render() {
    const s = this.screen, el = $('menu-body');
    const back = `<button class="ghost menu-back" data-go="${this.inGame ? 'pause' : 'title'}">← Back</button>`;
    if (s === 'title') {
      let auto = null;
      try { auto = (await listSaves()).auto; } catch { /* storage unavailable */ }
      el.innerHTML = `<p class="eyebrow">An evolution sandbox</p><h1 class="menu-title">StrangeLife</h1>
        <p class="lede">Shape a newborn planet, kindle life, and watch it evolve from the first cell to whatever comes next.</p>
        <nav class="menu-list">
          <button class="primary big" data-go="play">Play</button>
          ${auto ? `<button data-act="continue">Continue <span class="muted small">${esc(describeSave(auto))}</span></button>` : ''}
          <button data-go="load">Load game</button>
          <button data-act="zoo">🦒 Zoo</button>
          <button data-go="options">Options</button>
          <button data-act="howto">How to play</button>
        </nav>
        <a class="classic-link" href="classic/index.html">Play StrangeLife Classic: the simpler original</a>`;
    } else if (s === 'play') {
      el.innerHTML = `${back}<h2>Choose a world</h2>
        <div class="scenario-list">${SCENARIOS.map((sc, i) => `<label class="scenario${i === 0 ? ' active' : ''}"><input type="radio" name="scenario" value="${sc.id}" ${i === 0 ? 'checked' : ''}>
          <span class="sc-icon">${sc.icon}</span><span><b>${sc.name}</b><br><span class="muted">${sc.blurb}</span></span></label>`).join('')}</div>
        <label class="field menu-seed"><span>Planet seed <span class="muted small">(the same seed always makes the same planet)</span></span>
          <span class="seed-row"><input id="menu-seed" type="number" min="1" max="99999" value="${Math.floor(Math.random() * 99999) + 1}"><button class="ghost" data-act="reseed" title="Random seed">🎲</button></span></label>
        <button class="primary big" data-act="start">Start</button>`;
    } else if (s === 'load') {
      el.innerHTML = `${back}<h2>Load a world</h2><ul class="menu-saves" id="menu-saves"><li class="muted">Reading saves…</li></ul>
        <button class="ghost" data-act="import">Open a world file…</button><p class="muted small" id="menu-status"></p>`;
      let saves = {};
      try { saves = await listSaves(); } catch (err) { $('menu-status').textContent = err.message; }
      $('menu-saves').innerHTML = SLOTS.map((slot) => {
        const meta = saves[slot];
        return `<li><span><b>${slot === 'auto' ? 'Autosave' : `Slot ${slot}`}</b><br><span class="muted small">${esc(describeSave(meta))}</span></span>
          <button ${meta ? '' : 'disabled'} data-act="load" data-slot="${slot}">Load</button></li>`;
      }).join('');
    } else if (s === 'save') {
      el.innerHTML = `${back}<h2>Save this world</h2><ul class="menu-saves" id="menu-saves"><li class="muted">Reading saves…</li></ul><p class="muted small" id="menu-status"></p>`;
      let saves = {};
      try { saves = await listSaves(); } catch (err) { $('menu-status').textContent = err.message; }
      $('menu-saves').innerHTML = SLOTS.filter((x) => x !== 'auto').map((slot) => `<li><span><b>Slot ${slot}</b><br><span class="muted small">${esc(describeSave(saves[slot]))}</span></span>
          <button data-act="save" data-slot="${slot}">Save here</button></li>`).join('');
    } else if (s === 'options') {
      el.innerHTML = `${back}<h2>Options</h2><div class="menu-options">${OPTIONS.map((o) => `<label class="check"><input type="checkbox" data-opt="${o.id}" ${$(o.id)?.checked ? 'checked' : ''}> ${o.label}${o.hint ? `<span class="muted small"> · ${o.hint}</span>` : ''}</label>`).join('')}</div>
        <p class="muted small">Climate, evolution and map settings for the current world are in the World tab of the side panel.</p>`;
    } else if (s === 'pause') {
      el.innerHTML = `<h2>Paused</h2><nav class="menu-list">
          <button class="primary big" data-act="resume">Resume</button>
          <button data-go="save">Save game</button>
          <button data-go="load">Load game</button>
          <button data-go="options">Options</button>
          <button data-act="howto">How to play</button>
          <button data-go="endrun">End run…</button>
          <button class="ghost" data-act="quit">Quit to main menu</button>
        </nav>`;
    } else if (s === 'endrun') {
      this.renderEndRun(el, back);
    }
  }

  // the end of a run: choose up to three living species to take to the zoo
  renderEndRun(el, back) {
    const cands = this.hooks.candidates();
    this.picked = new Set();
    el.innerHTML = `${back}<h2>End this run</h2>
      <p class="lede">Your planet's story ends here. Take up to <b>three</b> living species home to your zoo: they keep their genome, their body, their place in the food web and their ancestry.</p>
      <div class="pick-grid">${cands.map((sp) => `<button class="pick" data-pick="${sp.id}">
        <img src="${spriteURL(sp, 72)}" width="72" height="72" alt="">
        <span><b><i>${esc(sp.name)}</i></b><br><span class="muted small">${GRADES[sp.grade].name} · ${KINGDOMS[sp.kingdom].name}<br>${sp.range} zones</span></span></button>`).join('') || '<p class="muted">Nothing is alive to take with you.</p>'}</div>
      <div class="menu-row"><button class="primary" data-act="finish" id="finish-run">End run without creatures</button></div>`;
  }

  onChange(e) {
    const o = e.target.closest('[data-opt]');
    if (o) { const el = $(o.dataset.opt); el.checked = o.checked; el.dispatchEvent(new Event('change')); storeOptions(); }
    const r = e.target.closest('input[name=scenario]');
    if (r) document.querySelectorAll('.scenario').forEach((l) => l.classList.toggle('active', l.contains(r)));
  }

  async onClick(e) {
    const go = e.target.closest('[data-go]');
    if (go) { this.screen = go.dataset.go; this.render(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const id = +pick.dataset.pick;
      if (this.picked.has(id)) this.picked.delete(id); else if (this.picked.size < 3) this.picked.add(id);
      document.querySelectorAll('.pick').forEach((b) => b.classList.toggle('active', this.picked.has(+b.dataset.pick)));
      $('finish-run').textContent = this.picked.size ? `Take ${this.picked.size} to the zoo and end the run` : 'End run without creatures';
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act, H = this.hooks;
    const status = (m) => { const s = $('menu-status'); if (s) s.textContent = m; };
    try {
      if (act === 'start') { const sc = document.querySelector('input[name=scenario]:checked')?.value || 'barren'; H.newGame(sc, +$('menu-seed').value || 1); }
      else if (act === 'reseed') $('menu-seed').value = Math.floor(Math.random() * 99999) + 1;
      else if (act === 'continue') { await H.load('auto'); }
      else if (act === 'load') { status('Loading…'); await H.load(a.dataset.slot); }
      else if (act === 'save') { status('Saving…'); await H.save(a.dataset.slot); status(`Saved to slot ${a.dataset.slot}.`); this.render(); }
      else if (act === 'import') H.importFile();
      else if (act === 'zoo') H.zoo();
      else if (act === 'howto') H.howto();
      else if (act === 'resume') H.resume();
      else if (act === 'quit') H.quit();
      else if (act === 'finish') H.endRun([...this.picked]);
    } catch (err) { status(`Something went wrong: ${err.message}`); }
  }
}
