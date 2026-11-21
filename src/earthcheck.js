// Is it like Earth? Five of the best-known patterns in Earth's biodiversity, measured in a
// simulated world and set beside Earth's own. Pure functions: no drawing (see earthview.js).
//
//  1. Diversity through time: animal diversity rises over hundreds of millions of years, knocked
//     back by mass extinctions and recovering (the fossil record of marine animal genera).
//  2. The latitudinal gradient: the tropics hold far more species than the poles.
//  3. The species–area relationship: S = c·A^z, with z about 0.15–0.35.
//  4. Body sizes: most animal species are small; a few are large.
//  5. Commonness and rarity: a few species are very common, most are rare.

// Earth's marine animal diversity through the Phanerozoic (millions of years ago, share of today's),
// a rough outline after Sepkoski's and Alroy's compilations: the Cambrian explosion, the Great
// Ordovician radiation, the big five mass extinctions (end-Ordovician, late Devonian,
// end-Permian, end-Triassic, end-Cretaceous) and the long Mesozoic–Cenozoic rise.
export const EARTH_TIMELINE = [[541, 0.05], [530, 0.22], [510, 0.33], [485, 0.36], [460, 0.58], [446, 0.68], [443, 0.48], [420, 0.6], [385, 0.64], [372, 0.47], [359, 0.46], [320, 0.54], [260, 0.58], [252, 0.14], [240, 0.24], [210, 0.36], [201, 0.27], [180, 0.37], [145, 0.52], [100, 0.67], [67, 0.76], [66, 0.54], [40, 0.8], [10, 0.94], [0, 1]];
export const EARTH_EXTINCTIONS = [[443, 'end-Ordovician'], [372, 'late Devonian'], [252, 'end-Permian'], [201, 'end-Triassic'], [66, 'end-Cretaceous']];
// species richness by latitude band (share of the tropics), typical of birds, mammals, trees and
// marine animals
export const LAT_BANDS = [0, 15, 30, 45, 60, 75, 90];
export const EARTH_LATITUDE = [1, 0.82, 0.55, 0.35, 0.18, 0.07];
// the usual range of the species–area exponent z
export const EARTH_Z = [0.15, 0.35];
// animal species by body size, small to large (share of the commonest class): right-skewed
export const EARTH_BODY = [0.55, 1, 0.82, 0.58, 0.38, 0.24, 0.14, 0.08, 0.04, 0.02];

