class Goblin {
  constructor(spawnR, spawnC) {
    this.r = spawnR;
    this.c = spawnC;
    this.x = spawnC * C.T + C.T / 2;
    this.y = spawnR * C.T + C.T / 2;
    this.type   = 'goblin';
    this.reward = C.GOBLIN.reward;
    this.hp = C.GOBLIN.hp;
    this.maxHp = C.GOBLIN.hp;
    this.speed = C.GOBLIN.speed * C.T;
    this.dmgToTower  = C.GOBLIN.dmgToTower;
    this.atkRate     = C.GOBLIN.atkRate;
    this.dmgToCastle = C.GOBLIN.dmgToCastle;
    this.path = null;
    this.pathIdx = 0;
    this.state = 'walking';
    this.attackTarget = null;
    this.atkTimer = 0;
    this.recalcTimer = 0;
    this.dead = false;
    this.reached = false;
    this.angle = 0;
    this.walkPhase = 0;
    this.armor = C.GOBLIN.armor;
    this.regen  = C.GOBLIN.regen;
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

  _checkTaunt() {
    for (const tower of Towers.list()) {
      if (tower.typeId !== 'GOLEM' || tower.hp <= 0) continue;
      const tx = tower.c * C.T + C.T / 2;
      const ty = tower.r * C.T + C.T / 2;
      const dx = this.x - tx, dy = this.y - ty;
      if (Math.sqrt(dx*dx + dy*dy) <= tower.tauntRadius * C.T) {
        this.state = 'attacking';
        this.attackTarget = { r: tower.r, c: tower.c };
        return true;
      }
    }
    return false;
  }

  update(dt) {
    if (this.dead || this.reached) return;

    if (this.regen > 0 && this.hp < this.maxHp)
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    // Periodic path recalc + taunt check
    this.recalcTimer += dt;
    if (this.recalcTimer > 0.5) {
      this.recalcTimer = 0;
      if (!this._checkTaunt()) this.recalcPath();
    }

    if (this.state === 'walking') {
      this._checkTaunt();
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

      this.walkPhase += dt * 8;

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
      if (this.atkTimer >= 1.0 / this.atkRate) {
        this.atkTimer = 0;
        Audio.play('goblinAttack');
        const destroyed = Towers.takeDamage(this.attackTarget.r, this.attackTarget.c, this.dmgToTower);
        if (destroyed) this.recalcPath();
      }
    }
  }

  takeDamage(amount, dmgType = 'normal') {
    const armorDef = C.ARMOR[this.armor] || C.ARMOR.NONE;
    const mult = dmgType === 'pierce' ? armorDef.pierceMult
               : dmgType === 'splash' ? armorDef.splashMult
               : 1.0;
    this.hp -= amount * mult;
    if (this.hp <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const x = this.x, y = this.y;

    const isWalking  = this.state === 'walking';
    const isAttacking = this.state === 'attacking';
    const wp = this.walkPhase;

    // animation values
    const legSwing = isWalking ? Math.sin(wp) * 4 : 0;
    const armSwing = isWalking ? Math.sin(wp + Math.PI) * 3 : 0; // przeciwnie do nóg
    const headBob  = isWalking ? Math.abs(Math.sin(wp)) * 1 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3d7015';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 2, y + 3); ctx.lineTo(x - 2 - legSwing, y + 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2, y + 3); ctx.lineTo(x + 2 + legSwing, y + 9); ctx.stroke();

    // Torso
    ctx.fillStyle = '#4d8c1a';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms + club
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#3d7015';
    if (isAttacking) {
      // prawa ręka uniesiona z maczugą
      ctx.beginPath(); ctx.moveTo(x + 4, y - 5); ctx.lineTo(x + 11, y - 13); ctx.stroke();
      ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x + 11, y - 13); ctx.lineTo(x + 14, y - 19); ctx.stroke();
      ctx.fillStyle = '#4a2800';
      ctx.beginPath(); ctx.arc(x + 15, y - 20, 4, 0, Math.PI * 2); ctx.fill();
      // lewa ręka w dół
      ctx.strokeStyle = '#3d7015'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 4, y - 5); ctx.lineTo(x - 9, y - 2); ctx.stroke();
    } else {
      // lewa ręka (huśta się)
      ctx.beginPath(); ctx.moveTo(x - 4, y - 5); ctx.lineTo(x - 9, y - 1 + armSwing); ctx.stroke();
      // prawa ręka z maczugą
      ctx.beginPath(); ctx.moveTo(x + 4, y - 5); ctx.lineTo(x + 9, y - 1 - armSwing); ctx.stroke();
      ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 9, y - 1 - armSwing); ctx.lineTo(x + 12, y + 3 - armSwing); ctx.stroke();
      ctx.fillStyle = '#4a2800';
      ctx.beginPath(); ctx.arc(x + 13, y + 4 - armSwing, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Head
    const hy = y - 10 - headBob;
    ctx.fillStyle = isAttacking ? '#cc5520' : '#5aaa20';
    ctx.beginPath();
    ctx.ellipse(x, hy, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointy ears
    const earCol = isAttacking ? '#aa3300' : '#3a8010';
    ctx.fillStyle = earCol;
    ctx.beginPath(); ctx.moveTo(x-6,hy-1); ctx.lineTo(x-13,hy-8); ctx.lineTo(x-3,hy-5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+6,hy-1); ctx.lineTo(x+13,hy-8); ctx.lineTo(x+3,hy-5); ctx.closePath(); ctx.fill();

    // Angry brow
    ctx.strokeStyle = '#1a4500'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x-6, hy-3); ctx.lineTo(x-2, hy-2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+6, hy-3); ctx.lineTo(x+2, hy-2); ctx.stroke();

    // Eyes (red + pupil)
    ctx.fillStyle = '#ff3300';
    ctx.beginPath(); ctx.ellipse(x-3, hy, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+3, hy, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#110000';
    ctx.beginPath(); ctx.arc(x-3, hy, 1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+3, hy, 1, 0, Math.PI*2); ctx.fill();

    // Hooked nose
    ctx.strokeStyle = '#2a5a00'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, hy+1);
    ctx.quadraticCurveTo(x+3, hy+2, x+2, hy+4);
    ctx.stroke();

    // Mouth + fangs
    ctx.strokeStyle = '#1a3500'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x-4, hy+4);
    ctx.quadraticCurveTo(x, hy+6, x+4, hy+4);
    ctx.stroke();
    ctx.fillStyle = '#ddddcc';
    ctx.beginPath(); ctx.moveTo(x-2,hy+4); ctx.lineTo(x-1,hy+7); ctx.lineTo(x,  hy+4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+1, hy+4); ctx.lineTo(x+2, hy+7); ctx.lineTo(x+3,hy+4); ctx.fill();

    // HP bar
    const bw = 22;
    const pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - bw/2 - 1, y - 22, bw + 2, 5);
    ctx.fillStyle = pct > 0.6 ? '#4CAF50' : pct > 0.3 ? '#FFC107' : '#F44336';
    ctx.fillRect(x - bw/2, y - 21, bw * pct, 3);
  }
}

