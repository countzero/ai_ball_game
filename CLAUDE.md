# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Ball Road Runner" — a browser game where the player controls a ball rolling down a procedurally generated winding road, dodging obstacles. No build system, no dependencies to install. Supports keyboard and XBOX gamepad input.

## Running

Open `index.html` directly in a browser. No server required (though a local HTTP server works too: `npx serve .` or `python -m http.server`).

## Architecture

The project is split across multiple files loaded via `<script>` tags. All modules communicate through a shared global namespace object `window.ballGame`. Three.js r128 is loaded from CDN.

### File Structure

```
index.html          — HTML shell, script loading, inline boot IIFE
css/styles.css      — HUD and overlay UI styles (backdrop-filter blur effects)
js/config.js        — Creates ballGame namespace; defines config, constants, state
js/renderer.js      — ballGame.renderer: Three.js scene, camera, renderer, lighting, ground
js/ball.js          — ballGame.createBall: player ball mesh (sphere + torus stripes + dot)
js/road.js          — ballGame.road: procedural road generation, decorations, cleanup
js/obstacles.js     — ballGame.obstacles: spawning, animation, collision/off-road detection
js/main.js          — ballGame.main: game loop, input handling, game state management
```

### Load Order (Critical)

Scripts must load in this order (defined in `index.html`):
1. Three.js r128 (CDN)
2. `config.js` — creates `window.ballGame`, defines `ballGame.config`, `ballGame.constants`, `ballGame.state`
3. `renderer.js` — creates `ballGame.renderer`
4. `ball.js` — creates `ballGame.createBall`
5. `road.js` — creates `ballGame.road`
6. `obstacles.js` — creates `ballGame.obstacles`
7. `main.js` — creates `ballGame.main`
8. Inline IIFE calls `init()` to boot

### Module Communication

All files read/write the shared `ballGame.state` object for mutable game state (Three.js objects, input, score, speed, etc.) and read `ballGame.config` for constants. There are no ES modules, imports, or build steps.

### Boot Sequence

1. `ballGame.renderer.init()` — scene, camera, renderer, lights, ground plane
2. `ballGame.createBall()` — player ball mesh
3. `ballGame.main.setupEvents()` — keyboard/gamepad listeners, DOM refs
4. `ballGame.main.animate()` — starts requestAnimationFrame loop

Game stays in `'menu'` state until user clicks START.

## Key Modules

### config.js
Tunable constants in `ballGame.config`: road dimensions (`ROAD_WIDTH: 8`), physics (`BASE_SPEED`, `MAX_SPEED`, `ACCELERATION`, `DECELERATION`, `FRICTION`), steering (`STEER_SPEED`), camera (`CAMERA_HEIGHT: 22`), and a `COLORS` sub-object (sky, ground, road, ball, obstacles, trees, flowers). `ballGame.constants.DEADZONE` for gamepad. `ballGame.state` holds all mutable game state, including the scene refs that must track the player (`ground`, `dirLight`) and the input layer (`keys`, `gamepadIndex`, `prevPadButtons`, `padInput`, `steerInput`).

