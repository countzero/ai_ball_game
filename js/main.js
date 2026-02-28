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
        if (state.gameState === 'gameover' && e.code === 'Space') {
            ballGame.main.startGame();
            e.preventDefault();
            return;
        }
        e.preventDefault();
    });

    window.addEventListener('keyup', function(e) {
        state.keys[e.key] = false;
    });

    startBtn.addEventListener('click', ballGame.main.startGame);

    window.addEventListener('gamepadconnected', function(e) {
        state.gamepad = e.gamepad;
        console.log('XBOX controller connected:', state.gamepad.id);
    });

    window.addEventListener('gamepaddisconnected', function() {
        state.gamepad = null;
        console.log('Controller disconnected');
    });
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

    // Generate initial road
    ballGame.road.generateRoadPoints(200);
    ballGame.road.buildRoadMesh(0, state.roadPoints.length - 1);
    ballGame.road.addDecorations(0, state.roadPoints.length - 1);

    // Position ball at start
    var startPos = state.roadCurve.getPoint(0.05);
    state.ballGroup.position.set(startPos.x, config.BALL_RADIUS, startPos.z);

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

// ─── update (main game loop) ────────────────────────────
ballGame.main.update = function(dt) {
    const state = ballGame.state;
    const config = ballGame.config;
    const DEADZONE = ballGame.constants.DEADZONE;

    if (state.gameState !== 'playing') return;
    if (!state.roadCurve) return;

    var gp = state.gamepad ? navigator.getGamepads()[0] : null;
    var useController = state.gamepad !== null;

    if (useController && gp) {
        var axisY = gp.axes[1]; // Left stick vertical
        var axisX = gp.axes[0]; // Left stick horizontal
        var buttons = gp.buttons;

        // Y button (index 2) - Pause toggle
        if (buttons[2] && buttons[2].pressed) {
            if (state.gameState === 'playing') {
                state.gameState = 'menu';
                overlay.classList.remove('hidden');
                overlayTitle.textContent = 'Paused';
                overlaySubtitle.textContent = 'Press Y again to resume';
                finalScore.style.display = 'none';
                startBtn.textContent = 'START';
            } else if (state.gameState === 'menu') {
                overlay.classList.add('hidden');
                state.gameState = 'playing';
            }
            return;
        }

        // B button (index 1) - Quick brake
        if (buttons[1] && buttons[1].pressed) {
            state.speed = Math.max(state.speed - config.DECELERATION * 3, 0);
            useController = false;
        } else {
            // Normal speed control from stick
            if (axisY > DEADZONE) {
                state.speed = Math.min(state.speed + config.ACCELERATION, config.MAX_SPEED);
            } else if (axisY < -DEADZONE) {
                state.speed = Math.max(state.speed - config.DECELERATION, 0);
            } else {
                if (state.speed < config.BASE_SPEED) {
                    state.speed = Math.min(state.speed + config.ACCELERATION * 0.5, config.BASE_SPEED);
                }
                state.speed = Math.max(state.speed - config.FRICTION, 0);
            }

            // Steering from stick horizontal
            if (axisX < -DEADZONE) {
                state.lateralOffset -= config.STEER_SPEED * (1 + state.speed * 2);
            }
            if (axisX > DEADZONE) {
                state.lateralOffset += config.STEER_SPEED * (1 + state.speed * 2);
            }
        }

        // LB (index 6) - Fine steer left
        if (buttons[6] && buttons[6].pressed) {
            state.lateralOffset -= config.STEER_SPEED * 0.5 * (1 + state.speed * 2);
            useController = false;
        }
        // RB (index 7) - Fine steer right
        if (buttons[7] && buttons[7].pressed) {
            state.lateralOffset += config.STEER_SPEED * 0.5 * (1 + state.speed * 2);
            useController = false;
        }

        document.getElementById('controllerStatus').style.display = 'block';
    }

    if (!useController) {
        // Speed control from keyboard
        if (state.keys['ArrowUp']) {
            state.speed = Math.min(state.speed + config.ACCELERATION, config.MAX_SPEED);
        } else if (state.keys['ArrowDown']) {
            state.speed = Math.max(state.speed - config.DECELERATION, 0);
        } else {
            if (state.speed < config.BASE_SPEED) {
                state.speed = Math.min(state.speed + config.ACCELERATION * 0.5, config.BASE_SPEED);
            }
            state.speed = Math.max(state.speed - config.FRICTION, 0);
        }

        // Steering from keyboard
        if (state.keys['ArrowLeft']) {
            state.lateralOffset -= config.STEER_SPEED * (1 + state.speed * 2);
        }
        if (state.keys['ArrowRight']) {
            state.lateralOffset += config.STEER_SPEED * (1 + state.speed * 2);
        }

        document.getElementById('controllerStatus').style.display = 'none';
    }

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

    // Ball rolling animation
    var rollSpeed = state.speed * 10;
    state.ball.rotation.x -= rollSpeed * dt;
    if (state.keys['ArrowLeft']) state.ball.rotation.z += rollSpeed * dt * 0.3;
    if (state.keys['ArrowRight']) state.ball.rotation.z -= rollSpeed * dt * 0.3;

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

    ballGame.main.update(dt);

    // Check controller A button for restart
    if (state.gamepad) {
        var gp = navigator.getGamepads()[0];
        if (gp && gp.buttons[0] && gp.buttons[0].pressed && state.gameState === 'gameover') {
            ballGame.main.startGame();
        }
    }

    state.renderer.render(state.scene, state.camera);
};
