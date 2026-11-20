# Biodiversity drivers

StrangeLife models the main sources of Earth's biodiversity. Each entry says what's real, what the game does, and where it lives in the code.

## 1. Geographic isolation and plate tectonics
- **Real:** most species form allopatrically: a population is split by a barrier and the halves diverge. Continental drift keeps making and breaking barriers. Supercontinents (Rodinia, Pangaea) assemble and break up on ~400–600-million-year cycles.
- **Game:**
  - `tectonics.js`: ~10 rigid plates rotate about Euler poles at 1–8 cm/yr. Collisions raise mountains and volcanic arcs; rifts open new ocean floor with vents. Colliding plates reorganise, arcs add continental crust, and old sea floor subsides.
  - `Ecosystem.checkIsolation()`: when a fragment of a species' range stays cut off for ~120 ticks, it becomes a new species adapted to its patch.

## 2. More niche dimensions
- **Real:** species partition the environment along many axes, not just temperature.
- **Game:** each species has a preferred temperature, rainfall on land or depth at sea, and altitude on land, each with its own tolerance (`nicheTol`). Suitability is the product of three bell curves (`refreshSuit`).

## 3. Coevolution and ecological interactions
- **Real:** much of Earth's diversity comes from species adapting to each other: specialist herbivores (most insects eat one plant family), cospeciation (figs and fig wasps), pollination, and ecosystem engineers that create habitat.
- **Game:**
  - Land insects and arthropods can specialise on one host plant (`chooseHost`, `sp.host`). They feed only on it, but efficiently.
  - When a host plant speciates, each specialist may split with it (`cospeciate`). Since specialists on different hosts occupy different niches, insect diversity tracks plant diversity.
  - Plants with their own specialists get dedicated pollinators (+15% growth).
  - Coral reefs (in sunlit shallows) and tall forests raise a zone's structure, which weakens crowding so more species coexist (`zStruct`).
  - Disease and parasites act as density-dependent crowding, which sexual species resist better (the Red Queen).

## 4. Climate cycles and refugia
- **Real:** Milankovitch orbital cycles drive ice ages. Ranges shrink into refuges, split, and expand again: a "species pump".
- **Game:** `Planet.updateOrbital()` adds a sum of three cycles to the global temperature, stronger on a cool planet. The cycles are stretched in time so ice ages are visible in play. `checkIsolation()` turns lasting refuges into new species. The Planet tab shows the current phase, and it can be toggled in World settings.

## 5. Ecological opportunity after extinctions
- **Real:** after mass extinctions, survivors radiate rapidly into emptied niches (mammals after the dinosaurs).
- **Game:**
  - Diversity-dependence works per niche bin (group, habitat, diet, temperature band, rainfall or depth, host): `nicheKey()`. A crowded bin splits slowly and sheds its rarest species (competitive exclusion).
  - After a drop below the recent peak species count, `opportunity` boosts speciation and major transitions.
  - Bursts of speciation in one group are reported as adaptive radiations.

## 6. Islands, endemism and sexual selection
- **Real:** islands produce endemic species and follow the island rule (dwarf elephants, giant lizards). Mate choice can split populations quickly (birds of paradise, cichlids).
- **Game:**
  - Hotspots build island chains as plates move over them (`buildHotspotIslands`).
  - Island fragments of land animals shift size: small ones grow, large ones shrink.
  - The *Endemics* map view lights up zones holding species found in ≤15 zones.
  - Sexual animals (birds most, then fish and insects) can speciate by mate choice with no niche change (`speciate(..., 'sexual')`).

