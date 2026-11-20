# StrangeLife

A planet-scale evolution sandbox that runs in the browser, inspired by SimEarth, SimLife and the real science of how life on Earth began and diversified.

You start with a newborn planet: scalding seas under a thick CO₂ sky, a dim young Sun, comets raining down, and no life at all. Make it habitable, or wait for it to cool on its own, until chemistry in a warm, organic-rich shallow sea produces the first cell. Then watch life spread across the globe and branch into every domain: Bacteria, Archaea, protists, algae and plants, fungi, and animals. Oxygen from photosynthesis rusts the oceans and then fills the sky. An ozone layer forms, plants creep onto land, and animals follow, all the way to intelligence.

Every species carries a **genome that builds its body**. Cells, symmetry, segments, legs, shells, bones, wings and brains come from genes, and each species is drawn from its own genome on the globe and in the tree of life. New body plans appear when mutations produce them and survive only if the planet rewards them, so every world grows its own tree of life. Groups can evolve more than once, from different ancestors, or never. Species also inherit **looks**: colours, markings, ornaments and proportions that are passed down and drift, so relatives share a family look and every species is recognisably its own.

**Go in close.** Click a zone, then *Go in close* (or press `Z`, or *Watch it up close* on any animal in the Life list). The zone's animals become individuals, each with a tiny brain: a neural network it inherits, with mutations, from its parents. They smell out food, stalk prey, flee predators, find mates, breed and die, so behaviour evolves while you watch: foraging, hunting, escape, and herds or schools where crowds confuse predators. Follow any creature to see its brain fire. When you go back to the planet, each species keeps what it learned, and it feeds and survives better everywhere.

**[StrangeLife Classic](classic/)**, the simpler original with a fixed ladder of transitions, is still playable from `classic/` (and the `classic` branch).

## Play

It's a static site with no build step (Three.js is vendored in `vendor/`). ES modules need a web server, so from the repo root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The game opens on its **main menu**:

- **Play** shows the scenario selector (only *A young planet* for now) with a planet seed.
- **Continue** picks up the autosave.
- **Load game**, **🦒 Zoo**, **Options** (kept between visits) and **How to play** are there too.

In a game, `Esc` or the ☰ button opens the pause menu: save, load, options, **End run…** or quit to the main menu.

URL options:

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
| `W` | Food web of the zone you inspected (or the one under the cursor) |
| `Z` | Go in close: watch the animals of the zone you inspected (or the one under the cursor) as individuals |
| `H` | Help |
| `Esc` | Clear the selection, or open the pause menu |

The **🌳 Tree of life** button (or `T`) opens a full-screen view. *Major groups* is a spindle diagram: each group's thickness over time is how many species it had. *Species* is the full phylogeny, which you can filter by kingdom or group and zoom in time. Living species are named at the tips.

**Seed life** (`-`) can release any kind of organism, with a preview of the body its genome builds. Each one gets its own look; *🎲 New look* rolls another. *Customise* lets you pick its diet, habitat, body size, climate and rainfall (or water depth), and name it.

**The zoo.** Whenever you end a run (pause menu → *End run…*), you can take up to three living species home to your zoo. It is kept in your browser across runs. In the zoo you can:

- watch each creature move in its own enclosure, the way its body lets it (swimming, walking, flying, swaying or dividing);
- feed it and play with it;
- open its **full species profile**: genome, body plan, how it lives, its place in the food web, what it was partners or parasites with, the planet it came from, and its ancestry as a chain of body-plan changes back to the first cell.

**Saved worlds** (World tab) keeps three save slots and an autosave in your browser, and can export or import a world as a file.

The panel on the right has four tabs:

- **Life** lists living species grouped by kingdom. Click one to light up its range on the globe and see its portrait, body plan, genome and appearance (with how far back its markings and ornaments go in its family).
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

- **Axial tilt and seasons.** The *Axial tilt* slider (World tab) sets how strong the seasons are. Winters are harshest far inland at high latitudes; the sea softens them. Hardy species weather them better: fur or feathers, seeds and spores, and animals that **migrate**. The *Seasons* map view shows it.
- **Winds and ocean currents.** Cold currents run up subtropical west coasts and upwelling brings nutrients to the surface there and along the equator, so those seas are rich (think Peru or Namibia), with coastal deserts beside them. East coasts get warm currents. The *Currents* map view shows them.
- **Rain shadows.** Mountains wring the rain out of the prevailing wind (from the east in the tropics and polar regions, from the west in mid-latitudes), leaving dry land behind them.

