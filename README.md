# StrangeLife

A planet-scale evolution sandbox that runs in the browser, inspired by SimEarth, SimLife and the real science of how life on Earth began and diversified.

You start with a newborn planet: scalding seas under a thick CO₂ sky, a dim young Sun, comets raining down, and no life at all. Make it habitable, or wait for it to cool on its own, until chemistry in a warm, organic-rich shallow sea produces the first cell. Then watch life spread across the globe and branch into every domain: Bacteria, Archaea, protists, algae and plants, fungi, and animals. Oxygen from photosynthesis rusts the oceans and then fills the sky. An ozone layer forms, plants creep onto land, and animals follow, all the way to intelligence. Life icons on the globe show what lives where.

## Play

It's a static site with no build step (Three.js is vendored in `vendor/`). ES modules need a web server, so from the repo root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. URL options:

- `?seed=42` picks a specific planet.
- `&start=microbial` or `&start=oxygen` skips ahead (the default `barren` starts before life).

To publish it with GitHub Pages: in the repo settings, go to Pages, choose *Deploy from a branch*, and pick `main` / root.

### Controls

| | |
|---|---|
| Drag | Spin the planet |
| Scroll / pinch | Zoom. Zoomed out you see one life icon per region; zoomed in, up to three per zone |
| `1`–`9`, `0`, `-`, `=` | Tools: inspect, raise land, lower land, volcano, warm, cool, rain, drought, lightning, icy comet, seed life, asteroid |
| Left-drag (with a terraform tool) | Paint. With a terraform tool selected, right-drag spins the globe |
| `Space` | Pause / resume |
| `[` `]` | Slower / faster |
| `H` | Help |

The panel on the right has five tabs:

- **Life** lists living species grouped by kingdom. Click one to light up its range on the globe.
- **Planet** shows the current eon, atmosphere gauges, and *the story of life*: a checklist of major transitions that shows the next goal and what it needs.
- **History** charts species per kingdom, oxygen, CO₂ and temperature, plus a chronicle of events.
- **Tree** is the phylogeny, coloured by kingdom, with eon boundaries.
- **World** holds map views, climate and evolution sliders, display options, and new-world generation.

## The science in the simulation

Everything below emerges from the simulation. Nothing is scripted to happen at a set time.

### The planet
- **Geodesic grid.** The terrain uses 40,962 cells. Life lives in 2,562 zones (each about 450 km across), roughly SimEarth's scale.
- **Faint young Sun.** It starts at 76% of today's brightness and slowly brightens.
- **Carbon–silicate cycle.** Volcanoes add CO₂. Rock weathering removes it, faster when it's warm, wet and plant-covered. This thermostat cools the scalding early planet over a few hundred million years, and land plants cool it further.
- **Ice–albedo feedback.** Ice reflects sunlight, so the planet can tip into a **snowball** state. It escapes when volcanic CO₂ builds up.
- **Water delivery.** Volcanic outgassing and icy comets fill the ocean basins over time.

### The origin of life (abiogenesis)
- **Making organic molecules.** Hydrothermal **vents**, **lightning** in an oxygen-free sky (the Miller–Urey experiment), and **comets** all supply them.
- **Concentrating them.** Wet–dry cycles in **tidal pools** near coasts concentrate the molecules. Hot water, dry land and oxygen destroy them.
- **The RNA world.** When a warm (5–50 °C) shallow sea stays rich in organics long enough, the RNA-world progress bar fills and **LUCA**, the first cell, appears. Use the Organics map view to see where chemistry is brewing.

### Ecology: populations, not individuals
Each zone holds the biomass of every species living there:
- **Producers** (cyanobacteria, algae, plants) grow logistically and compete for light.
- **Consumers** feed from shared pools with a saturating (Holling type II) response: chemotrophs on organic molecules, grazers on producers or microbes, predators on grazers, decomposers on dead matter.
- **Decomposers and mycorrhizal fungi** recycle nutrients, which boosts plant growth.
- **Flowering plants need pollinators.** Without insects or birds, they grow poorly.
- **Allee effect.** Tiny populations struggle to recover.
- **Dispersal.** A share of every population spreads to neighbouring zones with suitable habitat. That's how life visibly spreads across the map.