// ─── Drzewiec (Mini Boss Tier 2) ─────────────────────────────────────────────
class Drzewiec {
  constructor(spawnR, spawnC) {
    this.type   = 'drzewiec';
    this.reward = C.DRZEWIEC.reward;
    this.r = spawnR; this.c = spawnC;
    this.x = spawnC * C.T + C.T / 2;
    this.y = spawnR * C.T + C.T / 2;
    this.hp = C.DRZEWIEC.hp; this.maxHp = C.DRZEWIEC.hp;
    this.speed       = C.DRZEWIEC.speed * C.T;
    this.dmgToTower  = C.DRZEWIEC.dmgToTower;
    this.atkRate     = C.DRZEWIEC.atkRate;
    this.dmgToCastle = C.DRZEWIEC.dmgToCastle;
    this.path = null; this.pathIdx = 0;
    this.state = 'walking';
    this.attackTarget = null;
    this.atkTimer = 0; this.recalcTimer = 0;
    this.dead = false; this.reached = false;
    this.angle = 0;
    this.walkPhase = 0;
    this.armor = C.DRZEWIEC.armor;
    this.regen  = C.DRZEWIEC.regen;
  }

  _currentTile() {
    return { r: Math.round((this.y - C.T/2) / C.T), c: Math.round((this.x - C.T/2) / C.T) };
  }
  recalcPath() {
    const tile = this._currentTile();
    const cr = Math.max(0, Math.min(C.ROWS-1, tile.r));
    const cc = Math.max(0, Math.min(C.COLS-1, tile.c));
    this.path = Pathfinding.findPath(cr, cc, Towers.grid());
    if (!this.path) {
      this.pathIdx = 0; this.state = 'attacking';
      this._findAttackTarget(cr, cc);
    } else {
      this.pathIdx = this.path.length > 1 ? 1 : 0;
      this.state = 'walking'; this.attackTarget = null;
    }
  }
  _checkTaunt() {
    for (const tower of Towers.list()) {
      if (tower.typeId !== 'GOLEM' || tower.hp <= 0) continue;
      const tx = tower.c * C.T + C.T / 2;
      const ty = tower.r * C.T + C.T / 2;
      const dx = this.x - tx, dy = this.y - ty;
      if (Math.sqrt(dx*dx + dy*dy) <= tower.tauntRadius * C.T) {
        this.state = 'attacking';
        this.attackTarget = { r: tower.r, c: tower.c };
        return true;
      }
    }
    return false;
  }
  _findAttackTarget(r, c) {
    for (let cc = c + 1; cc < C.COLS; cc++) {
      if (Towers.grid()[r]?.[cc]) { this.attackTarget = {r, c: cc}; return; }
    }
    let best = null, bestD = Infinity;
    for (const t of Towers.list()) {
      const d = Math.abs(t.r - r) + Math.abs(t.c - c);
      if (d < bestD) { bestD = d; best = t; }
    }
    this.attackTarget = best ? {r: best.r, c: best.c} : null;
  }

