# Public game asset sources

Kenney Car Kit, Nature Kit and Space Kit. Author: Kenney. License: CC0 1.0.
Official pages: https://kenney.nl/assets/car-kit , https://kenney.nl/assets/nature-kit , https://kenney.nl/assets/space-kit .
Selected GLBs downloaded from the CC0 mirror https://github.com/Hidencod/tge-assets .
The imported wheel mesh is used by the five vehicle reconstructions. Vehicle body silhouettes, turret assemblies and painted materials are independently reconstructed; they are not original Glu meshes. Additional GLBs are used as arena dressing and debris.
Desert albedo and vehicle material atlas are generated project assets.
Reference mechanics and vehicle identities: https://indestructible.fandom.com/wiki/Vehicles . Public information does not establish original fixed weapon assignments; this project gives each vehicle a distinct representative weapon.

Build 17: all five vehicles, their weapons, wheels, the wear map and the garage showroom are generated in code (`src/vehicle-models.ts`, `src/showroom.ts`); the Kenney wheel mesh is no longer used on vehicles. Selection previews in `public/assets/models/*-preview.png` are renders of those generated models. Indestructible was used only as a genre/design reference for vehicle archetypes and weapon roles; no meshes, textures or logos were taken from it.
