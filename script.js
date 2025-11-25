const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreBoard = document.getElementById('score-board');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game Constants
const LANE_COUNT = 4;
let LANE_WIDTH = 0; // Calculated based on canvas width
const CAR_WIDTH_RATIO = 0.35; // Player car width relative to lane width
const CAR_HEIGHT_RATIO = 1.2; // Player car height relative to width
const BASE_SPEED = 5;
const SPEED_INCREMENT = 0.001;
const SPEED_BOOST = 2; // Speed jump every 500 points

const VEHICLE_TYPES = [
    { type: 'car', widthRatio: 0.35, heightRatio: 1.2, color: '#ff00ff' },
    { type: 'truck', widthRatio: 0.5, heightRatio: 2.2, color: '#ff4400' },
    { type: 'bike', widthRatio: 0.15, heightRatio: 0.6, color: '#00ff00' }
];

// Game State
let game = {
    active: false,
    score: 0,
    distance: 0, // Track precise distance for score
    speed: BASE_SPEED,
    lastTime: 0,
    obstacles: [],
    roadOffset: 0,
    nextSpeedBoost: 500
};

// Player
const player = {
    lane: 1, // 0, 1, 2, 3
    y: 0, // Set in resize
    targetX: 0,
    x: 0,
    width: 0,
    height: 0,
    color: '#00f3ff',
    type: 'player'
};

// Resize Handling
function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    LANE_WIDTH = canvas.width / LANE_COUNT;

    player.width = LANE_WIDTH * CAR_WIDTH_RATIO;
    player.height = player.width * CAR_HEIGHT_RATIO;
    player.y = canvas.height - player.height - 20;

    // Update player position based on current lane
    player.targetX = (player.lane * LANE_WIDTH) + (LANE_WIDTH - player.width) / 2;
    if (!game.active) {
        player.x = player.targetX;
    }
}

window.addEventListener('resize', resize);
resize();

// Input Handling
document.addEventListener('keydown', (e) => {
    if (!game.active) return;

    if (e.key === 'ArrowLeft' || e.key === 'a') {
        moveLeft();
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
        moveRight();
    }
});

// Touch Handling
document.addEventListener('touchstart', (e) => {
    if (!game.active) return;

    const touchX = e.touches[0].clientX;
    const screenWidth = window.innerWidth;

    if (touchX < screenWidth / 2) {
        moveLeft();
    } else {
        moveRight();
    }
}, { passive: false });

function moveLeft() {
    if (player.lane > 0) {
        player.lane--;
        updatePlayerTarget();
    }
}

function moveRight() {
    if (player.lane < LANE_COUNT - 1) {
        player.lane++;
        updatePlayerTarget();
    }
}

function updatePlayerTarget() {
    player.targetX = (player.lane * LANE_WIDTH) + (LANE_WIDTH - player.width) / 2;
}

// Game Loop
function startGame() {
    game.active = true;
    game.score = 0;
    game.distance = 0;
    game.speed = BASE_SPEED;
    game.obstacles = [];
    game.roadOffset = 0;
    game.nextSpeedBoost = 500;
    player.lane = 1;
    updatePlayerTarget();
    player.x = player.targetX;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreBoard.classList.remove('hidden');

    requestAnimationFrame(loop);
}

function loop(timestamp) {
    if (!game.active) return;

    const deltaTime = timestamp - game.lastTime;
    game.lastTime = timestamp;

    update();
    draw();

    requestAnimationFrame(loop);
}

function update() {
    // Increase speed continuously slightly
    game.speed += SPEED_INCREMENT;

    // Score based on distance traveled
    game.distance += game.speed;
    game.score = Math.floor(game.distance / 10);
    scoreEl.innerText = game.score;

    // Speed Boost every 500 points
    if (game.score >= game.nextSpeedBoost) {
        game.speed += SPEED_BOOST;
        game.nextSpeedBoost += 500;
    }

    // Move Player (Smooth transition)
    player.x += (player.targetX - player.x) * 0.2;

    // Move Road
    game.roadOffset += game.speed;
    if (game.roadOffset >= 40) game.roadOffset = 0;

    // Spawn Obstacles
    if (Math.random() < 0.03) {
        spawnObstacle();
    }

    // Update Obstacles
    for (let i = game.obstacles.length - 1; i >= 0; i--) {
        let obs = game.obstacles[i];
        obs.y += game.speed;

        // Collision Detection
        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            endGame();
        }

        // Remove off-screen obstacles
        if (obs.y > canvas.height) {
            game.obstacles.splice(i, 1);
        }
    }
}

