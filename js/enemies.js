class Goblin {
  constructor(spawnRow) {
    this.r = spawnRow;
    this.c = 0;
    this.x = C.T / 2;
    this.y = spawnRow * C.T + C.T / 2;
    this.hp = C.GOBLIN.hp;
    this.maxHp = C.GOBLIN.hp;
    this.speed = C.GOBLIN.speed * C.T; // px/s
    this.path = null;
    this.pathIdx = 0;
    this.state = 'walking'; // walking | attacking | dead | reached
    this.attackTarget = null; // {r,c}
    this.atkTimer = 0;
    this.recalcTimer = 0;
    this.dead = false;
    this.reached = false;
    this.angle = 0; // movement angle for drawing
  }

  _currentTile() {
    return { r: Math.round((this.y - C.T/2) / C.T), c: Math.round((this.x - C.T/2) / C.T) };
  }

  recalcPath() {
    const tile = this._currentTile();
    const clampedR = Math.max(0, Math.min(C.ROWS - 1, tile.r));
    const clampedC = Math.max(0, Math.min(C.COLS - 1, tile.c));
    this.path = Pathfinding.findPath(clampedR, clampedC, Towers.grid());

    if (!this.path) {
      this.pathIdx = 0;
      this.state = 'attacking';
      this._findAttackTarget(clampedR, clampedC);
    } else {
      // Start from index 1 — skip current tile to avoid snapping backwards
      this.pathIdx = this.path.length > 1 ? 1 : 0;
      this.state = 'walking';
      this.attackTarget = null;
    }
  }

  _findAttackTarget(r, c) {
    // Look right from current position in same row first
    for (let cc = c + 1; cc < C.COLS; cc++) {
      if (Towers.grid()[r] && Towers.grid()[r][cc]) {
        this.attackTarget = {r, c: cc};
        return;
      }
    }
    // Fallback: nearest tower
    let best = null, bestD = Infinity;
    for (const t of Towers.list()) {
      const d = Math.abs(t.r - r) + Math.abs(t.c - c);
      if (d < bestD) { bestD = d; best = t; }
    }
    this.attackTarget = best ? {r: best.r, c: best.c} : null;
  }

  update(dt) {
    if (this.dead || this.reached) return;

    // Periodic path recalc
    this.recalcTimer += dt;
    if (this.recalcTimer > 0.5) {
      this.recalcTimer = 0;
      this.recalcPath();
    }

    if (this.state === 'walking') {
      if (!this.path || this.pathIdx >= this.path.length) {
        this.recalcPath();
        return;
      }

      const wp = this.path[this.pathIdx];
      const tx = wp.c * C.T + C.T / 2;
      const ty = wp.r * C.T + C.T / 2;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      this.angle = Math.atan2(dy, dx);

      if (dist < 3) {
        if (Grid.getCell(wp.r, wp.c) === C.CASTLE) {
          this.reached = true;
          return;
        }
        this.pathIdx++;
      } else {
        const move = this.speed * dt;
        this.x += (dx / dist) * move;
        this.y += (dy / dist) * move;
      }

    } else if (this.state === 'attacking') {
      if (!this.attackTarget) { this.recalcPath(); return; }
      if (!Towers.grid()[this.attackTarget.r]?.[this.attackTarget.c]) {
        this.recalcPath(); return;
      }

      this.atkTimer += dt;
      if (this.atkTimer >= 1.0 / C.GOBLIN.atkRate) {
        this.atkTimer = 0;
        Audio.play('goblinAttack');
        const destroyed = Towers.takeDamage(this.attackTarget.r, this.attackTarget.c, C.GOBLIN.dmgToTower);
        if (destroyed) this.recalcPath();
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const x = this.x, y = this.y;
    const r = 9;

    const isAttacking = this.state === 'attacking';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + r - 2, r, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = isAttacking ? '#cc4444' : '#7ab040';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    // Ear triangles
    ctx.fillStyle = isAttacking ? '#aa3333' : '#5a8030';
    ctx.beginPath(); ctx.moveTo(x-7,y-5); ctx.lineTo(x-11,y-12); ctx.lineTo(x-3,y-10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+7,y-5); ctx.lineTo(x+11,y-12); ctx.lineTo(x+3,y-10); ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x-3, y-2, 3, 3.5, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+3, y-2, 3, 3.5,  0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(x-3, y-2, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+3, y-2, 1.5, 0, Math.PI*2); ctx.fill();

    // Attack wrench/weapon when attacking
    if (isAttacking) {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 4);
      ctx.lineTo(x + 14, y + 12);
      ctx.stroke();
    }

    // HP bar
    const bw = 22;
    const pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - bw/2 - 1, y - r - 9, bw + 2, 6);
    ctx.fillStyle = pct > 0.6 ? '#4CAF50' : pct > 0.3 ? '#FFC107' : '#F44336';
    ctx.fillRect(x - bw/2, y - r - 8, bw * pct, 4);
  }
}

const Enemies = (() => {
  let _list = [];

  function init() { _list = []; }

  function spawnGoblin(spawnRow) {
    _list.push(new Goblin(spawnRow));
  }

  function update(dt) {
    for (const e of _list) e.update(dt);
  }

  function draw(ctx) {
    for (const e of _list) e.draw(ctx);
  }

  function removeDeadAndReached() {
    const reached = _list.filter(e => e.reached);
    _list = _list.filter(e => !e.dead && !e.reached);
    return { reached: reached.length };
  }

  function allGone() {
    return _list.every(e => e.dead || e.reached);
  }

  return { init, list: () => _list, spawnGoblin, update, draw, removeDeadAndReached, allGone };
})();