  update(dt) {
    if (this.dead || this.reached) return;
    if (this.regen > 0 && this.hp < this.maxHp)
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    this.walkPhase += dt * 3;
    this.recalcTimer += dt;
    if (this.recalcTimer > 0.5) { this.recalcTimer = 0; if (!this._checkTaunt()) this.recalcPath(); }

    if (this.state === 'walking') {
      if (!this.path || this.pathIdx >= this.path.length) { this.recalcPath(); return; }
      const wp = this.path[this.pathIdx];
      const tx = wp.c * C.T + C.T/2, ty = wp.r * C.T + C.T/2;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      this.angle = Math.atan2(dy, dx);
      if (dist < 3) {
        if (Grid.getCell(wp.r, wp.c) === C.CASTLE) { this.reached = true; return; }
        this.pathIdx++;
      } else {
        const m = this.speed * dt;
        this.x += (dx/dist) * m; this.y += (dy/dist) * m;
      }
    } else if (this.state === 'attacking') {
      if (!this.attackTarget) { this.recalcPath(); return; }
      if (!Towers.grid()[this.attackTarget.r]?.[this.attackTarget.c]) { this.recalcPath(); return; }
      this.atkTimer += dt;
      if (this.atkTimer >= 1.0 / this.atkRate) {
        this.atkTimer = 0;
        Audio.play('goblinAttack');
        const destroyed = Towers.takeDamage(this.attackTarget.r, this.attackTarget.c, this.dmgToTower);
        if (destroyed) this.recalcPath();
      }
    }
  }

