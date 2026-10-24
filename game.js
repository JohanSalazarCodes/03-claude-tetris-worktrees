'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

const resumeBtn = document.getElementById('resume-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const startLevelSel = document.getElementById('start-level');
const overlayBox = overlay.firstElementChild;

let board, current, next, score, lines, level, paused, lastTime, dropAccum, dropInterval, animId;
let combo = 0, bestCombo = 0;
let gameOver = true; // hasta pulsar "Jugar" en la pantalla de inicio
let startLevel = 1;

const intervalFor = lvl => Math.max(100, 1000 - (lvl - 1) * 90);

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  combo = cleared ? combo + 1 : 0;
  bestCombo = Math.max(bestCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalFor(level);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

const NEON = [null, '#00ffff', '#ffff00', '#ff00ff', '#00ff66', '#ff3355', '#3377ff', '#ff9900', '#cccccc'];
const PASTEL = [null, '#b5ead7', '#fff5ba', '#e0bbe4', '#c7f0bd', '#ffb7b2', '#c4dff6', '#ffdac1', '#d9d9d9'];

// Cada skin dibuja un bloque en (px,py) de lado s
const SKINS = {
  retro(c, px, py, s, color) {
    c.fillStyle = color;
    c.fillRect(px + 1, py + 1, s - 2, s - 2);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(px + 1, py + 1, s - 2, 4);
  },
  neon(c, px, py, s, color) {
    c.shadowColor = color;
    c.shadowBlur = 12;
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.strokeRect(px + 3, py + 3, s - 6, s - 6);
    c.fillStyle = color + '55';
    c.fillRect(px + 3, py + 3, s - 6, s - 6);
    c.shadowBlur = 0;
  },
  pastel(c, px, py, s, color) {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(px + 2, py + 2, s - 4, s - 4, s / 3);
    c.fill();
  },
  pixel(c, px, py, s, color) {
    c.fillStyle = color;
    c.fillRect(px, py, s, s);
    const u = s / 6; // textura: luz arriba/izq, sombra abajo/der, punto central
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(px, py, s, u);
    c.fillRect(px, py, u, s);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(px, py + s - u, s, u);
    c.fillRect(px + s - u, py, u, s);
    c.fillRect(px + 2 * u, py + 2 * u, 2 * u, 2 * u);
  },
};
const SKIN_PALETTES = { neon: NEON, pastel: PASTEL };
let skin = 'retro';

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = (SKIN_PALETTES[skin] || COLORS)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  SKINS[skin](context, x * size, y * size, size, color);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

const RECORDS_KEY = 'tetris-records';
const TOP_N = 5;
const recordsList = document.getElementById('records-list');
const recordsExtra = document.getElementById('records-extra');
const newRecordEl = document.getElementById('new-record');
const nameInput = document.getElementById('name-input');

function loadRecords() {
  try {
    return { top: [], bestCombo: 0, maxLines: 0, ...JSON.parse(localStorage.getItem(RECORDS_KEY)) };
  } catch {
    return { top: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecords(rec) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
}

// highlight = índice de la fila a resaltar (o -1)
function renderRecords(highlight = -1) {
  const rec = loadRecords();
  recordsList.replaceChildren(...rec.top.map((r, i) => {
    const li = document.createElement('li');
    li.textContent = `${r.name} `;
    const s = document.createElement('span');
    s.textContent = r.score.toLocaleString();
    li.append(s);
    if (i === highlight) li.className = 'me';
    return li;
  }));
  recordsExtra.textContent = `Mejor combo: ${rec.bestCombo} · Máx. líneas: ${rec.maxLines}`;
}

function showOverlay(title, scoreText) {
  overlayTitle.textContent = title;
  overlayScore.textContent = scoreText;
  newRecordEl.hidden = true;
  renderRecords();
  overlay.classList.remove('hidden');
}

function submitRecord() {
  const rec = loadRecords();
  const entry = { name: nameInput.value.trim() || 'Anónimo', score };
  rec.top.push(entry);
  rec.top.sort((a, b) => b.score - a.score);
  rec.top.length = Math.min(rec.top.length, TOP_N);
  saveRecords(rec);
  newRecordEl.hidden = true;
  renderRecords(rec.top.indexOf(entry));
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, bestCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  showOverlay('GAME OVER', `Puntuación: ${score.toLocaleString()}`);
  if (score > 0 && (rec.top.length < TOP_N || score > rec.top[rec.top.length - 1].score)) {
    newRecordEl.hidden = false;
    nameInput.value = '';
    nameInput.focus();
  }
}

document.getElementById('save-btn').addEventListener('click', submitRecord);
nameInput.addEventListener('keydown', e => {
  e.stopPropagation(); // no disparar controles del juego al escribir
  if (e.key === 'Enter') submitRecord();
});
document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  localStorage.removeItem(RECORDS_KEY);
  newRecordEl.hidden = true;
  renderRecords();
});

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showOverlay('PAUSA', '');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = bestCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return; // inputs blocked while menu is open
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

resumeBtn.addEventListener('click', togglePause);
controlsBtn.addEventListener('click', () => { controlsList.hidden = !controlsList.hidden; });
startLevelSel.addEventListener('change', () => { startLevel = +startLevelSel.value; });
restartBtn.addEventListener('click', () => {
  restartBtn.textContent = 'Reiniciar';
  init();
});

const themeToggle = document.getElementById('theme-toggle');
const toggleIcon = themeToggle.querySelector('.toggle-icon');
const toggleLabel = themeToggle.querySelector('.toggle-label');

function applyTheme(isLight) {
  if (isLight) {
    document.body.classList.add('light-mode');
    toggleIcon.textContent = '☀';
    toggleLabel.textContent = 'DARK';
  } else {
    document.body.classList.remove('light-mode');
    toggleIcon.textContent = '☾';
    toggleLabel.textContent = 'LIGHT';
  }
}

const savedTheme = localStorage.getItem('tetris-theme');
applyTheme(savedTheme === 'light');

themeToggle.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light-mode');
  applyTheme(isLight);
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
});

const skinSelect = document.getElementById('skin-select');

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  document.body.dataset.skin = skin;
  skinSelect.value = skin;
  if (next) { drawNext(); if (!gameOver) draw(); }
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  localStorage.setItem('tetris-skin', skin);
  skinSelect.blur(); // evita que las flechas cambien el select durante el juego
});

applySkin(localStorage.getItem('tetris-skin'));
showOverlay('TETRIS', '');
