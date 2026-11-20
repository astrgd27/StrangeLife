# Ideas

Where StrangeLife could go next. ⭐ marks the ones to do first. For how the current simulation works, see [ROADMAP.md](ROADMAP.md).

**Current focus: Earth's diversity.** First make the planet reproduce the variety of life we actually see on Earth (Part 3). Other worlds and alien biochemistries wait until then (see *Later*).

## Part 1: game ideas

### Civilization
- ⭐ **Ships and cities.** An industrial civilization can cross oceans and settle other continents, and city icons spread across the map.
- ⭐ **Player policies.** At each stage, choose things like conservation, clean energy or expansion. The choices shape the planet's fate, as in SimEarth's civilization phase.
- **Collapse risks.** Runaway warming, pandemics, nuclear winter, depleted resources.
- **Several intelligent species.** More than one at once, each with its own civilization, competing or cooperating.

### Gameplay and goals
- ⭐ **Scenarios with goals.** "Get life onto land before 3 billion years", "Survive the Snowball", "Rescue a dying planet", terraform Mars or Venus. Each has win and lose conditions.
- **Achievements.** Firsts and rare events ("an island giant evolved", "a supercontinent formed twice").
- **Species of the moment.** A spotlight on the biggest, oldest or most widespread species.
- **Rewind.** Scrub back through autosaves like a timeline, then branch history in a new direction.

### Science and simulation
- **Ocean currents and winds.** They carry heat and nutrients: nutrient-rich coastal waters become hotspots of ocean life, and rain shadows form behind mountains.
- **Seasons and axial tilt.** A tilt slider: harsher seasons favour hibernation and migration.
- **Day length and tides.** Rich shorelines that make it easier for life to move onto land.
- **Nitrogen cycle.** Nitrogen-fixing microbes limiting how much plants can grow.
- **Volcanic mass extinctions.** Huge eruptions (the Siberian Traps, 252 million years ago) as a natural event and a tool.
- **Disease outbreaks.** Epidemics that spread through dense populations.
- **Behaviour.** Sociality, migration and parental care evolving as traits.

### Presentation
- **Time-lapse recording.** Watch continents drift and life spread, saved as a video or animated image.
- **Zoomed-in "postcard" view** of a single zone.
- **Sound.** Ambient audio for each eon, and a cue for discoveries.
- **Encyclopedia.** A page for every group of life.

### Quality and reach
- **Speed.** A background worker thread for the simulation, so it doesn't slow the graphics.
- **Better phone controls.**
- **GitHub Pages**, so anyone can play from a public link.

## Part 2: deeper than SimEarth

SimEarth (1990) gave life a fixed menu: about 15 predefined groups, each moving up a set ladder. StrangeLife already goes further, with real species, phylogeny, niches, isolation, coevolution and Earth-system feedbacks. But its groups (fish, reptiles…) and the transitions between them are still a hand-written table. The next leap is for life to **invent itself**: forms, abilities and transitions emerge from genes and selection rather than a script. On other worlds, that means life that is genuinely *strange*, not a replay of Earth.

### A. A real genome that builds the body ✅ built
- **Genomes, not labels.** Every species carries a compact genome: trait genes (size, metabolism, temperature range…) plus a small developmental program. The program describes body symmetry, number of segments, limbs, skeleton, sense organs, and surface (shell, scales, fur, leaves).
- **Procedural organisms.** Each species is drawn from its own genome, so you watch body forms actually change down the tree of life: segments fuse, limbs appear, shells are lost. This is *evolved*, not designed as in Spore.
- **Groups emerge.** Instead of fixed groups, labels are worked out from traits ("a segmented, armoured, land-walking grazer"). Life on another planet won't have "fish"; it will have whatever evolves.
- **Evo-devo constraints.** Developmental genes are reused, so some changes are easy (another segment) and some hard (a new body plan). This produces homology, vestigial organs and deep body-plan stability, as on Earth.

### B. Major transitions that emerge ✅ built
- Multicellularity appears when genes for cell adhesion and division of labour evolve, and pays off only when the environment rewards size.
- Endosymbiosis is an actual merger of two species' genomes and abilities.
- Photosynthesis, oxygen tolerance, flight, warm-bloodedness and intelligence become abilities built from gene combinations, with real costs and benefits. They can evolve more than once (convergent evolution) or never.

**What was built (A + B):** 19 genes per species develop into a body (cells, symmetry, segments, limbs, shell/soft/bone, wings, warm blood, brain, plant plumbing, flowers). Ecology, defences and oxygen needs come from the body. Groups are worked out from the body and can evolve several times (convergent evolution). Big developmental jumps are limited to what each body plan can easily change, and key innovations are entrenched. Only the three cell mergers (the archaeal split, mitochondria, chloroplasts) are scripted. Every species is drawn from its genome. Still to do from A: homology and vestigial organs, and surfaces (scales, fur, leaves) as genes.

### C. True population genetics
- **Genetic variation inside each species**, not just an average, so selection works on real variation and drift dominates in small populations.
- **Hybridisation and gene flow** between related species, ring species, and **horizontal gene transfer** in microbes (how bacteria share antibiotic resistance).
- **Molecular clocks.** The game can reconstruct the tree of life from genomes alone, the way biologists do, and compare it with the true history. That shows where real methods get fooled.

