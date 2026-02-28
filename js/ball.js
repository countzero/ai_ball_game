/**
 * Ball Road Runner - Ball Creation
 * Matches original BALL CREATION section.
 */
var ballGame = window.ballGame;

ballGame.createBall = function() {
    const state = ballGame.state;
    const config = ballGame.config;
    const BALL_RADIUS = config.BALL_RADIUS;

    state.ballGroup = new THREE.Group();

    // Main ball (black)
    const ballGeom = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const ballMat = new THREE.MeshPhongMaterial({
        color: config.COLORS.ball,
        specular: 0x444444,
        shininess: 80
    });
    state.ball = new THREE.Mesh(ballGeom, ballMat);
    state.ball.castShadow = true;
    state.ballGroup.add(state.ball);

    // Red stripe (accent ring)
    const stripeGeom = new THREE.TorusGeometry(BALL_RADIUS * 0.85, 0.06, 8, 32);
    const stripeMat = new THREE.MeshPhongMaterial({
        color: config.COLORS.ballAccent,
        specular: 0x666666,
        shininess: 100
    });

    const stripe1 = new THREE.Mesh(stripeGeom, stripeMat);
    stripe1.rotation.x = Math.PI / 2;
    state.ballGroup.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeom, stripeMat);
    stripe2.rotation.y = Math.PI / 2;
    state.ballGroup.add(stripe2);

    // Red dot on top
    const dotGeom = new THREE.SphereGeometry(BALL_RADIUS * 0.25, 16, 16);
    const dotMat = new THREE.MeshPhongMaterial({ color: config.COLORS.ballAccent });
    const dot = new THREE.Mesh(dotGeom, dotMat);
    dot.position.y = BALL_RADIUS * 0.9;
    state.ballGroup.add(dot);

    state.ballGroup.position.y = BALL_RADIUS;
    state.scene.add(state.ballGroup);
};
