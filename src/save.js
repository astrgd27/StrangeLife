// Saving and loading worlds.
//
// A save stores everything that can't be recomputed: terrain and plate positions, the atmosphere,
// every species that ever lived, where each living species is and how much of it, the history
// and the random-number state. Derived things (climate, biomes, distances) are rebuilt on load.
// Typed arrays are stored as base64, and the whole save is gzip-compressed where the browser can.

import { World } from './world.js';
import { Civilization } from './civ.js';
import { NG, makeGenes, ARCHETYPES } from './genome.js';

export const SAVE_VERSION = 3; // 2: species carry genomes; 3: coverings, armour, plant forms, fresh water

// ---------- encoding helpers ----------

function toB64(u8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(str) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
  const s = atob(str), u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
const TA = { Float32Array, Float64Array, Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array };
function packTA(v) { return { __ta: v.constructor.name, d: toB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) }; }
function unpackTA(o) { const u8 = fromB64(o.d); return new TA[o.__ta](u8.buffer, u8.byteOffset, u8.byteLength / TA[o.__ta].BYTES_PER_ELEMENT); }

// plain numbers, booleans and strings of an object (skips functions, arrays and nested objects)
function scalars(obj, skip = []) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (skip.includes(k)) continue;
    const t = typeof v;
    if (t === 'number' || t === 'boolean' || t === 'string' || v === null) out[k] = v;
  }
  return out;
}

// ---------- save ----------

export function serialize(world, meta = {}) {
  const P = world.planet, T = world.tect, E = world.eco;
  // biomass is mostly empty: store only occupied entries
  const idx = [], val = [];
  for (let i = 0; i < E.B.length; i++) if (E.B[i] > 0) { idx.push(i); val.push(E.B[i]); }
  const species = [...E.species.values()].map((sp) => ({ ...scalars(sp, ['_p', 'body']), genes: Array.from(sp.genes), brain: sp.brain ? Array.from(sp.brain) : undefined }));
  return {
    version: SAVE_VERSION,
    meta: { savedAt: new Date().toISOString(), years: world.years, eon: world.eon, species: E.alive.length, ...meta },
    seed: world.seed, scenario: world.scenario,
    world: {
      ...scalars(world, ['listeners']),
      eonTicks: world.eonTicks, history: world.history,
      milestones: [...world.milestones.entries()],
      civ: world.civ ? scalars(world.civ, ['range']) : null,
      rng: world.rng.getState(),
    },
    planet: {
      ...scalars(P),
      elev: packTA(P.elev), tempOffset: packTA(P.tempOffset), moistOffset: packTA(P.moistOffset),
      organics: packTA(P.organics), volc: packTA(P.volc),
    },
    tect: {
      ...scalars(T),
      plate0: packTA(T.plate0), label: packTA(T.label), crust0: packTA(T.crust0), uplift: packTA(T.uplift),
      hotspot: packTA(T.hotspot), omega: packTA(T.omega), angle: packTA(T.angle), lastMove: packTA(T.lastMove),
      collide: packTA(T.collide), axis: T.axis, rng: T.rng.getState(),
    },
    eco: {
      ...scalars(E),
      species, alive: E.alive.slice(), innovations: [...E.innovations],
      bIdx: packTA(Int32Array.from(idx)), bVal: packTA(Float32Array.from(val)),
      detS: packTA(E.detS), detL: packTA(E.detL),
      specLog: E.specLog, radiationNoted: E.radiationNoted,
      groupOrigins: E.groupOrigins, groupsSeen: [...(E.groupsSeen || [])], groupFrom: E.groupFrom || {},
    },
  };
}

// ---------- load ----------