  takeDamage(amount, dmgType = 'normal') {
    const armorDef = C.ARMOR[this.armor] || C.ARMOR.NONE;
    const mult = dmgType === 'pierce' ? armorDef.pierceMult
               : dmgType === 'splash' ? armorDef.splashMult
               : 1.0;
    this.hp -= amount * mult;
    if (this.hp <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const x = this.x, y = this.y;
    const sway = Math.sin(this.walkPhase) * (this.state === 'walking' ? 3 : 0);

    // Korzenie / nogi
    ctx.strokeStyle = '#3d1f00'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 5, y + 10); ctx.lineTo(x - 9 + sway, y + 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 5, y + 10); ctx.lineTo(x + 9 - sway, y + 17); ctx.stroke();

    // Tułów
    ctx.fillStyle = '#5a2e0a';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
    // Słoje
    ctx.strokeStyle = '#3d1f00'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y + 2, 6, 9, 0, 0, Math.PI * 2); ctx.stroke();

    // Ramiona / gałęzie
    ctx.strokeStyle = '#4a2500'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 8, y - 2); ctx.lineTo(x - 16 - sway, y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 8, y - 2); ctx.lineTo(x + 16 + sway, y - 8); ctx.stroke();
    // Liście na gałęziach
    ctx.fillStyle = '#2d6b1a';
    ctx.beginPath(); ctx.arc(x - 17 - sway, y - 10, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 17 + sway, y - 10, 5, 0, Math.PI*2); ctx.fill();

    // Korona z liści
    ctx.fillStyle = '#1e5c0e';
    ctx.beginPath(); ctx.arc(x, y - 14, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2d7a1a';
    ctx.beginPath(); ctx.arc(x - 7, y - 17, 9, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7, y - 17, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3a8f22';
    ctx.beginPath(); ctx.arc(x, y - 22, 8, 0, Math.PI*2); ctx.fill();

    // Oczy (bursztynowe)
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath(); ctx.arc(x - 4, y - 2, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y - 2, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(x - 4, y - 2, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y - 2, 1.8, 0, Math.PI*2); ctx.fill();

    // Usta — krzywy grymas
    ctx.strokeStyle = '#2a0f00'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 4); ctx.quadraticCurveTo(x, y + 7, x + 4, y + 4);
    ctx.stroke();

    // HP bar
    const bw = 28, pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - bw/2 - 1, y - 39, bw + 2, 6);
    ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FFC107' : '#F44336';
    ctx.fillRect(x - bw/2, y - 38, bw * pct, 4);
  }
}

// ─── Anakonda Cesarska (Mini Boss) ───────────────────────────────────────────
class Anaconda {
  constructor(spawnR, spawnC) {
    this.type   = 'anaconda';
    this.reward = C.ANACONDA.reward;
    this.r = spawnR; this.c = spawnC;
    this.x = spawnC * C.T + C.T / 2;
    this.y = spawnR * C.T + C.T / 2;
    this.hp = C.ANACONDA.hp; this.maxHp = C.ANACONDA.hp;
    this.speed       = C.ANACONDA.speed * C.T;
    this.dmgToTower  = C.ANACONDA.dmgToTower;
    this.atkRate     = C.ANACONDA.atkRate;
    this.dmgToCastle = C.ANACONDA.dmgToCastle;
    this.path = null; this.pathIdx = 0;
    this.state = 'walking';
    this.attackTarget = null;
    this.atkTimer = 0; this.recalcTimer = 0;
    this.dead = false; this.reached = false;
    this.angle = 0;
    this.posHistory = [{x: this.x, y: this.y}];
    this.armor = C.ANACONDA.armor;
    this.regen  = C.ANACONDA.regen;
  }

