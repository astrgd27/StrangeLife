// The planet: a geodesic grid of cells with terrain, climate, biomes and plant life.
// Pure simulation code (no rendering), so it can run headless for testing.

import { mulberry32, makeNoise3 } from './rng.js';

// ---------- geodesic grid ----------

export function makeGeodesicGrid(level) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(normalize);
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let l = 0; l < level; l++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 1e7 + b : b * 1e7 + a;
      let m = cache.get(key);
      if (m === undefined) {
        const va = verts[a], vb = verts[b];
        m = verts.length;
        verts.push(normalize([va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]]));
        cache.set(key, m);
      }
      return m;
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }

  const n = verts.length;
  const pos = new Float32Array(n * 3);
  verts.forEach((v, i) => { pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]; });
  const index = new Uint32Array(faces.length * 3);
  faces.forEach((f, i) => { index[i * 3] = f[0]; index[i * 3 + 1] = f[1]; index[i * 3 + 2] = f[2]; });

  // adjacency (each vertex has 5 or 6 neighbours)
  const adj = Array.from({ length: n }, () => []);
  const add = (a, b) => { if (!adj[a].includes(b)) adj[a].push(b); };
  for (const [a, b, c] of faces) { add(a, b); add(b, a); add(b, c); add(c, b); add(c, a); add(a, c); }
  const nbrStart = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) nbrStart[i + 1] = nbrStart[i] + adj[i].length;
  const nbr = new Int32Array(nbrStart[n]);
  for (let i = 0; i < n; i++) nbr.set(adj[i], nbrStart[i]);

  return { n, pos, index, nbrStart, nbr };
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------- biomes ----------

export const BIOMES = [
  // name, lush colour, plant capacity
  { name: 'Deep ocean', color: [0.04, 0.13, 0.32], K: 0.35, water: true },
  { name: 'Shallow sea', color: [0.09, 0.36, 0.55], K: 0.75, water: true },
  { name: 'Sea ice', color: [0.82, 0.88, 0.94], K: 0.04, water: true },
  { name: 'Ice sheet', color: [0.94, 0.96, 0.99], K: 0.02 },
  { name: 'Tundra', color: [0.52, 0.55, 0.42], K: 0.25 },
  { name: 'Taiga', color: [0.17, 0.36, 0.26], K: 0.55 },
  { name: 'Temperate forest', color: [0.2, 0.48, 0.18], K: 0.85 },
  { name: 'Grassland', color: [0.55, 0.66, 0.29], K: 0.5 },
  { name: 'Desert', color: [0.87, 0.76, 0.5], K: 0.06 },
  { name: 'Savanna', color: [0.72, 0.66, 0.33], K: 0.45 },
  { name: 'Rainforest', color: [0.07, 0.4, 0.11], K: 1.0 },
  { name: 'Mountains', color: [0.5, 0.45, 0.41], K: 0.1 },
];
export const B = {
  DEEP: 0, SHALLOW: 1, SEA_ICE: 2, ICE: 3, TUNDRA: 4, TAIGA: 5, TEMPERATE: 6,
  GRASS: 7, DESERT: 8, SAVANNA: 9, RAINFOREST: 10, MOUNTAIN: 11,
};

const SOIL = [0.5, 0.4, 0.29];

// ---------- planet ----------

export class Planet {
  constructor(seed = 1, level = 6) {
    this.grid = makeGeodesicGrid(level);
    const n = (this.n = this.grid.n);
    this.elev = new Float32Array(n);        // -1 (abyss) .. +1 (peaks); sea level at this.seaLevel
    this.tempOffset = new Float32Array(n);  // local climate edits (°C)
    this.moistOffset = new Float32Array(n); // local climate edits
    this.moistNoise = new Float32Array(n);
    this.temp = new Float32Array(n);
    this.moist = new Float32Array(n);
    this.biome = new Uint8Array(n);
    this.K = new Float32Array(n);
    this.plant = new Float32Array(n);
    this.water = new Uint8Array(n);
    this.oceanDist = new Uint16Array(n);
    this.seaLevel = 0;
    this.globalTemp = 0;  // player greenhouse offset (°C)
    this.winter = 0;      // impact-winter cooling, decays over time
    this.plantGrowth = 0.035;
    this.climateDirty = true;
    this.generate(seed);
  }