### renderer.js
Three.js setup: PerspectiveCamera (50 FOV, bird's-eye at height 22), WebGLRenderer (antialiased, PCFSoftShadowMap, 2048x2048 shadow map), ambient + directional lighting, fog (60–140 range), 500x500 green ground plane.

- `followPlayer(x, z)` — re-centres the ground plane and the sun (plus its shadow target) on the ball every frame. Both are finite: the plane is 500x500 and the directional light's shadow camera only covers a 100x100 box around its target. Leaving either anchored at the origin means the player literally drives off the edge of the world (sky visible through the road) after ~250 units, with shadows dying far earlier. Fog hides the plane's edges.

### ball.js
Creates a `THREE.Group` containing: main black sphere, two perpendicular red torus ring stripes, and a small red dot on top.

### road.js
- `generateRoadPoints(count)` — appends waypoints with random curvature scaled by difficulty
- `rebuildRoadCurve()` — reconstructs `CatmullRomCurve3` (tension 0.5)
- `getRightAt(t)` — road-space "right" vector from the curve tangent at `t`
- `buildRoadMesh(startIdx, endIdx)` — quad-strip road surface + white edge dashes + gold center dashes. Each quad takes its two cross-sections from `getRightAt()` and carries the far edge forward as the next quad's near edge. Deriving the normal from the `p1→p2` chord instead (one per quad, applied to both ends) leaves wedge-shaped gaps on the outside of every bend.
- `addDecorations(startIdx, endIdx)` — trees (35% chance) and flowers (40% chance) on road sides
- `cleanupBehind()` / `clearWorld()` — dispose Three.js geometries/materials to prevent leaks

### obstacles.js
- `spawnObstacle(distanceAhead)` — random geometry (box/cylinder/cone/dodecahedron), random lane offset, 8-color palette
- `updateObstacles(dt)` — hover animation + rotation, removes passed obstacles
- `checkCollisions()` — 2D sphere-vs-sphere (XZ plane), all obstacles use radius 0.6
- `checkOffRoad()` — brute-force sampling (200 points on curve), off-road if distance > `ROAD_WIDTH/2 + 0.3`
- `getObstacleSpacing()` — `max(4, 15 - difficulty * 1.2)`

### main.js
- `setupEvents()` — keyboard, gamepad connect/disconnect, start button, space-to-restart, Esc/P-to-pause
- `startGame()` — full reset, generates 200 initial road points, spawns initial obstacles
- `gameOver()` — shows overlay with score
- `setPaused(bool)` / `onStartButton()` — pause overlay; the overlay button doubles as RESUME so it must not wipe the run
- `resolvePad()` — returns the live `Gamepad` for the active slot (see Gamepad support below)
- `pollGamepad()` — reads the pad into `state.padInput` and handles pause/restart. Called from `animate()`, **not** `update()`: `update()` returns early unless `gameState === 'playing'`, so anything that has to work while paused or on the game-over screen cannot live there.
- `update(dt)` — main game loop: input processing, physics, road generation, ball positioning, camera follow, HUD updates
- `animate()` — requestAnimationFrame loop, dt capped at 50ms

Game states: `menu` | `playing` | `paused` | `gameover`.

## Key Design Patterns

- **Shared global namespace**: All modules attach to `window.ballGame` and share state through `ballGame.state`.
- **Infinite road**: Road segments generated ahead and cleaned up behind. Ball position parameterized by `travelDistance` mapped to curve parameter `t`, with `lateralOffset` for steering.
- **Difficulty scaling**: `difficulty = 1 + floor(travelDistance / 100)` — affects road curvature (`0.02 + difficulty * 0.008`), obstacle spacing (`max(4, 15 - difficulty * 1.2)`), and multi-obstacle rows (doubles at difficulty > 3, triples at difficulty > 6).
- **Speed-dependent steering**: Lateral offset change is `STEER_SPEED * (1 + speed * 2)`, so faster = wider turns.
- **Off-road is not instant death**: Speed degrades by 10% per frame; death only if speed drops below 30% of `BASE_SPEED`.
- **Memory management**: `clearWorld()` and `cleanupBehind()` dispose Three.js geometries/materials to prevent leaks.
- **The world follows the player**: the road runs towards −Z forever, so anything finite and static (ground plane, shadow frustum) must be re-centred on the ball each frame via `renderer.followPlayer()`. Fog and the 200-unit camera far plane hide the edges.
- **Seamless geometry**: road cross-sections are a function of the curve parameter `t` alone, so adjacent quads that meet at the same `t` share vertices exactly. Any per-quad approximation reintroduces visible cracks.
- **Merged input**: keyboard and gamepad are additive, never exclusive. `pollGamepad()` writes analog intent into `state.padInput`; `update()` combines it with `state.keys`. An idle or vanished controller must never disable the keyboard.
- **Gamepad support**: XBOX / "standard" mapping. Left stick or RT accelerate, LT/B brake, left stick or D-pad steer (analog, deadzone-rescaled), LB/RB fine steer, A start/restart, START or Y pause.
  - `resolvePad()` tracks whichever pad currently has input rather than reading `getGamepads()[0]`; with two controllers paired, slot 0 is frequently the idle one. Disconnects are index-checked so unplugging the idle pad cannot kill the active one.
  - Button actions use rising-edge detection against `state.prevPadButtons`. Polling raw `.pressed` fires ~60x/second, which makes toggles (pause) and one-shots (restart) unusable.
  - `navigator.getGamepads()` returns all-`null` until the player physically presses a button — pads are not exposed without that gesture, so this is not a detection failure.

## Known Dead Code

- `config.STEER_RETURN` (0.04) is defined but never referenced.
- `config.ROAD_VISIBLE_AHEAD` (120) and `config.ROAD_VISIBLE_BEHIND` (20) are defined but never referenced; cleanup uses a hardcoded threshold of 40 units in `cleanupBehind()`.
