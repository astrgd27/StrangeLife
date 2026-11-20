# Roadmap: what makes Earth so diverse

StrangeLife already models the main sources of Earth's biodiversity covered below. The rest are planned in this order. Each entry says what's real, what the game does, and where it goes in the code.

## Done

### 1. Geographic isolation and plate tectonics
- **Real:** most species form allopatrically: a population is split by a barrier and the halves diverge. Continental drift keeps making and breaking barriers. Supercontinents (Rodinia, Pangaea) assemble and break up on ~400–600-million-year cycles.
- **Game:**
  - `tectonics.js`: ~10 rigid plates rotate about Euler poles at 1–8 cm/yr. Collisions raise mountains and volcanic arcs; rifts open new ocean floor with vents. Colliding plates reorganise, arcs add new continental crust, and old sea floor subsides.
  - `Ecosystem.checkIsolation()`: when a fragment of a species' range stays cut off for ~120 ticks, it becomes a new species adapted to its patch.
- **Watch for:** supercontinent and breakup events in the chronicle; the *Plates* map view.

### 2. More niche dimensions
- **Real:** species partition the environment along many axes, not just temperature.
- **Game:** each species has a preferred temperature, rainfall on land or depth at sea, and altitude on land, each with its own tolerance (`nicheTol`). Suitability is the product of three bell curves, cached per zone (`refreshSuit`). Speciation and adaptation move all three.

## Next

### 3. Coevolution and ecological interactions
- **Real:** a large share of Earth's diversity is species adapting to *each other*:
  - Specialist herbivores (most insects eat one plant family)
  - Host–parasite arms races
  - Mutualisms
  - Ecosystem engineers (reefs, forests) that create habitat for others
- **Plan:**
  - Give consumers an optional *host lineage*: a specialist eats one plant or prey clade efficiently and others poorly. When the host speciates, specialists can co-speciate (cophylogeny).
  - Reef-builders (corals and sponges) and trees add a "structure" value to a zone. Structure raises the number of species a zone can hold, by softening the diversity-dependent brake in `evolve()` per zone.
  - Parasites as a trophic mode that scales with host density (density-dependent mortality, plus the existing Red Queen bonus for sexual hosts).
- **Code:** `setParams()` diet weights become per-host. Add `sp.host`. In `step()`, per-zone pools gain a per-clade breakdown for the few specialist pools.

### 4. Climate cycles and refugia
- **Real:** Milankovitch orbital cycles (~23, 41 and 100 thousand years) drive ice ages. Ranges shrink into refugia, split, and expand again, a "species pump", especially in the tropics and mountains.
- **Plan:** a sum of sinusoidal forcings added to `Planet.globalShift`, with amplitude growing when the planet is cool (like the Pleistocene). `checkIsolation()` already turns refugia into species, so this mostly needs the forcing plus a "glacial / interglacial" indicator in the Planet tab.

### 5. Ecological opportunity after extinctions
- **Real:** after mass extinctions, survivors radiate rapidly into emptied niches (mammals after the dinosaurs).
- **Plan:** make the diversity-dependent brake depend on *occupied niche space* rather than raw species count. Bin species by (grade, habitat, trophic, temperature band). Empty bins boost speciation and transition rates for related lineages nearby. Mark "adaptive radiation" in the chronicle when a lineage's speciation rate spikes.

### 6. Islands, endemism and sexual selection
- **Real:** islands and isolated lakes produce many endemic species (Galápagos, Hawaii, Lake Malawi cichlids). Mate choice can split populations quickly.
- **Plan:**
  - Hotspot volcanoes (`Tectonics.hotspot`) already build island chains as plates move over them. Add an island-dwarfism/gigantism tendency to `speciate()`, and an *Endemics* count per zone for an endemism map view.
  - Sexual selection: sexual animal lineages get a display-trait value. Speciation with a display shift needs no ecological change, raising rates for birds and fish.

## Also planned
- Methane and an Archean organic haze (an early greenhouse; orange skies before oxygen)
- Civilization stages once intelligence appears
- Save/load worlds; a designer for custom seed organisms