  // Metody ruchu identyczne z Goblin — reużycie przez kopiowanie
  _currentTile() {
    return { r: Math.round((this.y - C.T/2) / C.T), c: Math.round((this.x - C.T/2) / C.T) };
  }
  recalcPath() {
    const tile = this._currentTile();
    const cr = Math.max(0, Math.min(C.ROWS-1, tile.r));
    const cc = Math.max(0, Math.min(C.COLS-1, tile.c));
    this.path = Pathfinding.findPath(cr, cc, Towers.grid());
    if (!this.path) {
      this.pathIdx = 0; this.state = 'attacking';
      this._findAttackTarget(cr, cc);
    } else {
      this.pathIdx = this.path.length > 1 ? 1 : 0;
      this.state = 'walking'; this.attackTarget = null;
    }
  }
  _checkTaunt() {
    for (const tower of Towers.list()) {
      if (tower.typeId !== 'GOLEM' || tower.hp <= 0) continue;
      const tx = tower.c * C.T + C.T / 2;
      const ty = tower.r * C.T + C.T / 2;
      const dx = this.x - tx, dy = this.y - ty;
      if (Math.sqrt(dx*dx + dy*dy) <= tower.tauntRadius * C.T) {
        this.state = 'attacking';
        this.attackTarget = { r: tower.r, c: tower.c };
        return true;
      }
    }
    return false;
  }
  _findAttackTarget(r, c) {
    for (let cc = c + 1; cc < C.COLS; cc++) {
      if (Towers.grid()[r]?.[cc]) { this.attackTarget = {r, c: cc}; return; }
    }
    let best = null, bestD = Infinity;
    for (const t of Towers.list()) {
      const d = Math.abs(t.r - r) + Math.abs(t.c - c);
      if (d < bestD) { bestD = d; best = t; }
    }
    this.attackTarget = best ? {r: best.r, c: best.c} : null;
  }

  update(dt) {
    if (this.dead || this.reached) return;
    if (this.regen > 0 && this.hp < this.maxHp)
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    this.posHistory.unshift({x: this.x, y: this.y});
    if (this.posHistory.length > 120) this.posHistory.length = 120;

    this.recalcTimer += dt;
    if (this.recalcTimer > 0.5) { this.recalcTimer = 0; if (!this._checkTaunt()) this.recalcPath(); }

    if (this.state === 'walking') {
      if (!this.path || this.pathIdx >= this.path.length) { this.recalcPath(); return; }
      const wp = this.path[this.pathIdx];
      const tx = wp.c * C.T + C.T/2, ty = wp.r * C.T + C.T/2;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      this.angle = Math.atan2(dy, dx);
      if (dist < 3) {
        if (Grid.getCell(wp.r, wp.c) === C.CASTLE) { this.reached = true; return; }
        this.pathIdx++;
      } else {
        const m = this.speed * dt;
        this.x += (dx/dist) * m; this.y += (dy/dist) * m;
      }
    } else if (this.state === 'attacking') {
      if (!this.attackTarget) { this.recalcPath(); return; }
      if (!Towers.grid()[this.attackTarget.r]?.[this.attackTarget.c]) { this.recalcPath(); return; }
      this.atkTimer += dt;
      if (this.atkTimer >= 1.0 / this.atkRate) {
        this.atkTimer = 0;
        Audio.play('goblinAttack');
        const destroyed = Towers.takeDamage(this.attackTarget.r, this.attackTarget.c, this.dmgToTower);
        if (destroyed) this.recalcPath();
      }
    }
  }