### The origin of life (abiogenesis)
- **Making organic molecules.** Hydrothermal **vents**, **lightning** in an oxygen-free sky (the Miller–Urey experiment), and **comets** all supply them.
- **Concentrating them.** Wet–dry cycles in **tidal pools** near coasts concentrate the molecules. Hot water, dry land and oxygen destroy them.
- **The RNA world.** When a warm (5–50 °C) shallow sea stays rich in organics long enough, the RNA-world progress bar fills and **LUCA**, the first cell, appears. Use the Organics map view to see where chemistry is brewing.

### Ecology: populations, not individuals
Each zone holds the biomass of every species living there:
- **Food webs.** Predators choose their prey: hunters take animals about a third of their own size, filter-feeders much smaller ones, and well-defended prey (big, armoured, fast, flying) are both safer and poorer food. Each predator–prey link carries its own flow of food, so a predator that takes most of a common prey's losses is a **keystone species**. When one dies out, its prey can boom: a **trophic cascade**, reported in the chronicle.
- **Parasites.** Protists, fungi, worms and small arthropods can take to living in one host species. Hosts' defences keep parasites a modest share of their biomass, parasites spread only where their hosts live, and they split along with their hosts (cospeciation).
- **Partnerships.** One gene means different partners in different bodies: algae living in coral tissues (corals build reefs and **bleach** when the sea gets too warm), gut microbes that digest plants for grazers, and nitrogen-fixing bacteria in plant roots. Mycorrhizal fungi and pollinators work as before.
- **Arms races.** Plants can evolve toxins: they grow more slowly, but most grazers leave them alone. Specialist insects that beat one plant's defences get food nobody else can eat, so new specialists favour toxic plants, one reason insects are so diverse. Grasses regrow from the base and shrug off much of their grazing.
- **Wildfire.** Once there is about 13% oxygen and plants on land, dry places with plenty of fuel burn now and then. Trees burn; grasses resprout and are good fuel, so grass and fire together can hold back the forest. The *Fire* map view shows where fires burn.
- **Life histories.** Animals can evolve parental care (few young, well looked after: they survive better and hold their own, but recover more slowly), metamorphosis (larvae and adults live differently, so a species competes less with itself), and social living: colonies with queens and workers in insects (ants, bees and termites, which arise now and then from ordinary insects) and herds and packs in vertebrates.
- **Realms.** Zones are grouped by the species they share into biogeographic realms (the simulation's version of Earth's Australian or Neotropical realms, and of Wallace's Line), each named after a characteristic species. The *Realms* map view shows them, and the inspector says which realm a zone is in.
- **The food-web view.** Inspect a zone and press **🕸 Food web** (or `W`) to see who eats whom there, by trophic level, with parasites and partnerships.
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
- **Genomes build bodies** (`genome.js`). Each species has 29 genes (cell adhesion, tissues, photosynthesis, swallowing, absorbing, meat-eating, movement, size, symmetry, segments, limbs, skeleton, plant plumbing, drought-proofing, warm blood, brain, wings, display, colour, body covering, armour, water storage, climbing, parasitism, partnerships, toxins, parental care, metamorphosis, social living), plus its domain and any organelles gained by endosymbiosis. Development turns the genes into a body:
  - **Organisation:** single cells, colonies, simple multicellular, or complex bodies with tissues and organs.
  - **Diet:** from photosynthesis, swallowing or absorbing.
  - **Body plan:** radial or bilateral, segments, limb pairs, shell, soft body or backbone, flight, warm blood, brain.
  - **Ecology follows from the body:** oxygen need, growth, feeding, metabolism (Kleiber scaling), dispersal, climate tolerance, drought, and how hard it is to catch (size, armour, speed and wings protect prey, and predators take the easiest prey first).
- **Groups emerge.** "Fish", "insects" or "conifers" are just the nearest description of what evolved (`classify`), shown with each species' own procedurally drawn portrait (`sprites.js`). A group can evolve several times from different ancestors (**convergent evolution**), or never.
- **Looks are inherited.** Ten look genes (a second colour, light or dark, markings, how bold they are, an ornament and its size, build, snout, reach and tail) have no effect on survival, like neutral DNA. They drift a little at each speciation, and now and then jump, so a family shares its markings and ornaments while each species differs in shade and proportions. What an ornament gene grows depends on the body: a crest on a bird, antlers on a deer, a sail on a fish, horns on a beetle. Showy species (the display gene) grow bigger ornaments, and when mate choice splits a species, the new one gets new colours, markings and ornaments. For plants, fungi and microbes the same genes set the form: crown shape, flower type, cap shape, cell shape.
- **Earth's familiar groups.** About 50 kinds of life can evolve:
  - **Microbes and plankton:** bacteria, archaea, protists, diatoms (glass shells), forams (chalk shells).
  - **Plants:** algae, seaweeds, mosses, ferns, conifers, flowering plants, grasses, cacti, vines and epiphytes, water plants.
  - **Fungi:** molds, mushrooms, lichens.
  - **Invertebrates:** sponges and corals, jellies, starfish, worms, molluscs, squid, crustaceans, insects, spiders, centipedes.
  - **Vertebrates:** fish, amphibians, lizards, snakes, turtles, crocodiles, dinosaurs, pterosaurs, birds, whales.
  - **Mammals:** small insect-eaters, rodents, hoofed mammals, carnivores, primates, bats.

  Body coverings run fur → bare skin → scales → feathers. That separates mammals, amphibians, reptiles and birds, and keeps bats apart from birds. Within a family (mammals, reptiles and birds, land arthropods, seed plants) a lineage keeps its group unless its body clearly changes.
- **Fresh water.** Rain runs downhill across the terrain and gathers into rivers; basins fill into lakes in wet climates and dry salt pans in deserts. Rivers and lakes are a fourth habitat, with their own plants, fish, insects, amphibians and river dolphins. Populations living beside a river now and then found freshwater species, and sea life enters through river mouths. Lakes and rivers are rich for their size because they gather nutrients from their whole catchment, and isolated ones breed their own species. On a mature planet, roughly a tenth of species live in fresh water, as on Earth.
- **Developmental innovations.** Now and then a lineage produces a mutant with a big change in one gene its body plan can easily alter: another segment, a lost shell, legs, a bigger brain (evo-devo). Key innovations, once gained, are entrenched, and a backbone is never lost. Most mutants fail; the few that fit the planet found new kinds of life. Shores are where life rehearses for land: shore populations are selected for drought resistance.
- **Behaviour evolves in individuals** (`brain.js`, `microcosm.js`). Up close, each animal has a 10-input, 6-neuron, 3-output neural network: the smell of food, the nearest danger and prey, nearby kin and hunger steer where it goes and how fast. Brains are inherited with mutations (and mixed between parents in sexual species). Predators single out prey less easily in a crowd, and sexual species must meet to breed, so herding and schooling can evolve. A species keeps a newly evolved brain only if it's an improvement. Its skills then change its planet-wide feeding rate and how easily it's caught, and pass to daughter species.
- **Mergers** are the only scripted transitions, because genes alone can't make them:

| Merger | What it needs |
|---|---|
| Bacteria → Archaea (the deepest split) | — |
| Archaea + bacteria → complex cells (endosymbiosis: mitochondria) | Both in one zone, a trace of O₂ |
| Protists + cyanobacteria → Algae (chloroplasts) | Both in one zone |
| Mushrooms + algae → Lichens (a fungus farming algae) | Land, with algae or cyanobacteria nearby |

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
src/planet.js       geodesic grid, terrain, climate, winds, currents, seasons, rivers and lakes, carbon cycle, oxygen, prebiotic chemistry
src/tectonics.js    plate tectonics: drifting plates, mountain building, rifts, supercontinent cycles
src/genome.js       genes, development (genome → body), naming what evolved, ecology from the body, innovations
src/sprites.js      procedural organism portraits drawn from each species' genome and looks
src/brain.js        tiny evolving neural-network brains, and reading behaviour from them
src/microcosm.js    one zone simulated as individual animals with brains
src/zoneview.js     the up-close view of a zone
src/foodweb.js      the food-web view of a zone
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
src/menu.js         main menu, scenarios, options, pause menu, ending a run
src/zoo.js          the zoo: species snapshots, enclosures, full species profiles
src/main.js         bootstrap, tools, input, game loop
tools/headless.mjs  run the simulation in Node without graphics
tools/sprites.html  a sheet of every kind of organism with several random looks each, for checking the drawings
tools/microcosm.mjs run one zone of individuals headless and report how behaviour evolved
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

Next on the list: checking the planet against Earth's own diversity patterns (the fossil-record curve, the tropics-to-poles gradient, the species–area relationship, body sizes).

## License

MIT. Three.js is © its authors under the MIT license (see `vendor/THREE_LICENSE`).
