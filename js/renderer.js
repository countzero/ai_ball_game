/**
 * Ball Road Runner - Renderer (scene, camera, lights, ground)
 * Matches original INIT section.
 */
var ballGame = window.ballGame;

ballGame.renderer = {};

ballGame.renderer.init = function() {
    const state = ballGame.state;
    const config = ballGame.config;

    state.clock = new THREE.Clock();

    // Scene
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(config.COLORS.sky);
    state.scene.fog = new THREE.Fog(config.COLORS.sky, 60, 140);

    // Camera (bird's eye with slight tilt)
    state.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    state.camera.position.set(0, config.CAMERA_HEIGHT, 10);
    state.camera.lookAt(0, 0, -config.CAMERA_LOOK_AHEAD);

    // Renderer
    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(state.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 120;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    state.scene.add(dirLight);

    // Ground plane
    const groundGeom = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshLambertMaterial({ color: config.COLORS.ground });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    state.scene.add(ground);
};

ballGame.renderer.onResize = function() {
    const state = ballGame.state;
    if (!state.camera || !state.renderer) return;
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener('resize', ballGame.renderer.onResize);
