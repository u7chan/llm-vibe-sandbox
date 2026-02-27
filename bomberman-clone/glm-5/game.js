const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');
const message = document.getElementById('message');

const TILE = 32;
const COLS = 15;
const ROWS = 13;

const WALL = '#';
const SOFT = '?';
const EMPTY = '.';

let map = [];
let player = null;
let enemies = [];
let bombs = [];
let flames = [];
let items = [];
let state = 'playing';
let keys = {};

function createMap() {
  const m = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      if (y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1) {
        row.push(WALL);
      } else if (x % 2 === 0 && y % 2 === 0) {
        row.push(WALL);
      } else {
        row.push(EMPTY);
      }
    }
    m.push(row);
  }
  const softPositions = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (m[y][x] === EMPTY) {
        if ((x <= 2 && y <= 2) || (x >= COLS - 3 && y >= ROWS - 3)) continue;
        softPositions.push({ x, y });
      }
    }
  }
  shuffle(softPositions);
  for (let i = 0; i < Math.min(20, softPositions.length); i++) {
    const pos = softPositions[i];
    m[pos.y][pos.x] = SOFT;
  }
  return m;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.bombMax = 1;
    this.fire = 3;
    this.speed = 1;
    this.alive = true;
  }

  update() {
    if (!this.alive) return;
    let nx = this.x;
    let ny = this.y;
    if (keys['ArrowUp']) ny -= this.speed;
    if (keys['ArrowDown']) ny += this.speed;
    if (keys['ArrowLeft']) nx -= this.speed;
    if (keys['ArrowRight']) nx += this.speed;
    if (canMove(nx, ny, this.x, this.y)) {
      this.x = nx;
      this.y = ny;
    }
    this.checkItem();
    this.checkFlame();
    this.checkEnemy();
  }

  draw() {
    if (!this.alive) return;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x * TILE + TILE / 2, this.y * TILE + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  placeBomb() {
    if (!this.alive) return;
    const bx = Math.round(this.x);
    const by = Math.round(this.y);
    const active = bombs.filter(b => !b.exploded).length;
    if (active >= this.bombMax) return;
    if (bombs.some(b => b.x === bx && b.y === by)) return;
    bombs.push(new Bomb(bx, by, this.fire));
  }

  checkItem() {
    const gx = Math.round(this.x);
    const gy = Math.round(this.y);
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].x === gx && items[i].y === gy) {
        if (items[i].type === 'fire') this.fire++;
        else if (items[i].type === 'bomb') this.bombMax++;
        items.splice(i, 1);
      }
    }
  }

  checkFlame() {
    const gx = Math.round(this.x);
    const gy = Math.round(this.y);
    if (flames.some(f => f.x === gx && f.y === gy)) {
      this.alive = false;
      state = 'lose';
    }
  }

  checkEnemy() {
    for (const e of enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(this.x - e.x, this.y - e.y);
      if (dist < 0.8) {
        this.alive = false;
        state = 'lose';
      }
    }
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.alive = true;
    this.dir = Math.floor(Math.random() * 4);
    this.moveTimer = 0;
  }

  update() {
    if (!this.alive) return;
    this.moveTimer++;
    if (this.moveTimer < 30) return;
    this.moveTimer = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const validDirs = [];
    for (let i = 0; i < 4; i++) {
      const nx = this.x + dirs[i][0];
      const ny = this.y + dirs[i][1];
      if (canEnemyMove(nx, ny)) validDirs.push(i);
    }
    if (validDirs.length === 0) return;
    if (!validDirs.includes(this.dir) || Math.random() < 0.3) {
      this.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
    }
    this.x += dirs[this.dir][0];
    this.y += dirs[this.dir][1];
    this.checkFlame();
  }

  draw() {
    if (!this.alive) return;
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.arc(this.x * TILE + TILE / 2, this.y * TILE + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  checkFlame() {
    if (flames.some(f => f.x === this.x && f.y === this.y)) {
      this.alive = false;
      if (enemies.filter(e => e.alive).length === 0) {
        state = 'win';
      }
    }
  }
}

class Bomb {
  constructor(x, y, fire) {
    this.x = x;
    this.y = y;
    this.fire = fire;
    this.timer = 180;
    this.exploded = false;
  }

  update() {
    if (this.exploded) return;
    this.timer--;
    if (this.timer <= 0) {
      this.explode();
    }
  }

  explode() {
    this.exploded = true;
    createExplosion(this.x, this.y, this.fire);
    bombs = bombs.filter(b => b !== this);
  }

  draw() {
    if (this.exploded) return;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.x * TILE + TILE / 2, this.y * TILE + TILE / 2, TILE / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Flame {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.timer = 15;
  }

  update() {
    this.timer--;
  }

  draw() {
    if (this.timer <= 0) return;
    ctx.fillStyle = '#ff0';
    ctx.fillRect(this.x * TILE + 2, this.y * TILE + 2, TILE - 4, TILE - 4);
  }
}

class Item {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
  }

  draw() {
    ctx.fillStyle = this.type === 'fire' ? '#f80' : '#08f';
    ctx.fillRect(this.x * TILE + 8, this.y * TILE + 8, TILE - 16, TILE - 16);
  }
}

function canMove(nx, ny, ox, oy) {
  const gx = Math.round(nx);
  const gy = Math.round(ny);
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return false;
  if (map[gy][gx] === WALL || map[gy][gx] === SOFT) return false;
  for (const b of bombs) {
    if (b.x === gx && b.y === gy) {
      if (Math.round(ox) !== gx || Math.round(oy) !== gy) return false;
    }
  }
  return true;
}

function canEnemyMove(nx, ny) {
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;
  if (map[ny][nx] === WALL || map[ny][nx] === SOFT) return false;
  if (bombs.some(b => b.x === nx && b.y === ny)) return false;
  return true;
}

function createExplosion(cx, cy, fire) {
  flames.push(new Flame(cx, cy));
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [dx, dy] of dirs) {
    for (let i = 1; i <= fire; i++) {
      const x = cx + dx * i;
      const y = cy + dy * i;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) break;
      if (map[y][x] === WALL) break;
      flames.push(new Flame(x, y));
      if (map[y][x] === SOFT) {
        map[y][x] = EMPTY;
        if (Math.random() < 0.5) {
          const type = Math.random() < 0.5 ? 'fire' : 'bomb';
          items.push(new Item(x, y, type));
        }
        break;
      }
    }
  }
}

