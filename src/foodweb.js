// The food web of one zone: who lives here and who eats whom, arranged by trophic level
// (plants at the bottom, top predators at the top). Parasites hang off their hosts, and
// partnerships (corals and their algae, fungi and plant roots, pollinators) are drawn in green.

import { drawOrganism } from './sprites.js';
import { GRADES, TROPHIC_NAMES } from './ecosystem.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAX_NODES = 34;

export class FoodWebView {
  constructor() {
    $('web-close').addEventListener('click', () => this.close());
    const cv = $('web-canvas');
    cv.addEventListener('pointermove', (e) => { this.hover = this.nodeAt(e); this.draw(); this.tip(e); });
    cv.addEventListener('pointerleave', () => { this.hover = null; this.draw(); $('web-tip').hidden = true; });
    cv.addEventListener('pointerdown', (e) => { this.sel = this.nodeAt(e); this.draw(); this.detail(); });
    window.addEventListener('resize', () => this.isOpen && this.layout());
  }

  get isOpen() { return !$('webview').hidden; }

  open(world, z, title) {
    this.world = world; this.z = z; this.sel = null; this.hover = null;
    const E = world.eco, web = E.webOf(z);
    // keep the most important nodes: everything that eats something, then the biggest producers
    const score = (n) => Math.log10(n.b + 1e-6) + (n.sp.trophic === 1 ? 0 : 2) + (n.sp.ph?.level >= 2 ? 1 : 0);
    const order = web.nodes.map((n, i) => [i, score(n)]).sort((a, b) => b[1] - a[1]).slice(0, MAX_NODES).map((x) => x[0]);
    const keep = new Map(order.map((i, k) => [i, k]));
    const nodes = order.map((i) => ({ ...web.nodes[i] }));
    const pseudo = [];
    const pseudoNode = (key, name) => {
      let p = pseudo.find((q) => q.key === key);
      if (!p) { p = { key, name, pseudo: true, tl: 1, b: 1 }; pseudo.push(p); }
      return p;
    };
    const links = [];
    for (const l of web.links) {
      const to = typeof l.to === 'number' ? keep.get(l.to) : undefined;
      if (to === undefined) continue;
      const from = l.from === 'det' ? pseudoNode('det', 'Dead matter') : l.from === 'chem' ? pseudoNode('chem', 'Vent chemicals') : keep.has(l.from) ? nodes[keep.get(l.from)] : null;
      if (!from) continue;
      links.push({ from, to: nodes[to], f: l.f, kind: l.kind });
    }
    this.nodes = nodes; this.pseudo = pseudo; this.links = links;
    // trophic level: producers and dead matter are level 1; an eater sits one above the
    // average of what it eats (weighted by how much); parasites sit just above their hosts
    for (const n of nodes) n.tl = n.sp.trophic === 1 || n.sp.trophic === 0 ? 1 : 2;
    for (let it = 0; it < 12; it++) {
      for (const n of nodes) {
        if (n.sp.trophic === 1 || n.sp.trophic === 0) continue;
        let sw = 0, st = 0;
        for (const l of links) if (l.to === n && l.kind === 'eat') { sw += l.f; st += l.f * l.from.tl; }
        const par = links.find((l) => l.to === n && l.kind === 'parasite');
        n.tl = par ? par.from.tl + 0.5 : sw > 0 ? 1 + st / sw : 2;
      }
    }
    // each eater's diet as shares, for line widths
    for (const n of nodes) { n.intake = 0; for (const l of links) if (l.to === n && l.kind !== 'partner') n.intake += l.f; }
    $('web-title').textContent = `Food web: ${title}`;
    $('web-sub').textContent = `${web.nodes.length} species live here${web.nodes.length > nodes.length ? ` (the ${nodes.length} most important shown)` : ''}. Arrows run from the eaten to the eater.`;
    $('webview').hidden = false;
    this.layout();
    this.detail();
  }

  close() { $('webview').hidden = true; }

  layout() {
    const cv = $('web-canvas'), wrap = cv.parentElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = wrap.clientWidth, h = wrap.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    this.dpr = dpr; this.w = w; this.h = h;
    // rows by trophic level, columns spread evenly
    const all = [...this.nodes, ...this.pseudo];
    const maxTL = Math.max(2, ...all.map((n) => n.tl));
    const pad = 46, bands = new Map();
    for (const n of all) {
      const row = Math.round((n.tl - 1) * 2) / 2;
      if (!bands.has(row)) bands.set(row, []);
      bands.get(row).push(n);
    }
    for (const [row, list] of bands) {
      list.sort((a, b) => (a.pseudo ? 1 : 0) - (b.pseudo ? 1 : 0) || (a.sp?.kingdom || '').localeCompare(b.sp?.kingdom || '') || (b.b - a.b));
      list.forEach((n, i) => {
        n.x = pad + ((i + 0.5) / list.length) * (w - 2 * pad);
        n.y = h - pad - ((row) / Math.max(1, maxTL - 1)) * (h - 2 * pad);
        n.r = n.pseudo ? 16 : Math.max(11, Math.min(26, 13 + 3.2 * Math.log10(n.b / 1e-4)));
      });
    }
    this.maxTL = maxTL;
    this.draw();
  }

