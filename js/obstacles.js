/**
 * Ball Road Runner - Obstacles
 * Matches original OBSTACLES + COLLISION DETECTION sections.
 */
var ballGame = window.ballGame;

ballGame.obstacles = {};

// ─── spawnObstacle ──────────────────────────────────────
ballGame.obstacles.spawnObstacle = function(distanceAhead) {
    const state = ballGame.state;
    const config = ballGame.config;

    if (!state.roadCurve || state.roadPoints.length < 4) return;

    const t = distanceAhead / (state.roadPoints.length - 1);
    if (t < 0 || t > 0.98) return;

    const pos = state.roadCurve.getPoint(Math.min(t, 1));
    const nextT = Math.min(t + 0.005, 1);
    const pos2 = state.roadCurve.getPoint(nextT);
    const dir = new THREE.Vector3().subVectors(pos2, pos).normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);

    // Random lane offset
    const laneOffset = (Math.random() - 0.5) * (config.ROAD_WIDTH - 2);
    const obstPos = pos.clone().add(right.clone().multiplyScalar(laneOffset));

    // Random obstacle type
    const type = Math.floor(Math.random() * 4);
    var geom, height;
    switch (type) {
        case 0: // Box
            height = 0.6 + Math.random() * 0.6;
            geom = new THREE.BoxGeometry(0.8 + Math.random() * 0.6, height, 0.8 + Math.random() * 0.6);
            break;
        case 1: // Cylinder
            height = 0.8 + Math.random() * 0.5;
            geom = new THREE.CylinderGeometry(0.3, 0.5, height, 8);
            break;
        case 2: // Cone
            height = 1.0 + Math.random() * 0.4;
            geom = new THREE.ConeGeometry(0.45, height, 8);
            break;
        default: // Dodecahedron
            height = 0.7 + Math.random() * 0.4;
            geom = new THREE.DodecahedronGeometry(0.5);
            break;
    }

    const color = config.COLORS.obstacles[Math.floor(Math.random() * config.COLORS.obstacles.length)];
    const mat = new THREE.MeshPhongMaterial({ color: color, specular: 0x333333, shininess: 40 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(obstPos);
    mesh.position.y = height / 2 + 0.05;
    mesh.castShadow = true;
    mesh.userData.roadT = t;
    mesh.userData.radius = 0.6;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.pulseOffset = Math.random() * Math.PI * 2;
    state.scene.add(mesh);
    state.obstacles.push(mesh);
};

// ─── updateObstacles ────────────────────────────────────
ballGame.obstacles.updateObstacles = function(dt) {
    const state = ballGame.state;
    const time = state.clock.getElapsedTime();

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i];
        // Gentle hovering
        obs.position.y = obs.userData.baseY + Math.sin(time * 2 + obs.userData.pulseOffset) * 0.1;
        obs.rotation.y += dt * 0.5;

        // Remove far behind obstacles
        if (obs.position.z > state.ballGroup.position.z + 20) {
            state.scene.remove(obs);
            obs.geometry.dispose();
            obs.material.dispose();
            state.obstacles.splice(i, 1);
        }
    }
};

// ─── checkCollisions ────────────────────────────────────
ballGame.obstacles.checkCollisions = function() {
    const state = ballGame.state;
    const config = ballGame.config;
    const ballPos = state.ballGroup.position;

    for (let i = 0; i < state.obstacles.length; i++) {
        const obs = state.obstacles[i];
        const dx = ballPos.x - obs.position.x;
        const dz = ballPos.z - obs.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < config.BALL_RADIUS + obs.userData.radius) {
            return true;
        }
    }
    return false;
};

// ─── checkOffRoad ───────────────────────────────────────
ballGame.obstacles.checkOffRoad = function() {
    const state = ballGame.state;
    const config = ballGame.config;

    if (!state.roadCurve || state.roadPoints.length < 4) return false;

    // Find closest road point to ball
    const ballPos = state.ballGroup.position;
    var minDist = Infinity;
    const sampleCount = 200;
    for (let i = 0; i < sampleCount; i++) {
        const t = i / sampleCount;
        const p = state.roadCurve.getPoint(t);
        const dx = ballPos.x - p.x;
        const dz = ballPos.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDist) minDist = dist;
    }
    return minDist > config.ROAD_WIDTH / 2 + 0.3;
};

// ─── getObstacleSpacing ─────────────────────────────────
ballGame.obstacles.getObstacleSpacing = function() {
    const state = ballGame.state;
    return Math.max(4, 15 - state.difficulty * 1.2);
};
