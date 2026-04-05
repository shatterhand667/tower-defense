const Grid = (() => {
  let cells = [];
  let grassV = []; // pre-computed random variation per tile

  function init() {
    cells = [];
    grassV = [];
    for (let r = 0; r < C.ROWS; r++) {
      cells[r] = new Array(C.COLS).fill(C.GRASS);
      grassV[r] = [];
      for (let c = 0; c < C.COLS; c++) grassV[r][c] = Math.random();
    }

    // Top / bottom border
    for (let c = 0; c < C.COLS; c++) {
      cells[0][c] = C.TREE;
      cells[C.ROWS - 1][c] = C.TREE;
    }

    // Left edge
    for (let r = 0; r < C.ROWS; r++) cells[r][0] = C.TREE;
    C.SPAWN_ROWS.forEach(r => { if (r > 0 && r < C.ROWS - 1) cells[r][0] = C.SPAWN; });

    // Right edge
    for (let r = 0; r < C.ROWS; r++) cells[r][C.COLS - 1] = C.TREE;
    C.CASTLE_ROWS.forEach(r => { if (r > 0 && r < C.ROWS - 1) cells[r][C.COLS - 1] = C.CASTLE; });
  }

  function getCell(r, c) {
    if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) return -1;
    return cells[r][c];
  }

  function isWalkable(r, c, towerGrid) {
    const type = getCell(r, c);
    if (type === -1 || type === C.TREE) return false;
    if (towerGrid && towerGrid[r] && towerGrid[r][c]) return false;
    return true;
  }

  function draw(ctx, path, hover, selType, towerGrid) {
    for (let r = 0; r < C.ROWS; r++)
      for (let c = 0; c < C.COLS; c++)
        drawTile(ctx, r, c, path, hover, selType, towerGrid);
  }

  function isOnPath(r, c, path) {
    return path ? path.some(p => p.r === r && p.c === c) : false;
  }

  function drawTile(ctx, r, c, path, hover, selType, towerGrid) {
    const x = c * C.T, y = r * C.T, t = C.T;
    const type = cells[r][c];
    const v = grassV[r][c];
    const onPath = isOnPath(r, c, path);
    const hasTower = towerGrid && towerGrid[r] && towerGrid[r][c];

    // --- GRASS (or grass under tower) ---
    if (type === C.GRASS || hasTower) {
      ctx.fillStyle = onPath ? (v > 0.5 ? '#4d9e5a' : '#44905a') :
                     (v > 0.7 ? '#357a3f' : v > 0.4 ? '#3a7d44' : '#428050');
      ctx.fillRect(x, y, t, t);
      if (!onPath && !hasTower && v > 0.82) {
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(x + 3, y + 5, 5, 2);
        ctx.fillRect(x + 16, y + 20, 4, 2);
      }
      if (onPath && !hasTower) {
        ctx.fillStyle = 'rgba(130,230,130,0.22)';
        ctx.fillRect(x + 5, y + 5, t - 10, t - 10);
      }
      if (hasTower) return; // tower drawn by Towers.draw
    }

    // --- TREE ---
    else if (type === C.TREE) {
      ctx.fillStyle = '#1a3a1a';
      ctx.fillRect(x, y, t, t);
      ctx.fillStyle = '#4a2e10';
      ctx.fillRect(x + t / 2 - 2, y + t / 2 + 1, 4, t / 2 - 3);
      ctx.fillStyle = '#1e4d1e';
      ctx.beginPath(); ctx.arc(x + t/2, y + t/2 - 3, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d6a2d';
      ctx.beginPath(); ctx.arc(x + t/2 - 4, y + t/2 - 5, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a7a3a';
      ctx.beginPath(); ctx.arc(x + t/2 + 3, y + t/2 - 6, 7, 0, Math.PI * 2); ctx.fill();
    }

    // --- SPAWN ---
    else if (type === C.SPAWN) {
      ctx.fillStyle = '#3a7d44';
      ctx.fillRect(x, y, t, t);
      ctx.fillStyle = 'rgba(255,240,80,0.65)';
      ctx.beginPath();
      ctx.moveTo(x + 3,      y + t/2 - 5);
      ctx.lineTo(x + t - 8,  y + t/2 - 5);
      ctx.lineTo(x + t - 8,  y + t/2 - 9);
      ctx.lineTo(x + t - 2,  y + t/2);
      ctx.lineTo(x + t - 8,  y + t/2 + 9);
      ctx.lineTo(x + t - 8,  y + t/2 + 5);
      ctx.lineTo(x + 3,      y + t/2 + 5);
      ctx.closePath();
      ctx.fill();
    }

    // --- CASTLE ---
    else if (type === C.CASTLE) {
      ctx.fillStyle = '#9a9090';
      ctx.fillRect(x, y, t, t);
      ctx.strokeStyle = '#7a7070';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + t/2);     ctx.lineTo(x + t, y + t/2);
      ctx.moveTo(x + t/2, y);     ctx.lineTo(x + t/2, y + t/2);
      ctx.moveTo(x + t/4, y+t/2); ctx.lineTo(x + t/4, y + t);
      ctx.moveTo(x+3*t/4, y+t/2); ctx.lineTo(x+3*t/4, y + t);
      ctx.stroke();
      const ci = C.CASTLE_ROWS.indexOf(r);
      if (ci === 0) {
        ctx.fillStyle = '#555'; ctx.fillRect(x+2,y,8,8); ctx.fillRect(x+20,y,8,8);
      }
      if (ci === C.CASTLE_ROWS.length - 1) {
        ctx.fillStyle = '#555'; ctx.fillRect(x+2,y+t-8,8,8); ctx.fillRect(x+20,y+t-8,8,8);
      }
      // Castle flag on middle tile
      if (ci === Math.floor(C.CASTLE_ROWS.length / 2)) {
        ctx.fillStyle = '#cc3333';
        ctx.fillRect(x + t/2 - 1, y + 2, 2, 12);
        ctx.beginPath();
        ctx.moveTo(x + t/2 + 1, y + 2);
        ctx.lineTo(x + t/2 + 9, y + 6);
        ctx.lineTo(x + t/2 + 1, y + 10);
        ctx.fill();
      }
    }

    // --- HOVER highlight ---
    if (hover && hover.r === r && hover.c === c && type === C.GRASS && !hasTower && selType) {
      const def = C.TOWERS[selType];
      const canAfford = Game.gold >= def.cost;
      ctx.fillStyle = canAfford ? 'rgba(255,255,255,0.28)' : 'rgba(255,60,60,0.25)';
      ctx.fillRect(x, y, t, t);
    }

    // --- subtle grid lines ---
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, t, t);
  }

  return { init, getCell, isWalkable, draw };
})();
