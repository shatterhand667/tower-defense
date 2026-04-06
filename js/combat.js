const Combat = (() => {
  let projectiles = [];
  let lightningFlashes = []; // { x1,y1,x2,y2, life } visual only

  function init() { projectiles = []; lightningFlashes = []; }

  function update(dt, now) {
    _towerShoot(now);
    _moveProjectiles(dt);
    lightningFlashes = lightningFlashes.filter(f => { f.life -= dt; return f.life > 0; });
  }

  function _effectiveRate(tower) {
    let rate = tower.rate * (1 + (tower.rateBonus || 0));
    const inMech = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('MECHANIKA');
    if (inMech && Factions.tier('MECHANIKA') >= 1) rate *= 1.25; // -20% cooldown = +25% rate
    return rate;
  }

  function _towerShoot(now) {
    for (const tower of Towers.list()) {
      // Passive-only towers: no shooting
      if (['WALL', 'MUR_KOLCZASTY', 'MENNICA', 'WIEZA_OBS'].includes(tower.typeId)) continue;
      if (tower.dmg === 0) continue;

      const cooldown = 1000 / _effectiveRate(tower);
      if (now - tower.lastShot < cooldown) continue;

      const tx = tower.c * C.T + C.T / 2;
      const ty = tower.r * C.T + C.T / 2;
      const rangePx = tower.range * (1 + (tower.rangeBonus || 0)) * C.T;

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
      tower.shotCount = (tower.shotCount || 0) + 1;
      tower.angle = Math.atan2(target.y - ty, target.x - tx) - Math.PI/2;

      // Determine dmgType
      const dmgType = tower.typeId === 'ARCHER'      ? 'pierce'
                    : tower.typeId === 'KUSZNIK'      ? 'pierce'
                    : tower.typeId === 'BALISTOR'     ? 'pierce'
                    : tower.typeId === 'CANNON'       ? 'splash'
                    : tower.typeId === 'KATAPULTA'    ? 'splash'
                    : tower.typeId === 'WIEZA_OGNIA'  ? 'splash'
                    : 'normal';

      // Audio
      const snd = tower.typeId === 'ARCHER'      ? 'arrow'
                : tower.typeId === 'KUSZNIK'      ? 'arrow'
                : tower.typeId === 'CANNON'       ? 'cannon'
                : tower.typeId === 'KATAPULTA'    ? 'cannon'
                : tower.typeId === 'SNIPER'       ? 'sniper'
                : tower.typeId === 'BALISTOR'     ? 'sniper'
                : 'arrow';
      Audio.play(snd);

      // Chain lightning fires immediately, no projectile
      if (tower.typeId === 'WIEZA_BLYSK') {
        _fireLightning(tower, target, tx, ty, now);
        continue;
      }

      // Piercing ballista: direction-based, not homing
      if (tower.pierce) {
        const angle = Math.atan2(target.y - ty, target.x - tx);
        projectiles.push({
          x: tx, y: ty,
          vx: Math.cos(angle), vy: Math.sin(angle),
          dmg: tower.dmg, splash: 0, typeId: tower.typeId,
          dmgType, speed: 500,
          pierce: true, hit: new Set(),
          range: tower.range * C.T,
          traveledPx: 0,
          sourceTower: tower,
        });
        continue;
      }

      projectiles.push({
        x: tx, y: ty,
        targetRef: target,
        dmg: tower.dmg,
        splash: tower.splash || 0,
        typeId: tower.typeId,
        dmgType,
        speed: tower.typeId === 'SNIPER'     ? 400
             : tower.typeId === 'CANNON'     ? 180
             : tower.typeId === 'KATAPULTA'  ? 150
             : tower.typeId === 'WIEZA_LODU' ? 250
             : 280,
        sourceTower: tower,
      });
    }
  }

  function _fireLightning(tower, primaryTarget, tx, ty, now) {
    const targets = [primaryTarget];
    let last = primaryTarget;
    const chainR = (tower.chainRange || 2.5) * C.T;

    for (let i = 0; i < (tower.chainTargets || 1); i++) {
      let next = null, minD = Infinity;
      for (const e of Enemies.list()) {
        if (e.dead || e.reached || targets.includes(e)) continue;
        const dx = e.x - last.x, dy = e.y - last.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d <= chainR && d < minD) { minD = d; next = e; }
      }
      if (!next) break;
      targets.push(next);
      last = next;
    }

    // Apply damage + flash
    let prev = { x: tx, y: ty };
    for (const t of targets) {
      lightningFlashes.push({ x1: prev.x, y1: prev.y, x2: t.x, y2: t.y, life: 0.12 });
      _hitEnemy(t, tower.dmg, 'normal', tower);
      prev = { x: t.x, y: t.y };
    }
  }

  function _moveProjectiles(dt) {
    const alive = [];
    for (const p of projectiles) {
      if (p.pierce) {
        // Piercing: travel in straight line
        const move = p.speed * dt;
        p.x += p.vx * move;
        p.y += p.vy * move;
        p.traveledPx += move;
        if (p.traveledPx >= p.range) continue; // gone past max range

        // Check collision with all enemies
        for (const e of Enemies.list()) {
          if (e.dead || e.reached || p.hit.has(e)) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          if (Math.sqrt(dx*dx + dy*dy) < 8) {
            p.hit.add(e);
            _hitEnemy(e, p.dmg, p.dmgType, p.sourceTower);
          }
        }
        alive.push(p);
      } else {
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
    }
    projectiles = alive;
  }

  function _hitEnemy(e, dmg, dmgType, tower) {
    // PRECYZJA Silver: pierce from Precyzja towers ignores LIGHT armor
    if (dmgType === 'pierce' && tower && Factions.tier('PRECYZJA') >= 2) {
      const inP = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('PRECYZJA');
      if (inP) dmgType = 'precyzja_pierce';
    }

    // PRECYZJA Gold: 25% crit (2× DMG)
    if (tower && Factions.tier('PRECYZJA') >= 3) {
      const inP = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('PRECYZJA');
      if (inP && Math.random() < 0.25) dmg *= 2;
    }

    // MECHANIKA Silver: every 5th shot deals 2× DMG
    if (tower && Factions.tier('MECHANIKA') >= 2) {
      const inM = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('MECHANIKA');
      if (inM && tower.shotCount % 5 === 0) dmg *= 2;
    }

    // Apply status effects (existing code)
    if (tower) {
      if (tower.burnDps    > 0) { e.burning  = { dps: tower.burnDps,    time: tower.burnDuration   }; }
      if (tower.slowMult   < 1) { e.slowed   = { mult: tower.slowMult,  time: tower.slowDuration   }; }
      if (tower.poisonDps  > 0) { e.poisoned = { dps: tower.poisonDps,  time: tower.poisonDuration }; }
    }

    // NATURA Bronze (tier≥1): hits from Natura towers slow enemy 25% for 2s (if not already slower)
    if (tower && Factions.tier('NATURA') >= 1) {
      const inN = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('NATURA');
      if (inN) {
        const slowMult = Factions.tier('NATURA') >= 3 ? 0.5 : 0.75;
        if (e.slowed.mult > slowMult) e.slowed = { mult: slowMult, time: 2 };
        // NATURA Gold (tier≥3): spread slow to nearby enemies
        if (Factions.tier('NATURA') >= 3) {
          for (const other of Enemies.list()) {
            if (other === e || other.dead || other.reached) continue;
            const dx = other.x - e.x, dy = other.y - e.y;
            if (Math.sqrt(dx*dx + dy*dy) <= 1.5 * C.T && other.slowed.mult > 0.5)
              other.slowed = { mult: 0.5, time: 2 };
          }
        }
      }
    }

    // ŻYWIOŁ Bronze (tier≥1): 20% chance to ignite (8 dps × 3s)
    if (tower && Factions.tier('ZYWIOL') >= 1) {
      const inZ = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('ZYWIOL');
      if (inZ && Math.random() < 0.2) {
        e.burning = { dps: 8, time: 3 };
        // ŻYWIOŁ Gold (tier≥3): burn spreads to nearest enemy in 2 tiles
        if (Factions.tier('ZYWIOL') >= 3) {
          let nearest = null, minD = Infinity;
          for (const other of Enemies.list()) {
            if (other === e || other.dead || other.reached) continue;
            const dx = other.x - e.x, dy = other.y - e.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d <= 2 * C.T && d < minD) { minD = d; nearest = other; }
          }
          if (nearest) nearest.burning = { dps: 8, time: 3 };
        }
      }
    }

    // CIEŃ: shadow stacks — WIEZA_CIENIA always, + all Cień towers when Bronze active
    if (tower) {
      const inC = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('CIEN');
      if (tower.typeId === 'WIEZA_CIENIA' || (inC && Factions.tier('CIEN') >= 1)) {
        e.shadowStacks = Math.min(3, (e.shadowStacks || 0) + 1);
      }
      // CIEŃ Gold: every 10th hit stuns for 2s
      if (inC && Factions.tier('CIEN') >= 3) {
        tower.hitCount = (tower.hitCount || 0) + 1;
        if (tower.hitCount % 10 === 0) e.stunTime = 2;
      }
    }

    e.takeDamage(dmg, dmgType);

    if (e.dead) {
      Game.gold += e.reward;
      Game.addKill(e);
      Audio.play('goblinDeath');
      UI.showFloatingText('+' + e.reward + 'g', e.x, e.y);

      // BOGACTWO Bronze: +5g for killing non-goblin enemies
      if (tower && e.type !== 'goblin' && Factions.tier('BOGACTWO') >= 1) {
        const inB = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('BOGACTWO');
        if (inB) { Game.gold += 5; UI.showFloatingText('+5g', e.x, e.y - 12); }
      }

      // DESTRUKCJA Gold: kill causes chain explosion (50% DMG, radius 1 tile)
      if (tower && Factions.tier('DESTRUKCJA') >= 3) {
        const inD = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('DESTRUKCJA');
        if (inD) {
          for (const other of Enemies.list()) {
            if (other === e || other.dead || other.reached) continue;
            const dx = other.x - e.x, dy = other.y - e.y;
            if (Math.sqrt(dx*dx + dy*dy) <= C.T) other.takeDamage(dmg * 0.5, 'splash');
          }
        }
      }

      // MECHANIKA Gold: after kill, reset cooldown for this tower
      if (tower && Factions.tier('MECHANIKA') >= 3) {
        const inM = (Factions.TOWER_FACTIONS[tower.typeId] || []).includes('MECHANIKA');
        if (inM) tower.lastShot = 0;
      }

      // ŻYWIOŁ Silver: burning enemy death explosion (30 DMG, radius 1.5 tiles)
      if (e.burning && e.burning.time > 0 && Factions.tier('ZYWIOL') >= 2) {
        for (const other of Enemies.list()) {
          if (other === e || other.dead || other.reached) continue;
          const dx = other.x - e.x, dy = other.y - e.y;
          if (Math.sqrt(dx*dx + dy*dy) <= 1.5 * C.T) other.takeDamage(30, 'splash');
        }
      }
    }
  }

  function _applyDamage(p) {
    if (p.splash > 0) {
      const splashBonus = p.sourceTower ? (p.sourceTower.splashBonus || 0) : 0;
      const splashPx = p.splash * (1 + splashBonus) * C.T;
      const cx = p.targetRef.x, cy = p.targetRef.y;
      for (const e of Enemies.list()) {
        if (e.dead || e.reached) continue;
        const dx = e.x - cx, dy = e.y - cy;
        if (Math.sqrt(dx*dx + dy*dy) <= splashPx) {
          _hitEnemy(e, p.dmg, p.dmgType, p.sourceTower);
          // DESTRUKCJA Silver: splash hits apply slow 30% for 2s
          if (p.sourceTower && Factions.tier('DESTRUKCJA') >= 2) {
            const inD = (Factions.TOWER_FACTIONS[p.sourceTower.typeId] || []).includes('DESTRUKCJA');
            if (inD && e.slowed.mult > 0.7) e.slowed = { mult: 0.7, time: 2 };
          }
        }
      }
    } else {
      _hitEnemy(p.targetRef, p.dmg, p.dmgType, p.sourceTower);
    }
  }

  function draw(ctx) {
    // Lightning flashes
    for (const f of lightningFlashes) {
      const alpha = f.life / 0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.strokeStyle = '#ffdd00';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.restore();
    }

    for (const p of projectiles) {
      switch (p.typeId) {
        case 'ARCHER':
        case 'KUSZNIK': {
          ctx.save();
          ctx.translate(p.x, p.y);
          const tx = p.targetRef ? p.targetRef.x - p.x : p.vx * 10;
          const ty2 = p.targetRef ? p.targetRef.y - p.y : p.vy * 10;
          ctx.rotate(Math.atan2(ty2, tx));
          ctx.fillStyle = p.typeId === 'KUSZNIK' ? '#ddaa55' : '#c8a040';
          ctx.fillRect(-1, -6, 2, 12);
          ctx.fillStyle = p.typeId === 'KUSZNIK' ? '#aa7722' : '#886020';
          ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(-3,-2); ctx.lineTo(3,-2); ctx.fill();
          ctx.restore();
          break;
        }

        case 'CANNON':
        case 'KATAPULTA': {
          const r = p.typeId === 'KATAPULTA' ? 7 : 5;
          ctx.fillStyle = p.typeId === 'KATAPULTA' ? '#665544' : '#333';
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = p.typeId === 'KATAPULTA' ? '#887766' : '#555';
          ctx.beginPath(); ctx.arc(p.x-1, p.y-1, r*0.4, 0, Math.PI*2); ctx.fill();
          break;
        }

        case 'SNIPER': {
          ctx.strokeStyle = 'rgba(200,255,150,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y);
          const ang = Math.atan2(p.targetRef.y - p.y, p.targetRef.x - p.x);
          ctx.lineTo(p.x - Math.cos(ang)*12, p.y - Math.sin(ang)*12);
          ctx.stroke();
          ctx.fillStyle = '#ddff88';
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2); ctx.fill();
          break;
        }

        case 'BALISTOR': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = '#cc9966';
          ctx.fillRect(-2, -8, 4, 16);
          ctx.fillStyle = '#886644';
          ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(-4,-4); ctx.lineTo(4,-4); ctx.fill();
          ctx.restore();
          break;
        }

        case 'WIEZA_OGNIA': {
          ctx.fillStyle = 'rgba(255,100,0,0.85)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(255,220,0,0.7)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
          break;
        }

        case 'WIEZA_LODU': {
          ctx.fillStyle = 'rgba(120,200,255,0.9)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
          // Snowflake-like cross
          ctx.beginPath(); ctx.moveTo(p.x-5, p.y); ctx.lineTo(p.x+5, p.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.x, p.y-5); ctx.lineTo(p.x, p.y+5); ctx.stroke();
          break;
        }

        case 'WIEZA_TRUCIZNY': {
          ctx.fillStyle = 'rgba(80,200,40,0.85)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(30,100,10,0.7)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();
          break;
        }

        case 'WIEZA_CIENIA': {
          ctx.fillStyle = 'rgba(140,40,200,0.85)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
          break;
        }

        case 'BASTION': {
          ctx.fillStyle = '#aabb88';
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
          break;
        }
      }
    }
  }

  return { init, update, draw };
})();