## 7. Genomes, emergent body plans and convergence
- **Real:** bodies are built by developmental genes (Hox genes lay out segments and limbs). Some changes are easy (another segment, a lost shell), others hard (a whole new body plan), so body plans stay stable for hundreds of millions of years. The same solutions evolve repeatedly in unrelated lineages (eyes, flight, crab-like bodies).
- **Game:**
  - `genome.js`: 19 genes per species, `develop()` (genome → body), `classify()` (body → nearest familiar group), `ecology()` (body → growth, feeding, oxygen need, metabolism, defences, drought).
  - `evolvable()`: which genes a body plan can change with a big jump. Key innovations are entrenched once gained, and genes the body doesn't use yet stay in their ground state.
  - `Ecosystem.evolve()`: developmental innovations rolled per group; `establish()` records new groups and convergent origins once a new kind of life takes hold.
  - Prey are weighted by vulnerability (size, armour, speed, wings), so predators take the easiest prey first.
  - Shore populations are selected for drought resistance (`LAND_TARGET`), so land is colonised from the coasts.
  - `sprites.js` draws every species from its genome: on the globe, in the Life panel, in the tree of life and on discovery cards.

## 8. Behaviour evolving in individuals
- **Real:** behaviour is heritable and evolves. Herding and schooling protect prey because predators struggle to single one out of a crowd (the confusion and dilution effects). Foraging and hunting strategies are honed by selection.
- **Game:**
  - `brain.js`: each animal's brain is a small neural network (senses → 6 neurons → steering and speed). `probe()` reads a brain's skills (foraging, hunting, escaping, herding) by showing it stimuli from every direction.
  - `microcosm.js`: one zone as individuals that eat, hunt, flee, find mates, breed with inherited and mutated brains, and die. Crowds lower each animal's chance of being caught, and sexual species need a partner nearby.
  - Leaving the zone (`writeBack`): each species keeps the brain of its most successful individual if its skills improved. `Ecosystem.setParams` turns the skills into a better feeding rate and lower vulnerability across the planet, and daughter species inherit the brain.

## 9. Earth's familiar groups
- **Real:** much of Earth's visible diversity comes from a few body features: coverings (fur, feathers, scales), limb loss (snakes), armour (turtles), flight in three vertebrate groups (pterosaurs, birds, bats), and plant forms adapted to drought (cacti), grazing and fire (grasses), and life on other plants (vines, epiphytes).
- **Game:** `genome.js` has genes for covering, armour, water storage and climbing, and `classify()` names about 50 groups. Order-level groups within a family use `pickOrder()` with a margin, so lineages keep their group unless their bodies clearly change. Grasses regrow fast, succulents do better in dry zones, climbers do better in forests, and lichens grow on bare rock (`Ecosystem.step`). Lichens arise by a fungus–alga merger.

## 10. Fresh water
- **Real:** rivers and lakes cover about 1% of Earth's surface but hold about 10% of its species. Each lake and river system is an island, so freshwater life splits into many species (cichlids, crayfish, mayflies).
- **Game:** `Planet.computeRivers()` routes rain downhill with a priority flood from the coasts inland, so basins fill until they spill. Enough flow makes a river; a filled basin in a wet climate makes a lake. Rivers and lakes are a fourth habitat (`habitat === 3`) with their own plant capacity (`zKf`, enriched by the catchment) and their own competition for light, sharing the land's food web. `evolve()` lets populations beside rivers found freshwater species, and competition judges freshwater species' rarity against their small habitat (`abundance()`). Life moves between fresh water, shores and land, and the up-close view draws a river through the zone.

## 11. Food webs, parasites and partners
- **Real:** species eat specific others, mostly by size. Keystone predators hold common prey in check; removing them sets off trophic cascades (wolves and elk in Yellowstone, sea otters and kelp). Perhaps half of all species are parasites, tied to their hosts. Partnerships run deep: corals and their algae, grazers and gut microbes, legumes and nitrogen-fixing bacteria.
- **Game:**
  - `Ecosystem.buildLinks()`: each predator's preference for each prey by body-size ratio (hunters about 1/3 their size, filter-feeders much smaller). `step()` feeds predators prey by prey, weighted by preference, vulnerability and shared habitat, and records the flows.
  - `analyseWeb()`: every 50 ticks, a predator causing over half the losses of a common prey is a keystone species; when a keystone dies out, a prey that then booms more than 1.5× is reported as a trophic cascade.
  - Parasites (`trophic 6`, gene `parasitism`): they feed on one host, are held to a modest share of it by the host's defences, live in the host's habitat and climate, spread only where the host lives, jump hosts now and then, and cospeciate with their hosts. New parasite lineages arise from protists, fungi, worms and small arthropods. They are kept to about 5% of species by the simulation's limit on species (Earth's share is far higher).
  - Partnerships (gene `symbiosis`): coral algae (sugar from light in sunlit shallows; mortality and lost partners above their heat tolerance, i.e. bleaching), gut microbes (better digestion of plants), root bacteria (higher plant capacity). Reefs are now built only by corals with algae.
  - `webOf(z)` and `foodweb.js`: the food-web view of a zone.

