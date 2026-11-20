// Tiny evolving brains for individual creatures (used when you dive into a zone).
//
// Each brain is a small neural network: 10 senses → 6 hidden neurons → 3 outputs.
//   senses:  smell of food (x, y), nearest danger (x, y), nearest prey (x, y),
//            nearby kin (x, y), hunger, and a constant
//   outputs: which way to steer (x, y) and how fast to go
// Brains are inherited with mutations (and mixed between parents in sexual species), so
// behaviour evolves by natural selection while you watch: creatures that find food, escape
// predators or stay together leave more offspring. What a species learns is kept on the species
// and changes how it does across the whole planet.

export const SENSES = ['Food →', 'Food ↓', 'Danger →', 'Danger ↓', 'Prey →', 'Prey ↓', 'Kin →', 'Kin ↓', 'Hunger', 'Bias'];
export const ACTIONS = ['Steer →', 'Steer ↓', 'Speed'];
export const NI = SENSES.length, NH = 6, NO = ACTIONS.length;
const W1 = NH * NI;             // input → hidden weights
export const NW = W1 + NO * (NH + 1); // + hidden (and a bias) → output weights

// An innate starting brain: weak instincts to approach food or prey and avoid danger, with
// noise. Evolution strengthens, rewires or discards them. Kin attraction starts at zero, so
// herding and schooling appear only if they pay off.
export function makeBrain(diet, rng, gaussian, noise = 0.25) {
  const b = new Float32Array(NW);
  const w1 = (h, i, v) => { b[h * NI + i] = v; };
  const w2 = (o, h, v) => { b[W1 + o * (NH + 1) + h] = v; };
  const graze = diet.graze ? 0.8 : 0, hunt = diet.hunt ? 0.8 : 0;
  // hidden 0/1: food, 2/3: danger, 4/5: prey (x and y channels)
  w1(0, 0, 1.2); w1(1, 1, 1.2); w1(2, 2, 1.2); w1(3, 3, 1.2); w1(4, 4, 1.2); w1(5, 5, 1.2);
  w2(0, 0, graze); w2(1, 1, graze);
  w2(0, 2, -0.6); w2(1, 3, -0.6);
  w2(0, 4, hunt); w2(1, 5, hunt);
  w2(2, NH, 0.3); // a modest cruising speed
  if (rng) for (let k = 0; k < NW; k++) b[k] += gaussian(rng) * noise;
  return b;
}

// run the network: inputs (length NI) → out (length NO); steer in -1..1, speed in 0..1
const hid = new Float32Array(NH);
export function think(b, x, out) {
  for (let h = 0; h < NH; h++) {
    let s = 0;
    const o = h * NI;
    for (let i = 0; i < NI; i++) s += b[o + i] * x[i];
    hid[h] = Math.tanh(s);
  }
  for (let k = 0; k < NO; k++) {
    const o = W1 + k * (NH + 1);
    let s = b[o + NH];
    for (let h = 0; h < NH; h++) s += b[o + h] * hid[h];
    out[k] = k < 2 ? Math.tanh(s) : 1 / (1 + Math.exp(-s));
  }
  return out;
}

export function mutateBrain(b, rng, gaussian, rate = 1) {
  const c = Float32Array.from(b);
  for (let k = 0; k < NW; k++) {
    if (rng() < 0.15 * rate) c[k] += gaussian(rng) * 0.25;
    if (rng() < 0.005 * rate) c[k] = gaussian(rng) * 0.8; // occasionally rewire a connection
  }
  return c;
}

// sexual reproduction: each hidden neuron (with its connections) comes from one parent
export function crossBrains(a, b, rng) {
  const c = Float32Array.from(a);
  for (let h = 0; h < NH; h++) {
    if (rng() < 0.5) continue;
    for (let i = 0; i < NI; i++) c[h * NI + i] = b[h * NI + i];
    for (let o = 0; o < NO; o++) c[W1 + o * (NH + 1) + h] = b[W1 + o * (NH + 1) + h];
  }
  return c;
}

// ---------- reading behaviour from a brain ----------

// Show the brain one stimulus at a time from many directions and measure how it reacts:
// toward food, away from danger, toward prey, toward kin. Each skill is -1..1.
const PROBE = 16;
export function probe(b) {
  const x = new Float32Array(NI), out = new Float32Array(NO);
  // the same brain with no stimulus, so a constant drift doesn't count as a response
  x[8] = 0.5; x[9] = 1;
  const base = think(b, x, new Float32Array(NO)).slice();
  const skill = {};
  for (const [k, ch, sign] of [['forage', 0, 1], ['evade', 2, -1], ['hunt', 4, 1], ['herd', 6, 1]]) {
    let s = 0;
    for (let d = 0; d < PROBE; d++) {
      const a = (d / PROBE) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      x.fill(0); x[8] = 0.5; x[9] = 1;
      x[ch] = ux * 0.7; x[ch + 1] = uy * 0.7;
      think(b, x, out);
      s += ((out[0] - base[0]) * ux + (out[1] - base[1]) * uy) * (0.4 + 0.6 * out[2]);
    }
    skill[k] = Math.max(-1, Math.min(1, (sign * s) / PROBE));
  }
  return skill;
}

// plain-language behaviours a brain shows
export function behaviours(skill, diet) {
  const out = [];
  if (diet.graze && skill.forage > 0.55) out.push('follows the scent of food');
  if (diet.hunt && skill.hunt > 0.55) out.push('stalks prey');
  if (skill.evade > 0.45) out.push('flees predators');
  if (skill.herd > 0.3) out.push(diet.aquatic ? 'schools' : 'herds');
  if (skill.herd < -0.35) out.push('keeps apart from its own kind');
  return out;
}
