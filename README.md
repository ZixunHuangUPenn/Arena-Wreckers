# Arena Wreckers

Browser-based single-player vehicular combat. Live build uses self-contained assets and can cache the game after the first online load. This is an independently implemented prototype inspired by the mechanics and industrial interface of Indestructible, not its original source or asset pack.

## Play

Choose a vehicle, use its distinct weapon and skill, optionally upgrade armor/engine/firepower, then choose a mode and arena. All opponents and teammates are AI.

- Touch: left stick drives toward a screen direction; right stick independently aims and shoots. A center tap uses aim assist for visible opponents. Vehicle skill is above the right stick.
- Optional "stick + auto-aim" touch layout: left stick drives, the turret locks on to the nearest visible enemy, the right side only fires and casts skills. (The old wheel layout was removed; saves that used it move to this layout.)
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
- `src/ai-nav.ts`: AI driving. A* routes on the 1 m navigation grid that keep clear of rims and deck edges, path following, stuck and spin detection with a random break-away, search points when no enemy is known, and circling combat positions.
- `src/physics.ts`: oriented collision boxes and swept projectile tests.
- `src/match.ts`: match scoring and end conditions.
- `src/handling.ts`: vehicle parameters and screen/world angle conversion.
- `src/terrain.ts`: seeded terrain library (gorges, rivers, plateaus, lakes, waterfalls, hills, ring arenas), objective placement and the baked heightfield shared by graphics, driving and AI.
- `src/bridge.ts`: bridge decks, deck/ground collision and the bridge and ring-wall meshes.
- `src/water.ts`: water, lava, molten metal, toxic pools, frozen lakes and waterfalls.
- `src/profile.ts`: validated local save data, upgrades, rewards and configuration.
- `src/interface.ts` and `src/interface.css`: menu shell and rendered vehicle/weapon previews.
- `vite.config.ts`: static build and offline cache generation.

## Build 10

Five vehicles, each with its own weapon, active skill and passive: Kestrel (machine gun / Cloak), Grapnel (shotgun / Grapple), Arclight (pulse / Overdrive), Bombard (rockets / Creeping Barrage), Bulwark (howitzer / Fortress Dome). Names, skills and models are our own; internal ids and asset filenames keep the earlier working names. Downloaded CC0 components and provenance: `public/assets/vendor/SOURCES.md`.

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

## Audio

All sound is synthesised at run time with the Web Audio API in `src/audio.ts`, so the game ships no sound files and has no third-party audio licences. Voices are panned by their screen position (the camera is a fixed diagonal, so screen-right is world `(1,0,-1)`) and fade with distance; everything runs through a compressor and a short synthetic reverb.

- **Engines.** The player's engine is about half its previous level. Up to four nearby enemy vehicles get their own positional engines; each of the five chassis has its own pitch, range and "chug" (the big rig is low and lumpy, the mantis high and smooth).
- **Combat.** Per-weapon gunshots that lose their top end and gain reverb with distance, shell casings, armour pings and ground hits, rocket launch hiss, car-to-wall and car-to-car crashes, layered explosions with debris rattle, airstrike whistles, skill sounds and pickup chimes.
- **Battlefield ambience.** Per-arena wind and room tone (foundry metal creaks, caldera lava bubbling, colder and windier frostline) plus distant artillery, rolling gunfire and fly-overs that come more often as the fight heats up.

- **Arena music** (`src/music.ts`). An original, procedurally sequenced electronic track per arena, each with its own key, tempo, chord loop and seeded patterns: Sandstone D minor 126 BPM, Foundry E minor 132 BPM with metallic claps, Frostline A minor 120 BPM with bell arps and swing, Caldera C minor 140 BPM. Kick, clap, hats, filtered bass with sub, arp with dotted-eighth echo, pad, a lead in the peak section, and risers and crashes into each drop. The song cycles intro, groove, drive, break and peak; heavy fighting pushes it into the fuller sections sooner. The kick side-chains the melodic parts and big explosions briefly duck the music. Music volume has its own slider in Settings (default 60).

Levels were checked by rendering each sound offline in headless Chromium; the mix has not been heard on a real phone yet.

## Build 17

**Vehicles, second generation.** `src/vehicle-models.ts` is rewritten. Hulls are lofts whose half-width, sill and roof heights follow monotone splines, with wheel arches carved out of the sill line and dark wheel-well liners behind them, so bodywork wraps the tyres like a real panel. Trim (pillars, belt seals, door seams, racing stripes, armour plates) is laid onto the same surfaces. New detail: rounded-edge panels everywhere, round and rectangular lamp units with reflectors and lenses, grilles, mirrors, push bars, light bars, window guards, bolts and rivets, spare tyre and jerry cans, exhausts, smoke dischargers, fuel tanks and stacks, long-travel coil-over suspension on the buggy, a helmeted driver, brake discs and calipers, block-tread tyres and five rim designs (beadlock race, steel beadlock, slotted mag, military, truck). Each vehicle has its own paint finish (race gloss, worn satin, metallic, matte military, fleet gloss), and a shared procedural wear map adds road dust low on the body and on flat surfaces, grime and edge scratches in the shader. Weapons were remodelled (perforated twin machine guns with belt feed, drum-fed auto-shotgun with shield, coil pulse cannon, framed rocket pod with visible warheads, howitzer with muzzle brake and recoil cylinders). Vehicle archetypes and weapon roles follow the Indestructible genre reference; every mesh is generated here and is original. Collision footprints and handling are unchanged.

