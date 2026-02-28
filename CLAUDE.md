# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Ball Road Runner" — a single-file browser game where the player controls a ball rolling down a procedurally generated winding road, dodging obstacles. No build system, no dependencies to install.

## Running

Open `index.html` directly in a browser. No server required (though a local HTTP server works too: `npx serve .` or `python -m http.server`).

## Architecture

Everything lives in `index.html` — HTML, CSS, and JavaScript in a single IIFE. Uses Three.js r128 loaded from CDN.

Key sections of the script (search by comment headers like `// ─── CONFIG`):

- **CONFIG** — Tunable constants (road dimensions, physics, speeds, color palette)
- **GLOBALS** — Mutable game state (scene objects, score, speed, travel distance, difficulty)
- **INIT** — Three.js setup (scene, camera, renderer, lighting, ground plane, event listeners)
- **BALL CREATION** — Player ball mesh with decorative stripes
- **ROAD GENERATION** — Procedural road via `CatmullRomCurve3`; `generateRoadPoints()` appends waypoints with random curvature, `buildRoadMesh()` creates the geometry, `addDecorations()` places trees/flowers
- **OBSTACLES** — Random shapes (box/cylinder/cone/dodecahedron) spawned ahead on the road with hover animation
- **COLLISION DETECTION** — Sphere-vs-sphere for obstacles; distance-to-curve for off-road detection
- **GAME STATE** — `startGame()` resets and builds world, `gameOver()` shows overlay; states: `menu`, `playing`, `gameover`
- **UPDATE** — Main game loop: physics (acceleration/braking/friction), steering via lateral offset along road curve, camera follow, dynamic road/obstacle generation, cleanup of passed geometry

## Key Design Patterns

- **Infinite road**: Road segments are generated ahead and cleaned up behind the player. The ball's position is parameterized by `travelDistance` mapped to a `t` value on the spline curve, with `lateralOffset` for steering.
- **Difficulty scaling**: `difficulty = 1 + floor(travelDistance / 100)` — affects road curvature, obstacle spacing, and multi-obstacle spawns.
- **Memory management**: `clearWorld()` and `cleanupBehind()` dispose Three.js geometries/materials to prevent leaks.
