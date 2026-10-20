/**
 * Ball Road Runner - Main Game Loop, Input, Game State
 * Matches original UPDATE + GAME STATE + ANIMATE + event listeners.
 */
var ballGame = window.ballGame;

ballGame.main = {};

// ─── DOM refs ───────────────────────────────────────────
var scoreDisplay, speedDisplay, levelDisplay;
var overlay, overlayTitle, overlaySubtitle, finalScore, startBtn;

// ─── setupEvents ────────────────────────────────────────
ballGame.main.setupEvents = function() {
    const state = ballGame.state;
    const config = ballGame.config;

    scoreDisplay = document.getElementById('scoreDisplay');
    speedDisplay = document.getElementById('speedDisplay');
    levelDisplay = document.getElementById('levelDisplay');
    overlay = document.getElementById('overlay');
    overlayTitle = document.getElementById('overlayTitle');
    overlaySubtitle = document.getElementById('overlaySubtitle');
    finalScore = document.getElementById('finalScore');
    startBtn = document.getElementById('startBtn');

    window.addEventListener('keydown', function(e) {
        state.keys[e.key] = true;

        if (e.code === 'Space') {
            if (state.gameState === 'gameover' || state.gameState === 'menu') ballGame.main.startGame();
            else if (state.gameState === 'paused') ballGame.main.setPaused(false);
            e.preventDefault();
            return;
        }

        // Keyboard equivalent of the pad's pause button (fires on the keydown
        // edge, so holding the key does not thrash the state).
        if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
            if (state.gameState === 'playing') ballGame.main.setPaused(true);
            else if (state.gameState === 'paused') ballGame.main.setPaused(false);
            e.preventDefault();
            return;
        }

        e.preventDefault();
    });

    window.addEventListener('keyup', function(e) {
        state.keys[e.key] = false;
    });

    startBtn.addEventListener('click', function() { ballGame.main.onStartButton(); });

    window.addEventListener('gamepadconnected', function(e) {
        // Latch onto the first pad that reports in -- that is the one the
        // player actually pressed a button on. Do not let a second pad
        // waking up later steal control from the one in use.
        if (state.gamepadIndex === null) {
            state.gamepadIndex = e.gamepad.index;
            state.gamepad = e.gamepad;
            console.log('Controller connected (slot ' + e.gamepad.index + '):', e.gamepad.id);
        } else {
            console.log('Additional controller ignored (slot ' + e.gamepad.index + '):', e.gamepad.id);
        }
    });

    window.addEventListener('gamepaddisconnected', function(e) {
        // Only drop the pad we are actually driving with. The old handler
        // cleared it unconditionally, so switching off an idle second
        // controller killed input from the active one.
        if (state.gamepadIndex === e.gamepad.index) {
            state.gamepadIndex = null;
            state.gamepad = null;
            state.prevPadButtons = [];
            state.padInput.throttle = state.padInput.brake = state.padInput.steer = 0;
            console.log('Active controller disconnected (slot ' + e.gamepad.index + ')');
        }
    });
};

// ─── gamepad helpers ────────────────────────────────────

// Xbox / "standard" gamepad mapping
var BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, DPAD_L: 14, DPAD_R: 15 };

function padHasInput(pad) {
    const DEADZONE = ballGame.constants.DEADZONE;
    for (var a = 0; a < pad.axes.length; a++) {
        if (Math.abs(pad.axes[a]) > DEADZONE) return true;
    }
    for (var b = 0; b < pad.buttons.length; b++) {
        if (pad.buttons[b] && pad.buttons[b].pressed) return true;
    }
    return false;
}

// Resolve the live Gamepad object. Snapshots from the connect event go stale
// immediately in Chrome, and the old code always read getGamepads()[0] -- with
// two controllers paired, slot 0 is frequently the idle one, so the stick the
// player was holding did nothing.
ballGame.main.resolvePad = function() {
    const state = ballGame.state;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];

    var current = (state.gamepadIndex !== null) ? pads[state.gamepadIndex] : null;

    // Keep the current pad as long as the player is actually using it.
    if (current && current.connected && padHasInput(current)) return current;

    // Otherwise hand control to whichever pad is being touched right now, so
    // putting one controller down and picking the other up just works.
    var fallback = null;
    for (var i = 0; i < pads.length; i++) {
        var p = pads[i];
        if (!p || !p.connected) continue;
        if (!fallback) fallback = p;
        if (padHasInput(p)) {
            state.gamepadIndex = p.index;
            state.gamepad = p;
            return p;
        }
    }

    // Nobody is touching anything: stay on the current pad if it still
    // exists, else fall back to the first connected one.
    var keep = (current && current.connected) ? current : fallback;
    state.gamepadIndex = keep ? keep.index : null;
    state.gamepad = keep;
    return keep;
};

