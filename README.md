# Arena Wreckers

Browser-based single-player vehicular combat. Live build uses self-contained assets and can cache the game after the first online load. This is an independently implemented prototype inspired by the mechanics and industrial interface of Indestructible, not its original source or asset pack.

## Play

Choose a vehicle, use its distinct weapon and skill, optionally upgrade armor/engine/firepower, then choose a mode and arena. All opponents and teammates are AI.

- Touch: left stick drives toward a screen direction; right stick independently aims and shoots. A center tap uses aim assist for visible opponents. Vehicle skill is above the right stick.
- Optional wheel control: continuous forward throttle, wheel steering and assisted fire.
- Desktop: WASD, pointer aim, Space fire, Q skill, Escape pause.
- The game pauses when backgrounded. Progress, settings and milestones are stored in this browser's localStorage.

Modes: six-wave solo survival with bosses; 3v3 respawn deathmatch; capture points; single-life elimination; capture the flag; recover/hold charge.
Arenas: Sandstone, Foundry and Frostline have different heightfields and cover layouts.

## Development

Requires a supported Node.js release. Run `npm install`, `npm run dev`, `npm test`, `npm run build`.

`npm test` runs the actual TypeScript game logic in a deterministic browser stub with real Three.js geometry. It covers collisions, immediate steering, equipment and skills, telegraphs, pickups, barrels, respawn rules, wave progression, objectives, upgrades and persistence. It does not validate WebGL rendering, touch latency on physical hardware or subjective game feel. Menus are additionally exercised in a real browser during development.

`npm run build` emits `dist/` plus a versioned service worker and app manifest. Deploy `dist/` as a static HTTPS site. No server, external CDN, account, API key, paid purchase or multiplayer backend is needed.

## Source

- `src/main.ts`: game loop, scene, controls, AI, effects and menu bindings.
- `src/physics.ts`: oriented collision boxes and swept projectile tests.
- `src/match.ts`: match scoring and end conditions.
- `src/handling.ts`: vehicle parameters and screen/world angle conversion.
- `src/terrain.ts`: continuous heightfields shared by graphics and driving.
- `src/profile.ts`: validated local save data, upgrades, rewards and configuration.
- `src/interface.ts` and `src/interface.css`: menu shell and rendered vehicle/weapon previews.
- `vite.config.ts`: static build and offline cache generation.

## Build 10

Five reconstructed textured glTF vehicles: Mantis (machine gun / Nitro), Punisher (shotgun / incendiary mine), Retro (pulse / Charge), Pummeler (rockets / Air Strike), Bigrig (howitzer / Kinetic Shock). Skills follow the reference archetypes; fixed weapon assignments are our gameplay choices. Models are independently rebuilt, not original Glu assets. Downloaded CC0 components and provenance: `public/assets/vendor/SOURCES.md`.

Shots have maximum horizontal flight distances of 16/11/20/22/18m. Vehicle vision is 22/19/21/20/18m; cover blocks sight, enemy health bars and radar contacts. AI retains last seen locations briefly instead of tracking hidden enemies. The HUD uses a uniformly scaled coordinate frame and Safari safe-area insets; projected labels use that same frame. Deployment has one shared start action for both buttons.

`scripts/build_models.py` rebuilds vehicles, weapons, projectiles and preview renders using Blender; runtime assets are prebuilt. Terrain and vehicle atlas textures are generated originals. `src/assets.ts` loads models and batches static body parts by material. Browser QA confirms menus and all five model loads; actual WebGL frame rate and physical iPhone touch latency require hardware testing.

## Build 11

Added bounded muzzle flashes, projectile smoke, blast rings, tyre marks, dust and low-HP smoke. Fire button displays reload progress; skill button displays cooldown. Effects have a fixed 150-item cap and dispose per-instance materials. Projectile models now follow vertical velocity. Fixed spark material indexing. These are independent approximations of the reference effects, not extracted original assets.

## Build 12

Rebuilt all three heightfields with 4–8m relief, long access slopes, valleys and raised flanks. Added conforming road ribbons, physical yard cover, background mountain ridges, aircraft silhouettes, factory stacks and overhead pipes. Gameplay geometry and driving use the same height function. Map tests check relief, slope limits, scenery colliders and long collision simulations. There are no driveable overlapping bridge layers: terrain remains a continuous 3D heightfield.

## Build 13

Added a north bridge to every map with two approach ramps, a 9m central deck, piers and raised collision rails. Driving selects ground or deck using entry position/previous height; vehicle collisions include vertical intervals and projectiles can hit the deck. Added a universal 65-damage missile with 26m range and an independent 7s cooldown (touch button / E); it steers toward a visible locked target, and flies straight without a lock. Armory and deployment now explain missile controls and bridge routes.

## Build 14

Vehicle-specific acceleration, lower full-speed steering gain and mild corner speed reduction; no input smoothing delay. Camera uses exponential follow smoothing plus a capped 1.5m forward look, with teleport/spectator snapping. Incoming hostile rockets within 14m show a warning and audio cue; hit arcs identify attacker direction. AI uses loadout-specific firing distances, flank offsets, critical-health repair pickup routing and occasional independent missiles. Camera convergence is tested at 30/60/120fps; physical iPhone performance remains unverified.
