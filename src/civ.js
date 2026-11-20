// Civilization: what an intelligent species does to its planet.
//
// Once intelligence evolves, its species advances through technological stages. Progress is
// faster when the species is widespread. Each stage changes the planet:
//  - hunting and habitat loss press on large animals wherever people live (on Earth, the
//    extinctions of mammoths, moas and many others)
//  - farming and logging clear land plants
//  - industry burns fossil fuel, adding CO₂ and warming the climate, until cleaner energy
//    takes over
// Time slows down to a human pace, so a few centuries of industry take as long to play as
// millions of years did before.

import { GRADES, MAXT } from './ecosystem.js';

export const CIV_STAGES = [
  { name: 'Stone Age', icon: '🔥', yearsPerTick: 3000, rate: 1, hunt: 0.002, clear: 0, crowd: 1, emit: 0,
    earth: '~3.3 million years ago (stone tools) to ~12,000 years ago',
    text: 'Stone tools, fire and language let small bands hunt and gather across whole continents. Wherever modern humans arrived, many large animals soon vanished: mammoths, giant ground sloths, moas.' },
  { name: 'Farming', icon: '🌾', yearsPerTick: 12, rate: 1.4, hunt: 0.003, clear: 0.003, crowd: 0.6, emit: 0,
    earth: '~12,000 years ago',
    text: 'Domesticating plants and animals fed far more people from the same land. Villages became towns, and forests were cleared for fields and pasture.' },
  { name: 'Metal Ages', icon: '⚒️', yearsPerTick: 4, rate: 1.8, hunt: 0.004, clear: 0.005, crowd: 0.45, emit: 0,
    earth: '~5,000–2,500 years ago (bronze, then iron)',
    text: 'Bronze and iron tools, writing, cities and trade networks. Smelting metal took huge amounts of wood: whole regions were deforested.' },
  { name: 'Industrial', icon: '🏭', yearsPerTick: 0.3, rate: 2.5, hunt: 0.008, clear: 0.008, crowd: 0.3, emit: 0.012,
    earth: 'From ~1760',
    text: 'Coal, oil and gas power machines. Burning fossil fuel returns carbon that took hundreds of millions of years to bury, and CO₂ climbs faster than at almost any time in Earth\'s history. The planet warms; species that can\'t move or adapt fast enough die out.' },
  { name: 'Information Age', icon: '🏙️', yearsPerTick: 0.3, rate: 3, hunt: 0.005, clear: 0.004, crowd: 0.3, emit: 0.006,
    earth: 'From ~1970',
    text: 'Computers and global communication. Understanding the climate and the biosphere makes it possible to cut emissions and protect what is left.' },
  { name: 'Spacefaring', icon: '🚀', yearsPerTick: 50000, rate: 0, hunt: 0.0005, clear: 0.0002, crowd: 0.3, emit: 0,
    earth: 'Perhaps one day',
    text: 'Clean energy, a recovering biosphere, and ships leaving the planet. Your species has gone from a single cell in a warm sea to the stars. Deep time resumes: the planet keeps evolving.' },
];

export class Civilization {
  constructor(world, sp) {
    this.world = world;
    this.speciesId = sp.id;
    this.stage = 0;
    this.progress = 0;     // 0..1 within the current stage
    this.startTick = world.tick;
    this.stageStart = world.tick;
    this.stageYears = 0;   // years spent in the current stage
    this.fallen = false;
    this.apply();
  }

  get species() { return this.world.eco.species.get(this.speciesId); }
  get info() { return CIV_STAGES[this.stage]; }
  get yearsPerTick() { return this.info.yearsPerTick; }

  // set the species' icon and its population limits for the current stage
  apply() {
    const sp = this.species, E = this.world.eco;
    if (!sp || sp.died >= 0) return;
    sp.icon = this.info.icon;
    E.setParams(sp);
    E.tSelf[sp.slot] *= this.info.crowd; // farming and cities support denser populations
    E.tDisp[sp.slot] *= this.stage >= 3 ? 2 : 1;
  }

  step() {
    const W = this.world, E = W.eco, P = W.planet;
    let sp = this.species;
    if (!sp || sp.died >= 0) {
      // the culture carries on in a descendant intelligent species, if there is one
      const heir = E.alive.map((s) => E.slots[s]).find((q) => q.grade === 'sapient');
      if (heir) { this.speciesId = heir.id; sp = heir; this.apply(); }
      else {
        if (!this.fallen) {
          this.fallen = true;
          W.markTime(this.stage === CIV_STAGES.length - 1 ? 'Departure' : 'Fall');
          W.emit({ type: this.stage === CIV_STAGES.length - 1 ? 'civleft' : 'civfall', stage: this.stage });
        }
        return;
      }
    }
    const S = this.info;
    this.stageYears += S.yearsPerTick;
    if (S.rate > 0) {
      this.progress += 0.0012 * S.rate * Math.min(2, Math.sqrt(sp.range / 15));
      if (this.progress >= 1 && this.stage < CIV_STAGES.length - 1) {
        this.stage++;
        this.progress = 0;
        this.stageStart = W.tick;
        this.stageYears = 0;
        this.apply();
        W.markTime(this.info.name);
        W.emit({ type: 'civstage', stage: this.stage });
      }
    }
    // the footprint of people where they live
    const s = sp.slot, B = E.B;
    const huntable = this._huntable || (this._huntable = new Uint8Array(MAXT));
    const plants = this._plants || (this._plants = new Uint8Array(MAXT));
    huntable.fill(0); plants.fill(0);
    for (const q of E.alive) {
      const o = E.slots[q];
      if (q === s) continue;
      const G = GRADES[o.grade];
      if (o.kingdom === 'animal' && G.tier >= 4 && o.habitat !== 0) huntable[q] = 1;
      if (o.kingdom === 'plant' && o.habitat !== 0 && G.tier >= 3) plants[q] = 1;
    }
    let range = 0;
    for (let z = 0; z < E.Z; z++) {
      if (B[z * MAXT + s] < 1e-3) continue;
      range++;
      for (let a = 0; a < E.presN[z]; a++) {
        const q = E.pres[z * MAXT + a];
        if (huntable[q]) B[z * MAXT + q] *= 1 - S.hunt;
        else if (plants[q] && S.clear) B[z * MAXT + q] *= 1 - S.clear;
      }
    }
    // fossil-fuel CO₂, scaled by how widespread the civilization is
    if (S.emit) P.co2 += S.emit * Math.min(1.5, range / 40);
    this.range = range;
  }
}
