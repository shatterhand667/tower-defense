const UI = (() => {
  let floats = []; // floating text {text, x, y, life, maxLife}

  function init() {
    floats = [];
    _bindSidebar();
  }

  function _buildTooltip(typeId) {
    const def = C.TOWERS[typeId];
    if (!def) return '';
    const facs = (Factions.TOWER_FACTIONS[typeId] || [])
      .map(f => Factions.DEFS[f].icon + ' ' + Factions.DEFS[f].name)
      .join('  ');

    const rows = [];
    if (def.hp)    rows.push(['HP', def.hp]);
    if (def.dmg)   rows.push(['DMG', def.dmg]);
    if (def.dmg && def.rate) rows.push(['DPS', (def.dmg * def.rate).toFixed(1)]);
    if (def.range) rows.push(['Zasięg', def.range.toFixed(1)]);
    if (def.rate)  rows.push(['Szybk.', def.rate.toFixed(2) + '/s']);
    if (def.splash)rows.push(['Splash', def.splash.toFixed(1)]);

    const innates = [];
    if (def.burnDps)       innates.push('Podpalenie ' + def.burnDps + '/s × ' + def.burnDuration + 's');
    if (def.slowMult < 1)  innates.push('Spowalnia do ' + Math.round(def.slowMult * 100) + '%');
    if (def.poisonDps)     innates.push('Trucizna ' + def.poisonDps + '/s × ' + def.poisonDuration + 's');
    if (def.chainTargets)  innates.push('Łańcuch ×' + def.chainTargets);
    if (def.pierce)        innates.push('Przebija wrogów');
    if (def.thorns)        innates.push('Kolce ' + def.thorns + ' DMG');
    if (def.goldInterval)  innates.push('+' + def.goldAmount + 'g co ' + def.goldInterval + 's');
    if (def.obsBonus)      innates.push('+' + Math.round(def.obsBonus * 100) + '% szybk. sąsiad.');
    if (def.tauntRadius)   innates.push('Taunt r=' + def.tauntRadius + ' kafelków');

    return '<div class="tt-name">' + def.name + '  <span style="color:#FFD700">' + def.cost + 'g</span></div>'
      + rows.map(([k, v]) => '<div class="tt-row"><span class="tt-key">' + k + '</span><span class="tt-val">' + v + '</span></div>').join('')
      + (innates.length ? '<div class="tt-innate">' + innates.join('<br>') + '</div>' : '')
      + (facs ? '<div class="tt-fac">' + facs + '</div>' : '');
  }

  function _positionTooltipAt(e) {
    const t = document.getElementById('tower-tooltip');
    const tw = t.offsetWidth || 200;
    const th = t.offsetHeight || 120;
    let left = e.clientX + 12;
    let top  = e.clientY - 10;
    if (left + tw > window.innerWidth  - 8) left = e.clientX - tw - 12;
    if (top  + th > window.innerHeight - 8) top  = window.innerHeight - th - 8;
    t.style.left = left + 'px';
    t.style.top  = top  + 'px';
  }

  function _bindSidebar() {
    const tooltip = document.getElementById('tower-tooltip');

    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (Game.selectedTile) { Game.selectedTile = null; _hideInfo(); }
        Game.selectedTowerType = Game.selectedTowerType === type ? null : type;
        _highlightBtn(Game.selectedTowerType);
      });

      btn.addEventListener('mouseenter', (e) => {
        tooltip.innerHTML = _buildTooltip(btn.dataset.type);
        tooltip.style.display = 'block';
        _positionTooltipAt(e);
      });
      btn.addEventListener('mousemove', _positionTooltipAt);
      btn.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
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

    document.getElementById('btn-sell-all').addEventListener('click', () => {
      Game.sellSelected();
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

  function _buildFactionTooltip(facId, activeTier) {
    const def = Factions.DEFS[facId];
    if (!def) return '';
    let html = `<div class="tt-name">${def.icon} ${def.name}</div>`;
    for (let i = 0; i < def.thresholds.length; i++) {
      const thresh = def.thresholds[i];
      const tierIdx = i + 1;
      const color = TIER_COLORS[tierIdx];
      const label = TIER_NAMES[tierIdx];
      const isActive = activeTier >= tierIdx;
      const opacity = isActive ? '1' : '0.4';
      html += `<div class="tt-row" style="opacity:${opacity};margin-top:3px">` +
        `<span class="tt-key" style="color:${color};min-width:52px">${label} (${thresh})</span>` +
        `<span class="tt-val" style="color:${isActive ? '#e8e8e8' : '#888'}">${def.effects[i]}</span>` +
        `</div>`;
    }
    return html;
  }

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

      const tooltip = document.getElementById('tower-tooltip');
      row.addEventListener('mouseenter', (e) => {
        tooltip.innerHTML = _buildFactionTooltip(facId, tier);
        tooltip.style.display = 'block';
        _positionTooltipAt(e);
      });
      row.addEventListener('mousemove', _positionTooltipAt);
      row.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

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

  function _positionTowerInfo() { _positionPanel('tower-info'); }

  function _refreshInfo(tile) {
    const tower = Towers.grid()[tile.r]?.[tile.c];
    if (!tower) { _hideInfo(); return; }
    const def = C.TOWERS[tower.typeId];
    const panel = document.getElementById('tower-info');
    panel.style.display = 'block';
    _positionTowerInfo();
    const curDps = tower.dmg > 0 && tower.rate > 0 ? tower.dmg * tower.rate : 0;

    // Helper: zwraca ' <span class="ti-up">(→X)</span>' jeśli nowa wartość różni się
    const up = tower.level < def.upgrades.length ? def.upgrades[tower.level] : null;
    const _upHint = (cur, nv, fmt) => {
      if (!up || nv === undefined || nv === cur) return '';
      return ` <span class="ti-up">(→${fmt(nv)})</span>`;
    };

    const newDps = up && (up.dmg || tower.dmg) > 0 && (up.rate || tower.rate) > 0
      ? (up.dmg !== undefined ? up.dmg : tower.dmg) * (up.rate !== undefined ? up.rate : tower.rate) : 0;

    document.getElementById('ti-name').textContent = def.name + ' Lv' + (tower.level + 1);

    document.getElementById('ti-hp').innerHTML =
      (Math.ceil(tower.hp) + '/' + tower.maxHp) + _upHint(tower.maxHp, up?.hp, v => v);

    document.getElementById('ti-dmg').innerHTML =
      (tower.dmg || '—') + _upHint(tower.dmg, up?.dmg, v => v);

    document.getElementById('ti-dps').innerHTML = curDps > 0
      ? curDps.toFixed(1) + _upHint(curDps, newDps || undefined, v => v.toFixed(1))
      : '—';

    document.getElementById('ti-range').innerHTML = tower.range > 0
      ? tower.range.toFixed(1) + _upHint(tower.range, up?.range, v => v.toFixed(1))
      : '—';

    document.getElementById('ti-rate').innerHTML = tower.rate > 0
      ? tower.rate.toFixed(2) + '/s' + _upHint(tower.rate, up?.rate, v => v.toFixed(2) + '/s')
      : '—';

    const sellMult = Game.wave === 0 ? 1.0 : 0.5;
    const sellGold = Math.floor(tower.totalCost * sellMult);
    const sellLabel = Game.wave === 0 ? 'Sprzedaj 100% (' + sellGold + 'g)' : 'Sprzedaj 50% (' + sellGold + 'g)';
    document.getElementById('btn-sell').textContent = sellLabel;

    if (up) {
      const btn = document.getElementById('btn-upgrade');
      btn.textContent = 'Ulepsz (' + up.cost + 'g)';
      btn.disabled = Game.gold < up.cost;
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

  function _positionPanel(panelId) {
    const canvas = document.getElementById('gameCanvas');
    const panel  = document.getElementById(panelId);
    const r = canvas.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.left     = r.left + 'px';
    panel.style.top      = (r.bottom + 8) + 'px';
  }

  function showMultiSelect(tiles) {
    _hideInfo();
    const mult = Game.wave === 0 ? 1.0 : 0.5;
    const totalGold = tiles.reduce((sum, { r, c }) => {
      const t = Towers.grid()[r][c];
      return sum + (t ? Math.floor(t.totalCost * mult) : 0);
    }, 0);
    document.getElementById('ms-info').textContent =
      tiles.length + ' ' + (tiles.length === 1 ? 'wieża zaznaczona' : 'wieże zaznaczone');
    document.getElementById('btn-sell-all').textContent =
      'Sprzedaj wszystkie (' + totalGold + 'g)';
    const panel = document.getElementById('multi-sell-panel');
    panel.style.display = 'block';
    _positionPanel('multi-sell-panel');
  }

  function hideMultiSelect() {
    document.getElementById('multi-sell-panel').style.display = 'none';
  }

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

  return { init, update, updateSidebar, showTowerInfo, hideInfo, setWaveStatus, setStartBtnEnabled, showFloatingText, drawFloats, highlightBtn: _highlightBtn, showMultiSelect, hideMultiSelect };
})();
