const UI = (() => {
  let floats = []; // floating text {text, x, y, life, maxLife}

  function init() {
    floats = [];
    _bindSidebar();
  }

  function _bindSidebar() {
    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (Game.selectedTile) { Game.selectedTile = null; _hideInfo(); }
        Game.selectedTowerType = Game.selectedTowerType === type ? null : type;
        _highlightBtn(Game.selectedTowerType);
      });
    });

    document.getElementById('btn-start-wave').addEventListener('click', () => {
      Game.startWave();
    });

    document.getElementById('btn-upgrade').addEventListener('click', () => {
      if (!Game.selectedTile) return;
      if (Towers.tryUpgrade(Game.selectedTile.r, Game.selectedTile.c)) {
        updateSidebar();
        _refreshInfo(Game.selectedTile);
      }
    });

    document.getElementById('btn-sell').addEventListener('click', () => {
      if (!Game.selectedTile) return;
      const gold = Towers.sell(Game.selectedTile.r, Game.selectedTile.c);
      Game.gold += gold;
      Audio.play('sell');
      Game.selectedTile = null;
      _hideInfo();
      updateSidebar();
    });
  }

  function _highlightBtn(type) {
    document.querySelectorAll('.tower-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.type === type);
    });
  }

  function updateSidebar() {
    document.getElementById('gold-val').textContent   = Game.gold;
    document.getElementById('castle-val').textContent = Game.castleHP + '/' + C.CASTLE_MAX_HP;
    document.getElementById('wave-val').textContent   = Game.wave;

    document.querySelectorAll('.tower-btn').forEach(btn => {
      const def = C.TOWERS[btn.dataset.type];
      btn.classList.toggle('unaffordable', Game.gold < def.cost);
    });

    _updateFactions();
  }

  const TIER_COLORS = ['', '#cd7f32', '#c0c0c0', '#FFD700'];
  const TIER_NAMES  = ['', 'Bronze',  'Silver',  'Gold'  ];

  function _updateFactions() {
    const container = document.getElementById('factions-list');
    const typeIds   = Towers.list().map(t => t.typeId);

    // Count towers per faction
    const counts = {};
    for (const id of Object.keys(Factions.DEFS)) counts[id] = 0;
    for (const typeId of typeIds) {
      const facs = Factions.TOWER_FACTIONS[typeId];
      if (!facs) continue;
      for (const f of facs) counts[f]++;
    }

    const activeTiers = Factions.getActiveTiers(typeIds);

    // Only show factions with at least 1 tower, sorted by count desc
    const rows = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a);

    if (rows.length === 0) {
      container.innerHTML = '<div class="faction-empty">Postaw wieżę aby aktywować synergie</div>';
      return;
    }

    container.innerHTML = '';

    for (const [facId, count] of rows) {
      const def      = Factions.DEFS[facId];
      const tierData = activeTiers[facId];
      const tier     = tierData ? tierData.tier : 0;
      const maxCount = def.thresholds[def.thresholds.length - 1]; // 4

      const row = document.createElement('div');
      row.className = 'faction-row' + (tier > 0 ? ' f-active' : '');

      // Pips
      let pipsHtml = '';
      for (let i = 1; i <= maxCount; i++) {
        const filled    = i <= count;
        const atThresh  = def.thresholds.includes(i);
        const color     = filled ? (tier > 0 ? TIER_COLORS[tier] : '#4a7a4a') : '';
        const classes   = ['faction-pip', filled ? 'filled' : '', atThresh ? 'threshold' : ''].filter(Boolean).join(' ');
        const style     = filled ? `background:${color};` : '';
        pipsHtml += `<span class="${classes}" style="${style}"></span>`;
      }

      // Tier label (only if active)
      const tierHtml = tier > 0
        ? `<span class="faction-tier" style="color:${TIER_COLORS[tier]}">${TIER_NAMES[tier]}</span>`
        : `<span class="faction-tier"></span>`;

      row.innerHTML =
        `<span class="faction-icon">${def.icon}</span>` +
        `<span class="faction-name">${def.name}</span>` +
        `<div class="faction-pips">${pipsHtml}</div>` +
        `<span class="faction-count" style="${tier > 0 ? 'color:' + TIER_COLORS[tier] : ''}">${count}/${maxCount}</span>` +
        tierHtml;

      container.appendChild(row);
    }
  }

  function showTowerInfo(tile) {
    const tower = Towers.grid()[tile.r][tile.c];
    if (!tower) { _hideInfo(); return; }
    Game.selectedTile = tile;
    Game.selectedTowerType = null;
    _highlightBtn(null);
    _refreshInfo(tile);
  }

  function _refreshInfo(tile) {
    const tower = Towers.grid()[tile.r]?.[tile.c];
    if (!tower) { _hideInfo(); return; }
    const def = C.TOWERS[tower.typeId];
    const panel = document.getElementById('tower-info');
    panel.style.display = 'block';
    document.getElementById('ti-name').textContent  = def.name + ' Lv' + (tower.level + 1);
    document.getElementById('ti-hp').textContent    = Math.ceil(tower.hp) + '/' + tower.maxHp;
    document.getElementById('ti-dmg').textContent   = tower.dmg;
    document.getElementById('ti-range').textContent = tower.range.toFixed(1);
    document.getElementById('ti-rate').textContent  = tower.rate.toFixed(2) + '/s';

    const sellMult = Game.wave === 0 ? 1.0 : 0.5;
    const sellGold = Math.floor(tower.totalCost * sellMult);
    const sellLabel = Game.wave === 0 ? 'Sprzedaj 100% (' + sellGold + 'g)' : 'Sprzedaj 50% (' + sellGold + 'g)';
    document.getElementById('btn-sell').textContent = sellLabel;

    if (tower.level < def.upgrades.length) {
      const up = def.upgrades[tower.level];
      const canUp = Game.gold >= up.cost;
      const btn = document.getElementById('btn-upgrade');
      btn.textContent = 'Ulepsz (' + up.cost + 'g)';
      btn.disabled = !canUp;
    } else {
      const btn = document.getElementById('btn-upgrade');
      btn.textContent = 'MAX poziom';
      btn.disabled = true;
    }
  }

  function _hideInfo() {
    document.getElementById('tower-info').style.display = 'none';
  }

  function hideInfo() { _hideInfo(); }

  function setWaveStatus(text) {
    document.getElementById('wave-status').textContent = text;
  }

  function setStartBtnEnabled(enabled) {
    document.getElementById('btn-start-wave').disabled = !enabled;
  }

  function showFloatingText(text, x, y) {
    floats.push({ text, x, y, life: 1.2, maxLife: 1.2 });
  }

  function update(dt) {
    floats = floats.filter(f => { f.life -= dt; return f.life > 0; });
  }

  function drawFloats(ctx) {
    for (const f of floats) {
      const alpha = f.life / f.maxLife;
      const offsetY = (1 - alpha) * 28;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y - 16 - offsetY);
      ctx.restore();
    }
  }

  return { init, update, updateSidebar, showTowerInfo, hideInfo, setWaveStatus, setStartBtnEnabled, showFloatingText, drawFloats };
})();
