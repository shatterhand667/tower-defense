const Towers = (() => {
  let _grid = [];  // [row][col] = tower obj or null
  let _list = [];  // flat list

  function init() {
    _grid = Array.from({length: C.ROWS}, () => new Array(C.COLS).fill(null));
    _list = [];
  }

  function canPlace(r, c) {
    return Grid.getCell(r, c) === C.GRASS && !_grid[r][c];
  }

  function place(r, c, typeId) {
    if (!canPlace(r, c)) return null;
    const def = C.TOWERS[typeId];
    const t = {
      r, c, typeId,
      level: 0,
      hp: def.hp, maxHp: def.hp,
      dmg: def.dmg, range: def.range, rate: def.rate, splash: def.splash || 0,
      lastShot: 0,
      totalCost: def.cost,
      angle: 0,
      tauntRadius:    def.tauntRadius   || 0,
      regen:          def.regen         || 0,
      burnDps:        def.burnDps       || 0,
      burnDuration:   def.burnDuration  || 0,
      slowMult:       def.slowMult      || 1,
      slowDuration:   def.slowDuration  || 0,
      poisonDps:      def.poisonDps     || 0,
      poisonDuration: def.poisonDuration|| 0,
      chainTargets:   def.chainTargets  || 0,
      chainRange:     def.chainRange    || 0,
      pierce:         def.pierce        || false,
      thorns:         def.thorns        || 0,
      goldInterval:   def.goldInterval  || 0,
      goldAmount:     def.goldAmount    || 0,
      goldTimer:      0,
      obsRadius:      def.obsRadius     || 0,
      obsBonus:       def.obsBonus      || 0,
      rateBonus:      0,   // filled by _recalcObsBuffs
      baseMaxHp:      def.hp,
      rangeBonus:     0,
      splashBonus:    0,
      shotCount:      0,
      hitCount:       0,
      factionGoldTimer: 0,
    };
    _grid[r][c] = t;
    _list.push(t);
    _recalcAll();
    return t;
  }

  function sell(r, c) {
    const t = _grid[r][c];
    if (!t) return 0;
    const mult = Game.wave === 0 ? 1.0 : 0.5;
    const gold = Math.floor(t.totalCost * mult);
    _remove(r, c);
    return gold;
  }

  function tryUpgrade(r, c) {
    const t = _grid[r][c];
    if (!t) return false;
    const def = C.TOWERS[t.typeId];
    if (t.level >= def.upgrades.length) return false;
    const up = def.upgrades[t.level];
    if (Game.gold < up.cost) return false;
    Game.gold -= up.cost;
    t.totalCost += up.cost;
    t.level++;
    t.hp = up.hp; t.maxHp = up.hp;
    if (up.hp !== undefined) t.baseMaxHp = up.hp;
    t.dmg = up.dmg; t.range = up.range; t.rate = up.rate;
    if (up.splash       !== undefined) t.splash       = up.splash;
    if (up.tauntRadius  !== undefined) t.tauntRadius  = up.tauntRadius;
    if (up.burnDps      !== undefined) t.burnDps      = up.burnDps;
    if (up.burnDuration !== undefined) t.burnDuration = up.burnDuration;
    if (up.slowMult     !== undefined) t.slowMult     = up.slowMult;
    if (up.slowDuration !== undefined) t.slowDuration = up.slowDuration;
    if (up.poisonDps    !== undefined) t.poisonDps    = up.poisonDps;
    if (up.poisonDuration!==undefined) t.poisonDuration = up.poisonDuration;
    if (up.chainTargets !== undefined) t.chainTargets = up.chainTargets;
    if (up.chainRange   !== undefined) t.chainRange   = up.chainRange;
    if (up.thorns       !== undefined) t.thorns       = up.thorns;
    if (up.goldInterval !== undefined) t.goldInterval = up.goldInterval;
    if (up.goldAmount   !== undefined) t.goldAmount   = up.goldAmount;
    if (up.obsRadius    !== undefined) t.obsRadius    = up.obsRadius;
    if (up.obsBonus     !== undefined) t.obsBonus     = up.obsBonus;
    _recalcAll();
    return true;
  }

  // Przywraca HP wszystkich Golemów do maksimum (wywoływane po zakończeniu fali)
  function repairGolems() {
    for (const t of _list) {
      if (t.typeId === 'GOLEM') t.hp = t.maxHp;
    }
  }

  function takeDamage(r, c, amount) {
    const t = _grid[r][c];
    if (!t) return false;
    t.hp -= amount;
    if (t.hp <= 0) {
      // FORTECA Gold: destroyed wall/Golem/Bastion explodes (60 DMG, radius 1.5 tiles)
      if (Factions.tier('FORTECA') >= 3) {
        const eligible = ['WALL', 'MUR_KOLCZASTY', 'GOLEM', 'BASTION'];
        if (eligible.includes(t.typeId)) {
          const ex = t.c * C.T + C.T / 2, ey = t.r * C.T + C.T / 2;
          const r2 = 1.5 * C.T;
          for (const e of Enemies.list()) {
            if (e.dead || e.reached) continue;
            const dx = e.x - ex, dy = e.y - ey;
            if (Math.sqrt(dx*dx + dy*dy) <= r2) e.takeDamage(60, 'splash');
          }
        }
      }
      _remove(r, c);
      return true;
    }
    return false;
  }

  function _remove(r, c) {
    const t = _grid[r][c];
    if (!t) return;
    _grid[r][c] = null;
    _list = _list.filter(x => x !== t);
    _recalcAll();
  }

  function thornsDmg(r, c) {
    const t = _grid[r][c];
    return (t && t.thorns) ? t.thorns : 0;
  }

  // Recalculates rateBonus for every tower based on adjacent observatories
  function _recalcObsBuffs() {
    for (const t of _list) t.rateBonus = 0;
    for (const obs of _list) {
      if (obs.typeId !== 'WIEZA_OBS' || obs.obsBonus === 0) continue;
      const radiusPx = obs.obsRadius * C.T;
      const ox = obs.c * C.T + C.T / 2;
      const oy = obs.r * C.T + C.T / 2;
      for (const t of _list) {
        if (t === obs) continue;
        const tx = t.c * C.T + C.T / 2;
        const ty = t.r * C.T + C.T / 2;
        const d = Math.sqrt((tx - ox) ** 2 + (ty - oy) ** 2);
        if (d <= radiusPx) t.rateBonus += obs.obsBonus;
      }
    }
  }

  function _recalcAll() {
    Factions.recalc(_list.map(t => t.typeId));
    _recalcObsBuffs();
    _recalcFactionBuffs();
  }

  function _recalcFactionBuffs() {
    // Reset rangeBonus and splashBonus for all towers first
    for (const t of _list) {
      t.rangeBonus  = 0;
      t.splashBonus = 0;
    }

    // PRECYZJA Bronze (tier≥1): +25% range for PRECYZJA towers
    for (const t of _list) {
      const facs = Factions.TOWER_FACTIONS[t.typeId] || [];
      if (facs.includes('PRECYZJA')) {
        t.rangeBonus = Factions.tier('PRECYZJA') >= 1 ? 0.25 : 0;
      }
    }

    // DESTRUKCJA Bronze (tier≥1): +40% splash for DESTRUKCJA towers
    for (const t of _list) {
      const facs = Factions.TOWER_FACTIONS[t.typeId] || [];
      if (facs.includes('DESTRUKCJA')) {
        t.splashBonus = Factions.tier('DESTRUKCJA') >= 1 ? 0.4 : 0;
      }
    }

    // FORTECA Bronze (tier≥1): ×2 maxHp for WALL, MUR_KOLCZASTY, GOLEM
    const fortecaTypes = ['WALL', 'MUR_KOLCZASTY', 'GOLEM'];
    for (const t of _list) {
      if (!fortecaTypes.includes(t.typeId)) continue;
      if (Factions.tier('FORTECA') >= 1) {
        const ratio = t.hp / t.maxHp;
        t.maxHp = t.baseMaxHp * 2;
        t.hp = t.maxHp * ratio;
      } else {
        const ratio = t.hp / t.maxHp;
        t.maxHp = t.baseMaxHp;
        t.hp = Math.min(t.hp, t.maxHp);
      }
    }
  }

  // Passive per-frame updates: Mennica gold generation + BOGACTWO Gold
  function updatePassives(dt) {
    for (const t of _list) {
      if (t.typeId === 'MENNICA' && t.goldInterval > 0) {
        t.goldTimer += dt;
        if (t.goldTimer >= t.goldInterval) {
          t.goldTimer -= t.goldInterval;
          Game.gold += t.goldAmount;
          UI.showFloatingText('+' + t.goldAmount + 'g', t.c * C.T + C.T / 2, t.r * C.T);
          UI.updateSidebar();
        }
      }
    }

    // BOGACTWO Gold (tier≥3): BOGACTWO faction towers generate 1g per 10s
    if (Factions.tier('BOGACTWO') >= 3) {
      const bogTowers = ['KATAPULTA', 'KUSZNIK', 'WIEZA_OBS', 'MENNICA'];
      for (const t of _list) {
        if (!bogTowers.includes(t.typeId)) continue;
        t.factionGoldTimer += dt;
        if (t.factionGoldTimer >= 10) {
          t.factionGoldTimer -= 10;
          Game.gold += 1;
          UI.showFloatingText('+1g', t.c * C.T + C.T / 2, t.r * C.T);
        }
      }
    }
  }

  function draw(ctx, selectedTile) {
    for (const t of _list) _drawTower(ctx, t, selectedTile);
  }

  function _drawTower(ctx, t, selTile) {
    const x = t.c * C.T, y = t.r * C.T, s = C.T;
    const def = C.TOWERS[t.typeId];
    const sel = selTile && selTile.r === t.r && selTile.c === t.c;

    // Selection ring
    if (sel) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    }

    if (t.typeId === 'GOLEM') {
      const cx = x + s/2, cy = y + s/2;
      // Kamienny korpus
      ctx.fillStyle = '#5a6040';
      ctx.fillRect(x + 3, y + 6, s - 6, s - 8);
      // Mech — zielone plamy
      ctx.fillStyle = '#3a6a20';
      ctx.beginPath(); ctx.arc(x + 7,  y + 10, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s-8, y + s-10, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 10, y + s-8, 3, 0, Math.PI*2); ctx.fill();
      // Twarz
      ctx.fillStyle = '#4a5030';
      ctx.fillRect(x + 8, y + 8, s - 16, 12);
      // Świecące oczy (zielone)
      ctx.fillStyle = '#88ff44';
      ctx.beginPath(); ctx.arc(cx - 5, y + 13, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, y + 13, 2.5, 0, Math.PI*2); ctx.fill();
      // Kontur
      ctx.strokeStyle = '#2a3020';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, y + 6, s - 6, s - 8);
      // Aura taunt (słaby krąg)
      ctx.strokeStyle = 'rgba(136,255,68,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, t.tauntRadius * C.T, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (t.typeId === 'MUR_KOLCZASTY') {
      // Mur z kolcami
      ctx.fillStyle = '#556644';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = '#334422';
      ctx.fillRect(x + 1,   y + 1,   s/2-1, s/2-1);
      ctx.fillRect(x + s/2, y + s/2, s/2-1, s/2-1);
      ctx.strokeStyle = '#223311';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      // Kolce
      ctx.fillStyle = '#aabbaa';
      const spikes = [[4,1],[10,1],[16,1],[22,1],[28,1],[1,8],[31,8],[1,16],[31,16],[4,31],[10,31],[16,31],[22,31],[28,31]];
      for (const [sx, sy] of spikes) {
        ctx.beginPath(); ctx.moveTo(x+sx, y+sy+4); ctx.lineTo(x+sx-2, y+sy-2); ctx.lineTo(x+sx+2, y+sy-2); ctx.closePath(); ctx.fill();
      }
    } else if (t.typeId === 'MENNICA') {
      // Złota mennica
      ctx.fillStyle = '#2a2200';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.strokeStyle = '#aa8800';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
      // Monety
      for (const [ox, oy] of [[8,10],[16,8],[24,10],[12,18],[20,18],[8,24],[24,24]]) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(x + ox, y + oy, 4, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#aa8800'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(x + ox, y + oy, 4, 0, Math.PI*2); ctx.stroke();
      }
    } else if (t.typeId === 'WIEZA_OBS') {
      // Wieża obserwacyjna
      ctx.fillStyle = '#667755';
      ctx.fillRect(x + 4, y + 10, s - 8, s - 12);
      // Platforma
      ctx.fillStyle = '#aabb88';
      ctx.fillRect(x + 2, y + 6, s - 4, 6);
      // Teleskop
      ctx.fillStyle = '#778866';
      ctx.fillRect(x + s/2 - 2, y + 2, 4, 8);
      ctx.fillStyle = '#99aa77';
      ctx.fillRect(x + s/2 - 4, y + 2, 8, 3);
      ctx.strokeStyle = '#334422'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 10, s - 8, s - 12);
      // Aura buffa (słaba)
      if (t.obsBonus > 0) {
        ctx.strokeStyle = 'rgba(170,220,120,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.arc(x + s/2, y + s/2, t.obsRadius * C.T, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (t.typeId === 'WALL') {
      // Solid stone wall block
      ctx.fillStyle = '#8a7e6e';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      // Brick pattern
      ctx.fillStyle = '#7a6e5e';
      ctx.fillRect(x + 1,      y + 1,      s/2 - 1, s/2 - 1);
      ctx.fillRect(x + s/2,    y + s/2,    s/2 - 1, s/2 - 1);
      ctx.strokeStyle = '#5a5040';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.beginPath();
      ctx.moveTo(x + s/2, y + 1); ctx.lineTo(x + s/2, y + s - 1);
      ctx.moveTo(x + 1, y + s/2); ctx.lineTo(x + s - 1, y + s/2);
      ctx.stroke();
    } else {
      const cx = x + s/2, cy = y + s/2;

      if (t.typeId === 'WIEZA_OGNIA') {
        // Czerwono-czarna wieża z płomieniami
        ctx.fillStyle = '#331100'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = def.color; ctx.fillRect(x+7, y+7, s-14, s-14);
        ctx.fillStyle = '#ff6600';
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
      } else if (t.typeId === 'WIEZA_LODU') {
        // Niebiesko-biała wieża z kryształami
        ctx.fillStyle = '#001133'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = def.color; ctx.fillRect(x+7, y+7, s-14, s-14);
        // Kryształ
        ctx.fillStyle = '#aaddff';
        ctx.beginPath(); ctx.moveTo(cx, y+4); ctx.lineTo(cx+6, cy); ctx.lineTo(cx, y+s-4); ctx.lineTo(cx-6, cy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke();
      } else if (t.typeId === 'WIEZA_TRUCIZNY') {
        ctx.fillStyle = '#112200'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = def.color; ctx.fillRect(x+7, y+7, s-14, s-14);
        // Kolba z trucizną
        ctx.fillStyle = '#44ff44';
        ctx.beginPath(); ctx.arc(cx, cy+1, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#226600';
        ctx.fillRect(cx-2, y+6, 4, 8);
        ctx.fillStyle = '#33aa22';
        ctx.beginPath(); ctx.arc(cx, cy+1, 3, 0, Math.PI*2); ctx.fill();
      } else if (t.typeId === 'WIEZA_BLYSK') {
        ctx.fillStyle = '#221100'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = def.color; ctx.fillRect(x+7, y+7, s-14, s-14);
        // Błyskawica
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx+2, y+5); ctx.lineTo(cx-2, cy); ctx.lineTo(cx+3, cy); ctx.lineTo(cx-2, y+s-5); ctx.stroke();
        ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx+2, y+5); ctx.lineTo(cx-2, cy); ctx.lineTo(cx+3, cy); ctx.lineTo(cx-2, y+s-5); ctx.stroke();
      } else if (t.typeId === 'BALISTOR') {
        ctx.fillStyle = '#221100'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = def.color; ctx.fillRect(x+6, y+6, s-12, s-12);
        // Długa belka/balista
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t.angle);
        ctx.fillStyle = def.barrelColor; ctx.fillRect(-3, -s/2+3, 6, s/2-3);
        ctx.fillStyle = '#886644'; ctx.fillRect(-5, -4, 10, 5); // łuk
        ctx.restore();
      } else if (t.typeId === 'KATAPULTA') {
        ctx.fillStyle = '#332211'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = def.color; ctx.fillRect(x+6, y+6, s-12, s-12);
        // Ramię katapulty
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t.angle);
        ctx.fillStyle = def.barrelColor; ctx.fillRect(-2, -s/2+3, 4, s-6);
        ctx.fillStyle = '#663300';
        ctx.beginPath(); ctx.arc(0, -s/2+5, 5, 0, Math.PI*2); ctx.fill(); // głaz
        ctx.restore();
      } else if (t.typeId === 'WIEZA_CIENIA') {
        ctx.fillStyle = '#110022'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = def.color; ctx.fillRect(x+7, y+7, s-14, s-14);
        // Mroczny portal
        ctx.fillStyle = '#220033';
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#aa44ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2); ctx.stroke();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t.angle);
        ctx.fillStyle = def.barrelColor; ctx.fillRect(-2, -s/2+5, 4, s/2-5);
        ctx.restore();
      } else if (t.typeId === 'BASTION') {
        // Masywny bastion — szeroki, niski
        ctx.fillStyle = '#445566'; ctx.fillRect(x+1, y+2, s-2, s-4);
        ctx.fillStyle = '#667788'; ctx.fillRect(x+4, y+5, s-8, s-10);
        // Blanki
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = '#556677';
          ctx.fillRect(x + 3 + i*8, y+1, 5, 5);
        }
        // Szczeliny w murze
        ctx.fillStyle = '#334455';
        ctx.fillRect(x+8,  y+12, 3, 8);
        ctx.fillRect(x+21, y+12, 3, 8);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t.angle);
        ctx.fillStyle = def.barrelColor; ctx.fillRect(-2, -s/2+7, 4, s/2-7);
        ctx.restore();
      } else {
        // Stone base (default: ARCHER, CANNON, SNIPER, KUSZNIK)
        ctx.fillStyle = '#7a6e60'; ctx.fillRect(x+2, y+2, s-4, s-4);
        ctx.fillStyle = '#6b5e50';
        ctx.fillRect(x+2, y+2, 4, s-4); ctx.fillRect(x+s-6, y+2, 4, s-4);
        ctx.fillRect(x+2, y+2, s-4, 4); ctx.fillRect(x+2, y+s-6, s-4, 4);
        ctx.fillStyle = def.color; ctx.fillRect(x+8, y+8, s-16, s-16);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t.angle);
        ctx.fillStyle = def.barrelColor; ctx.fillRect(-2, -s/2+6, 4, s/2-6);
        ctx.restore();
      }
    }

    // Level stars
    for (let i = 0; i < t.level; i++) {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(x + 8 + i * 9, y + s - 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar (only when damaged)
    if (t.hp < t.maxHp) {
      const pct = t.hp / t.maxHp;
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 2, y + s - 5, s - 4, 3);
      ctx.fillStyle = pct > 0.5 ? '#4CAF50' : '#F44336';
      ctx.fillRect(x + 2, y + s - 5, (s - 4) * pct, 3);
    }
  }

  return {
    init,
    grid: () => _grid,
    list: () => _list,
    canPlace, place, sell, tryUpgrade, takeDamage, repairGolems,
    thornsDmg, updatePassives,
    draw,
  };
})();
