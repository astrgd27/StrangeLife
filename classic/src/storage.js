// Save slots kept in the browser's IndexedDB (large enough for whole worlds), plus file export
// and import so worlds can be backed up or shared.

import { serialize, deserialize, toBytes, fromBytes } from './save.js';
import { EONS, formatYears } from './world.js';

const DB = 'strangelife', STORE = 'saves';
export const SLOTS = ['auto', '1', '2', '3'];

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser has no storage for saved worlds.'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open saved worlds.'));
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

export async function listSaves() {
  const out = {};
  for (const slot of SLOTS) {
    try {
      const rec = await tx('readonly', (s) => s.get(slot));
      if (rec) out[slot] = rec.meta;
    } catch { /* storage unavailable */ }
  }
  return out;
}

export async function saveToSlot(world, slot) {
  const data = serialize(world, { name: slot === 'auto' ? 'Autosave' : `Slot ${slot}`, seed: world.seed, scenario: world.scenario });
  const bytes = await toBytes(data);
  await tx('readwrite', (s) => s.put({ meta: data.meta, bytes }, slot));
  return data.meta;
}

export async function loadFromSlot(slot) {
  const rec = await tx('readonly', (s) => s.get(slot));
  if (!rec) throw new Error('That slot is empty.');
  return deserialize(await fromBytes(rec.bytes));
}

export async function exportWorld(world) {
  const bytes = await toBytes(serialize(world, { name: 'Exported world', seed: world.seed, scenario: world.scenario }));
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `strangelife-seed${world.seed}-${Math.round(world.years / 1e6)}myr.strangelife`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function importWorld(file) {
  return deserialize(await fromBytes(new Uint8Array(await file.arrayBuffer())));
}

export function describeSave(meta) {
  if (!meta) return 'Empty';
  const when = new Date(meta.savedAt);
  return `${EONS[meta.eon]?.name || ''} · ${formatYears(meta.years)} · ${meta.species} species · saved ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