function buttonValue(pad, index) {
    var b = pad.buttons[index];
    if (!b) return 0;
    return typeof b.value === 'number' ? b.value : (b.pressed ? 1 : 0);
}

function buttonDown(pad, index) {
    return !!(pad.buttons[index] && pad.buttons[index].pressed);
}

// Rising edge: true only on the frame the button goes down. Without this,
// a held button fires ~60x/second -- which made the pause toggle flicker
// on/off every frame and the restart button re-roll the level continuously.
function buttonPressed(pad, index) {
    const state = ballGame.state;
    return buttonDown(pad, index) && !state.prevPadButtons[index];
}

function snapshotButtons(pad) {
    const state = ballGame.state;
    state.prevPadButtons.length = pad.buttons.length;
    for (var i = 0; i < pad.buttons.length; i++) {
        state.prevPadButtons[i] = buttonDown(pad, i);
    }
}

// Apply the deadzone and rescale so motion starts from 0 at the deadzone
// edge instead of jumping straight to full rate.
function applyDeadzone(v) {
    const DEADZONE = ballGame.constants.DEADZONE;
    if (Math.abs(v) <= DEADZONE) return 0;
    return (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

// ─── setPaused ──────────────────────────────────────────
ballGame.main.setPaused = function(paused) {
    const state = ballGame.state;
    if (paused) {
        state.gameState = 'paused';
        overlayTitle.textContent = 'Paused';
        overlaySubtitle.textContent = 'Press START or Y to resume';
        finalScore.style.display = 'none';
        startBtn.textContent = 'RESUME';
        overlay.classList.remove('hidden');
    } else {
        state.gameState = 'playing';
        overlay.classList.add('hidden');
    }
};

// ─── pollGamepad ────────────────────────────────────────
// Runs every frame from animate(), not from update(). update() bails out
// early unless gameState === 'playing', so the old in-update pause handler
// could pause the game but could never un-pause it.
ballGame.main.pollGamepad = function() {
    const state = ballGame.state;
    const pad = ballGame.main.resolvePad();
    const status = document.getElementById('controllerStatus');

    if (!pad) {
        if (status) status.style.display = 'none';
        state.padInput.throttle = state.padInput.brake = state.padInput.steer = 0;
        state.prevPadButtons.length = 0;
        return;
    }

    if (status) status.style.display = 'block';

    // --- global buttons (edge triggered) ---
    if (buttonPressed(pad, BTN.START) || buttonPressed(pad, BTN.Y)) {
        if (state.gameState === 'playing') ballGame.main.setPaused(true);
        else if (state.gameState === 'paused') ballGame.main.setPaused(false);
    }

    if (buttonPressed(pad, BTN.A)) {
        if (state.gameState === 'gameover' || state.gameState === 'menu') ballGame.main.startGame();
        else if (state.gameState === 'paused') ballGame.main.setPaused(false);
    }

    // --- analog driving intent ---
    // axes[1] is -1 when the stick is pushed UP. The old code accelerated on
    // axisY > DEADZONE, i.e. it was inverted: pulling back sped you up.
    var stickY = -applyDeadzone(pad.axes[1] || 0);
    var stickX = applyDeadzone(pad.axes[0] || 0);

    var rt = buttonValue(pad, BTN.RT);
    var lt = buttonValue(pad, BTN.LT);

    var throttle = Math.max(stickY > 0 ? stickY : 0, rt);
    var brake = Math.max(stickY < 0 ? -stickY : 0, lt);
    if (buttonDown(pad, BTN.B)) brake = 3;   // B = hard brake

    // LB/RB are buttons 4/5 in the standard mapping; the old code used 6/7,
    // which are the analog triggers.
    var steer = stickX;
    if (buttonDown(pad, BTN.LB)) steer -= 0.5;
    if (buttonDown(pad, BTN.RB)) steer += 0.5;
    if (buttonDown(pad, BTN.DPAD_L)) steer -= 1;
    if (buttonDown(pad, BTN.DPAD_R)) steer += 1;

    state.padInput.throttle = Math.max(0, Math.min(1, throttle));
    state.padInput.brake = Math.max(0, brake);
    state.padInput.steer = Math.max(-1, Math.min(1, steer));

    snapshotButtons(pad);
};

// ─── startGame ──────────────────────────────────────────
ballGame.main.startGame = function() {
    const state = ballGame.state;
    const config = ballGame.config;

    // Clear everything
    ballGame.road.clearWorld();

    // Reset state
    state.score = 0;
    state.speed = 0;
    state.travelDistance = 0;
    state.lateralOffset = 0;
    state.difficulty = 1;
    state.lastObstacleDistance = 0;
    state.totalRoadGenerated = 0;
    state.currentAngle = 0;
    state.roadPoints = [];
    state.obstacles = [];
    state.steerInput = 0;
    state.padInput.throttle = state.padInput.brake = state.padInput.steer = 0;

    // Generate initial road
    ballGame.road.generateRoadPoints(200);
    ballGame.road.buildRoadMesh(0, state.roadPoints.length - 1);
    ballGame.road.addDecorations(0, state.roadPoints.length - 1);

    // Position ball at start
    var startPos = state.roadCurve.getPoint(0.05);
    state.ballGroup.position.set(startPos.x, config.BALL_RADIUS, startPos.z);
    ballGame.renderer.followPlayer(startPos.x, startPos.z);

    // Position camera directly behind ball at start
    state.camera.position.set(startPos.x, config.CAMERA_HEIGHT, startPos.z + config.CAMERA_LOOK_AHEAD);
    var aheadPos = state.roadCurve.getPoint(0.09);
    state.camera.lookAt(aheadPos.x, 0, aheadPos.z);

    // Spawn initial obstacles
    for (var d = 30; d < 180; d += ballGame.obstacles.getObstacleSpacing()) {
        ballGame.obstacles.spawnObstacle(d / config.ROAD_SEGMENT_LENGTH);
        state.lastObstacleDistance = d;
    }

    // Hide overlay
    overlay.classList.add('hidden');
    state.gameState = 'playing';
};

// ─── gameOver ───────────────────────────────────────────
ballGame.main.gameOver = function() {
    const state = ballGame.state;
    state.gameState = 'gameover';
    state.speed = 0;

    overlayTitle.textContent = 'Game Over';
    overlaySubtitle.textContent = 'You crashed!';
    finalScore.style.display = 'block';
    finalScore.textContent = 'Final Score: ' + Math.floor(state.score);
    startBtn.textContent = 'RETRY';

    // Remove existing hint if present
    var existingHint = document.querySelector('.restart-hint');
    if (existingHint) existingHint.remove();

    // Add restart hint
    var hintDiv = document.createElement('div');
    hintDiv.className = 'instructions restart-hint';
    hintDiv.innerHTML = '<strong>Press SPACE or A to restart</strong>';
    overlay.insertBefore(hintDiv, startBtn);
    overlay.classList.remove('hidden');
};

// ─── onStartButton ──────────────────────────────────────
// The overlay button doubles as RESUME while paused, so clicking it must not
// wipe the run.
ballGame.main.onStartButton = function() {
    if (ballGame.state.gameState === 'paused') ballGame.main.setPaused(false);
    else ballGame.main.startGame();
};

// ─── update (main game loop) ────────────────────────────
ballGame.main.update = function(dt) {
    const state = ballGame.state;
    const config = ballGame.config;
    const DEADZONE = ballGame.constants.DEADZONE;

    if (state.gameState !== 'playing') return;
    if (!state.roadCurve) return;

    // Keyboard and pad are merged rather than exclusive. The old code picked
    // one or the other, so a connected-but-idle controller disabled the
    // keyboard entirely -- and if the pad then vanished from getGamepads(),
    // neither branch ran and the ball became uncontrollable.
    var pad = state.padInput;
    var throttle = pad.throttle;
    var brake = pad.brake;
    var steer = pad.steer;

    if (state.keys['ArrowUp']) throttle = 1;
    if (state.keys['ArrowDown']) brake = Math.max(brake, 1);
    if (state.keys['ArrowLeft']) steer -= 1;
    if (state.keys['ArrowRight']) steer += 1;
    steer = Math.max(-1, Math.min(1, steer));

    // Speed
    if (brake > 0) {
        state.speed = Math.max(state.speed - config.DECELERATION * brake, 0);
    } else if (throttle > 0) {
        state.speed = Math.min(state.speed + config.ACCELERATION * throttle, config.MAX_SPEED);
    } else {
        if (state.speed < config.BASE_SPEED) {
            state.speed = Math.min(state.speed + config.ACCELERATION * 0.5, config.BASE_SPEED);
        }
        state.speed = Math.max(state.speed - config.FRICTION, 0);
    }

    // Steering (analog: full deflection matches the old keyboard rate)
    state.lateralOffset += steer * config.STEER_SPEED * (1 + state.speed * 2);
    state.steerInput = steer;

    // Clamp lateral offset to road width
    var maxLateral = config.ROAD_WIDTH / 2 - config.BALL_RADIUS - 0.2;
    state.lateralOffset = Math.max(-maxLateral, Math.min(maxLateral, state.lateralOffset));

    // Move along road
    state.travelDistance += state.speed;
    state.score += state.speed * 10;

    // Difficulty scaling
    state.difficulty = 1 + Math.floor(state.travelDistance / 100);

    // Get position on road
    var t = state.travelDistance / (state.roadPoints.length - 1);
    if (t >= 0.9) {
        // Generate more road
        var prevLen = state.roadPoints.length;
        ballGame.road.generateRoadPoints(100);
        ballGame.road.buildRoadMesh(prevLen - 2, state.roadPoints.length - 1);
        ballGame.road.addDecorations(prevLen - 2, state.roadPoints.length - 1);
        // Recalculate t with the new (longer) roadPoints array
        t = state.travelDistance / (state.roadPoints.length - 1);
    }

    var clampedT = Math.min(t, 0.999);
    var roadPos = state.roadCurve.getPoint(clampedT);
    var nextT = Math.min(clampedT + 0.002, 1);
    var roadNext = state.roadCurve.getPoint(nextT);

    var roadDir = new THREE.Vector3().subVectors(roadNext, roadPos).normalize();
    var roadRight = new THREE.Vector3(-roadDir.z, 0, roadDir.x);

    // Ball position
    var targetX = roadPos.x + roadRight.x * state.lateralOffset;
    var targetZ = roadPos.z + roadRight.z * state.lateralOffset;
    state.ballGroup.position.x = targetX;
    state.ballGroup.position.z = targetZ;

    // Keep the finite ground plane and the sun's shadow frustum centred on
    // the ball, otherwise the player drives off the edge of the world.
    ballGame.renderer.followPlayer(targetX, targetZ);

    // Ball rolling animation (lean follows whichever device is steering)
    var rollSpeed = state.speed * 10;
    state.ball.rotation.x -= rollSpeed * dt;
    state.ball.rotation.z -= state.steerInput * rollSpeed * dt * 0.3;

    // Spawn obstacles ahead
    var currentDist = state.travelDistance * config.ROAD_SEGMENT_LENGTH;
    var spawnAhead = 80 + state.difficulty * 10;
    while (state.lastObstacleDistance < currentDist + spawnAhead) {
        state.lastObstacleDistance += ballGame.obstacles.getObstacleSpacing();
        var idx = state.lastObstacleDistance / config.ROAD_SEGMENT_LENGTH;
        if (idx < state.roadPoints.length - 2) {
            ballGame.obstacles.spawnObstacle(idx);
            // Spawn multiple obstacles per row at higher difficulties
            if (state.difficulty > 3 && Math.random() < 0.4) {
                ballGame.obstacles.spawnObstacle(idx + 0.5);
            }
            if (state.difficulty > 6 && Math.random() < 0.3) {
                ballGame.obstacles.spawnObstacle(idx + 0.3);
            }
        }
    }

    // Update obstacles
    ballGame.obstacles.updateObstacles(dt);

    // Check collisions
    if (ballGame.obstacles.checkCollisions()) {
        ballGame.main.gameOver();
        return;
    }

    // Check off-road
    if (ballGame.obstacles.checkOffRoad()) {
        // Slow down dramatically if off road
        state.speed *= 0.9;
        if (state.speed < config.BASE_SPEED * 0.3) {
            ballGame.main.gameOver();
            return;
        }
    }

    // Camera follow (bird's eye)
    var lookAheadT = Math.min(clampedT + 0.04, 1);
    var lookAheadPos = state.roadCurve.getPoint(lookAheadT);

    var desiredCamX = targetX;
    var desiredCamZ = targetZ + config.CAMERA_LOOK_AHEAD;

    state.camera.position.x += (desiredCamX - state.camera.position.x) * 0.12;
    state.camera.position.z += (desiredCamZ - state.camera.position.z) * 0.12;
    state.camera.position.y = config.CAMERA_HEIGHT;

    var lookTarget = new THREE.Vector3(
        lookAheadPos.x,
        0,
        lookAheadPos.z
    );
    state.camera.lookAt(lookTarget);

    // HUD
    scoreDisplay.textContent = Math.floor(state.score);
    speedDisplay.textContent = Math.floor(state.speed * 100);
    levelDisplay.textContent = state.difficulty;

    // Cleanup old road segments behind
    ballGame.road.cleanupBehind();
};

// ─── animate ────────────────────────────────────────────
ballGame.main.animate = function() {
    requestAnimationFrame(ballGame.main.animate);
    const state = ballGame.state;
    var dt = Math.min(state.clock.getDelta(), 0.05);

    // Polled outside update() so pause/resume and restart keep working while
    // the game is not in the 'playing' state.
    ballGame.main.pollGamepad();

    ballGame.main.update(dt);

    state.renderer.render(state.scene, state.camera);
};