// the standard normal quantile (Acklam's approximation), for the log-normal of commonness
function probit(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  if (q < 0.02425) { const t = Math.sqrt(-2 * Math.log(q)); return (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1); }
  if (q > 1 - 0.02425) return -probit(1 - q);
  const t = q - 0.5, r = t * t;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * t / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
// Earth's commonness: abundances roughly log-normal (Preston), with a spread of about 2.3
// natural-log units, so the commonest species is thousands of times commoner than the rarest
export function earthRank(r) { return (2.3 * probit(1 - r) - 2.3 * probit(1 - 0.005)) / Math.LN10; }

const lsq = (pts) => {
  const n = pts.length;
  if (n < 2) return { slope: 0, icept: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  return { slope, icept: (sy - slope * sx) / n };
};

// 1. animal species through time, from the first animals to now
function timeline(world) {
  const h = world.history, i0 = h.findIndex((p) => p.kingdoms?.animal?.species >= 2);
  if (i0 < 0 || h.length - i0 < 15) return { ok: null, summary: 'Not enough history yet: wait until animals have been around for a while.', series: [] };
  const pts = h.slice(i0).map((p) => [p.years, p.kingdoms.animal.species]);
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0], max = Math.max(...pts.map((p) => p[1])) || 1;
  const series = pts.map(([t, s]) => [(t - t0) / (t1 - t0 || 1), s / max, s, t]);
  // drops: from a peak, a fall of at least 30% within a short time
  const drops = [];
  for (let i = 1; i < pts.length; i++) {
    let peak = 0, pk = -1;
    for (let j = Math.max(0, i - 12); j < i; j++) if (pts[j][1] > peak) { peak = pts[j][1]; pk = j; }
    if (peak >= 6 && pts[i][1] <= peak * 0.7 && (!drops.length || pk > drops[drops.length - 1].at)) drops.push({ at: i, from: peak, to: pts[i][1], x: series[i][0], years: pts[i][0] });
  }
  // merge drops into events at their lowest point
  const events = [];
  for (const d of drops) { const last = events[events.length - 1]; if (last && d.at - last.at < 12) { if (d.to < last.to) Object.assign(last, d, { from: Math.max(last.from, d.from) }); } else events.push({ ...d }); }
  const q = Math.max(2, Math.floor(pts.length / 4));
  const early = pts.slice(0, q).reduce((a, p) => a + p[1], 0) / q, late = pts.slice(-q).reduce((a, p) => a + p[1], 0) / q;
  const recovered = events.filter((e) => pts.slice(e.at).some((p) => p[1] >= e.from * 0.9)).length;
  const rise = late / Math.max(1, early);
  const ok = rise > 1.3 && (events.length === 0 || recovered >= Math.min(1, events.length));
  return {
    ok, series, events, rise, recovered,
    summary: `Animal species rose ${rise.toFixed(1)}× from the first quarter of animal history to the last, with ${events.length} sharp drop${events.length === 1 ? '' : 's'} of 30% or more${events.length ? ` (${recovered} recovered)` : ''}.`,
    earth: 'On Earth, marine animal diversity rose about tenfold over 540 million years, set back by five mass extinctions and recovering each time.',
    note: 'The simulation follows at most 160 lineages at once, so its rise levels off sooner than Earth\'s.',
  };
}

// 2. species per zone by latitude
function latitude(world) {
  const E = world.eco, pos = E.zgrid.pos, n = LAT_BANDS.length - 1;
  const sum = new Array(n).fill(0), cnt = new Array(n).fill(0);
  for (let z = 0; z < E.Z; z++) {
    if (E.zSea[z] + E.zLand[z] < 0.1) continue;
    const lat = Math.abs(Math.asin(Math.max(-1, Math.min(1, pos[z * 3 + 1]))) * 180 / Math.PI);
    const b = Math.min(n - 1, Math.floor(lat / 15));
    sum[b] += E.speciesIn(z).length; cnt[b]++;
  }
  const per = sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0));
  const top = Math.max(...per) || 1, polar = per[4] || per[5] || 0.01;
  const ratio = per[0] / Math.max(0.1, polar);
  const peakBand = per.indexOf(top);
  return {
    ok: per[0] > 0 ? ratio > 1.5 && peakBand <= 1 : null, per, rel: per.map((v) => v / top), ratio,
    summary: per[0] ? `Tropical zones hold ${per[0].toFixed(1)} species each on average, polar ones (60–75°) ${polar.toFixed(1)}: ${ratio.toFixed(1)}× as many in the tropics.` : 'No life yet.',
    earth: 'On Earth, species richness peaks in the tropics and falls towards the poles, for nearly every group: a tropical forest can hold more tree species in one hectare than all of Europe.',
  };
}

