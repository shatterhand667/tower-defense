const Game = (() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  let gold       = C.START_GOLD;
  let castleHP   = C.CASTLE_MAX_HP;
  let wave       = 0;
  let state      = 'prep';  // prep | wave | gameover | won
  let selectedTowerType = null;
  let selectedTile      = null;
  let hoverTile         = null;
  let cachedPath        = null;
  let lastTime          = 0;

  // Wave spawning
  let spawnQueue    = []; // array of spawnRow indices
  let spawnTimer    = 0;
  let spawnedCount  = 0;
  let totalToSpawn  = 0;

  // --- Expose mutable state as getters/setters so modules can reference Game.gold etc. ---
  const pub = {
    get gold()       { return gold; },
    set gold(v)      { gold = v; UI.updateSidebar(); },
    get castleHP()   { return castleHP; },
    get wave()       { return wave; },
    get selectedTowerType() { return selectedTowerType; },
    set selectedTowerType(v){ selectedTowerType = v; },
    get selectedTile()      { return selectedTile; },
    set selectedTile(v)     { selectedTile = v; },
  };

  function init() {
    canvas.width  = C.COLS * C.T;
    canvas.height = C.ROWS * C.T;

    Grid.init();
    Towers.init();
    Enemies.init();
    Combat.init();
    UI.init();
    Audio.init();

    cachedPath = _buildCombinedPath();
    UI.updateSidebar();
    UI.setWaveStatus('Przygotuj obronę!');

    canvas.addEventListener('mousemove', _onMouseMove);
    canvas.addEventListener('click',     _onClick);
    canvas.addEventListener('contextmenu', _onRightClick);

    requestAnimationFrame(_loop);
  }

  function _loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.1);
    lastTime = ts;

    _update(dt, ts);
    _render();
    requestAnimationFrame(_loop);
  }

  function _update(dt, now) {
    if (state === 'gameover' || state === 'won') return;

    UI.update(dt);

    if (state === 'wave') {
      // Spawn goblins from queue
      if (spawnedCount < totalToSpawn) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnTimer = C.WAVE_SPAWN_INTERVAL;
          const row = spawnQueue[spawnedCount % spawnQueue.length];
          Enemies.spawnGoblin(row);
          spawnedCount++;
        }
      }

      Enemies.update(dt);
      Combat.update(dt, now);

      // Check reached enemies → damage castle
      const { reached } = Enemies.removeDeadAndReached();
      if (reached > 0) {
        Audio.play('castleHit');
        castleHP -= reached * C.GOBLIN.dmgToCastle;
        UI.showFloatingText('-' + reached, C.COLS * C.T - C.T, C.CASTLE_ROWS[Math.floor(C.CASTLE_ROWS.length/2)] * C.T);
        UI.updateSidebar();
        if (castleHP <= 0) {
          castleHP = 0;
          state = 'gameover';
          Audio.play('gameOver');
          UI.setWaveStatus('GAME OVER');
          UI.setStartBtnEnabled(false);
          return;
        }
      }

      // Wave complete?
      if (spawnedCount >= totalToSpawn && Enemies.allGone()) {
        state = 'prep';
        UI.setWaveStatus('Fala ' + wave + ' ukończona! Buduj obronę.');
        UI.setStartBtnEnabled(true);
        cachedPath = _buildCombinedPath();
      }
    }
  }

  function _drawRange(r, c, rangeTiles, color) {
    const cx = c * C.T + C.T / 2;
    const cy = r * C.T + C.T / 2;
    const px = rangeTiles * C.T;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, px, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function _render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Grid.draw(ctx, cachedPath, hoverTile, selectedTowerType, Towers.grid());
    Towers.draw(ctx, selectedTile);

    // Range preview when hovering grass with tower selected
    if (selectedTowerType && hoverTile && Grid.getCell(hoverTile.r, hoverTile.c) === C.GRASS) {
      const def = C.TOWERS[selectedTowerType];
      if (def.range > 0) _drawRange(hoverTile.r, hoverTile.c, def.range, 'rgba(255,255,180,0.9)');
    }

    // Range of selected tower
    if (selectedTile) {
      const t = Towers.grid()[selectedTile.r]?.[selectedTile.c];
      if (t && t.range > 0) _drawRange(t.r, t.c, t.range, 'rgba(100,200,255,0.9)');
    }

    // Range on hover over existing tower (when nothing selected)
    if (!selectedTowerType && !selectedTile && hoverTile) {
      const t = Towers.grid()[hoverTile.r]?.[hoverTile.c];
      if (t && t.range > 0) _drawRange(t.r, t.c, t.range, 'rgba(180,255,180,0.8)');
    }

    Enemies.draw(ctx);
    Combat.draw(ctx);
    UI.drawFloats(ctx);

    if (state === 'gameover') _drawOverlay('GAME OVER', '#cc2222');
    if (state === 'won')      _drawOverlay('WYGRANA!',  '#22cc44');
  }

  function _drawOverlay(text, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width/2, canvas.height/2);
    ctx.fillStyle = '#fff';
    ctx.font = '22px monospace';
    ctx.fillText('Odśwież stronę aby zagrać ponownie', canvas.width/2, canvas.height/2 + 50);
  }

  function startWave() {
    if (state !== 'prep') return;
    wave++;
    state = 'wave';
    spawnedCount = 0;
    totalToSpawn = C.WAVE_SIZE + (wave - 1) * 3;
    spawnTimer   = 0;
    spawnQueue   = [...C.SPAWN_ROWS];
    UI.setStartBtnEnabled(false);
    Audio.play('waveStart');
    UI.setWaveStatus('Fala ' + wave + ' — Idą gobliny!');
    cachedPath = _buildCombinedPath();
  }

  function _buildCombinedPath() {
    // Union of all paths from every spawn row
    const seen = new Set();
    const combined = [];
    for (const r of C.SPAWN_ROWS) {
      const p = Pathfinding.findPath(r, 0, Towers.grid());
      if (!p) continue;
      for (const tile of p) {
        const key = tile.r + ',' + tile.c;
        if (!seen.has(key)) { seen.add(key); combined.push(tile); }
      }
    }
    return combined.length > 0 ? combined : null;
  }

  function _tileAt(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { r: Math.floor(y / C.T), c: Math.floor(x / C.T) };
  }

  function _onMouseMove(e) {
    const t = _tileAt(e);
    hoverTile = t;
  }

  function _onClick(e) {
    if (state === 'gameover' || state === 'won') return;
    const t = _tileAt(e);
    const tower = Towers.grid()[t.r]?.[t.c];

    // Placing a tower type selected
    if (selectedTowerType && Grid.getCell(t.r, t.c) === C.GRASS) {
      const def = C.TOWERS[selectedTowerType];

      // If there's a wall here and we're placing a non-wall tower → replace wall
      const wallHere = tower && tower.typeId === 'WALL';
      if (tower && !wallHere) {
        // Occupied by a real tower — select it instead
        selectedTowerType = null;
        UI.showTowerInfo(t);
        return;
      }

      const totalCost = def.cost + (wallHere ? 0 : 0); // wall refunded below
      const wallRefund = wallHere ? Math.floor(tower.totalCost * (Game.wave === 0 ? 1.0 : 0.5)) : 0;
      const netCost = def.cost - wallRefund;

      if (gold < netCost) { UI.setWaveStatus('Za mało złota!'); return; }

      if (wallHere) Towers.sell(t.r, t.c); // remove wall, no gold change yet

      const placed = Towers.place(t.r, t.c, selectedTowerType);
      if (placed) {
        gold = gold + wallRefund - def.cost;
        Audio.play('place');
        UI.updateSidebar();
        cachedPath = _buildCombinedPath();
        selectedTile = null;
        UI.hideInfo();
      }
      return;
    }

    if (tower) {
      // Select placed tower
      selectedTowerType = null;
      UI.showTowerInfo(t);
      return;
    }

    // Click on empty tile while no tower type selected: deselect
    selectedTile = null;
    selectedTowerType = null;
    UI.hideInfo();
  }

  function _onRightClick(e) {
    e.preventDefault();
    selectedTowerType = null;
    selectedTile = null;
    UI.hideInfo();
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
  }

  return Object.assign(pub, { init, startWave });
})();

window.addEventListener('load', () => Game.init());