export function deserialize(data) {
  if (data?.version === 1) throw new Error('This world was saved before genomes existed. Open it in StrangeLife Classic.');
  if (!data || (data.version !== SAVE_VERSION && data.version !== 2)) throw new Error('This save file is from a different version of StrangeLife.');
  // rebuild the same planet from its seed, then overwrite everything that has changed since
  const w = new World(data.seed, { scenario: data.scenario });
  const P = w.planet, T = w.tect, E = w.eco;

  const { elev, tempOffset, moistOffset, organics, volc, ...pScalars } = data.planet;
  Object.assign(P, pScalars);
  P.elev.set(unpackTA(elev)); P.tempOffset.set(unpackTA(tempOffset)); P.moistOffset.set(unpackTA(moistOffset));
  P.organics.set(unpackTA(organics)); P.volc.set(unpackTA(volc));
  P.terrainChanged();

  const t = data.tect;
  const { plate0, label, crust0, uplift, hotspot, omega, angle, lastMove, collide, axis, rng: trng, ...tScalars } = t;
  Object.assign(T, tScalars);
  T.plate0.set(unpackTA(plate0)); T.label.set(unpackTA(label)); T.crust0.set(unpackTA(crust0));
  T.uplift.set(unpackTA(uplift)); T.hotspot.set(unpackTA(hotspot)); T.omega.set(unpackTA(omega));
  T.angle.set(unpackTA(angle)); T.lastMove.set(unpackTA(lastMove)); T.collide.set(unpackTA(collide));
  T.axis = axis;
  T.rng.setState(trng);
  for (let c = 0; c < P.n; c++) for (let p = 0; p < T.P; p++) T.guess[c * T.P + p] = c;
  T.computeBoundary();
  T.landStats();

  // ecosystem: species, then where they live
  const e = data.eco;
  const { species, alive, innovations, bIdx, bVal, detS, detL, specLog, radiationNoted, groupOrigins, groupsSeen, groupFrom, ...eScalars } = e;
  Object.assign(E, eScalars);
  E.species = new Map();
  E.slots.fill(null);
  for (const sp of species) {
    if (sp.genes.length < NG) {
      // a save from before coverings and plant forms: fill in the new genes from the group's archetype
      const base = makeGenes(ARCHETYPES[sp.grade]?.genes || {});
      const g = Float32Array.from(base);
      g.set(sp.genes.slice(0, NG));
      sp.genes = g;
    }
    sp.genes = Float32Array.from(sp.genes);
    if (sp.brain) sp.brain = Float32Array.from(sp.brain);
    E.species.set(sp.id, sp);
    E.develop(sp); // rebuild the body from the genome
  }
  E.alive = [];
  for (const s of alive) {
    const sp = species.find((q) => q.slot === s && q.died < 0);
    if (!sp) continue;
    E.slots[s] = sp;
    E.alive.push(s);
  }
  E.innovations = new Set(innovations);
  E.specLog = specLog || {};
  E.radiationNoted = radiationNoted || {};
  E.groupOrigins = groupOrigins || {};
  E.groupsSeen = new Set(groupsSeen || []);
  E.groupFrom = groupFrom || {};
  E.B.fill(0);
  E.presN.fill(0);
  const I = unpackTA(bIdx), V = unpackTA(bVal);
  for (let k = 0; k < I.length; k++) {
    const i = I[k], z = Math.floor(i / (E.B.length / E.Z)), s = i - z * (E.B.length / E.Z);
    if (E.slots[s]) E.addB(z, s, V[k]);
  }
  E.detS.set(unpackTA(detS)); E.detL.set(unpackTA(detL));
  E.updateEnvironment();
  for (const s of E.alive) { E.setParams(E.slots[s]); E.refreshSuit(s); }

  // world bookkeeping
  const { eonTicks, history, milestones, rng, civ, ...wScalars } = data.world;
  Object.assign(w, wScalars);
  w.eonTicks = eonTicks;
  w.history = history;
  w.milestones = new Map(milestones);
  w.rng.setState(rng);
  if (civ) {
    w.civ = Object.assign(Object.create(Civilization.prototype), civ, { world: w });
    if (!w.civ.fallen) w.civ.apply();
  } else w.civ = null;
  return w;
}

// ---------- bytes on disk ----------

// JSON text, gzip-compressed when the browser supports it
export async function toBytes(data) {
  const text = JSON.stringify(data);
  if (typeof CompressionStream === 'undefined') return new TextEncoder().encode(text);
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function fromBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text;
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed saves.');
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else text = new TextDecoder().decode(u8);
  return JSON.parse(text);
}
