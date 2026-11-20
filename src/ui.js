// HTML panels: stats, life list, charts, planet story, inspector, cards, toasts.

import { GRADES, KINGDOMS, KINGDOM_KEYS, TROPHIC_NAMES, HABITAT_NAMES, MAXT } from './ecosystem.js';
import { EONS, formatYears } from './world.js';
import { STORY, EVENTS, storyByKey } from './science.js';
import { CIV_STAGES } from './civ.js';
import { spriteURL } from './sprites.js';
import { GENES, GENE_INFO, GI } from './genome.js';

// the genes worth showing for each kind of body (others are switched off or don't matter)
const GENE_LABELS = {
  adhesion: 'Cells stick', differentiation: 'Tissues', photo: 'Sunlight', ingest: 'Swallowing', absorb: 'Absorbing',
  carnivory: 'Meat-eating', motility: 'Movement', size: 'Size', symmetry: 'Head & tail', segments: 'Segments',
  limbs: 'Limbs', skeleton: 'Skeleton', vascular: 'Plumbing', landAdapt: 'Drought-proof', endothermy: 'Warm blood',
  brain: 'Brain', wings: 'Wings', display: 'Display',
};
function shownGenes(sp) {
  const ph = sp.ph;
  if (!ph) return [];
  if (!ph.euk) return ['photo', 'absorb', 'adhesion', 'motility'];
  if (ph.level <= 1) return ['adhesion', 'photo', 'ingest', 'absorb', 'carnivory', 'motility'];
  if (ph.plant) return ['adhesion', 'differentiation', 'vascular', 'landAdapt', 'display', 'size'];
  if (ph.fungus) return ['adhesion', 'differentiation', 'absorb', 'landAdapt', 'size'];
  if (ph.level === 2) return ['adhesion', 'differentiation', 'symmetry', 'motility', 'carnivory', 'size'];
  return ['symmetry', 'segments', 'limbs', 'skeleton', 'size', 'motility', 'landAdapt', 'endothermy', 'brain', 'wings', 'carnivory', 'display'];
}
function genomeHTML(sp) {
  return `<div class="genome">${shownGenes(sp).map((k) => {
    const v = sp.genes[GI[k]];
    return `<span class="gene" title="${esc(GENE_INFO[k])}"><span class="gn">${GENE_LABELS[k]}</span><span class="gbar"><i style="width:${Math.round(v * 100)}%"></i></span></span>`;
  }).join('')}</div>`;
}
export function portrait(sp, px = 72) {
  const url = spriteURL(sp, px);
  return url ? `<img class="portrait" src="${url}" width="${px}" height="${px}" alt="">` : '';
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const narrow = () => window.innerWidth <= 680;

function badge(sp, size = 22) {
  return `<span class="badge" style="--k:${KINGDOMS[sp.kingdom].color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.58)}px">${sp.icon}</span>`;
}

export class UI {
  constructor(renderer, hooks = {}) {
    this.r = renderer;
    this.hooks = hooks;
    this.tab = 'life';
    this.timers = {};
    this.cards = [];
    this.showCards = true;
    this.kingdomFilter = null;

    document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
    $('btn-collapse').addEventListener('click', () => {
      const p = $('panel');
      p.classList.toggle('collapsed');
      $('btn-collapse').title = p.classList.contains('collapsed') ? 'Show panel' : 'Hide panel';
    });
    const pickSpecies = (e) => {
      const el = e.target.closest('[data-sp]');
      if (!el) return;
      const sp = this.world.eco.species.get(+el.dataset.sp);
      this.setHighlight(this.r.highlight === sp ? null : sp);
    };
    // lists refresh live, so act on pointerdown: a click could straddle a refresh and be lost
    $('species-list').addEventListener('pointerdown', pickSpecies);
    $('kingdom-row').addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-k]');
      if (!el) return;
      this.kingdomFilter = this.kingdomFilter === el.dataset.k ? null : el.dataset.k;
      this.renderLife();
    });
    $('story').addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-story]');
      if (el) this.openCard(storyByKey[el.dataset.story], true);
    });
    $('inspector').addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-act=close]')) { this.inspectCell = -1; $('inspector').hidden = true; return; }
      pickSpecies(e);
    });
    $('card-close').addEventListener('click', () => this.nextCard());
  }

  setWorld(world) {
    this.world = world;
    this.kingdomFilter = null;
    this.inspectCell = -1;
    this.cards = [];
    $('card').hidden = true;
    $('inspector').hidden = true;
    $('chronicle').innerHTML = '';
    $('toasts').innerHTML = '';
    world.on((e) => this.onEvent(e));
    const S = world.scenario;
    this.chronicle(0, S === 'barren' ? 'A young planet forms: scalding seas, a thick CO₂ sky and no life.' : S === 'microbial' ? 'The story begins with microbes in an oxygen-free ocean.' : 'The story begins on an oxygen-rich world full of life.');
    this.timers = {};
  }

  showTab(tab) {
    if (narrow()) $('inspector').hidden = true;
    this.tab = tab;
    document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-body').forEach((s) => (s.hidden = s.dataset.body !== tab));
    $('panel').classList.remove('collapsed');
    this.timers = {};
  }

  setHighlight(sp) {
    this.r.highlight = sp;
    this.r.updateIcons();
    this.r.updateColors();
    this.timers.list = this.timers.insp = 0;
    if (this.tab === 'life') this.renderLife();
  }

  // ---------- events ----------

  onEvent(e) {
    const W = this.world;
    if (e.type === 'milestone') {
      const story = storyByKey[e.key];
      const ev = e.event && EVENTS[e.event];
      const text = story ? `${story.icon} ${story.title}` : e.text;
      this.toast(text, e.bad ? 'bad' : 'star');
      this.chronicle(e.tick, story ? `${story.title}.` : e.text, e.bad);
      if (story) this.openCard({ ...story, tick: e.tick });
      else if (ev && !this.seenEvents?.has(e.event)) { (this.seenEvents ||= new Set()).add(e.event); this.openCard(ev); }
    } else if (e.type === 'extinction') {
      if (e.species.peakRange < 20) return; // only species that had spread widely
      const why = e.species.outcompeted ? 'was outcompeted and went extinct' : 'went extinct';
      this.chronicle(e.tick, `${e.species.icon} ${e.species.name} (${GRADES[e.species.grade].name.toLowerCase()}) ${why}.`, true);
      if (e.species.peakRange >= 500) this.toast(`${e.species.icon} ${e.species.name} ${why}.`, 'bad');
    } else if (e.type === 'civstage') {
      const S = CIV_STAGES[e.stage];
      this.toast(`${S.icon} ${e.stage === 0 ? 'Civilization begins: the Stone Age' : `${S.name}`}`, 'star');
      this.chronicle(e.tick, `${S.icon} ${e.stage === 0 ? 'An intelligent species starts a civilization: the Stone Age.' : `Civilization enters the ${S.name.toLowerCase()}${e.stage === CIV_STAGES.length - 1 ? '. Its ships leave for the stars.' : '.'}`}`);
      this.openCard({ icon: S.icon, title: S.name, earth: S.earth, text: S.text });
    } else if (e.type === 'civleft') {
      this.toast('🚀 The last of the intelligent species has left the planet.', 'star');
      this.chronicle(e.tick, 'The intelligent species has left the planet for the stars. The biosphere carries on without it.');
    } else if (e.type === 'civfall') {
      this.toast('💀 The civilization has fallen: its species is extinct.', 'bad');
      this.chronicle(e.tick, `The civilization falls during the ${CIV_STAGES[e.stage].name.toLowerCase()}: its species has gone extinct. Life goes on.`, true);
    } else if (e.type === 'radiation') {
      const G = GRADES[e.grade];
      this.toast(`🎆 Adaptive radiation: ${G.name.toLowerCase()} are diversifying fast.`, 'star');
      this.chronicle(e.tick, `${G.icon} Adaptive radiation: ${e.count} new species of ${G.name.toLowerCase()} in a short time.`);
      this.firstCard('radiation');
    } else if (e.type === 'cospeciation') {
      this.firstCard('cospeciation');
      if (!this.coNoted) { this.coNoted = true; this.chronicle(e.tick, `${e.species.icon} ${e.species.name} split along with its host plant, ${e.host.name}: coevolution.`); }
    } else if (e.type === 'island') {
      this.firstCard('island');
      this.chronicle(e.tick, `${e.species.icon} On an island, ${e.species.name} evolves into a ${e.change === 'giant' ? 'giant' : 'dwarf'} form of ${e.parent.name}.`);
    } else if (e.type === 'sexualsel') {
      this.firstCard('sexualsel');
    } else if (e.type === 'allopatric') {
      if (!this.seenEvents?.has('allopatric')) { (this.seenEvents ||= new Set()).add('allopatric'); this.openCard(EVENTS.allopatric); }
      if (e.zones >= 12) this.chronicle(e.tick, `${e.species.icon} Cut off from the rest of its range, a population of ${e.parent.name} becomes a new species, ${e.species.name}.`);
    } else if (e.type === 'newgroup') {
      const G = GRADES[e.grade], sp = e.species;
      this.chronicle(e.tick, `${sp.icon} A new kind of life: ${G.name.toLowerCase()}${sp.body ? ` (${sp.body})` : ''}, from ${e.parent ? e.parent.name : 'seeded life'}.`);
      // put the new creature's portrait on the discovery card that announced it
      const url = spriteURL(sp, 96);
      for (const c of this.cards) if (c.tick === e.tick && !c.img) { c.img = url; c.caption = `${sp.name}: ${sp.body}`; }
      if (this.cards[0]?.tick === e.tick) this.renderCard();
      this.firstCard('bodyplan');
    } else if (e.type === 'convergent') {
      const g = e.grade;
      this.firstCard('convergent');
      if (e.tick - ((this.convNoted ||= {})[g] ?? -1e9) > 3000) {
        this.convNoted[g] = e.tick;
        this.chronicle(e.tick, `${e.species.icon} Convergent evolution: ${GRADES[g].name.toLowerCase()} evolve again, this time from ${e.parent.name} (${GRADES[e.parent.grade].name.toLowerCase()}).`);
      }
    } else if (e.type === 'lineage') {
      const g = e.species.grade;
      if (e.tick - ((this.lineageNoted ||= {})[g] ?? -1e9) > 1500) { this.lineageNoted[g] = e.tick; this.chronicle(e.tick, `${e.species.icon} ${GRADES[g].name} arise again, from ${e.parent.name}.`); }
    } else if (e.type === 'eon') {
      const eon = EONS[e.eon];
      this.toast(`The ${eon.name} eon begins.`, 'star');
      this.chronicle(e.tick, `The ${eon.name} eon begins. ${eon.blurb}`);
    } else if (e.type === 'asteroid' && e.natural) {
      this.r.launchMeteor(e.cell, null, 'meteor');
      this.toast('☄️ An asteroid strikes! Dust darkens the sky.', 'bad');
      this.chronicle(e.tick, 'An asteroid strikes the planet. An impact winter follows.', true);
      if (!this.seenEvents?.has('asteroid')) { (this.seenEvents ||= new Set()).add('asteroid'); this.openCard(EVENTS.asteroid); }
    } else if (e.type === 'comet' && e.natural) {
      const now = performance.now();
      if (now - (this.lastComet || 0) > 1500) { this.lastComet = now; this.r.launchMeteor(e.cell, null, 'comet'); }
    }
  }

  firstCard(key) {
    if (this.seenEvents?.has(key)) return;
    (this.seenEvents ||= new Set()).add(key);
    this.openCard(EVENTS[key]);
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
    li.innerHTML = `<span class="t">${formatYears(this.world.years)}</span><span>${esc(text)}</span>`;
    $('chronicle').prepend(li);
    const ol = $('chronicle');
    while (ol.children.length > 200) ol.lastChild.remove();
  }

  // ---------- discovery cards ----------

  openCard(entry, force = false) {
    if (!entry || (!this.showCards && !force)) return;
    if (force) { this.cards = [entry]; this.renderCard(); return; }
    this.cards.push(entry);
    if (this.cards.length === 1) this.renderCard();
  }

  renderCard() {
    const c = this.cards[0];
    if (!c) { $('card').hidden = true; return; }
    $('card-icon').textContent = c.icon || '✦';
    const pic = $('card-pic');
    if (pic) { pic.hidden = !c.img; if (c.img) { pic.querySelector('img').src = c.img; pic.querySelector('figcaption').textContent = c.caption || ''; } }
    $('card-title').textContent = c.title;
    $('card-earth').textContent = c.earth ? `On Earth: ${c.earth}` : '';
    $('card-text').textContent = c.text;
    $('card-more').innerHTML = this.cards.length > 1 ? `${this.cards.length - 1} more · <button class="linkish" id="card-skip">Skip all</button>` : '';
    $('card-skip')?.addEventListener('click', () => { this.cards = []; this.renderCard(); });
    $('card').hidden = false;
  }

  nextCard() { this.cards.shift(); this.renderCard(); }

  // ---------- periodic refresh ----------

  update(now) {
    const W = this.world, E = W.eco, P = W.planet, t = this.timers;
    const due = (k, ms) => { if (now - (t[k] || 0) > ms) { t[k] = now; return true; } return false; };
    if (due('stats', 250)) {
      $('clock-value').textContent = formatYears(W.years);
      const civ = W.civ && !W.civ.fallen ? W.civ : null;
      $('eon-chip').textContent = civ ? `${civ.info.icon} ${civ.info.name}` : EONS[W.eon].name;
      $('stat-species').textContent = E.alive.length;
      $('stat-life').textContent = `${Math.round(((E.lifeZones || 0) / E.Z) * 100)}%`;
      $('stat-temp').textContent = `${P.meanT.toFixed(0)}°C`;
      $('stat-o2').textContent = `${P.o2.toFixed(P.o2 < 1 ? 1 : 0)}%`;
    }
    if (this.tab === 'life' && due('list', 800)) this.renderLife();
    if (this.tab === 'history' && due('charts', 1000)) { this.drawDiversityChart(); this.drawAtmoChart(); }
    if (this.tab === 'planet' && due('planet', 500)) this.renderPlanet();
    if (this.inspectCell >= 0 && due('insp', 500)) this.renderInspector();
  }

  // ---------- life tab ----------

  renderLife() {
    const E = this.world.eco;
    // most complex life first, then the most widespread
    const living = E.livingSpecies().sort((a, b) => GRADES[b.grade].tier - GRADES[a.grade].tier || b.range - a.range);
    const byK = {};
    for (const k of KINGDOM_KEYS) byK[k] = [];
    for (const sp of living) byK[sp.kingdom].push(sp);
    setHTML($('kingdom-row'), KINGDOM_KEYS.map((k, i) => {
      const n = byK[k].length;
      const pct = E.kRange ? Math.round((E.kRange[i] / E.Z) * 100) : 0;
      return `<button class="kchip${this.kingdomFilter === k ? ' active' : ''}${n ? '' : ' empty'}" data-k="${k}" style="--k:${KINGDOMS[k].color}">
        <span class="kname">${KINGDOMS[k].name}</span><span class="kval mono">${n ? `${n} sp · ${pct}%` : 'none yet'}</span></button>`;
    }).join(''));
    const shown = this.kingdomFilter ? byK[this.kingdomFilter] : living;
    $('species-summary').textContent = living.length
      ? `${living.length} living species across ${KINGDOM_KEYS.filter((k) => byK[k].length).length} kingdoms. Percentages are the share of the planet's zones each kingdom lives in. Click a species to see its range.`
      : 'No life yet. Watch the Planet tab to see how close the chemistry is to producing the first cell, or seed life with the 🧬 tool.';
    const hl = this.r.highlight;
    const rows = shown.slice(0, 120).map((sp) => {
      const G = GRADES[sp.grade];
      const active = hl === sp;
      let detail = '';
      if (active) {
        const parent = sp.parent ? E.species.get(sp.parent) : null;
        const origins = E.originsOf(sp.grade);
        detail = `<div class="sp-body">${portrait(sp, 84)}<div><div class="sp-plan">${esc(sp.body || '')}</div>${genomeHTML(sp)}</div></div>
        <dl class="sp-detail">
          <dt>Looks like</dt><dd>${G.name} · ${KINGDOMS[sp.kingdom].domain}${origins > 1 ? ` <span class="muted">(evolved ${origins} separate times)</span>` : ''}</dd>
          <dt>Cells</dt><dd>${sp.domain === 'eukaryote' ? `Complex cells${sp.mito ? ', mitochondria' : ''}${sp.chloro ? ', chloroplasts' : ''}` : 'Simple cells (no nucleus)'}</dd>
          <dt>Appeared</dt><dd>${formatYears(sp.bornYears)}${parent ? ` from <i>${esc(parent.name)}</i>` : ''}</dd>
          <dt>Range</dt><dd>${sp.range} zones (peak ${sp.peakRange})</dd>
          <dt>Climate</dt><dd>${sp.pref.toFixed(0)}°C ± ${sp.tol.toFixed(0)}°</dd>
          <dt>Niche</dt><dd>${nicheText(sp)}</dd>
          ${sp.allopatric ? '<dt>Origin</dt><dd>Split off after its population was isolated</dd>' : sp.display ? '<dt>Origin</dt><dd>Split by mate choice (sexual selection)</dd>' : sp.cospeciated ? '<dt>Origin</dt><dd>Split along with its host plant</dd>' : ''}
          ${sp.host && E.species.get(sp.host) ? `<dt>Specialist</dt><dd>Feeds on ${E.species.get(sp.host).icon} <i>${esc(E.species.get(sp.host).name)}</i>${E.species.get(sp.host).died >= 0 ? ' (extinct)' : ''}</dd>` : ''}
          ${sp.island ? '<dt>Island</dt><dd>Evolved on an island; found nowhere else</dd>' : ''}
          <dt>Needs O₂</dt><dd>${sp.eco?.o2 ? `${sp.eco.o2.toFixed(1)}% or more` : 'none (anaerobic)'}</dd>
          ${sp.trophic !== 1 && sp.eco && sp.ph?.animal ? `<dt>Defences</dt><dd>${defenceText(sp)}</dd>` : ''}
          <dt>Reproduction</dt><dd>${sp.sexual ? 'Sexual' : 'Asexual (cloning or splitting)'}</dd>
        </dl>`;
      }
      return `<li class="sp${active ? ' active' : ''}" data-sp="${sp.id}">
        ${badge(sp)}
        <span class="nm">${esc(sp.name)}</span>
        <span class="ct mono" title="Zones occupied">${sp.range}</span>
        <span class="tags">
          <span class="tag">${G.name}</span>
          <span class="tag t${sp.trophic}">${TROPHIC_NAMES[sp.trophic]}</span>
          <span class="tag h${sp.habitat}">${HABITAT_NAMES[sp.habitat]}</span>
          ${sp.pref < 2 ? '<span class="tag h0">Cold-adapted</span>' : sp.pref > 30 ? '<span class="tag t5">Heat-loving</span>' : ''}
          ${nicheTags(sp)}
          ${sp.host ? '<span class="tag t3">Specialist</span>' : ''}${sp.island ? '<span class="tag h1">Island</span>' : ''}${sp.range > 0 && sp.range <= 15 ? '<span class="tag">Endemic</span>' : ''}
        </span>${detail}</li>`;
    });
    setHTML($('species-list'), rows.join('') || '<li class="muted small">None living.</li>');
  }

  // ---------- charts ----------

  prepCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  drawDiversityChart() {
    const { ctx, w, h } = this.prepCanvas($('chart-div'));
    const H = this.world.history;
    if (H.length < 2) return emptyChart(ctx, w, h);
    let max = 5;
    for (const s of H) max = Math.max(max, s.species);
    const pad = { l: 30, r: 6, t: 6, b: 16 };
    const X = (i) => pad.l + (i / (H.length - 1)) * (w - pad.l - pad.r);
    const Y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
    grid(ctx, w, h, pad, max, (v) => Math.round(v));
    eonBands(ctx, H, X, pad, h);
    const base = new Float32Array(H.length);
    for (const k of KINGDOM_KEYS) {
      const top = H.map((s, i) => base[i] + (s.kingdoms?.[k]?.species || 0));
      ctx.fillStyle = KINGDOMS[k].color + 'dd';
      ctx.beginPath();
      top.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
      for (let i = H.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(base[i]));
      ctx.closePath(); ctx.fill();
      base.set(top);
    }
    timeAxis(ctx, w, h, pad, H);
    $('legend-div').innerHTML = KINGDOM_KEYS.map((k) => `<span><i style="background:${KINGDOMS[k].color}"></i>${KINGDOMS[k].name}</span>`).join('');
  }

  drawAtmoChart() {
    const { ctx, w, h } = this.prepCanvas($('chart-atmo'));
    const H = this.world.history;
    if (H.length < 2) return emptyChart(ctx, w, h);
    const pad = { l: 30, r: 34, t: 8, b: 16 };
    const X = (i) => pad.l + (i / (H.length - 1)) * (w - pad.l - pad.r);
    let tmin = Infinity, tmax = -Infinity;
    for (const s of H) { tmin = Math.min(tmin, s.temp); tmax = Math.max(tmax, s.temp); }
    tmin = Math.floor(tmin - 2); tmax = Math.ceil(tmax + 2);
    grid(ctx, w, h, pad, 25, (v) => `${Math.round(v)}%`);
    eonBands(ctx, H, X, pad, h);
    const line = (vals, lo, hi, color, width = 1.6) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      vals.forEach((v, i) => ctx.lineTo(X(i), h - pad.b - Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * (h - pad.t - pad.b)));
      ctx.stroke();
    };
    line(H.map((s) => Math.log10(Math.max(0.1, s.co2))), -1, 5, css('--co2'));
    line(H.map((s) => s.temp), tmin, tmax, css('--sun'));
    line(H.map((s) => s.o2), 0, 25, css('--o2'), 2);
    ctx.fillStyle = css('--sun'); ctx.font = '10px ' + css('--font-mono'); ctx.textAlign = 'left';
    ctx.fillText(`${tmax}°`, w - pad.r + 4, pad.t + 8);
    ctx.fillText(`${tmin}°`, w - pad.r + 4, h - pad.b);
    timeAxis(ctx, w, h, pad, H);
  }

  // ---------- planet tab ----------

  renderPlanet() {
    const W = this.world, P = W.planet, E = W.eco;
    const eon = EONS[W.eon];
    $('eon-card').innerHTML = `<div class="eon-name">${eon.name} eon</div><div class="muted small">${eon.blurb} Planet age ${formatYears(W.years)}.</div>`;
    const gauge = (label, value, frac, note, cls = '') => `<div class="gauge ${cls}"><div class="g-top"><span>${label}</span><span class="mono">${value}</span></div><div class="bar"><i style="width:${Math.max(0, Math.min(100, frac * 100))}%"></i></div>${note ? `<div class="g-note">${note}</div>` : ''}</div>`;
    let html = '';
    html += gauge('Mean temperature', `${P.meanT.toFixed(1)}°C`, (P.meanT + 20) / 100, P.meanT > 45 ? 'Too hot for life: seas are scalding.' : P.meanT < -5 ? 'Frozen: a snowball world.' : '', 'g-temp');
    html += gauge('Carbon dioxide', `${P.co2 >= 100 ? Math.round(P.co2).toLocaleString() : P.co2.toFixed(1)}× today`, Math.log10(Math.max(0.1, P.co2) * 10) / 6, P.co2 > 50 ? 'A thick greenhouse. Weathering and life slowly draw it down.' : '', 'g-co2');
    html += gauge('Oxygen', `${P.o2.toFixed(1)}%`, P.o2 / 25, P.iron > 0 && E.gradeAlive('cyano') ? `Oceans rusting: ${Math.round((1 - P.iron) * 100)}% of dissolved iron used up` : P.o2 > 21 ? 'Wildfires keep oxygen from rising much higher.' : '', 'g-o2');
    if (P.ch4 > 0.05 || P.o2 < 1) html += gauge('Methane', `${P.ch4.toFixed(1)}`, Math.min(1, P.ch4 / 12), P.haze > 0.3 ? 'Thick enough to form an orange haze.' : P.ch4 > 1 ? 'Made by methanogens; warms the planet.' : '', 'g-ch4');
    html += gauge('Ozone shield', `${Math.round(P.ozone * 100)}%`, P.ozone, P.ozone < 0.5 ? 'Without ozone, ultraviolet light sterilises dry land.' : '', 'g-o3');
    html += gauge('Ocean cover', `${Math.round(P.oceanFrac * 100)}%`, P.oceanFrac, '', 'g-sea');
    html += gauge('Ice cover', `${Math.round(P.iceFrac * 100)}%`, P.iceFrac, '', 'g-ice');
    if (P.cycles) {
      const glacial = P.orbital < -0.45 * P.cycleAmp, warm = P.orbital > 0.45 * P.cycleAmp;
      html += gauge('Orbital climate cycle', `${P.orbital >= 0 ? '+' : ''}${P.orbital.toFixed(1)}°C`, 0.5 + P.orbital / 10,
        glacial ? 'Ice age: glaciers advance and species retreat into refuges.' : warm ? 'Warm interglacial.' : P.cycleAmp < 2 ? 'Mild on a warm planet; ice ages bite harder when it is cool.' : '', 'g-orb');
    }
    const T = W.tect;
    html += gauge('Continents', `${T.landmasses} landmass${T.landmasses === 1 ? '' : 'es'}`, T.largestShare, T.speed > 0 ? `${T.P} plates drifting. The largest landmass holds ${Math.round(T.largestShare * 100)}% of the land.` : 'Continental drift is switched off.', 'g-land');
    html += gauge('Sunlight', `${Math.round(P.sun * 100)}% of today`, (P.sun - 0.7) / 0.35, P.sun < 0.85 ? 'The young Sun is dim; a strong greenhouse keeps the planet warm.' : '', 'g-sun');
    if (E.alive.length === 0) {
      const potential = W.lifePotential;
      html += `<div class="abio">${gauge('Path to the first cell', `${Math.round(W.abiogenesis * 100)}%`, W.abiogenesis, potential > 1.5 ? 'Chemistry is brewing in a warm, organic-rich sea.' : W.liquidFrac < 0.08 ? 'Needs liquid oceans: cool the planet or wait for weathering.' : 'Needs a warm (5–50 °C) shallow sea rich in organics. Try lightning or comets near vents and coasts. The Organics map view shows where.', 'g-life')}</div>`;
    }
    const civ = W.civ;
    if (civ) {
      const sp = civ.species;
      html += `<div class="civ"><div class="civ-head"><span class="civ-icon">${civ.fallen ? '💀' : civ.info.icon}</span><div><b>${civ.fallen ? 'Fallen civilization' : civ.info.name}</b><div class="muted small">${sp ? `<i>${esc(sp.name)}</i>` : ''}${civ.fallen ? '' : ` · ${Math.round(civ.stageYears).toLocaleString()} years in this age · living in ${civ.range ?? sp?.range ?? 0} zones`}</div></div></div>
        <ol class="civ-stages">${CIV_STAGES.map((S, i) => `<li class="${i < civ.stage ? 'done' : i === civ.stage ? 'now' : ''}" title="${S.name}">${S.icon}</li>`).join('')}</ol>
        ${!civ.fallen && civ.stage < CIV_STAGES.length - 1 ? gauge('Progress to the next age', `${Math.round(civ.progress * 100)}%`, civ.progress, '', 'g-life') : ''}
        ${!civ.fallen && civ.info.emit ? '<div class="g-note">Burning fossil fuel: CO₂ is rising and the climate is warming.</div>' : ''}
        ${!civ.fallen && civ.info.hunt > 0.003 ? '<div class="g-note">Hunting and land clearing are pushing large animals and forests back.</div>' : ''}</div>`;
    }
    $('atmo-stats').innerHTML = html;

    let nextShown = false;
    setHTML($('story'), STORY.map((s) => {
      const m = W.milestones.get(s.key);
      if (m) return `<li class="done" data-story="${s.key}"><span class="si">${s.icon}</span><span class="st">${s.title}</span><span class="sw mono">${formatYears(m.years)}</span></li>`;
      const next = !nextShown;
      nextShown = true;
      return `<li class="${next ? 'next' : 'todo'}" data-story="${s.key}"><span class="si">${next ? s.icon : '·'}</span><span class="st">${s.title}${next ? `<span class="goal">${s.goal}</span>` : ''}</span><span class="sw"></span></li>`;
    }).join(''));
  }

  // ---------- inspector ----------

  inspect(cell) { this.inspectCell = cell; this.renderInspector(); }

  renderInspector() {
    const el = $('inspector');
    const W = this.world, P = W.planet;
    const c = this.inspectCell;
    const d = W.describeCell(c);
    const height = d.water ? `${Math.round(d.elev * 5200).toLocaleString()} m` : `${Math.round(P.heightAboveSea(c) * 6000).toLocaleString()} m`;
    const hl = this.r.highlight;
    const life = d.life.slice(0, 14).map(({ sp, b }) => {
      const w = Math.max(4, Math.min(100, (Math.log10(b) + 4) * 25));
      return `<li data-sp="${sp.id}" class="${hl === sp ? 'active' : ''}">${badge(sp, 20)}<span class="nm">${esc(sp.name)}<span class="muted"> · ${GRADES[sp.grade].name}</span></span><span class="bar"><i style="width:${w}%;background:${kingdomColor(sp)}"></i></span></li>`;
    }).join('');
    el.innerHTML = `<button class="close" data-act="close" aria-label="Close">×</button>
      <h4>${d.biome}</h4><div class="sub">${latLon(P.grid.pos, c)}</div>
      <dl>
        <dt>Temperature</dt><dd>${d.temp.toFixed(1)}°C</dd>
        <dt>Rainfall</dt><dd>${Math.round(d.moist * 100)}%</dd>
        <dt>${d.water ? 'Depth' : 'Altitude'}</dt><dd>${height}</dd>
        ${d.water ? `<dt>Organics</dt><dd>${d.organics.toFixed(2)}${d.volc > 0.3 ? ' · hydrothermal vents' : ''}</dd>` : d.volc > 0.4 ? '<dt>Geology</dt><dd>volcanic</dd>' : ''}
      </dl>
      <hr><div class="sub">${d.life.length ? `Life in this zone (${d.life.length} species)` : 'No life in this zone yet.'}</div>
      <ol class="zone-life">${life}</ol>`;
    el.hidden = false;
    if (narrow()) $('panel').classList.add('collapsed');
  }
}