  takeDamage(amount, dmgType = 'normal') {
    const armorDef = C.ARMOR[this.armor] || C.ARMOR.NONE;
    const mult = dmgType === 'pierce' ? armorDef.pierceMult
               : dmgType === 'splash' ? armorDef.splashMult
               : 1.0;
    this.hp -= amount * mult;
    if (this.hp <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const SEGS = 7, SPACING = 14;

    // Ogon (od tyłu do przodu, żeby głowa była na wierzchu)
    for (let i = SEGS - 1; i >= 1; i--) {
      const histIdx = Math.min(i * SPACING, this.posHistory.length - 1);
      const p = this.posHistory[histIdx] || {x: this.x, y: this.y};
      const t = i / SEGS; // 0=blisko głowy, 1=koniec ogona
      const r = 10 - i * 0.9;
      ctx.fillStyle = t < 0.5 ? '#1a5c1a' : '#0d3d0d';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      // Wzór — żółte plamki
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(200,180,0,0.5)';
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Głowa
    const hx = this.x, hy = this.y;
    ctx.fillStyle = this.state === 'attacking' ? '#8b0000' : '#1e7a1e';
    ctx.beginPath(); ctx.ellipse(hx, hy, 13, 10, this.angle, 0, Math.PI * 2); ctx.fill();

    // Oczy
    const ex = Math.cos(this.angle - 0.6) * 7, ey = Math.sin(this.angle - 0.6) * 7;
    const ex2 = Math.cos(this.angle + 0.6) * 7, ey2 = Math.sin(this.angle + 0.6) * 7;
    ctx.fillStyle = '#ffff00';
    ctx.beginPath(); ctx.arc(hx + ex, hy + ey, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + ex2, hy + ey2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(hx + ex, hy + ey, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + ex2, hy + ey2, 1.5, 0, Math.PI * 2); ctx.fill();

    // Rozwidlony język
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(this.angle) * 11, hy + Math.sin(this.angle) * 11);
    ctx.lineTo(hx + Math.cos(this.angle) * 17, hy + Math.sin(this.angle) * 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(this.angle) * 17, hy + Math.sin(this.angle) * 17);
    ctx.lineTo(hx + Math.cos(this.angle - 0.35) * 21, hy + Math.sin(this.angle - 0.35) * 21);
    ctx.moveTo(hx + Math.cos(this.angle) * 17, hy + Math.sin(this.angle) * 17);
    ctx.lineTo(hx + Math.cos(this.angle + 0.35) * 21, hy + Math.sin(this.angle + 0.35) * 21);
    ctx.stroke();

    // Pasek HP
    const bw = 30, pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(hx - bw/2 - 1, hy - 20, bw + 2, 6);
    ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FFC107' : '#F44336';
    ctx.fillRect(hx - bw/2, hy - 19, bw * pct, 4);
  }
}

// ─── Ogr (Boss Tier 4) ────────────────────────────────────────────────────────
class Ogr {
  constructor(spawnR, spawnC) {
    this.type   = 'ogr';
    this.reward = C.OGR.reward;
    this.r = spawnR; this.c = spawnC;
    this.x = spawnC * C.T + C.T / 2;
    this.y = spawnR * C.T + C.T / 2;
    this.hp = C.OGR.hp; this.maxHp = C.OGR.hp;
    this.speed       = C.OGR.speed * C.T;
    this.dmgToTower  = C.OGR.dmgToTower;
    this.atkRate     = C.OGR.atkRate;
    this.dmgToCastle = C.OGR.dmgToCastle;
    this.path = null; this.pathIdx = 0;
    this.state = 'walking';
    this.attackTarget = null;
    this.atkTimer = 0; this.recalcTimer = 0;
    this.dead = false; this.reached = false;
    this.angle = 0;
    this.walkPhase = 0;
    this.armor = C.OGR.armor;
    this.regen  = C.OGR.regen;
  }

  _currentTile() {
    return { r: Math.round((this.y - C.T/2) / C.T), c: Math.round((this.x - C.T/2) / C.T) };
  }
  recalcPath() {
    const tile = this._currentTile();
    const cr = Math.max(0, Math.min(C.ROWS-1, tile.r));
    const cc = Math.max(0, Math.min(C.COLS-1, tile.c));
    this.path = Pathfinding.findPath(cr, cc, Towers.grid());
    if (!this.path) {
      this.pathIdx = 0; this.state = 'attacking';
      this._findAttackTarget(cr, cc);
    } else {
      this.pathIdx = this.path.length > 1 ? 1 : 0;
      this.state = 'walking'; this.attackTarget = null;
    }
  }
  _checkTaunt() {
    for (const tower of Towers.list()) {
      if (tower.typeId !== 'GOLEM' || tower.hp <= 0) continue;
      const tx = tower.c * C.T + C.T / 2;
      const ty = tower.r * C.T + C.T / 2;
      const dx = this.x - tx, dy = this.y - ty;
      if (Math.sqrt(dx*dx + dy*dy) <= tower.tauntRadius * C.T) {
        this.state = 'attacking';
        this.attackTarget = { r: tower.r, c: tower.c };
        return true;
      }
    }
    return false;
  }
  _findAttackTarget(r, c) {
    for (let cc = c + 1; cc < C.COLS; cc++) {
      if (Towers.grid()[r]?.[cc]) { this.attackTarget = {r, c: cc}; return; }
    }
    let best = null, bestD = Infinity;
    for (const t of Towers.list()) {
      const d = Math.abs(t.r - r) + Math.abs(t.c - c);
      if (d < bestD) { bestD = d; best = t; }
    }
    this.attackTarget = best ? {r: best.r, c: best.c} : null;
  }

  update(dt) {
    if (this.dead || this.reached) return;
    if (this.regen > 0 && this.hp < this.maxHp)
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    this.recalcTimer += dt;
    if (this.recalcTimer > 0.5) { this.recalcTimer = 0; if (!this._checkTaunt()) this.recalcPath(); }

    if (this.state === 'walking') {
      if (!this.path || this.pathIdx >= this.path.length) { this.recalcPath(); return; }
      const wp = this.path[this.pathIdx];
      const tx = wp.c * C.T + C.T/2, ty = wp.r * C.T + C.T/2;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      this.angle = Math.atan2(dy, dx);
      this.walkPhase += dt * 4;
      if (dist < 3) {
        if (Grid.getCell(wp.r, wp.c) === C.CASTLE) { this.reached = true; return; }
        this.pathIdx++;
      } else {
        const m = this.speed * dt;
        this.x += (dx/dist) * m; this.y += (dy/dist) * m;
      }
    } else if (this.state === 'attacking') {
      if (!this.attackTarget) { this.recalcPath(); return; }
      if (!Towers.grid()[this.attackTarget.r]?.[this.attackTarget.c]) { this.recalcPath(); return; }
      this.atkTimer += dt;
      if (this.atkTimer >= 1.0 / this.atkRate) {
        this.atkTimer = 0;
        Audio.play('goblinAttack');
        const destroyed = Towers.takeDamage(this.attackTarget.r, this.attackTarget.c, this.dmgToTower);
        if (destroyed) this.recalcPath();
      }
    }
  }

  takeDamage(amount, dmgType = 'normal') {
    const armorDef = C.ARMOR[this.armor] || C.ARMOR.NONE;
    const mult = dmgType === 'pierce' ? armorDef.pierceMult
               : dmgType === 'splash' ? armorDef.splashMult
               : 1.0;
    this.hp -= amount * mult;
    if (this.hp <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const x = this.x, y = this.y;

    const isWalking   = this.state === 'walking';
    const isAttacking = this.state === 'attacking';
    const wp = this.walkPhase;

    const legSwing = isWalking ? Math.sin(wp) * 5 : 0;
    const armSwing = isWalking ? Math.sin(wp + Math.PI) * 4 : 0;
    const bob      = isWalking ? Math.abs(Math.sin(wp)) * 1.5 : 0;

    // Duży cień
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Grube nogi
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - 5, y + 5); ctx.lineTo(x - 5 - legSwing, y + 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + 5 + legSwing, y + 14); ctx.stroke();

    // Masywny tułów
    ctx.fillStyle = '#5a7030';
    ctx.beginPath();
    ctx.ellipse(x, y - 2 - bob, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pas / szarfa
    ctx.fillStyle = '#3a1a00';
    ctx.fillRect(x - 11, y + 4 - bob, 22, 4);

    // Ramiona + broń
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#4a5a20';
    if (isAttacking) {
      // Prawa ręka uniesiona z wielką maczugą
      ctx.beginPath(); ctx.moveTo(x + 8, y - 8 - bob); ctx.lineTo(x + 18, y - 20 - bob); ctx.stroke();
      ctx.strokeStyle = '#5a3000'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x + 18, y - 20 - bob); ctx.lineTo(x + 22, y - 30 - bob); ctx.stroke();
      ctx.fillStyle = '#3a1800';
      ctx.beginPath(); ctx.arc(x + 24, y - 32 - bob, 8, 0, Math.PI * 2); ctx.fill();
      // Lewa ręka w dół
      ctx.strokeStyle = '#4a5a20'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 8 - bob); ctx.lineTo(x - 16, y - 3 - bob); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x - 8, y - 8 - bob); ctx.lineTo(x - 16, y - 3 + armSwing - bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 8, y - 8 - bob); ctx.lineTo(x + 16, y - 3 - armSwing - bob); ctx.stroke();
      // Maczuga w prawej ręce
      ctx.strokeStyle = '#5a3000'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x + 16, y - 3 - armSwing - bob); ctx.lineTo(x + 20, y + 5 - armSwing - bob); ctx.stroke();
      ctx.fillStyle = '#3a1800';
      ctx.beginPath(); ctx.arc(x + 21, y + 6 - armSwing - bob, 6, 0, Math.PI * 2); ctx.fill();
    }