// 3. distinct species in growing neighbourhoods of zones
function speciesArea(world) {
  const E = world.eco, zg = E.zgrid, rng = (() => { let a = 12345; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  const lifeZones = [];
  for (let z = 0; z < E.Z; z++) if (E.presN[z] >= 3) lifeZones.push(z);
  if (lifeZones.length < 40) return { ok: null, summary: 'Life is too sparse to measure yet.', levels: [] };
  const RINGS = 7, levels = Array.from({ length: RINGS }, () => ({ a: 0, s: 0, n: 0 })), slopes = [];
  for (let c = 0; c < 30; c++) {
    const start = lifeZones[Math.floor(rng() * lifeZones.length)];
    const seen = new Set([start]), sp = new Set();
    let ring = [start];
    const pts = [];
    for (let r = 0; r < RINGS; r++) {
      for (const z of ring) for (const { sp: q } of E.speciesIn(z)) sp.add(q.id);
      pts.push([Math.log10(seen.size), Math.log10(Math.max(1, sp.size))]);
      levels[r].a += Math.log10(seen.size); levels[r].s += Math.log10(Math.max(1, sp.size)); levels[r].n++;
      const next = [];
      for (const z of ring) for (let k = zg.nbrStart[z]; k < zg.nbrStart[z + 1]; k++) { const q = zg.nbr[k]; if (!seen.has(q)) { seen.add(q); next.push(q); } }
      ring = next;
    }
    slopes.push(lsq(pts).slope);
  }
  slopes.sort((a, b) => a - b);
  const z = slopes[Math.floor(slopes.length / 2)];
  const pts = levels.map((l) => [l.a / l.n, l.s / l.n]);
  return {
    ok: z >= 0.1 && z <= 0.45, z, pts, fit: lsq(pts),
    summary: `Species rise with area as S ∝ A^${z.toFixed(2)} (the median of 30 samples, from one zone to about 130).`,
    earth: 'On Earth, the number of species grows with area as S ∝ A^z, with z usually between 0.15 and 0.35: ten times the area holds about twice the species.',
  };
}

// 4. animal species by body size
function bodySizes(world) {
  const an = world.eco.livingSpecies().filter((s) => s.ph?.animal && s.trophic !== 6);
  if (an.length < 8) return { ok: null, summary: 'Too few animals yet.', counts: [] };
  const counts = new Array(10).fill(0);
  for (const s of an) counts[Math.min(9, Math.floor(s.ph.size * 10))]++;
  const sizes = an.map((s) => s.ph.size).sort((a, b) => a - b);
  const small = sizes.filter((x) => x < 0.3).length / sizes.length, large = sizes.filter((x) => x >= 0.6).length / sizes.length;
  const top = Math.max(...counts) || 1;
  return {
    ok: small >= 0.5 && small > large * 3, counts, rel: counts.map((c) => c / top), small, large, n: an.length,
    summary: `${Math.round(small * 100)}% of the ${an.length} animal species are small and ${Math.round(large * 100)}% large.`,
    earth: 'On Earth, most animal species are small (insects above all) and only a few are large: plotted by size, the counts pile up at the small end with a long tail of giants.',
  };
}

// 5. commonness and rarity
function commonness(world) {
  const sp = world.eco.livingSpecies().filter((s) => s.total > 0).map((s) => s.total).sort((a, b) => b - a);
  if (sp.length < 10) return { ok: null, summary: 'Too few species yet.', pts: [] };
  const tot = sp.reduce((a, b) => a + b, 0), k = Math.max(1, Math.round(sp.length * 0.1));
  const topShare = sp.slice(0, k).reduce((a, b) => a + b, 0) / tot;
  const pts = sp.map((v, i) => [(i + 0.5) / sp.length, Math.log10(v / sp[0])]);
  const median = sp[Math.floor(sp.length / 2)] / sp[0];
  return {
    ok: topShare > 0.4 && median < 0.1, pts, topShare, median,
    summary: `The commonest 10% of species make up ${Math.round(topShare * 100)}% of all living matter; the median species is ${median < 0.01 ? 'less than 1%' : `${Math.round(median * 100)}%`} as abundant as the commonest.`,
    earth: 'On Earth, a few species are very common and most are rare: abundances follow a log-normal, and in a tropical forest plot half the trees may belong to a handful of species while most species are represented by a few individuals.',
  };
}

export function earthCheck(world) {
  const checks = [
    { key: 'time', title: 'Diversity through time', ...timeline(world) },
    { key: 'lat', title: 'Tropics to poles', ...latitude(world) },
    { key: 'area', title: 'Species and area', ...speciesArea(world) },
    { key: 'size', title: 'Body sizes', ...bodySizes(world) },
    { key: 'common', title: 'Common and rare', ...commonness(world) },
  ];
  const measured = checks.filter((c) => c.ok !== null);
  return { checks, matches: measured.filter((c) => c.ok).length, measured: measured.length };
}
