# StrangeLife

A planet-scale evolution sandbox that runs in the browser, inspired by SimEarth, SimLife and the real science of how life on Earth began and diversified.

You start with a newborn planet: scalding seas under a thick CO₂ sky, a dim young Sun, comets raining down, and no life at all. Make it habitable, or wait for it to cool on its own, until chemistry in a warm, organic-rich shallow sea produces the first cell. Then watch life spread across the globe and branch into every domain: Bacteria, Archaea, protists, algae and plants, fungi, and animals. Oxygen from photosynthesis rusts the oceans and then fills the sky. An ozone layer forms, plants creep onto land, and animals follow, all the way to intelligence.

Every species carries a **genome that builds its body**. Cells, symmetry, segments, legs, shells, bones, wings and brains come from genes, and each species is drawn from its own genome on the globe and in the tree of life. New body plans appear when mutations produce them and survive only if the planet rewards them, so every world grows its own tree of life. Groups can evolve more than once, from different ancestors, or never.

**[StrangeLife Classic](classic/)**, the simpler original with a fixed ladder of transitions, is still playable from `classic/` (and the `classic` branch).

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
| `T` | Tree of life |
| `H` | Help |

The **🌳 Tree of life** button (or `T`) opens a full-screen view. *Major groups* is a spindle diagram: each group's thickness over time is how many species it had. *Species* is the full phylogeny, which you can filter by kingdom or group and zoom in time. Living species are named at the tips.

**Seed life** (`-`) can release any kind of organism, with a preview of the body its genome builds. *Customise* lets you pick its diet, habitat, body size, climate and rainfall (or water depth), and name it.

**Saved worlds** (World tab) keeps three save slots and an autosave in your browser, and can export or import a world as a file.

The panel on the right has four tabs:

- **Life** lists living species grouped by kingdom. Click one to light up its range on the globe and see its portrait, body plan and genome.
- **Planet** shows the current eon, atmosphere gauges, and *the story of life*: a checklist of major transitions that shows the next goal and what it needs.
- **History** charts species per kingdom, oxygen, CO₂ and temperature, plus a chronicle of events.
- **World** holds map views, climate and evolution sliders, display options, and new-world generation.

## The science in the simulation

Everything below emerges from the simulation. Nothing is scripted to happen at a set time.

### The planet
- **Geodesic grid.** The terrain uses 40,962 cells. Life lives in 2,562 zones (each about 450 km across), roughly SimEarth's scale.
- **Faint young Sun.** It starts at 76% of today's brightness and slowly brightens.
- **Carbon–silicate cycle.** Volcanoes add CO₂. Rock weathering removes it, faster when it's warm, wet and plant-covered. This thermostat cools the scalding early planet over a few hundred million years, and land plants cool it further.
- **Methane.** Archaea (methanogens) fill the oxygen-free sky with methane, warming the planet under the dim young Sun, and with enough of it an orange haze forms. When oxygen arrives, methane collapses and the planet can plunge into a long ice age, as Earth did in the Huronian glaciation.
- **Ice–albedo feedback.** Ice reflects sunlight, so the planet can tip into a **snowball** state. It escapes when volcanic CO₂ builds up.
- **Water delivery.** Volcanic outgassing and icy comets fill the ocean basins over time.
- **Plate tectonics.** About ten plates drift at 1–8 cm/yr:
  - Collisions raise mountain ranges and volcanic arcs.
  - Rifts open new ocean floor, with hydrothermal vents along the ridges.
  - Colliding plates swing onto new courses, arcs grow new continental crust, mountains erode, and old sea floor sinks.
  - Supercontinents assemble and break apart over hundreds of millions of years.
  - The *Plates* map view shows the plates and volcanic belts.

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
- **Niches.** Each species has a preferred temperature, rainfall on land or water depth at sea, and altitude on land, each with a tolerance. Desert specialists, rainforest plants, alpine life and deep-sea fish all emerge.
- **Adaptation.** Each species' niche drifts toward the conditions it actually lives in.
- **Ice-age cycles.** Orbital (Milankovitch) cycles add a rhythm of glacials and interglacials, strongest on a cool planet. Ranges shrink into refuges and split, a "species pump".
- **Coevolution.** Insects can specialise on one host plant; when the plant splits, its specialists often split too (cospeciation), so insect diversity tracks plant diversity. Plants with their own specialists get dedicated pollinators.
- **Ecosystem engineers.** Coral reefs and tall forests add 3D habitat that lets more species coexist in a zone.
- **Ecological opportunity.** Speciation slows as a niche fills (species in the same niche bin) and surges after mass extinctions, producing adaptive radiations.
- **Islands.** Hotspot volcanoes build island chains as plates slide over them. Island populations follow the island rule (dwarf elephants, giant lizards). The *Endemics* map view shows species found in few places.
- **Sexual selection.** In birds, fish and other showy animals, mate choice alone can split a population into new species.
- **Geographic isolation (allopatric speciation).** When part of a species' range is cut off by an opening sea, a rising mountain range or a band of hostile climate, and stays cut off, it becomes a new species adapted to its own patch. Drifting continents keep making new barriers.
- **Speciation at range edges.** Stressed populations at the edge of a range also split off as new species with a new temperature niche, diet, habitat or body size. Sexual species split faster. Speciation slows as a niche fills (diversity-dependent diversification), and crowded niches squeeze out their rarest members (competitive exclusion).
- **Genomes build bodies** (`genome.js`). Each species has 19 genes (cell adhesion, tissues, photosynthesis, swallowing, absorbing, meat-eating, movement, size, symmetry, segments, limbs, skeleton, plant plumbing, drought-proofing, warm blood, brain, wings, display, colour), plus its domain and any organelles gained by endosymbiosis. Development turns the genes into a body:
  - **Organisation:** single cells, colonies, simple multicellular, or complex bodies with tissues and organs.
  - **Diet:** from photosynthesis, swallowing or absorbing.
  - **Body plan:** radial or bilateral, segments, limb pairs, shell, soft body or backbone, flight, warm blood, brain.
  - **Ecology follows from the body:** oxygen need, growth, feeding, metabolism (Kleiber scaling), dispersal, climate tolerance, drought, and how hard it is to catch (size, armour, speed and wings protect prey, and predators take the easiest prey first).