  generate(seed) {
    this.seed = seed;
    const rng = mulberry32(seed);
    const N = makeNoise3(rng);
    const { n, pos } = this.grid;
    const ox = rng() * 100, oy = rng() * 100, oz = rng() * 100;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      // domain warp for interesting coastlines
      const wx = N.fbm(x * 1.5 + 11, y * 1.5, z * 1.5, 3) * 0.6;
      const wy = N.fbm(x * 1.5, y * 1.5 + 23, z * 1.5, 3) * 0.6;
      const wz = N.fbm(x * 1.5, y * 1.5, z * 1.5 + 37, 3) * 0.6;
      const px = x + wx + ox, py = y + wy + oy, pz = z + wz + oz;
      const continent = N.fbm(px * 0.9, py * 0.9, pz * 0.9, 4);
      const detail = N.fbm(px * 3.2, py * 3.2, pz * 3.2, 5);
      const ridge = N.ridged(px * 2.0 + 5, py * 2.0, pz * 2.0, 4);
      raw[i] = continent * 1.0 + detail * 0.35 + ridge * 0.45 * Math.max(0, continent + 0.15);
      this.moistNoise[i] = N.fbm(x * 2.3 + 50, y * 2.3, z * 2.3, 4);
    }
    // put ~31% of the surface above sea level
    const sorted = Float32Array.from(raw).sort();
    const sea = sorted[Math.floor(n * 0.69)];
    const top = sorted[n - 1] - sea, bottom = sea - sorted[0];
    for (let i = 0; i < n; i++) {
      const e = raw[i] - sea;
      this.elev[i] = e >= 0 ? Math.pow(e / top, 1.35) : -Math.pow(-e / bottom, 0.7);
    }
    this.tempOffset.fill(0);
    this.moistOffset.fill(0);
    this.seaLevel = 0;
    this.globalTemp = 0;
    this.winter = 0;
    this.terrainChanged();
    for (let i = 0; i < n; i++) this.plant[i] = this.K[i] * 0.8;
  }

  // call after elevation or sea-level edits
  terrainChanged() {
    const { n } = this;
    for (let i = 0; i < n; i++) this.water[i] = this.elev[i] < this.seaLevel ? 1 : 0;
    this.computeOceanDist();
    this.updateClimate();
  }

  computeOceanDist() {
    const { n } = this;
    const { nbrStart, nbr } = this.grid;
    const d = this.oceanDist;
    const queue = new Int32Array(n);
    let qh = 0, qt = 0;
    for (let i = 0; i < n; i++) {
      if (this.water[i]) { d[i] = 0; queue[qt++] = i; } else d[i] = 65535;
    }
    while (qh < qt) {
      const c = queue[qh++];
      for (let k = nbrStart[c]; k < nbrStart[c + 1]; k++) {
        const m = nbr[k];
        if (d[m] > d[c] + 1) { d[m] = d[c] + 1; queue[qt++] = m; }
      }
    }
  }

  // land height above sea level in 0..1 (0 for water)
  heightAboveSea(i) {
    return Math.max(0, (this.elev[i] - this.seaLevel) / Math.max(0.2, 1 - this.seaLevel));
  }

  updateClimate() {
    const { n } = this;
    const pos = this.grid.pos;
    const g = this.globalTemp - this.winter;
    for (let i = 0; i < n; i++) {
      const y = pos[i * 3 + 1];
      const lat = Math.asin(y) * 180 / Math.PI; // degrees
      const alat = Math.abs(lat);
      let T = 28 - 50 * y * y;
      const w = this.water[i];
      if (w) {
        T = T * 0.8 + 3; // oceans moderate temperature
      } else {
        T -= this.heightAboveSea(i) * 34; // lapse rate
        T += Math.min(this.oceanDist[i], 12) * 0.12 * (T > 10 ? 1 : -1); // continentality
      }
      T += g + this.tempOffset[i];
      this.temp[i] = T;

      // moisture: noise + ocean proximity + Hadley circulation
      let m = 0.42 + this.moistNoise[i] * 0.55;
      if (!w) m += 0.42 * Math.exp(-this.oceanDist[i] / 5) - 0.15;
      m -= 0.38 * Math.exp(-(((alat - 27) / 9) ** 2)); // subtropical deserts
      m += 0.3 * Math.exp(-((alat / 11) ** 2));        // tropical rain belt
      m += 0.12 * Math.exp(-(((alat - 55) / 12) ** 2)); // mid-latitude storms
      m -= Math.max(0, this.heightAboveSea(i) - 0.45) * 0.4;
      if (T < 0) m *= 0.75; // cold air holds less water
      m += this.moistOffset[i];
      this.moist[i] = Math.min(1, Math.max(0, m));

      this.biome[i] = this.classify(i, T, this.moist[i]);
      this.K[i] = BIOMES[this.biome[i]].K;
      if (w && this.biome[i] !== B.SEA_ICE) {
        // warm, shallow water is productive; cold upwelling helps too
        this.K[i] *= 0.75 + 0.25 * Math.exp(-(((T - 18) / 14) ** 2)) + (T < 8 ? 0.15 : 0);
      }
    }
    this.climateDirty = false;
  }

  classify(i, T, m) {
    if (this.water[i]) {
      if (T < -6) return B.SEA_ICE;
      return this.elev[i] - this.seaLevel > -0.18 ? B.SHALLOW : B.DEEP;
    }
    const h = this.heightAboveSea(i);
    if (T < -10) return B.ICE;
    if (h > 0.62 && T < 14) return B.MOUNTAIN;
    if (T < 0) return B.TUNDRA;
    if (T < 9) return m > 0.38 ? B.TAIGA : B.TUNDRA;
    if (T < 20) return m < 0.22 ? B.DESERT : m < 0.48 ? B.GRASS : B.TEMPERATE;
    return m < 0.2 ? B.DESERT : m < 0.46 ? B.SAVANNA : B.RAINFOREST;
  }

  growPlants() {
    const { n, plant, K } = this;
    const r = this.plantGrowth * (this.winter > 0 ? Math.max(0.25, 1 - this.winter / 12) : 1);
    for (let i = 0; i < n; i++) {
      const k = K[i];
      let b = plant[i];
      if (b > k) b -= (b - k) * 0.1; // die back after climate shifts
      else b += r * b * (1 - b / k) + 0.0015 * k;
      plant[i] = b;
    }
  }

  step(tick) {
    if (this.winter > 0) {
      this.winter = Math.max(0, this.winter * 0.985 - 0.005);
      if (tick % 4 === 0) this.climateDirty = true;
    }
    if (this.climateDirty) this.updateClimate();
    this.growPlants();
  }

  // ---------- player tools ----------

  // cells within an angular radius (radians) of cell c, with falloff weight 0..1
  cellsNear(c, radius) {
    const { pos } = this.grid;
    const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
    const cosR = Math.cos(radius);
    const out = [];
    for (let i = 0; i < this.n; i++) {
      const d = cx * pos[i * 3] + cy * pos[i * 3 + 1] + cz * pos[i * 3 + 2];
      if (d >= cosR) {
        const a = Math.acos(Math.min(1, d)) / radius;
        out.push(i, 0.5 + 0.5 * Math.cos(Math.PI * a));
      }
    }
    return out; // flat [cell, weight, cell, weight, ...]
  }

  editElevation(c, radius, amount) {
    const cells = this.cellsNear(c, radius);
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      this.elev[i] = Math.max(-1, Math.min(1.2, this.elev[i] + amount * cells[k + 1]));
    }
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      this.water[i] = this.elev[i] < this.seaLevel ? 1 : 0;
    }
    this.climateDirty = true;
  }

  editClimate(c, radius, dTemp, dMoist) {
    const cells = this.cellsNear(c, radius);
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k], w = cells[k + 1];
      this.tempOffset[i] = Math.max(-30, Math.min(30, this.tempOffset[i] + dTemp * w));
      this.moistOffset[i] = Math.max(-0.8, Math.min(0.8, this.moistOffset[i] + dMoist * w));
    }
    this.climateDirty = true;
  }

  impact(c) {
    const crater = this.cellsNear(c, 0.07);
    for (let k = 0; k < crater.length; k += 2) {
      const i = crater[k], w = crater[k + 1];
      // bowl with a raised rim
      this.elev[i] += -0.35 * w + 0.12 * Math.sin(Math.PI * (1 - w));
      this.plant[i] = 0;
    }
    const blast = this.cellsNear(c, 0.35);
    for (let k = 0; k < blast.length; k += 2) this.plant[blast[k]] *= 1 - blast[k + 1];
    for (let i = 0; i < this.n; i++) this.plant[i] *= 0.6;
    this.winter = Math.min(20, this.winter + 9);
    this.terrainChanged();
  }

  // ---------- colours for rendering ----------

  // writes RGB into out (Float32Array n*3)
  colors(out, mode = 'biome') {
    const { n } = this;
    for (let i = 0; i < n; i++) {
      let r, g, b;
      if (mode === 'biome' || mode === 'life') {
        const bi = this.biome[i];
        const base = BIOMES[bi].color;
        if (this.water[i]) {
          const depth = Math.min(1, (this.seaLevel - this.elev[i]) / 0.6);
          if (bi === B.SEA_ICE) { [r, g, b] = base; }
          else {
            r = 0.1 + (0.02 - 0.1) * depth;
            g = 0.42 + (0.1 - 0.42) * depth;
            b = 0.58 + (0.3 - 0.58) * depth;
            const p = Math.min(1, this.plant[i] / 0.9) * 0.12; // plankton tint
            g += p; r += p * 0.3;
          }
        } else {
          const lush = this.K[i] > 0.05 ? Math.min(1, this.plant[i] / this.K[i]) : 1;
          r = SOIL[0] + (base[0] - SOIL[0]) * lush;
          g = SOIL[1] + (base[1] - SOIL[1]) * lush;
          b = SOIL[2] + (base[2] - SOIL[2]) * lush;
          if (bi === B.ICE || bi === B.DESERT || bi === B.MOUNTAIN) [r, g, b] = base;
          if (bi === B.MOUNTAIN && this.temp[i] < -2) [r, g, b] = [0.92, 0.93, 0.96];
        }
      } else if (mode === 'temperature') {
        [r, g, b] = ramp(TEMP_RAMP, (this.temp[i] + 30) / 70);
      } else if (mode === 'moisture') {
        [r, g, b] = ramp(MOIST_RAMP, this.moist[i]);
        if (this.water[i]) { r *= 0.35; g *= 0.35; b *= 0.45; }
      } else if (mode === 'elevation') {
        const e = this.elev[i] - this.seaLevel;
        [r, g, b] = e < 0 ? ramp(DEPTH_RAMP, 1 + e) : ramp(HEIGHT_RAMP, e / (1 - this.seaLevel));
      } else if (mode === 'plants') {
        [r, g, b] = ramp(PLANT_RAMP, this.plant[i]);
      }
      out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
    }
  }
}

const TEMP_RAMP = [[0.2, 0.25, 0.75], [0.3, 0.65, 0.95], [0.95, 0.95, 0.85], [0.98, 0.65, 0.25], [0.8, 0.15, 0.12]];
const MOIST_RAMP = [[0.75, 0.55, 0.3], [0.8, 0.8, 0.5], [0.35, 0.7, 0.55], [0.2, 0.45, 0.85]];
const DEPTH_RAMP = [[0.02, 0.05, 0.2], [0.1, 0.3, 0.6]];
const HEIGHT_RAMP = [[0.25, 0.5, 0.25], [0.75, 0.7, 0.4], [0.55, 0.42, 0.32], [0.95, 0.95, 0.95]];
const PLANT_RAMP = [[0.08, 0.06, 0.05], [0.25, 0.35, 0.1], [0.3, 0.85, 0.25]];

function ramp(stops, t) {
  t = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
