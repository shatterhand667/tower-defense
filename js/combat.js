const Combat = (() => {
  let projectiles = [];

  function init() { projectiles = []; }

  function update(dt, now) {
    _towerShoot(now);
    _moveProjectiles(dt);
  }

  function _towerShoot(now) {
    for (const tower of Towers.list()) {
      if (tower.dmg === 0) continue; // walls don't shoot
      const cooldown = 1000 / tower.rate; // ms
      if (now - tower.lastShot < cooldown) continue;

      const tx = tower.c * C.T + C.T / 2;
      const ty = tower.r * C.T + C.T / 2;
      const rangePx = tower.range * C.T;

      // Find nearest live enemy in range
      let target = null, minDist = Infinity;
      for (const e of Enemies.list()) {
        if (e.dead || e.reached) continue;
        const dx = e.x - tx, dy = e.y - ty;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d <= rangePx && d < minDist) { minDist = d; target = e; }
      }

      if (!target) continue;

      tower.lastShot = now;
      tower.angle = Math.atan2(target.y - ty, target.x - tx) - Math.PI/2;
      Audio.play(tower.typeId === 'ARCHER' ? 'arrow' : tower.typeId === 'CANNON' ? 'cannon' : 'sniper');

      projectiles.push({
        x: tx, y: ty,
        targetRef: target,
        dmg: tower.dmg,
        splash: tower.splash,
        typeId: tower.typeId,
        speed: tower.typeId === 'SNIPER' ? 400 : tower.typeId === 'CANNON' ? 180 : 280,
      });
    }
  }

  function _moveProjectiles(dt) {
    const alive = [];
    for (const p of projectiles) {
      if (p.targetRef.dead || p.targetRef.reached) continue;

      const dx = p.targetRef.x - p.x;
      const dy = p.targetRef.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 6) {
        _applyDamage(p);
      } else {
        const move = p.speed * dt;
        p.x += (dx / dist) * move;
        p.y += (dy / dist) * move;
        alive.push(p);
      }
    }
    projectiles = alive;
  }

  function _applyDamage(p) {
    if (p.splash > 0) {
      const splashPx = p.splash * C.T;
      const cx = p.targetRef.x, cy = p.targetRef.y;
      for (const e of Enemies.list()) {
        if (e.dead || e.reached) continue;
        const dx = e.x - cx, dy = e.y - cy;
        if (Math.sqrt(dx*dx + dy*dy) <= splashPx) {
          e.takeDamage(p.dmg);
          if (e.dead) { Game.gold += C.GOBLIN.reward; Audio.play('goblinDeath'); UI.showFloatingText('+' + C.GOBLIN.reward + 'g', e.x, e.y); }
        }
      }
    } else {
      p.targetRef.takeDamage(p.dmg);
      if (p.targetRef.dead) { Game.gold += C.GOBLIN.reward; Audio.play('goblinDeath'); UI.showFloatingText('+' + C.GOBLIN.reward + 'g', p.targetRef.x, p.targetRef.y); }
    }
  }

  function draw(ctx) {
    for (const p of projectiles) {
      switch (p.typeId) {
        case 'ARCHER':
          // Arrow
          ctx.save();
          ctx.translate(p.x, p.y);
          const tx = p.targetRef.x - p.x, ty2 = p.targetRef.y - p.y;
          ctx.rotate(Math.atan2(ty2, tx));
          ctx.fillStyle = '#c8a040';
          ctx.fillRect(-1, -5, 2, 10);
          ctx.fillStyle = '#886020';
          ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(-3,-1); ctx.lineTo(3,-1); ctx.fill();
          ctx.restore();
          break;

        case 'CANNON':
          // Cannonball
          ctx.fillStyle = '#333';
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#555';
          ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 2, 0, Math.PI * 2); ctx.fill();
          break;

        case 'SNIPER':
          // Bullet trail
          ctx.strokeStyle = 'rgba(200,255,150,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          const ang = Math.atan2(p.targetRef.y - p.y, p.targetRef.x - p.x);
          ctx.lineTo(p.x - Math.cos(ang)*12, p.y - Math.sin(ang)*12);
          ctx.stroke();
          ctx.fillStyle = '#ddff88';
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2); ctx.fill();
          break;
      }
    }
  }

  return { init, update, draw };
})();