## 12. Arms races, fire and life histories
- **Real:** plants defend themselves chemically, and insects that overcome one plant's defences specialise on it; this arms race is a big part of why there are so many beetles. Grasses tolerate grazing and fire, and grass–fire feedbacks keep savannas open. Animals differ in life history: many young or few cared-for young, larvae that live differently from adults, and colonies of social insects that dominate many ecosystems.
- **Game:**
  - Gene `toxins` (plants): growth cost; palatability `tPal` weights the food generalist grazers can find and the grazing losses a plant takes. Specialists (`tHost`) eat their host fully and their feeding is taken from that plant alone; new specialists favour toxic hosts (`chooseHost`).
  - Grasses lose about half as much to grazing (`tGraze`).
  - `Ecosystem.wildfires()`: every 10 ticks, dry land zones burn with a chance set by oxygen (from ~13%), dryness and fuel (grass counts double). Each species keeps a share by `tFire` (grasses and animals mostly survive, trees mostly burn); ash returns nutrients. `zFire` drives the Fire map view.
  - Genes `care`, `metamorphosis`, `sociality` (animals) change conversion efficiency, mortality, self-limitation, dispersal, feeding and defences in `ecology()`. Social insects are their own group, arise now and then from land insects, and speciate more slowly (few breeders).

## 13. Earth's geographic patterns
- **Real:** tilt makes seasons, and winters are harshest inside big continents at high latitudes, so species there hibernate, insulate or migrate. Cold currents and upwelling off subtropical west coasts make some of the richest seas on Earth beside coastal deserts. Mountains cast rain shadows. And because continents have been apart for a long time, each has its own fauna: Wallace's biogeographic realms.
- **Game:**
  - `Planet.computeWindsAndCurrents()` (run with `computeBase`): walks each coast east and west to find its ocean side. Subtropical west coasts get cold currents and upwelling (`upwell`, `current`), sea temperatures fall and the coast dries; east coasts are warmed; the equator upwells a little. Sea carrying capacity rises with upwelling.
  - Rain shadows: each land cell looks upwind (easterlies below 30° and above 62°, westerlies between) for mountains and loses rainfall behind them.
  - `season[i]` from tilt, latitude and distance from the sea. `Ecosystem.updateEnvironment` turns it into `zSeason`, which adds winter mortality scaled by `1 − tHardy` (hardiness from kingdom, covering, endothermy, and the `migration` gene).
  - `Ecosystem.computeRealms()`: k-means on the lists of complex species in each zone, separately for land and sea, recomputed when the Realms view is shown; each realm is named after its most characteristic species.
  - Map views Currents, Seasons, Realms (and Fire) with legends.

## Also built
- A main menu with a scenario selector, options, load and continue, a pause menu (`menu.js`), and ending a run to take up to three species to the **zoo** (`zoo.js`): enclosures you can feed and play with, and full species profiles with ancestry
- Methane from archaea, an orange haze, and the methane crash at the Great Oxidation Event (`Planet.stepAtmosphere`)
- Civilization stages after intelligence (`civ.js`)
- Saving and loading worlds (`save.js`, `storage.js`) and the organism designer (Seed life → Customise)

## Ideas
- Oceans crossable by an industrial civilization (ships), and cities as map icons
- Player policies for a civilization (conservation, clean energy)
- A sandbox mode with an editable atmosphere
