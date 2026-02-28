/**
 * Ball Road Runner - Config & State
 * Matches original CONFIG + GLOBALS sections.
 */
var ballGame = window.ballGame || {};
window.ballGame = ballGame;

// ─── CONFIG (tunable constants) ─────────────────────────
ballGame.config = {
    ROAD_WIDTH: 8,
    ROAD_SEGMENT_LENGTH: 2,
    ROAD_VISIBLE_AHEAD: 120,
    ROAD_VISIBLE_BEHIND: 20,
    BALL_RADIUS: 0.5,
    BASE_SPEED: 0.15,
    MAX_SPEED: 0.6,
    ACCELERATION: 0.004,
    DECELERATION: 0.006,
    FRICTION: 0.001,
    STEER_SPEED: 0.12,
    STEER_RETURN: 0.04,
    CAMERA_HEIGHT: 22,
    CAMERA_LOOK_AHEAD: 15,

    COLORS: {
        sky: 0x87CEEB,
        ground: 0x90EE90,
        road: 0x555566,
        roadEdge: 0xFFFFFF,
        roadCenter: 0xFFD700,
        ball: 0x111111,
        ballAccent: 0xCC0000,
        obstacles: [0xFF6B6B, 0xFFE66D, 0x4ECDC4, 0xA06CD5, 0xFF8C42, 0x6BCB77, 0xFF69B4, 0x48BFE3],
        trees: [0x2ECC71, 0x27AE60, 0x1ABC9C, 0x16A085],
        treetrunk: 0x8B4513,
        flowers: [0xFF69B4, 0xFFD700, 0xFF6B6B, 0xE056FF, 0xFF8C42]
    }
};

ballGame.constants = {
    DEADZONE: 0.15
};

// ─── GLOBALS (mutable game state) ───────────────────────
ballGame.state = {
    scene: null,
    camera: null,
    renderer: null,

    ball: null,       // the inner mesh
    ballGroup: null,  // the group (positioned on road)

    roadPoints: [],
    roadCurve: null,
    roadMeshes: [],
    edgeMeshes: [],
    decorations: [],
    obstacles: [],

    gameState: 'menu', // menu | playing | gameover
    score: 0,
    speed: 0,
    travelDistance: 0,
    lateralOffset: 0,
    difficulty: 1,
    lastObstacleDistance: 0,
    totalRoadGenerated: 0,
    currentAngle: 0,

    keys: {},
    gamepad: null,
    clock: null
};