const kingdomColor = (sp) => KINGDOMS[sp.kingdom].color;

// only touch the DOM when the markup actually changed
function setHTML(el, html) {
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
}

// plain-language niche: rainfall and altitude on land, depth at sea
function nicheText(sp) {
  const parts = [];
  if (sp.habitat === 0) parts.push(sp.n2 < 0.2 ? 'coastal shallows' : sp.n2 > 0.55 ? 'deep sea' : 'open ocean');
  else parts.push(sp.n2 < 0.25 ? 'dry ground' : sp.n2 > 0.7 ? 'wet ground' : 'moderate rainfall');
  if (sp.habitat === 2) parts.push(sp.alt > 0.45 ? 'mountains' : sp.alt > 0.22 ? 'uplands' : 'lowlands');
  return parts.join(', ');
}

function nicheTags(sp) {
  if (sp.habitat === 0) return sp.n2 > 0.55 ? '<span class="tag h0">Deep sea</span>' : sp.n2 < 0.2 ? '<span class="tag h1">Shallows</span>' : '';
  let t = sp.n2 < 0.25 ? '<span class="tag h2">Desert</span>' : sp.n2 > 0.7 ? '<span class="tag t1">Rainforest &amp; wetland</span>' : '';
  if (sp.habitat === 2 && sp.alt > 0.45) t += '<span class="tag">Alpine</span>';
  return t;
}

