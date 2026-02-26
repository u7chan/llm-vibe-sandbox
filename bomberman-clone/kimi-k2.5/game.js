// Bomberman Clone - Game Logic
// Grid: 15x13, Tile: 32px, Canvas: 480x416

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GRID_W = 15;
const GRID_H = 13;
const TILE = 32;

// Game state
let gameState = 'playing'; // playing, win, lose
let map = [];
let player = null;
let enemies = [];
let bombs = [];
let flames = [];
let items = [];

// Input
const keys = {};

// Map tiles
const TILE_EMPTY = '.';
const TILE_WALL = '#';
const TILE_SOFT = '?';

// Initialize game
function init() {
    generateMap();
    spawnEntities();
    setupInput();
    requestAnimationFrame(gameLoop);
}

// Generate map with walls and soft blocks
function generateMap() {
    map = [];

    // Create empty grid
    for (let y = 0; y < GRID_H; y++) {
        const row = [];
        for (let x = 0; x < GRID_W; x++) {
            row.push(TILE_EMPTY);
        }
        map.push(row);
    }

    // Place outer walls
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
                map[y][x] = TILE_WALL;
            }
        }
    }

    // Place inner walls (checkerboard pattern + random)
    for (let y = 2; y < GRID_H - 2; y += 2) {
        for (let x = 2; x < GRID_W - 2; x += 2) {
            map[y][x] = TILE_WALL;
        }
    }

    // Place soft blocks (20 random positions, avoiding player start area)
    let softCount = 0;
    const playerSafeZone = [
        {x: 1, y: 1}, {x: 2, y: 1}, {x: 1, y: 2}
    ];

    while (softCount < 20) {
        const x = Math.floor(Math.random() * (GRID_W - 2)) + 1;
        const y = Math.floor(Math.random() * (GRID_H - 2)) + 1;

        if (map[y][x] === TILE_EMPTY && !isInSafeZone(x, y, playerSafeZone)) {
            map[y][x] = TILE_SOFT;
            softCount++;
        }
    }
}

function isInSafeZone(x, y, safeZone) {
    return safeZone.some(p => p.x === x && p.y === y);
}

// Spawn player and enemies
function spawnEntities() {
    // Player at top-left
    player = {
        x: 1,
        y: 1,
        maxBombs: 1,
        firePower: 3,
        moveCooldown: 0
    };

    // 4 Enemies at corners
    const enemyPositions = [
        {x: GRID_W - 2, y: 1},
        {x: GRID_W - 2, y: GRID_H - 2},
        {x: 1, y: GRID_H - 2},
        {x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2)}
    ];

    enemies = enemyPositions.map(pos => ({
        x: pos.x,
        y: pos.y,
        moveCooldown: 0,
        moveInterval: 30 + Math.random() * 30
    }));
}

// Input handling
function setupInput() {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;

        if (e.code === 'Space') {
            e.preventDefault();
            placeBomb();
        }

        // Retry on Enter
        if (e.code === 'Enter' && gameState !== 'playing') {
            resetGame();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
}

// Place bomb
function placeBomb() {
    if (gameState !== 'playing') return;

    const px = Math.round(player.x);
    const py = Math.round(player.y);

    // Check if already has bomb at position
    if (bombs.some(b => b.x === px && b.y === py)) return;

    // Check max bombs
    const playerBombs = bombs.filter(b => b.owner === 'player').length;
    if (playerBombs >= player.maxBombs) return;

    bombs.push({
        x: px,
        y: py,
        timer: 180,
        firePower: player.firePower,
        owner: 'player'
    });
}

// Game loop
let lastTime = 0;
function gameLoop(timestamp) {
    const delta = timestamp - lastTime;

    if (delta >= 16) { // ~60fps
        update();
        render();
        lastTime = timestamp;
    }

    requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
    if (gameState !== 'playing') return;

    updatePlayer();
    updateEnemies();
    updateBombs();
    updateFlames();
    checkCollisions();
    checkWinCondition();
    updateUI();
}

// Player movement
function updatePlayer() {
    if (player.moveCooldown > 0) {
        player.moveCooldown--;
        return;
    }

    let dx = 0;
    let dy = 0;

    if (keys['ArrowUp']) dy = -1;
    else if (keys['ArrowDown']) dy = 1;
    else if (keys['ArrowLeft']) dx = -1;
    else if (keys['ArrowRight']) dx = 1;

    if (dx !== 0 || dy !== 0) {
        const newX = player.x + dx;
        const newY = player.y + dy;

        if (canMoveTo(newX, newY)) {
            player.x = newX;
            player.y = newY;
            player.moveCooldown = 10; // Move delay for grid-based movement
        }
    }
}

// Enemy AI - random movement
function updateEnemies() {
    enemies.forEach(enemy => {
        if (enemy.moveCooldown > 0) {
            enemy.moveCooldown--;
            return;
        }

        const directions = [
            {dx: 0, dy: -1}, {dx: 0, dy: 1},
            {dx: -1, dy: 0}, {dx: 1, dy: 0}
        ];

        // Shuffle directions
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        for (const dir of directions) {
            const newX = enemy.x + dir.dx;
            const newY = enemy.y + dir.dy;

            if (canEnemyMoveTo(newX, newY)) {
                enemy.x = newX;
                enemy.y = newY;
                enemy.moveCooldown = enemy.moveInterval;
                break;
            }
        }
    });
}

// Check if position is valid for movement
function canMoveTo(x, y) {
    const gx = Math.round(x);
    const gy = Math.round(y);

    if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return false;
    if (map[gy][gx] === TILE_WALL || map[gy][gx] === TILE_SOFT) return false;
    if (bombs.some(b => b.x === gx && b.y === gy)) return false;

    return true;
}

function canEnemyMoveTo(x, y) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
    if (map[y][x] === TILE_WALL || map[y][x] === TILE_SOFT) return false;
    if (bombs.some(b => b.x === x && b.y === y)) return false;
    return true;
}