### D. Zoom from planet to individual ✅ built (first version)
- **Multi-scale simulation.** At planet scale, life stays as populations. Zoom into one zone and the game switches to **individual creatures** with tiny evolving brains (neural networks) that forage, flee, court and cooperate.
- Their behaviour is real evolution in miniature (like the Primer and Bibites simulations), and the fitness measured there feeds back into the planet-scale model.
- This is where behaviour evolves: herding, warning colours and mimicry, camouflage that matches the local ground, mating displays, parental care.

**What was built (D):** *Go in close* turns a zone's animals into individuals with inherited, mutating neural-network brains. Foraging, hunting, escape and herding or schooling evolve under real selection (crowds confuse predators; sexual species need to meet), and improvements carry back to the species planet-wide. Still to do: warning colours and mimicry, camouflage, mating displays, parental care, and behaviour evolving in the background for zones you aren't watching.

### E. Explicit food webs and ecosystem function
- **Feeding links instead of food pools.** Each species eats specific others, decided by size, defences and habitat, so you can watch keystone species, trophic cascades (wolves → deer → forests) and invasive species when continents collide.
- **Nutrient cycles** (nitrogen, phosphorus), the ocean's biological pump, and life regulating its own planet (Daisyworld-style Gaia feedbacks).

### G. The planet as a laboratory
- **Replaying the tape of life.** Rerun the same planet with different luck and compare what repeats, answering Stephen Jay Gould's question with data.
- **Convergence detector.** Flags when unrelated lineages evolve the same solution (eyes, flight, crab-like bodies).
- **Real biodiversity metrics**: diversity indices, phylogenetic diversity, extinction rates per million years, and a curve of diversity through time like the one palaeontologists drew for Earth's fossil record.
- **Export data** for students and researchers.

### Suggested path
1. ✅ **A + B: genome-built bodies and emergent groups.** The biggest single step past SimEarth, and it makes every planet's tree of life unique and visible.
2. ✅ **D: zoom to individuals in one zone.** Where behaviour and the "wow" moments live.
3. **E: explicit food webs.** Deeper ecology, built on the genome traits from step 1.
4. **G: laboratory tools.** Cheap to add once 1–3 exist, and they turn the game into real science.
5. **C** layered in as the systems mature; F (strange biochemistries) waits for *Later*.

## Part 3: Earth's diversity (current focus)

Ordered by how much Earth-like variety each adds for the effort.

1. ✅ **Earth's familiar groups.** (Built.) Give the genome what Earth's groups need to be told apart:
   - **Coverings:** a gene for skin, scales, feathers or fur. Then bats aren't birds, and turtles, dinosaurs and pterosaurs become possible.
   - **Animal body plans:** snakes (lost limbs), starfish (radial again), spiders, centipedes, and orders within mammals and reptiles (rodents, hoofed animals, carnivores, primates, crocodiles).
   - **Plant forms:** grasses, cacti and succulents, vines and epiphytes, water plants.
   - **Fungi and plankton:** lichens; diatoms and forams.
2. ✅ **Fresh water.** (Built.) Rivers and lakes from rain draining over the terrain. On Earth, fresh water holds about 10% of species in about 1% of the area: lake fish radiations like cichlids, insect larvae, amphibians.
3. ✅ **Food webs, parasites and partners.** (Built; parasites are capped at about 5% of species by the simulation's species limit.)
   - **Food webs:** each species eats specific others, by size and defences, giving keystone species and trophic cascades.
   - **Parasites:** perhaps half of all species, each often tied to one host.
   - **Partnerships:** coral and algae, gut microbes, cleaner fish.
4. ✅ **Arms races and life histories.** (Built.)
   - **Plant defences:** plant toxins versus specialist herbivores (why there are so many beetles), and grasses evolving alongside grazers.
   - **Fire:** shaping savannas.
   - **Life histories:** many small offspring or few big ones, parental care, metamorphosis (larva and adult living different lives), social insects.
5. **Earth's geographic patterns.**
   - **Seasons and axial tilt:** migration and hibernation.
   - **Ocean currents and upwelling:** rich coasts and coral hotspots.
   - **Rain shadows:** behind mountain ranges.
   - **A "realms" map view:** zones grouped by shared species, showing continents with their own faunas (marsupials in Australia, Wallace's Line).
6. **Checking it against Earth.** Diversity through time (the fossil-record curve), the tropics-to-poles gradient, the species–area relationship, body-size distributions.
7. **Realistic species numbers.** Estimate how many species each simulated lineage holds (from range, habitat variety and body size) for Earth-scale totals, and raise the lineage limit with a faster engine on a background thread.
8. **More behaviour up close.** Mating displays, warning colours and mimicry, camouflage, and behaviour evolving in zones you aren't watching.

## Later: other worlds and alien life

Parked until Earth's diversity is in place.

### Other worlds
- **Different planets.** Size, gravity, star type (a dimmer red dwarf, a hotter star), ocean coverage, or a planet tidally locked to its star.
- **Moons and impacts.** A big moon that steadies the planet's tilt; an impact-history mode.
- **Life from space.** Life arriving by meteorite (panspermia) as an alternative origin.

### Strange biochemistries
- **Alternative chemistry per planet.** Different photosynthetic pigments (a purple or black-plant world), sulfur- or iron-based metabolisms, life in ammonia or methane seas on cold worlds, life under ice shells (Europa).
- The origin-of-life phase picks the chemistry from the planet's conditions, and everything downstream follows from it.