**Showroom.** `src/showroom.ts` renders the garage as a dark photo studio: a generated softbox environment for paint, chrome and glass reflections, a shadow-casting key light, a cool rim light, a brushed-steel turntable with an LED ring, a contact shadow and a slatted back wall. It fills the whole screen behind the menu, the turntable can be dragged, and the camera reframes for each step. Selection-card and weapon previews in `public/assets/models/*-preview.png` are re-rendered from the new models.

**Menu flow.** The garage is now a guided three-step flow shown in a stepper at the top: 1 选车 (vehicle panel with an offence/defence balance bar, four stat bars, main weapon and active skill, arrows and five cards), 2 改装 (weapon variant cards with real numbers, upgrades, paint swatches and a loadout summary), 3 出战 (modes, illustrated arena cards, briefing and one pulsing start button). A bottom action bar always shows where you are, what to do and the next step. Career and settings sit behind the profile chip and gear icon. First launch shows a redesigned welcome card. The menu now fills the safe area instead of letterboxing, in landscape and portrait.

Verification: `npm test` and `npm run build` pass; the three steps were screenshotted at 1280×720, 844×390 and 390×844 in headless Chromium with software rendering. Frame rate on real phones is unverified.

## Build 18 — menu polish

- The loadout step is now a tabbed panel (武器 / 升级 / 涂装). The weapon tab has a showcase with the remodelled gun and variant cards with damage and fire-rate comparison bars. Upgrade cards show level pips and the current → next value, with a buy button. Paint swatches show owned, in-use and locked/price states.
- Feedback effects: panels slide in on page change, selected cards and primary buttons get a shine sweep, purchases fire a spark burst with a floating "+8%" label and pulse the parts counter, and changing car or paint sweeps a light across the showroom. All of this respects `prefers-reduced-motion`.
- Settings, career and results use the same style as the rest of the menu. Native selects are replaced by segmented controls, sliders and checkboxes are custom-styled, touch-only options are hidden in keyboard mode, the career page has a level ring and XP bar, and results animate in.
- The welcome card asks for AI difficulty (writes the existing `settings.difficulty`).

## Build 19 — visual mode, arena and vehicle select
- **Deploy screen**: the selected arena's aerial render fills the whole background (slow pan, cross-fade on change, drifting dust). Mode cards are illustrated 3D key art; the arena hero card plays a reveal and scan-line effect; the ready card shows the chosen car.
- **Assets are all rendered in-house** from the game's own procedural models and terrain, with no third-party art:
  - `public/assets/maps/arena-N.jpg` — aerial renders of the real arena scene. After a terrain change, run `npx vite --port 5173` and then `node scripts/map-previews.cjs` to regenerate them (uses the dev-only `__aerial` hook on localhost).
  - `public/assets/modes/*.jpg` — staged scenes rendered from `lab.html?mode=<id>` (`src/lab.ts`).
- **Vehicle cards**: studio spot, turntable floor ellipse, floor reflection, class code and armour/speed/firepower mini-bars. The info panel shows `skillDescription` (or `skillDesc`) from the vehicle spec when one is present.

## Vehicle kits

Each car has one active skill (Q or the skill button) and one passive. Rules and numbers live in `src/skills.ts`, the dome, cable and lightning meshes in `src/skill-effects.ts`. The vehicle page shows the full write-up beside the car.

| Car | Role | Active | Passive |
|---|---|---|---|
| Kestrel 幽隼 | Stealth assassin | Cloak: unseen beyond 6 m for 5 s, firing breaks it and grants ×1.5 damage for 1.5 s | Backstab: +30% from behind |
| Grapnel 铁钩 | Close-range control | Grapple: drags an enemy within 17 m to the bumper and slows it | Close armour: −25% damage from within 9 m |
| Arclight 弧光 | Energy burst | Overdrive: faster fire for 5 s, hits arc to two more enemies | Capacitor: +6% per consecutive hit on one target, up to +36% |
| Bombard 震岳 | Siege | Creeping barrage: six shells walk along the aim line | Braced: 25% faster reload after standing still |
| Bulwark 壁垒 | Tank | Fortress dome: absorbs outside fire for 6 s, then releases part of it as a blast | Crush: ramming at speed damages and throws enemy cars |

AI drivers use the same skills. Effects were checked in software rendering only, not on a phone.

## Build 18 · Terrain library