- **Groups emerge.** "Fish", "insects" or "conifers" are just the nearest description of what evolved (`classify`), shown with each species' own procedurally drawn portrait (`sprites.js`). A group can evolve several times from different ancestors (**convergent evolution**), or never.
- **Developmental innovations.** Now and then a lineage produces a mutant with a big change in one gene its body plan can easily alter: another segment, a lost shell, legs, a bigger brain (evo-devo). Key innovations, once gained, are entrenched, and a backbone is never lost. Most mutants fail; the few that fit the planet found new kinds of life. Shores are where life rehearses for land: shore populations are selected for drought resistance.
- **Mergers** are the only scripted transitions, because genes alone can't make them:

| Merger | What it needs |
|---|---|
| Bacteria → Archaea (the deepest split) | — |
| Archaea + bacteria → complex cells (endosymbiosis: mitochondria) | Both in one zone, a trace of O₂ |
| Protists + cyanobacteria → Algae (chloroplasts) | Both in one zone |

Everything else (photosynthesis, multicellularity, animals, land plants, forests, seeds, flowers, shells, backbones, legs on land, warm blood, flight, intelligence) evolves from genes when selection favours it, and the story checklist ticks off each one when it first takes hold.

- **Oxygen paces complexity.** Complex cells and bodies need aerobic respiration. Most archaea are strict anaerobes and decline after oxygenation.
- **Great Oxidation Event.** Photosynthesis first rusts the iron dissolved in the oceans (banded iron formations). Only then does oxygen accumulate.
- **The "boring billion."** Volcanic gases keep soaking up oxygen while the planet is young.
- **Wildfires.** Above ~21% oxygen, fires hold it down.
- **Ozone.** It forms once there's oxygen and shields land from ultraviolet light. Before that, dry land is sterile.
- **Mass extinctions.** Asteroids and climate swings cause them, followed by adaptive radiations.

### Civilization
When intelligence evolves, its species founds a civilization that advances through six stages: Stone Age, Farming, Metal Ages, Industrial, Information Age and Spacefaring.
- **Time:** it slows to a human pace during the human stages.
- **Footprint:** hunting and land clearing push back large animals and forests where people live. Industry burns fossil fuel, raising CO₂ and warming the climate, until cleaner energy takes over.
- **Endings:** if the species dies out, its civilization falls. If it reaches space, deep time resumes and the planet keeps evolving.

### Deep time
Each tick lasts longer while life is microbial (Hadean, Archean, Proterozoic) and shorter in the Phanerozoic, so the whole story fits in a session. The Planet tab compares your planet's milestones with when they happened on Earth.

## Code layout

```
index.html          page shell and UI markup
style.css           styles
src/rng.js          seeded RNG + 3D Perlin noise
src/planet.js       geodesic grid, terrain, climate, carbon cycle, oxygen, prebiotic chemistry
src/tectonics.js    plate tectonics: drifting plates, mountain building, rifts, supercontinent cycles
src/genome.js       genes, development (genome → body), naming what evolved, ecology from the body, innovations
src/sprites.js      procedural organism portraits drawn from each species' genome
src/ecosystem.js    zones, species, niches, population ecology, dispersal, speciation, mergers
src/world.js        planet + ecosystem, abiogenesis, eons, natural events, history, milestones
src/science.js      the story of life: real-science notes for each transition
src/names.js        procedural Latin names, styled by group
src/render.js       Three.js globe, ocean, atmosphere, clouds, life icons, picking, effects
src/ui.js           panels, charts, planet story, inspector, discovery cards
src/tree.js         full-screen tree of life (group spindles + species phylogeny)
src/civ.js          civilization stages and their effects on the planet
src/save.js         serialize / restore whole worlds (compressed)
src/storage.js      save slots in IndexedDB, autosave, file export / import
src/main.js         bootstrap, tools, input, game loop
tools/headless.mjs  run the simulation in Node without graphics
tools/sprites.html  a sheet of every kind of organism, for checking the drawings
classic/            StrangeLife Classic, the original version with a fixed ladder of transitions
vendor/             three.js r160 + OrbitControls (MIT)
```

The simulation code doesn't depend on Three.js or the DOM, so you can tune it headless:

```bash
node tools/headless.mjs 7 20000 barren 2000
```

The arguments are the seed, the number of ticks, the scenario, and how often to report.

## Ideas for later

See [ROADMAP.md](ROADMAP.md) for how each biodiversity driver is modelled, and [IDEAS.md](IDEAS.md) for what's next, including the plan to go deeper than SimEarth.

Next on the list: zooming into one zone to watch individual creatures with evolved behaviour, and explicit food webs built on the genome traits.

## License

MIT. Three.js is © its authors under the MIT license (see `vendor/THREE_LICENSE`).
