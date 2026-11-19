# StrangeLife

A planet-scale evolution sandbox that runs in the browser. It draws on SimEarth, SimLife, and the artificial-life simulations researchers use to study evolution.

You start with a young, procedurally generated planet and a single microscopic species in a warm, shallow sea. Every creature after that descends from it. Spin the globe, zoom down to the coastlines, and watch life spread, split into species, crawl onto land, grow large, and start hunting. Or step in: raise mountains, warm the poles, flood the lowlands, seed new organisms, or drop a meteor.

## Play

It's a static site with no build step and no dependencies to install (Three.js is vendored in `vendor/`). ES modules need a web server, so from the repo root run:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To get a specific planet, add a seed: `http://localhost:8000/?seed=42`.

To publish it with GitHub Pages: in the repo settings, go to Pages, choose *Deploy from a branch*, and pick `main` / root.

### Controls

| | |
|---|---|
| Drag | Spin the planet |
| Scroll / pinch | Zoom |
| `1`–`9` | Tools: inspect, raise, lower, warm, cool, rain, drought, seed life, meteor |
| Left-drag (with a terraform tool) | Paint. With a terraform tool selected, right-drag spins the globe |
| `Space` | Pause / resume |
| `[` `]` | Slower / faster |
| `H` | Help |

The side panel has four tabs:

- **Species** lists living species with their traits. Click one to highlight it on the globe.
- **History** charts population by species, biodiversity, and temperature, plus a chronicle of events.
- **Tree of life** draws the phylogeny.
- **World** holds the climate, sea level, and mutation sliders, the map overlays (biomes, heat, rain, height, plants), and new-world generation.

## How the simulation works

**Planet.** The surface is a geodesic grid of 40,962 cells (a 6× subdivided icosahedron). Terrain comes from domain-warped fractal noise, tuned so about 31% of the surface is land. Each cell has:

- **Temperature.** It falls with latitude and altitude. Oceans moderate it, and continental interiors swing to extremes.
- **Moisture.** It depends on noise, distance to the ocean, a Hadley-cell pattern (wet equator, subtropical deserts, stormy mid-latitudes), and rain shadows.
- **A Whittaker-style biome** with a plant carrying capacity. Plants regrow logistically and get grazed down.

**Creatures.** Each creature has a genome of 8 genes:

| Gene | Effect | Trade-off |
|---|---|---|
| Size | Bigger bites, more energy storage, can eat bigger prey, harder to catch | Metabolism scales with size^0.75; matures later |
| Speed | Covers more ground, catches and escapes | Cost grows with speed² |
| Diet | 0 = plants only, 1 = meat only | Specialists eat their food more efficiently |
| Climate | Preferred temperature | Stress costs energy outside the comfort range |
| Tolerance | Width of the comfort range | Wider tolerance has an upkeep cost |
| Habitat | 0 = land, 1 = water | Living in the "wrong" medium is costly, quadratically, so shoreline amphibians are viable |
| Colour | Neutral marker, drifts slowly | None. It makes lineages visible |
| Brood | Many small young vs. few large ones | r/K strategy |

Creatures move toward cells with food, prey, and a comfortable climate. They pay metabolic costs, graze or hunt, and reproduce asexually when they have enough energy, passing on a mutated copy of their genome. Nothing is scripted: herbivores, amphibians, land animals, predators, and megafauna all emerge from selection on these trade-offs.

**Species.** Each species keeps a reference genome that slowly tracks its population's mean. When an offspring is born too far from that reference (a weighted genetic distance), it founds a new species with a new Latin binomial and a shifted colour. The parent link is recorded, and that's what builds the tree of life.

**Disasters.** A meteor kills everything near the impact, carves a crater, and adds an *impact winter*: global cooling and suppressed plant growth that fade over time. Combine it with the greenhouse slider for mass extinctions.

## Code layout

```
index.html        page shell and UI markup
style.css         styles
src/rng.js        seeded RNG + 3D Perlin noise
src/planet.js     geodesic grid, terrain, climate, biomes, plants (no rendering)
src/life.js       genomes, behaviour, energy, reproduction, speciation (no rendering)
src/names.js      procedural species names
src/world.js      planet + life + history, milestones
src/render.js     Three.js globe, ocean, atmosphere, clouds, creatures, picking, effects
src/ui.js         panels, charts, tree of life, inspector
src/main.js       bootstrap, tools, input, game loop
tools/headless.mjs  run the simulation in Node without graphics
vendor/           three.js r160 + OrbitControls (MIT)
```

The simulation code doesn't depend on Three.js or the DOM, so you can tune it headless:

```bash
node tools/headless.mjs 7 5000
```

The arguments are the seed and the number of ticks.

## Ideas for later

- Sexual reproduction and geographic speciation driven by isolation
- Plate tectonics and continental drift
- An oxygen/CO₂ atmosphere loop coupled to plant life (Gaia feedback)
- Saving and loading worlds
- A creature editor for designing your own seed organisms

## License

MIT. Three.js is © its authors under the MIT license (see `vendor/THREE_LICENSE`).