function latLon(pos, c) {
  const x = pos[c * 3], y = pos[c * 3 + 1], z = pos[c * 3 + 2];
  const lat = Math.asin(y) * 180 / Math.PI, lon = Math.atan2(z, x) * 180 / Math.PI;
  return `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;
}

function grid(ctx, w, h, pad, max, fmt) {
  ctx.strokeStyle = 'rgba(146,176,222,0.12)';
  ctx.fillStyle = css('--ink-dim');
  ctx.font = '10px ' + css('--font-mono');
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

// faint vertical lines where a new eon begins
function eonBands(ctx, H, X, pad, h) {
  ctx.fillStyle = css('--ink-dim');
  ctx.font = '9px ' + css('--font-mono');
  let lastX = -999;
  for (let i = 1; i < H.length; i++) {
    if (H[i].eon !== H[i - 1].eon) {
      const x = X(i);
      if (x - lastX < 60) continue;
      lastX = x;
      ctx.strokeStyle = 'rgba(146,176,222,0.25)';
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
      ctx.fillText(EONS[H[i].eon].name, x + 3, pad.t + 9);
    }
  }
}

function timeAxis(ctx, w, h, pad, H) {
  ctx.fillStyle = css('--ink-dim');
  ctx.font = '10px ' + css('--font-mono');
  ctx.textAlign = 'left'; ctx.fillText(formatYears(H[0].years), pad.l, h - 3);
  ctx.textAlign = 'right'; ctx.fillText(formatYears(H[H.length - 1].years), w - pad.r, h - 3);
  ctx.textAlign = 'left';
}

function emptyChart(ctx, w, h) {
  ctx.fillStyle = 'rgba(200,210,230,0.4)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Collecting data…', w / 2, h / 2);
  ctx.textAlign = 'left';
}

export { MAXT };

function defenceText(sp) {
  const ph = sp.ph, out = [];
  if (ph.size > 0.5) out.push('large');
  if (ph.skeleton === 'exo') out.push(ph.limbs ? 'armoured' : 'shelled');
  if (ph.flying) out.push('flies');
  if (ph.motile && ph.motility > 0.6) out.push('fast');
  const v = sp.eco.vuln;
  return `${out.length ? out.join(', ') + ' · ' : ''}${v > 0.6 ? 'easy prey' : v > 0.35 ? 'hard to catch' : 'very hard to catch'}`;
}