function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANE_COUNT);

    // Random Vehicle Type
    const vehicleType = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];

    const obsWidth = LANE_WIDTH * vehicleType.widthRatio;
    const obsHeight = obsWidth * vehicleType.heightRatio;
    const x = (lane * LANE_WIDTH) + (LANE_WIDTH - obsWidth) / 2;

    // Check for obstacles in the "spawn zone" (top area)
    const spawnZoneHeight = obsHeight * 1.5;

    // Get obstacles currently in the spawn zone
    const obstaclesInZone = game.obstacles.filter(o => o.y < spawnZoneHeight);

    // Check if this lane is already occupied near the top
    const laneOccupied = obstaclesInZone.some(o => o.lane === lane);

    if (!laneOccupied) {
        // Count occupied lanes in this zone
        const occupiedLanes = new Set(obstaclesInZone.map(o => o.lane));

        // If adding this obstacle would block the LAST free lane, don't spawn it
        if (occupiedLanes.size < LANE_COUNT - 1) {
            game.obstacles.push({
                x: x,
                y: -obsHeight,
                width: obsWidth,
                height: obsHeight,
                lane: lane,
                color: vehicleType.color,
                type: vehicleType.type
            });
        }
    }
}

function draw() {
    // Clear Canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Road Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;

    // Lane dividers
    for (let i = 1; i < LANE_COUNT; i++) {
        let x = i * LANE_WIDTH;
        ctx.beginPath();
        ctx.setLineDash([20, 20]);
        ctx.lineDashOffset = -game.roadOffset;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Draw Player
    drawCar(player.x, player.y, player.width, player.height, player.color, true, 'player');

    // Draw Obstacles
    game.obstacles.forEach(obs => {
        drawCar(obs.x, obs.y, obs.width, obs.height, obs.color, false, obs.type);
    });
}

function drawCar(x, y, w, h, color, isPlayer, type) {
    ctx.save();

    // Glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;

    if (type === 'bike') {
        // Draw Tires First (Black)
        ctx.fillStyle = '#111';
        const tireWidth = w * 0.8;
        const tireHeight = h * 0.15;
        const tireX = x + (w - tireWidth) / 2;

        // Rear Tire (Top)
        ctx.fillRect(tireX, y, tireWidth, tireHeight);
        // Front Tire (Bottom)
        ctx.fillRect(tireX, y + h - tireHeight, tireWidth, tireHeight);

        // Bike Body (Connecting the tires)
        ctx.fillStyle = color;
        const bodyWidth = w * 0.6;
        const bodyX = x + (w - bodyWidth) / 2;
        ctx.beginPath();
        ctx.roundRect(bodyX, y + tireHeight - 2, bodyWidth, h - (tireHeight * 2) + 4, 5);
        ctx.fill();

        // Handlebars (Near front)
        ctx.fillStyle = '#ccc';
        const handleBarY = y + h * 0.75;
        ctx.fillRect(x - 2, handleBarY, w + 4, 3);

        // Headlight (Single, Center)
        if (!isPlayer) {
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.fillRect(x + w / 2 - 3, y + h - 5, 6, 4);
        }

    } else {
        // Standard Car/Truck Rendering
        ctx.fillStyle = color;
        ctx.beginPath();

        if (type === 'truck') {
            ctx.roundRect(x, y, w, h, 2);
        } else {
            ctx.roundRect(x, y, w, h, 5);
        }
        ctx.fill();

        // Details
        ctx.fillStyle = '#000';
        if (type === 'truck') {
            ctx.fillRect(x + 2, y + h * 0.1, w - 4, h * 0.15); // Windshield
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x + 2, y + h * 0.3, w - 4, h * 0.65); // Cargo bed
        } else {
            ctx.fillRect(x + 5, y + h * 0.2, w - 10, h * 0.2); // Windshield
        }

        // Lights
        if (isPlayer) {
            ctx.fillStyle = '#ff0000';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 10;
            ctx.fillRect(x + 5, y + h - 5, 5, 3);
            ctx.fillRect(x + w - 10, y + h - 5, 5, 3);
        } else {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(x + 5, y + h - 5, 5, 3);
            ctx.fillRect(x + w - 10, y + h - 5, 5, 3);
        }
    }

    ctx.restore();
}

function endGame() {
    game.active = false;
    finalScoreEl.innerText = game.score;
    gameOverScreen.classList.remove('hidden');
    scoreBoard.classList.add('hidden');
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