  nodeAt(e) {
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = Infinity;
    for (const n of [...this.nodes, ...this.pseudo]) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < n.r + 4 && d < bd) { bd = d; best = n; }
    }
    return best;
  }

  draw() {
    const cv = $('web-canvas'), ctx = cv.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const focus = this.hover || this.sel;
    // level guides
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = 'rgba(200,210,230,0.35)'; ctx.textAlign = 'left';
    for (let tl = 1; tl <= Math.ceil(this.maxTL); tl++) {
      const y = this.h - 46 - ((tl - 1) / Math.max(1, this.maxTL - 1)) * (this.h - 92);
      ctx.fillText(tl === 1 ? 'producers & dead matter' : tl === 2 ? 'grazers' : `level ${tl}`, 8, y - 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke();
    }
    // links
    for (const l of this.links) {
      const on = !focus || l.from === focus || l.to === focus;
      const share = l.kind === 'partner' ? 0.5 : l.to.intake > 0 ? l.f / l.to.intake : 0;
      if (share < 0.03 && l.kind === 'eat' && !(focus && on)) continue;
      ctx.globalAlpha = on ? (focus ? 0.9 : 0.55) : 0.06;
      ctx.strokeStyle = l.kind === 'parasite' ? '#ff6b7a' : l.kind === 'partner' ? '#6fdc8c' : '#f3b35c';
      ctx.lineWidth = l.kind === 'eat' ? 0.8 + 5 * share : 1.6;
      ctx.setLineDash(l.kind === 'parasite' ? [5, 4] : l.kind === 'partner' ? [2, 3] : []);
      const { x: x1, y: y1 } = l.from, { x: x2, y: y2 } = l.to, mx = (x1 + x2) / 2 + (y1 - y2) * 0.12, my = (y1 + y2) / 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      // arrowhead at the eater
      if (l.kind !== 'partner') {
        const a = Math.atan2(y2 - my, x2 - mx), hx = x2 - Math.cos(a) * (l.to.r + 2), hy = y2 - Math.sin(a) * (l.to.r + 2);
        ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(a - 0.4) * 8, hy - Math.sin(a - 0.4) * 8); ctx.lineTo(hx - Math.cos(a + 0.4) * 8, hy - Math.sin(a + 0.4) * 8); ctx.fill();
      }
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // nodes
    for (const n of [...this.pseudo, ...this.nodes]) {
      const dim = focus && n !== focus && !this.links.some((l) => (l.from === focus && l.to === n) || (l.to === focus && l.from === n));
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.fillStyle = 'rgba(10,15,28,0.92)';
      ctx.strokeStyle = n.pseudo ? '#8d7a5c' : n.sp.keystone ? '#ffd166' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = n === focus ? 3 : n.sp?.keystone ? 2.5 : 1.2;
      ctx.beginPath();
      if (n.pseudo) ctx.roundRect(n.x - n.r * 1.6, n.y - n.r * 0.8, n.r * 3.2, n.r * 1.6, 6); else ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (n.pseudo) { ctx.fillStyle = '#c9b48f'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.name, n.x, n.y); }
      else { ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y, n.r - 1.5, 0, Math.PI * 2); ctx.clip(); drawOrganism(ctx, n.sp, n.x, n.y, n.r * 0.85); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
  }

  // what a species eats and what eats it, in this place
  relations(n) {
    const eats = this.links.filter((l) => l.to === n && l.kind === 'eat').sort((a, b) => b.f - a.f);
    const by = this.links.filter((l) => l.from === n && l.kind === 'eat').sort((a, b) => b.f - a.f);
    const par = this.links.filter((l) => l.from === n && l.kind === 'parasite');
    const host = this.links.filter((l) => l.to === n && l.kind === 'parasite');
    const partners = this.links.filter((l) => l.kind === 'partner' && (l.from === n || l.to === n)).map((l) => (l.from === n ? l.to : l.from));
    const nm = (m) => (m.pseudo ? m.name.toLowerCase() : `<i>${esc(m.sp.name)}</i>`);
    const list = (arr, f) => arr.slice(0, 4).map(f).join(', ');
    return [
      eats.length && `Eats ${list(eats, (l) => nm(l.from))}`,
      host.length && `Lives in ${list(host, (l) => nm(l.from))}`,
      by.length && `Eaten by ${list(by, (l) => nm(l.to))}`,
      par.length && `Parasites: ${list(par, (l) => nm(l.to))}`,
      partners.length && `Partners: ${list(partners, nm)}`,
    ].filter(Boolean);
  }

  tip(e) {
    const t = $('web-tip'), n = this.hover;
    if (!n || n.pseudo) { t.hidden = true; return; }
    t.innerHTML = `<b><i>${esc(n.sp.name)}</i></b><br>${GRADES[n.sp.grade].name} · ${TROPHIC_NAMES[n.sp.trophic]}${n.sp.keystone ? ' · <span style="color:#ffd166">keystone</span>' : ''}<br><span class="muted">${this.relations(n).join('<br>')}</span>`;
    t.hidden = false;
    t.style.left = Math.min(window.innerWidth - t.offsetWidth - 8, e.clientX + 14) + 'px';
    t.style.top = Math.min(window.innerHeight - t.offsetHeight - 8, e.clientY + 14) + 'px';
  }

  detail() {
    const n = this.sel, d = $('web-detail');
    if (!n || n.pseudo) {
      d.innerHTML = '<span class="muted">Orange: who eats whom (thicker = a bigger share of the diet). Red dashes: parasites. Green dots: partnerships. A gold ring marks a keystone predator, one that holds a common prey in check. Click a species.</span>';
      return;
    }
    const sp = n.sp;
    d.innerHTML = `<b><i>${esc(sp.name)}</i></b> · ${GRADES[sp.grade].name} · ${TROPHIC_NAMES[sp.trophic].toLowerCase()} · trophic level ${n.tl.toFixed(1)}${sp.keystone ? ' · <b style="color:#ffd166">keystone predator</b>: it holds its main prey in check' : ''}<br>${this.relations(n).join(' · ')}`;
  }
}