    // Głowa
    const hy = y - 18 - bob;
    ctx.fillStyle = isAttacking ? '#8b3a10' : '#6a8a30';
    ctx.beginPath();
    ctx.ellipse(x, hy, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Małe uszy (zaokrąglone, nie szpiczaste jak goblin)
    ctx.fillStyle = isAttacking ? '#6a2a00' : '#4a6a18';
    ctx.beginPath(); ctx.arc(x - 11, hy - 1, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 11, hy - 1, 5, 0, Math.PI * 2); ctx.fill();

    // Zmarszczone brwi
    ctx.strokeStyle = '#1a2a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 9, hy - 4); ctx.lineTo(x - 3, hy - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 9, hy - 4); ctx.lineTo(x + 3, hy - 3); ctx.stroke();

    // Małe złe oczka
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath(); ctx.arc(x - 4, hy - 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, hy - 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#110000';
    ctx.beginPath(); ctx.arc(x - 4, hy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, hy - 1, 1.5, 0, Math.PI * 2); ctx.fill();

    // Płaski nos
    ctx.fillStyle = '#3a5010';
    ctx.beginPath(); ctx.ellipse(x, hy + 3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Szczęka z kłami
    ctx.fillStyle = isAttacking ? '#6a2a00' : '#4a6a18';
    ctx.beginPath();
    ctx.ellipse(x, hy + 7, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eeeedd';
    ctx.beginPath(); ctx.moveTo(x - 4, hy + 5); ctx.lineTo(x - 3, hy + 12); ctx.lineTo(x - 1, hy + 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2, hy + 5); ctx.lineTo(x + 3, hy + 12); ctx.lineTo(x + 5, hy + 5); ctx.fill();

    // Etykieta BOSS
    ctx.fillStyle = '#ff6600';
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('BOSS', x, y - 34);

    // HP bar (szerszy)
    const bw = 34, pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - bw/2 - 1, y - 43, bw + 2, 6);
    ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FFC107' : '#F44336';
    ctx.fillRect(x - bw/2, y - 42, bw * pct, 4);
  }
}

const Enemies = (() => {
  let _list = [];

  function init() { _list = []; }

  function spawnGoblin(spawnR, spawnC)   { spawnByType('GOBLIN',   spawnR, spawnC); }
  function spawnAnaconda(spawnR, spawnC) { spawnByType('ANACONDA', spawnR, spawnC); }

  function spawnByType(typeId, spawnR, spawnC) {
    const def = Monsters[typeId];
    if (!def) { console.warn('Nieznany potwór:', typeId); return; }
    _list.push(def.create(spawnR, spawnC));
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

  return { init, list: () => _list, spawnGoblin, spawnAnaconda, spawnByType, update, draw, removeDeadAndReached, allGone };
})();
