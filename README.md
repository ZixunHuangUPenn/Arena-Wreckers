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

## Build 15

Visual overhaul. `src/environment.ts` generates every arena surface at load time: nine tileable PBR layers (sand, cracked track, sandstone, concrete, asphalt, tread plate, snow, ice, frosted rock) baked on the CPU into albedo, height and normal maps, then height-blended per pixel in the ground shader with macro colour variation, baked contact shading around cover and drifting cloud shadows. Roads are part of that blend rather than separate ribbons. Outside the walls a generated landscape (stepped mesas, factory yard, snowy peaks) replaces the cone skyline; its slope is capped so it never hides the arena from the fixed camera. Cover footprints are unchanged but are now drawn as generated boulder clusters or stacked shipping containers. Instanced pebbles, wind-swayed grass, shrubs, snow-capped pines, sodium lamps with ground light pools, lit factory blocks and camera-following snow, dust and embers are all generated too.

`src/render-pipeline.ts` adds image-based lighting from a generated sky per arena (golden-hour desert, moonlit foundry, cold morning snowfield), ACES tone mapping, a texel-snapped shadow frustum that follows the camera, bloom and a colour grade with vignette. Quality tiers: low renders directly with no shadows or post-processing; medium adds 1024 shadows, bloom and grading; high adds 2048 shadows and 4x MSAA.

Gameplay geometry, collision, sight lines and AI are untouched. `npm test` also builds all three generated environments headlessly. Screenshots were checked in headless Chromium with software rendering only; frame rate on real phones and GPUs is unverified.

## Build 16

**Camera and lens.** The orthographic camera is replaced by a perspective camera at the same heading (so screen-relative controls are unchanged), 39 degrees of pitch and a field of view chosen to keep the old playfield coverage. Distance haze now works, the generated landscape extends to 300m, and the bridge fades when its deck is between the camera and the player. A Gaussian-weighted lens blur grows towards the top and bottom of the frame (with a fixed-pitch camera, screen height tracks distance along the ground, so no depth buffer is needed). The high tier adds ground-truth ambient occlusion (GTAO). Baked textures are 512px on desktop and 256px on touch devices.

**Vehicles.** `src/vehicle-models.ts` generates all five vehicles: hulls are lofted rounded cross-sections, with clear-coat paint, tinted glass, chrome, emissive lamps, tread-profiled tyres on spoked rims and a weapon per vehicle on a `Turret` node. The glTF reconstructions are no longer used for cars. Wheels spin and steer; the body is sprung, leans into corners, squats under acceleration, steps its tail out in hard turns and rocks from recoil and hits. All of this is visual: collision boxes and handling numbers are unchanged.

**Combat effects.** `src/combat-effects.ts` is rewritten around two GPU point clouds (alpha smoke, additive fire) and one decal mesh: fireballs, rolling smoke, bouncing sparks and debris, shockwave rings, scorch and tyre marks, arena-coloured dust, damage smoke and fire, plus two pooled point lights for blast and muzzle flashes (off on the low tier). Capacity is fixed at 640 particles and 220 decals.

**Feel.** Trauma-style camera shake with roll that scales with blast distance, a short hit-stop on kills and heavy hits, a speed- and boost-sensitive field of view, per-weapon gunshot sounds (previously silent), a two-voice filtered engine and a sub-bass layer under explosions.

**Content.** A fourth arena, Caldera: ash ground, basalt rims and a ring of cracked lava crust whose seams emit light. Horde waves 2, 4 and 5 add a fragile suicide buggy that chases the player and detonates; waves 4 to 6 add an armoured elite. Three more milestones (10 matches, 5000 damage, 100 kills).

**Gaussian splatting** was evaluated and not adopted: splat scenes come from photo captures of real places, cannot be generated procedurally, are static with baked lighting (no dynamic shadows from cars, no collision) and typically weigh tens to hundreds of megabytes, which is a poor fit for a phone-first GitHub Pages game. It remains an option for a static showroom backdrop if a capture is supplied.

Verification: `npm test` passes, including the new arena's relief and slope limits and the bounded effects system; `npm run build` passes; all four arenas, the garage and an explosion were screenshotted in headless Chromium at medium quality and one arena at high quality, with no console errors. Software rendering only: frame rate, touch latency and audio on real devices are unverified. Photo-scanned CC0 materials could not be fetched in the build environment, so all surfaces remain generated.
