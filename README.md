# Ball Road Runner

A browser-based 3D game where you control a ball rolling down a procedurally generated winding road, dodging obstacles. Built with Three.js — no build tools or dependencies to install.

## How to Play

Open `index.html` in any modern browser. That's it.

### Controls

| Action      | Keyboard       | Xbox Controller        |
|-------------|----------------|------------------------|
| Accelerate  | Up Arrow       | Left Stick (forward)   |
| Brake       | Down Arrow     | B Button               |
| Steer Left  | Left Arrow     | Left Stick / D-Pad Left |
| Steer Right | Right Arrow    | Left Stick / D-Pad Right|
| Pause       | —              | A Button               |
| Restart     | Space (on game over) | —              |

### Gameplay

- Stay on the road — going off-road ends the game.
- Dodge obstacles (boxes, cylinders, cones, dodecahedrons) that spawn on the road ahead.
- Difficulty increases every 100 distance units: tighter curves, more frequent and clustered obstacles.
- Your score and current speed are shown in the HUD.

## Project Structure

```
index.html          Entry point — loads styles, scripts, and bootstraps the game
css/styles.css      UI styling (HUD, overlay, buttons)
js/
  config.js         Tunable constants and mutable game state
  renderer.js       Three.js scene, camera, lighting, ground setup
  ball.js           Player ball mesh with decorative stripes
  road.js           Procedural road generation, decorations (trees, flowers)
  obstacles.js      Obstacle spawning and collision detection
  main.js           Game loop, input handling, game state management
```

## Tech

- **Three.js r128** loaded from CDN — the only external dependency.
- No bundler, no transpiler, no `npm install`. Just HTML + JS.

## License

See repository for license details.
