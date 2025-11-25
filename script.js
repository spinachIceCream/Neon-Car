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
const CAR_WIDTH_RATIO = 0.45; // Car width relative to lane width
const OBSTACLE_WIDTH_RATIO = 0.45; // Smaller obstacles
const CAR_HEIGHT_RATIO = 1.2; // Car height relative to width
const BASE_SPEED = 5;
const SPEED_INCREMENT = 0.001;
const SPEED_BOOST = 2; // Speed jump every 500 points

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
    color: '#00f3ff'
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
        if (player.lane > 0) {
            player.lane--;
            updatePlayerTarget();
        }
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (player.lane < LANE_COUNT - 1) {
            player.lane++;
            updatePlayerTarget();
        }
    }
});

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
    // Use smaller ratio for obstacles
    const obsWidth = LANE_WIDTH * OBSTACLE_WIDTH_RATIO;
    const obsHeight = obsWidth * CAR_HEIGHT_RATIO;
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
                color: '#ff00ff'
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
    drawCar(player.x, player.y, player.width, player.height, player.color, true);

    // Draw Obstacles
    game.obstacles.forEach(obs => {
        drawCar(obs.x, obs.y, obs.width, obs.height, obs.color, false);
    });
}

function drawCar(x, y, w, h, color, isPlayer) {
    ctx.save();

    // Glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;

    // Car Body
    ctx.fillStyle = color;
    // Simple car shape
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();

    // Details (Windshield)
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 5, y + h * 0.2, w - 10, h * 0.2);

    // Tail lights if player, Headlights if enemy (conceptually)
    if (isPlayer) {
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(x + 5, y + h - 5, 5, 3);
        ctx.fillRect(x + w - 10, y + h - 5, 5, 3);
    } else {
        // Enemy details
        ctx.fillStyle = '#ffff00'; // Headlights
        ctx.fillRect(x + 5, y + h - 5, 5, 3);
        ctx.fillRect(x + w - 10, y + h - 5, 5, 3);
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