// Bomb timer and explosion
function updateBombs() {
    for (let i = bombs.length - 1; i >= 0; i--) {
        const bomb = bombs[i];
        bomb.timer--;

        if (bomb.timer <= 0) {
            explodeBomb(bomb, i);
        }
    }
}

// Explosion
function explodeBomb(bomb, index) {
    bombs.splice(index, 1);

    const fx = bomb.x;
    const fy = bomb.y;
    const power = bomb.firePower;

    // Center
    flames.push({x: fx, y: fy, timer: 60});

    // Four directions
    const dirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];

    dirs.forEach(dir => {
        for (let i = 1; i <= power; i++) {
            const nx = fx + dir.dx * i;
            const ny = fy + dir.dy * i;

            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) break;

            // Hit wall - stop
            if (map[ny][nx] === TILE_WALL) break;

            // Hit soft block - destroy and stop
            if (map[ny][nx] === TILE_SOFT) {
                map[ny][nx] = TILE_EMPTY;
                // 50% chance for item
                if (Math.random() < 0.5) {
                    items.push({
                        x: nx,
                        y: ny,
                        type: Math.random() < 0.5 ? 'fire' : 'bomb'
                    });
                }
                break;
            }

            // Chain reaction - hit other bomb
            const otherBomb = bombs.find(b => b.x === nx && b.y === ny);
            if (otherBomb) {
                otherBomb.timer = 0;
            }

            flames.push({x: nx, y: ny, timer: 60});
        }
    });
}

// Flame timer
function updateFlames() {
    for (let i = flames.length - 1; i >= 0; i--) {
        flames[i].timer--;
        if (flames[i].timer <= 0) {
            flames.splice(i, 1);
        }
    }
}

// Check all collisions
function checkCollisions() {
    const px = Math.round(player.x);
    const py = Math.round(player.y);

    // Player vs Flame
    if (flames.some(f => f.x === px && f.y === py)) {
        gameOver();
        return;
    }

    // Player vs Enemy
    if (enemies.some(e => Math.round(e.x) === px && Math.round(e.y) === py)) {
        gameOver();
        return;
    }

    // Player vs Item
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.x === px && item.y === py) {
            if (item.type === 'fire') {
                player.firePower++;
            } else if (item.type === 'bomb') {
                player.maxBombs++;
            }
            items.splice(i, 1);
        }
    }

    // Enemy vs Flame
    for (let i = enemies.length - 1; i >= 0; i--) {
        const ex = Math.round(enemies[i].x);
        const ey = Math.round(enemies[i].y);

        if (flames.some(f => f.x === ex && f.y === ey)) {
            enemies.splice(i, 1);
        }
    }
}

// Check win/lose
function checkWinCondition() {
    if (enemies.length === 0) {
        gameState = 'win';
        document.getElementById('message').textContent = 'YOU WIN! Press Enter to retry';
    }
}

function gameOver() {
    gameState = 'lose';
    document.getElementById('message').textContent = 'GAME OVER - Press Enter to retry';
}

function resetGame() {
    gameState = 'playing';
    bombs = [];
    flames = [];
    items = [];
    document.getElementById('message').textContent = '';
    generateMap();
    spawnEntities();
}

// Update UI
function updateUI() {
    document.getElementById('enemies').textContent = enemies.length;
    document.getElementById('fire').textContent = player.firePower;
    document.getElementById('bombs').textContent = player.maxBombs;
}

// Render
function render() {
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw map
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const tile = map[y][x];
            const px = x * TILE;
            const py = y * TILE;

            if (tile === TILE_WALL) {
                ctx.fillStyle = '#888';
                ctx.fillRect(px, py, TILE, TILE);
            } else if (tile === TILE_SOFT) {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(px, py, TILE, TILE);
            }
        }
    }

    // Draw items
    items.forEach(item => {
        const px = item.x * TILE + TILE / 2;
        const py = item.y * TILE + TILE / 2;

        if (item.type === 'fire') {
            ctx.fillStyle = '#ff6600';
        } else {
            ctx.fillStyle = '#00ff00';
        }

        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw bombs
    ctx.fillStyle = '#333';
    bombs.forEach(bomb => {
        const px = bomb.x * TILE + TILE / 2;
        const py = bomb.y * TILE + TILE / 2;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw flames
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 4;
    flames.forEach(flame => {
        const px = flame.x * TILE + TILE / 2;
        const py = flame.y * TILE + TILE / 2;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.stroke();
    });

    // Draw player
    if (gameState !== 'lose') {
        const ppx = player.x * TILE + TILE / 2;
        const ppy = player.y * TILE + TILE / 2;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ppx, ppy, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw enemies
    ctx.fillStyle = '#ff0000';
    enemies.forEach(enemy => {
        const ex = enemy.x * TILE + TILE / 2;
        const ey = enemy.y * TILE + TILE / 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 12, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Start game
init();