function init() {
  map = createMap();
  player = new Player(1, 1);
  enemies = [];
  bombs = [];
  flames = [];
  items = [];
  state = 'playing';
  const enemyPositions = [
    [COLS - 2, 1],
    [1, ROWS - 2],
    [COLS - 2, ROWS - 2],
    [Math.floor(COLS / 2), Math.floor(ROWS / 2)]
  ];
  for (const [x, y] of enemyPositions) {
    if (map[y][x] === EMPTY) {
      enemies.push(new Enemy(x, y));
    }
  }
}

function drawMap() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = map[y][x];
      if (tile === WALL) {
        ctx.fillStyle = '#666';
      } else if (tile === SOFT) {
        ctx.fillStyle = '#840';
      } else {
        ctx.fillStyle = '#111';
      }
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
}

function update() {
  if (state !== 'playing') return;
  player.update();
  for (const e of enemies) e.update();
  for (const b of bombs) b.update();
  for (const f of flames) f.update();
  flames = flames.filter(f => f.timer > 0);
  const aliveEnemies = enemies.filter(e => e.alive).length;
  ui.textContent = `Enemies: ${aliveEnemies} | Fire: ${player.fire} | Bombs: ${player.bombMax}`;
}

function draw() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawMap();
  for (const i of items) i.draw();
  for (const b of bombs) b.draw();
  for (const f of flames) f.draw();
  for (const e of enemies) e.draw();
  player.draw();
  if (state === 'win') {
    message.style.display = 'block';
    message.textContent = 'YOU WIN!\nPress R to restart';
  } else if (state === 'lose') {
    message.style.display = 'block';
    message.textContent = 'GAME OVER\nPress R to restart';
  } else {
    message.style.display = 'none';
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' && state === 'playing') {
    player.placeBomb();
    e.preventDefault();
  }
  if (e.code === 'KeyR') {
    init();
  }
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
});

init();
loop();
