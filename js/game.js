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
  let _isDragging       = false;
  let _lastDragTile     = null;

  // Wave spawning
  let spawnPositions  = [];
  let spawnQueue      = [];
  let spawnTimer      = 0;
  let spawnedCount    = 0;
  let totalToSpawn    = 0;
  let spawnInterval   = 1.8;

  // Boss
  let killCount        = 0;
  let anacondaSpawned  = false;
  let ogrKillCounter   = 0;   // globalny licznik goblinów dla Ogra (nie resetuje się co falę)
  let ogrSpawned       = false; // czy Ogr pojawił się już kiedykolwiek (baner tylko raz)
  let bossAnnouncement     = 0;   // timer (s) dla baneru
  let bossAnnouncementType = '';  // 'ogr'

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

  function _generateSpawns() {
    const candidates = [];
    // Left edge
    for (let r = 1; r < C.ROWS - 1; r++) candidates.push({r, c: 0});
    // Right edge (nie castle)
    for (let r = 1; r < C.ROWS - 1; r++) {
      if (!C.CASTLE_ROWS.includes(r)) candidates.push({r, c: C.COLS - 1});
    }
    // Top & bottom edge (bez narożników)
    for (let c = 1; c < C.COLS - 1; c++) {
      candidates.push({r: 0, c});
      candidates.push({r: C.ROWS - 1, c});
    }

    // Odfiltruj zbyt blisko zamku (dystans Manhattan < 2)
    const valid = candidates.filter(pos =>
      C.CASTLE_ROWS.every(cr =>
        Math.abs(pos.r - cr) + Math.abs(pos.c - (C.COLS - 1)) >= 2
      )
    );

    // Shuffle
    for (let i = valid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [valid[i], valid[j]] = [valid[j], valid[i]];
    }

    return valid.slice(0, C.SPAWN_COUNT);
  }

  function init() {
    canvas.width  = C.COLS * C.T;
    canvas.height = C.ROWS * C.T;

    spawnPositions = _generateSpawns();
    Grid.init(spawnPositions);
    MapObjects.init(spawnPositions);
    Towers.init();
    Enemies.init();
    Combat.init();
    UI.init();
    Audio.init();

    cachedPath = _buildCombinedPath();
    UI.updateSidebar();
    UI.setWaveStatus('Przygotuj obronę!');

    canvas.addEventListener('mousemove',  _onMouseMove);
    canvas.addEventListener('mousedown',  _onMouseDown);
    canvas.addEventListener('mouseup',    _onMouseUp);
    canvas.addEventListener('mouseleave', () => { _isDragging = false; _lastDragTile = null; });
    canvas.addEventListener('click',      _onClick);
    canvas.addEventListener('contextmenu', _onRightClick);
    document.getElementById('btn-new-game').addEventListener('click', resetGame);

    requestAnimationFrame(_loop);
  }

  function resetGame() {
    gold      = C.START_GOLD;
    castleHP  = C.CASTLE_MAX_HP;
    wave      = 0;
    state     = 'prep';
    selectedTowerType = null;
    selectedTile      = null;
    hoverTile         = null;
    spawnedCount      = 0;
    totalToSpawn      = 0;
    spawnTimer        = 0;
    spawnInterval     = 1.8;
    spawnQueue        = [];
    killCount             = 0;
    anacondaSpawned       = false;
    ogrKillCounter        = 0;
    ogrSpawned            = false;
    bossAnnouncement      = 0;
    bossAnnouncementType  = '';

    spawnPositions = _generateSpawns();
    Grid.init(spawnPositions);
    MapObjects.init(spawnPositions);
    Towers.init();
    Enemies.init();
    Combat.init();

    cachedPath = _buildCombinedPath();
    UI.updateSidebar();
    UI.hideInfo();
    UI.setWaveStatus('Przygotuj obronę!');
    UI.setStartBtnEnabled(true);
    document.getElementById('btn-start-wave').textContent = '▶ Rozpocznij Falę 1';
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
    if (bossAnnouncement > 0) bossAnnouncement -= dt;

    if (state === 'wave') {
      // Spawn goblins from queue
      if (spawnedCount < totalToSpawn) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnTimer = spawnInterval;
          const pos = spawnQueue[spawnedCount % spawnQueue.length];
          Enemies.spawnGoblin(pos.r, pos.c);
          spawnedCount++;
        }
      }

      // Golem regen
      for (const t of Towers.list()) {
        if (t.typeId === 'GOLEM' && t.regen > 0 && t.hp < t.maxHp)
          t.hp = Math.min(t.maxHp, t.hp + t.regen * dt);
      }

      Enemies.update(dt);
      Combat.update(dt, now);
      Towers.updatePassives(dt);

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
        if (wave >= C.WAVES.length) {
          state = 'won';
          Audio.play('waveStart');
          UI.setWaveStatus('WYGRANA!');
          UI.setStartBtnEnabled(false);
        } else {
          state = 'prep';
          Towers.repairGolems();
          UI.setWaveStatus('Fala ' + wave + ' ukończona! Buduj obronę.');
          UI.setStartBtnEnabled(true);
          const nextWave = wave + 1;
          document.getElementById('btn-start-wave').textContent = '▶ Rozpocznij Falę ' + nextWave;
          cachedPath = _buildCombinedPath();
        }
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

    if (bossAnnouncement > 0) _drawBossAnnouncement();
    if (state === 'gameover') _drawOverlay('GAME OVER', '#cc2222');
    if (state === 'won')      _drawOverlay('WYGRANA!',  '#22cc44');
  }

  function _drawBossAnnouncement() {
    const duration = bossAnnouncementType === 'ogr' ? 4.0 : 3.5;
    const alpha = Math.min(1, bossAnnouncement) * Math.min(1, (bossAnnouncement / duration) * 4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, canvas.height/2 - 44, canvas.width, 88);

    if (bossAnnouncementType === 'ogr') {
      ctx.fillStyle = '#ff6600';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠⚠  BOSS  ⚠⚠', canvas.width/2, canvas.height/2 - 8);
      ctx.fillStyle = '#ffdd44';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('Ogr', canvas.width/2, canvas.height/2 + 22);
    } else {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠  MINI BOSS  ⚠', canvas.width/2, canvas.height/2 - 8);
      ctx.fillStyle = '#ffcc44';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('Anakonda Cesarska', canvas.width/2, canvas.height/2 + 22);
    }
    ctx.restore();
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
    const sub = text === 'WYGRANA!' ? 'Kliknij ↺ Nowa gra aby zagrać ponownie' : 'Kliknij ↺ Nowa gra aby spróbować ponownie';
    ctx.fillText(sub, canvas.width/2, canvas.height/2 + 50);
  }

  function startWave() {
    if (state !== 'prep') return;
    wave++;
    state = 'wave';
    spawnedCount = 0;
    const waveDef    = C.WAVES[wave - 1];
    totalToSpawn     = waveDef.size;
    spawnInterval    = waveDef.interval;
    spawnTimer       = 0;
    spawnQueue       = [...spawnPositions];
    killCount             = 0;
    anacondaSpawned       = false;
    bossAnnouncement      = 0;
    bossAnnouncementType  = '';
    UI.setStartBtnEnabled(false);
    Audio.play('waveStart');
    UI.setWaveStatus('Fala ' + wave + ' / ' + C.WAVES.length + ' — Idą gobliny!');
    cachedPath = _buildCombinedPath();
  }

  function _buildCombinedPath() {
    const seen = new Set();
    const combined = [];
    for (const pos of spawnPositions) {
      const p = Pathfinding.findPath(pos.r, pos.c, Towers.grid());
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

    if (_isDragging && selectedTowerType) {
      if (_lastDragTile && _lastDragTile.r === t.r && _lastDragTile.c === t.c) return;
      _lastDragTile = t;
      _tryPlace(t, true); // keepMode — nie czyść trybu podczas draga
    }
  }

  function _onMouseDown(e) {
    if (e.button !== 0) return;
    if (!selectedTowerType) return;
    _isDragging = true;
    _lastDragTile = null;
  }

  function _onMouseUp(e) {
    // Jeśli był prawdziwy drag (ruch po kafelkach) — czyść tryb kupna
    if (_isDragging && _lastDragTile !== null && selectedTowerType) {
      selectedTowerType = null;
      UI.highlightBtn(null);
    }
    _isDragging = false;
    _lastDragTile = null;
  }

  // keepMode=true podczas draga (nie czyść trybu po każdym postawieniu)
  function _tryPlace(t, keepMode = false) {
    if (state === 'gameover' || state === 'won') return;
    const tower = Towers.grid()[t.r]?.[t.c];
    if (Grid.getCell(t.r, t.c) !== C.GRASS) return;
    const def = C.TOWERS[selectedTowerType];
    const wallHere = tower && tower.typeId === 'WALL';
    if (tower && !wallHere) return;
    const wallRefund = wallHere ? Math.floor(tower.totalCost * (Game.wave === 0 ? 1.0 : 0.5)) : 0;
    const netCost = def.cost - wallRefund;
    if (gold < netCost) return;
    if (wallHere) Towers.sell(t.r, t.c);
    const placed = Towers.place(t.r, t.c, selectedTowerType);
    if (placed) {
      gold = gold + wallRefund - def.cost;
      Audio.play('place');
      UI.updateSidebar();
      cachedPath = _buildCombinedPath();
      selectedTile = null;
      UI.hideInfo();
      if (!keepMode) {
        selectedTowerType = null;
        UI.highlightBtn(null);
      }
    }
  }

  function _onClick(e) {
    if (state === 'gameover' || state === 'won') return;
    const t = _tileAt(e);
    const tower = Towers.grid()[t.r]?.[t.c];

    if (selectedTowerType) {
      const tower2 = Towers.grid()[t.r]?.[t.c];
      const wallHere = tower2 && tower2.typeId === 'WALL';
      if (tower2 && !wallHere) return; // kliknięcie na istniejącą wieżę w trybie kupna — ignoruj
      _tryPlace(t);
      return;
    }

    if (tower) {
      // Wybierz postawioną wieżę
      selectedTowerType = null;
      UI.showTowerInfo(t);
      return;
    }

    // Kliknięcie na pusty kafelek bez trybu kupna — odznacz
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

  function _randomSpawn() {
    return spawnPositions[Math.floor(Math.random() * spawnPositions.length)];
  }

  function addKill(enemy) {
    if (enemy.type !== 'goblin') return;
    killCount++;
    ogrKillCounter++;
    if (state !== 'wave') return;

    // Drzewiec co 7 goblinów
    if (killCount % C.DRZEWIEC.killsToSpawn === 0) {
      const pos = _randomSpawn();
      Enemies.spawnByType('DRZEWIEC', pos.r, pos.c);
      UI.setWaveStatus('Drzewiec wyłazi z dżungli!');
    }

    // Anakonda raz na falę po 10 goblinach
    if (!anacondaSpawned && killCount >= C.ANACONDA.killsToSpawn) {
      anacondaSpawned = true;
      const pos = _randomSpawn();
      Enemies.spawnByType('ANACONDA', pos.r, pos.c);
    }

    // Ogr co 50 goblinów (licznik nie resetuje się co falę)
    if (ogrKillCounter % C.OGR.killsToSpawn === 0) {
      const pos = _randomSpawn();
      Enemies.spawnByType('OGR', pos.r, pos.c);
      if (!ogrSpawned) {
        ogrSpawned = true;
        bossAnnouncement = 4.0; bossAnnouncementType = 'ogr';
        UI.setWaveStatus('⚠⚠ OGR NADCHODZI! ⚠⚠');
      }
    }
  }

  return Object.assign(pub, { init, startWave, addKill });
})();

window.addEventListener('load', () => Game.init());