### Evolution
- **Adaptation.** Each species' preferred temperature drifts toward the climates it actually lives in.
- **Speciation.** Stressed populations at the edge of a range split off as new species with a new temperature niche, diet, habitat or body size. Sexual species split faster. Speciation slows as a niche fills (diversity-dependent diversification), and crowded niches squeeze out their rarest members (competitive exclusion).
- **Major transitions** are rare events that found new lineages, once the planet allows them:

| Transition | What it needs |
|---|---|
| Bacteria → Archaea | — |
| Bacteria → Cyanobacteria (photosynthesis) | Sunlit seas |
| Archaea + bacteria → Protists (endosymbiosis: mitochondria) | Both in one zone, a trace of O₂ |
| Protists + cyanobacteria → Algae (chloroplasts) | Both in one zone |
| Protists → Fungi / Sponges & cnidarians | ~1% / ~3% O₂ |
| Algae → Seaweeds (multicellularity) | ~2% O₂ |
| Seaweeds → Mosses (plants on land) | An ozone shield and a coast |
| Mosses → Ferns → Conifers → Flowering plants | O₂; flowers need insects |
| Sponges → Arthropods (Cambrian explosion) | ~7% O₂ |
| Arthropods → Insects (animals on land) | Land plants, ozone |
| Arthropods → Fish → Amphibians → Reptiles → Mammals / Birds | Rising O₂; tetrapods need land plants and insects |
| Mammals → Marine mammals / Intelligence | A coast / ~14% O₂ and a widespread lineage |

- **Oxygen paces complexity.** Complex cells and bodies need aerobic respiration. Most archaea are strict anaerobes and decline after oxygenation.
- **Great Oxidation Event.** Photosynthesis first rusts the iron dissolved in the oceans (banded iron formations). Only then does oxygen accumulate.
- **The "boring billion."** Volcanic gases keep soaking up oxygen while the planet is young.
- **Wildfires.** Above ~21% oxygen, fires hold it down.
- **Ozone.** It forms once there's oxygen and shields land from ultraviolet light. Before that, dry land is sterile.
- **Mass extinctions.** Asteroids and climate swings cause them, followed by adaptive radiations.

### Deep time
Each tick lasts longer while life is microbial (Hadean, Archean, Proterozoic) and shorter in the Phanerozoic, so the whole story fits in a session. The Planet tab compares your planet's milestones with when they happened on Earth.

## Code layout

```
index.html          page shell and UI markup
style.css           styles
src/rng.js          seeded RNG + 3D Perlin noise
src/planet.js       geodesic grid, terrain, climate, carbon cycle, oxygen, prebiotic chemistry
src/ecosystem.js    zones, species, population ecology, dispersal, speciation, major transitions
src/world.js        planet + ecosystem, abiogenesis, eons, natural events, history, milestones
src/science.js      the story of life: real-science notes for each transition
src/names.js        procedural Latin names, styled by group
src/render.js       Three.js globe, ocean, atmosphere, clouds, life icons, picking, effects
src/ui.js           panels, charts, tree of life, planet story, inspector, discovery cards
src/main.js         bootstrap, tools, input, game loop
tools/headless.mjs  run the simulation in Node without graphics
vendor/             three.js r160 + OrbitControls (MIT)
```

The simulation code doesn't depend on Three.js or the DOM, so you can tune it headless:

```bash
node tools/headless.mjs 7 20000 barren 2000
```

The arguments are the seed, the number of ticks, the scenario, and how often to report.

## Ideas for later

- Plate tectonics and continental drift (and the supercontinent cycle)
- Methane and an Archean organic haze
- Civilization once intelligence appears (SimEarth's tech ages)
- Saving and loading worlds
- A creature/plant designer for seeding your own lineages

## License

MIT. Three.js is © its authors under the MIT license (see `vendor/THREE_LICENSE`).