**Every battle is a new map.** `src/terrain.ts` composes each arena from a seeded library of landforms and validates it before use: a gorge or river that splits the two halves and can only be crossed on two or three bridges, cliff-edged plateaus with drivable ramps, lakes, waterfalls that pour off a plateau into a plunge pool, hills, and walled ring arenas with four gates. Themes weight the library and pick the liquid: desert water, foundry molten-metal trenches and toxic pools, frozen lakes and icy rivers on Frostline, lava rivers, lava lakes and lavafalls in the Caldera. Spawns, capture zones, flags, pickups, barrels, the charge core and cover are placed on open ground for each layout, and a flood fill on a 1 m navigation grid (with car clearance) rejects any layout where they are not all connected. Starting a battle rolls a new seed; the toast names the landforms. `?seed=1234` replays one layout.

**One heightfield for everything.** The layout is baked to the same 0.5 m grid the ground mesh uses, and `terrainHeight` interpolates on the same triangles, so what you see is exactly what the car drives on. Cliff faces, gorge floors, deep water and lava are marked impassable; the gorge also cuts on through the mountains beyond the wall.

**Bridge fix.** The old overpass trapped cars: its 8 m ramps had solid rails on both sides, any turn into a rail bounced the car back to zero speed, rotating was refused while touching a rail, and the ramp ended 12 m from the wall, so the car had to turn there. Bridges now sit level with the rims over a gorge (nothing passes underneath, so no upper/lower ambiguity), decks are 8.6 m wide, glancing contact with rails, rock faces or walls slides along them, and a car pressed against an edge is eased away so it can still turn. The AI planner routes over bridges and objectives keep the bridge run-ups clear.

`npm test` generates 20 layouts (4 themes x 5 seeds) and checks relief, open ground, objective placement and connectivity, drives every vehicle across every bridge both ways, crashes each into the railing and drives it out, and has the AI planner cross the gorge.


## Build 20 · Bigger maps

**Four times the area.** Arenas are now 200 × 200 m (walls at ±100 m, `ARENA` in `src/terrain.ts`). The heightfield is baked every 0.625 m (321 × 321), which keeps the ground mesh at about 100k vertices. The camera bounds, minimap, AI route grid, boundary walls, outer landscape, scattered rocks and plants, foundry lamps and factory skyline all scale with `ARENA`.

**Diagonal starts.** Blue spawns in the bottom-left corner and red in the top-right, and cars face the centre when they spawn. The main gorge or river runs corner to corner between the two bases and is crossed by three or four bridges.

**More of the library on every map.** On top of the main channel, a layout can have a tributary of the other kind (a river joining a gorge or the reverse) with its own one or two bridges. It can also have a sunken road with an overpass across it: you can drive down the ramps and under the deck, or over the deck. There are three to five plateaus (up to two with waterfalls), two to four sheer rock spires that block shots and sight, two to four lakes, up to two walled rings and eight to thirteen hills. Channels can now run in any direction (`Channel.ax/az`). Sunken roads ramp in and out over 17 m. Deck edges over a drop of more than 2.8 m are impassable, so cars cannot fall off an overpass. The AI planner never links the deck to the road beneath it.

**Cover.** Barrels went from six to one linked pair, and the small crate yards are gone. Cover is now 12 to 14 large rock outcrops or container walls, 6 to 12 m long, with taller boulders. There are eight pickups instead of four.

**Generation cost.** Bounding-box early-outs in the shape functions, a band test before channel distance, one bake per successful attempt and a rasterised navigation mask bring generation to about 0.2 to 0.9 s per layout in Node. On a phone, expect roughly two to three times that when a battle starts. This has not been measured on a real device.

## Build 20 — HUD, minimap and split mode/arena pages
- **Mode and arena are separate steps** (选车 → 改装 → 模式 → 战场):
  - The mode page has a detail panel showing the rules, team size, win condition and respawn rules.
  - The arena page rolls the next battle's terrain in advance and draws it top-down (relief shading, contours, cliffs, water/lava, bridges, team bases), with feature chips and the seed. "换一个地形" re-rolls it.
- **Match start** shows only the arena name as an animated title card. The terrain features live on the arena page.
- **HUD**: player card, score panel and one shared glass button style for menu / pause / sound, with SVG icons.
- **Minimap**:
  - Background is baked from the terrain generator (`src/minimap.ts`).
  - Fog of war covers everything outside the team's shared vision; high ground sees further.
  - Shows objectives, visible enemies, and the player as a heading arrow.

## Build 22 — Match finale
- A decided match no longer cuts straight to the result screen. For about three seconds the battle keeps running:
  - time dips into slow motion and the camera pushes in;
  - a verdict banner (胜利 / 战败 / 平局) drops with the mode and score, and a short win or loss sting plays;
  - the winning side keeps driving and can fire and use skills, but nobody takes damage; allied AI spins donuts and fireworks go off over the winners;
  - on a defeat the camera moves to the nearest surviving winner and the player's car rolls to a stop.
- Then the result screen appears as before. This applies to every mode. Slow-motion pacing has not been checked on a real device.
