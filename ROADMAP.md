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

## Planned
- Methane and an Archean organic haze (an early greenhouse; orange skies before oxygen)
- Civilization stages once intelligence appears
- Save/load worlds; a designer for custom seed organisms
