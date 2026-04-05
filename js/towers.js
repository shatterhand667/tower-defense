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
      angle: 0,   // barrel angle for drawing
    };
    _grid[r][c] = t;
    _list.push(t);
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
    t.dmg = up.dmg; t.range = up.range; t.rate = up.rate;
    if (up.splash !== undefined) t.splash = up.splash;
    return true;
  }

  function takeDamage(r, c, amount) {
    const t = _grid[r][c];
    if (!t) return false;
    t.hp -= amount;
    if (t.hp <= 0) { _remove(r, c); return true; }
    return false;
  }

  function _remove(r, c) {
    const t = _grid[r][c];
    if (!t) return;
    _grid[r][c] = null;
    _list = _list.filter(x => x !== t);
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

    if (t.typeId === 'WALL') {
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
      // Stone base
      ctx.fillStyle = '#7a6e60';
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);

      // Inner walls detail
      ctx.fillStyle = '#6b5e50';
      ctx.fillRect(x + 2, y + 2, 4, s - 4);
      ctx.fillRect(x + s - 6, y + 2, 4, s - 4);
      ctx.fillRect(x + 2, y + 2, s - 4, 4);
      ctx.fillRect(x + 2, y + s - 6, s - 4, 4);

      // Tower color center
      ctx.fillStyle = def.color;
      ctx.fillRect(x + 8, y + 8, s - 16, s - 16);

      // Barrel (rotated line)
      const cx = x + s/2, cy = y + s/2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t.angle);
      ctx.fillStyle = def.barrelColor;
      ctx.fillRect(-2, -s/2 + 6, 4, s/2 - 6);
      ctx.restore();
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
    canPlace, place, sell, tryUpgrade, takeDamage,
    draw,
  };
})();
