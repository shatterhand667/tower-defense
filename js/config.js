const C = {
  COLS: 30,
  ROWS: 20,
  T: 32,

  GRASS:   0,
  TREE:    1,
  SPAWN:   2,
  CASTLE:  3,
  TERRAIN: 4,  // mapa-obiekty (drzewa, głazy, itp.)

  SPAWN_COUNT:     5,
  MAP_TREE_COUNT: 14,  // drzew losowanych na planszy
  CASTLE_ROWS: [7, 8, 9, 10, 11, 12, 13],

  START_GOLD:    200,
  CASTLE_MAX_HP: 20,

  WAVES: [
    { size: 20, interval: 1.8 },  // 1
    { size: 26, interval: 1.7 },  // 2
    { size: 32, interval: 1.6 },  // 3
    { size: 38, interval: 1.5 },  // 4
    { size: 44, interval: 1.4 },  // 5
    { size: 50, interval: 1.3 },  // 6
    { size: 56, interval: 1.2 },  // 7
    { size: 62, interval: 1.1 },  // 8
    { size: 68, interval: 1.0 },  // 9
    { size: 80, interval: 0.9 },  // 10 — finałowa
  ],

  TOWERS: {
    WALL: {
      name: 'Mur', cost: 2, sellMult: 0.5,
      hp: 80, dmg: 0, range: 0, rate: 0, splash: 0,
      color: '#9a8870', barrelColor: '#7a6850',
      upgrades: [
        { cost: 20, hp: 180, dmg: 0, range: 0, rate: 0 },
        { cost: 35, hp: 350, dmg: 0, range: 0, rate: 0 },
      ],
    },
    ARCHER: {
      name: 'Łucznik', cost: 50, sellMult: 0.5,
      hp: 100, dmg: 10, range: 3.5, rate: 1.0, splash: 0,
      color: '#8B6914', barrelColor: '#5a3d00',
      upgrades: [
        { cost: 40, hp: 130, dmg: 15, range: 4.0, rate: 1.2 },
        { cost: 70, hp: 160, dmg: 22, range: 4.5, rate: 1.5 },
      ],
    },
    CANNON: {
      name: 'Kanon', cost: 75, sellMult: 0.5,
      hp: 150, dmg: 25, range: 2.5, rate: 0.5, splash: 1.0,
      color: '#4a4a66', barrelColor: '#222233',
      upgrades: [
        { cost: 60, hp: 190, dmg: 35, range: 3.0, rate: 0.6, splash: 1.2 },
        { cost: 100, hp: 240, dmg: 50, range: 3.5, rate: 0.8, splash: 1.5 },
      ],
    },
    SNIPER: {
      name: 'Snajper', cost: 100, sellMult: 0.5,
      hp: 80, dmg: 40, range: 5.5, rate: 0.33, splash: 0,
      color: '#2d5a1b', barrelColor: '#1a3a0a',
      upgrades: [
        { cost: 80,  hp: 100, dmg: 60, range: 6.5, rate: 0.4 },
        { cost: 130, hp: 120, dmg: 90, range: 7.5, rate: 0.5 },
      ],
    },
    GOLEM: {
      name: 'Golem', cost: 110, sellMult: 0.5,
      hp: 300, dmg: 8, range: 1.0, rate: 0.5, splash: 0,
      tauntRadius: 2.5,   // kafelki
      regen: 5,           // HP/s podczas fali
      color: '#5a6e4a', barrelColor: '#3a4e2a',
      upgrades: [
        { cost: 80,  hp: 450, dmg: 12, range: 1.0, rate: 0.6 },
        { cost: 130, hp: 650, dmg: 18, range: 1.5, rate: 0.7 },
      ],
    },
    WIEZA_OGNIA: {
      name: 'Wieża Ognia', cost: 80, sellMult: 0.5,
      hp: 120, dmg: 12, range: 2.0, rate: 0.8, splash: 0.8,
      burnDps: 8, burnDuration: 3,
      color: '#cc4400', barrelColor: '#881100',
      upgrades: [
        { cost: 60, hp: 160, dmg: 16, range: 2.5, rate: 0.9, splash: 1.0, burnDps: 10, burnDuration: 3 },
        { cost: 90, hp: 200, dmg: 22, range: 3.0, rate: 1.1, splash: 1.2, burnDps: 14, burnDuration: 4 },
      ],
    },
    WIEZA_LODU: {
      name: 'Wieża Lodu', cost: 70, sellMult: 0.5,
      hp: 110, dmg: 8, range: 3.0, rate: 0.7, splash: 0,
      slowMult: 0.8, slowDuration: 2,
      color: '#44aacc', barrelColor: '#226688',
      upgrades: [
        { cost: 55, hp: 140, dmg: 12, range: 3.5, rate: 0.8, slowMult: 0.65, slowDuration: 2.5 },
        { cost: 85, hp: 170, dmg: 16, range: 4.0, rate: 1.0, slowMult: 0.5,  slowDuration: 3   },
      ],
    },
    WIEZA_TRUCIZNY: {
      name: 'Wieża Trucizny', cost: 65, sellMult: 0.5,
      hp: 90, dmg: 5, range: 3.0, rate: 0.9, splash: 0,
      poisonDps: 3, poisonDuration: 4,
      color: '#66bb22', barrelColor: '#337700',
      upgrades: [
        { cost: 50, hp: 110, dmg: 7,  range: 3.5, rate: 1.0, poisonDps: 5,  poisonDuration: 4 },
        { cost: 75, hp: 130, dmg: 10, range: 4.0, rate: 1.2, poisonDps: 8,  poisonDuration: 5 },
      ],
    },
    WIEZA_BLYSK: {
      name: 'Wieża Błyskawicy', cost: 90, sellMult: 0.5,
      hp: 100, dmg: 18, range: 4.0, rate: 1.5, splash: 0,
      chainTargets: 1, chainRange: 2.5,
      color: '#ffdd00', barrelColor: '#aa8800',
      upgrades: [
        { cost: 70,  hp: 130, dmg: 25, range: 4.5, rate: 1.7, chainTargets: 1, chainRange: 3.0 },
        { cost: 110, hp: 160, dmg: 35, range: 5.0, rate: 2.0, chainTargets: 2, chainRange: 3.5 },
      ],
    },
    BALISTOR: {
      name: 'Balistor', cost: 120, sellMult: 0.5,
      hp: 90, dmg: 55, range: 7.0, rate: 0.25, splash: 0,
      pierce: true,
      color: '#886644', barrelColor: '#553311',
      upgrades: [
        { cost: 90,  hp: 120, dmg: 75,  range: 8.0, rate: 0.3 },
        { cost: 140, hp: 150, dmg: 100, range: 9.0, rate: 0.4 },
      ],
    },
    KATAPULTA: {
      name: 'Katapulta', cost: 150, sellMult: 0.5,
      hp: 130, dmg: 40, range: 4.0, rate: 0.3, splash: 2.0,
      color: '#887755', barrelColor: '#554433',
      upgrades: [
        { cost: 120, hp: 170, dmg: 55, range: 4.5, rate: 0.4, splash: 2.5 },
        { cost: 180, hp: 220, dmg: 75, range: 5.0, rate: 0.5, splash: 3.0 },
      ],
    },
    MUR_KOLCZASTY: {
      name: 'Mur Kolczasty', cost: 20, sellMult: 0.5,
      hp: 140, dmg: 0, range: 0, rate: 0, splash: 0,
      thorns: 15,
      color: '#556644', barrelColor: '#334422',
      upgrades: [
        { cost: 25, hp: 280, dmg: 0, range: 0, rate: 0, thorns: 25 },
        { cost: 40, hp: 450, dmg: 0, range: 0, rate: 0, thorns: 40 },
      ],
    },
    MENNICA: {
      name: 'Mennica', cost: 60, sellMult: 0.5,
      hp: 80, dmg: 0, range: 0, rate: 0, splash: 0,
      goldInterval: 10, goldAmount: 1,
      color: '#ccaa00', barrelColor: '#997700',
      upgrades: [
        { cost: 50, hp: 100, dmg: 0, range: 0, rate: 0, goldInterval: 8,  goldAmount: 2 },
        { cost: 80, hp: 120, dmg: 0, range: 0, rate: 0, goldInterval: 6,  goldAmount: 3 },
      ],
    },
    KUSZNIK: {
      name: 'Kusznik', cost: 70, sellMult: 0.5,
      hp: 90, dmg: 12, range: 3.0, rate: 1.5, splash: 0,
      color: '#997733', barrelColor: '#664400',
      upgrades: [
        { cost: 55, hp: 110, dmg: 18, range: 3.5, rate: 1.8 },
        { cost: 85, hp: 130, dmg: 25, range: 4.0, rate: 2.2 },
      ],
    },
    WIEZA_OBS: {
      name: 'Wieża Obserwacyjna', cost: 80, sellMult: 0.5,
      hp: 70, dmg: 0, range: 0, rate: 0, splash: 0,
      obsRadius: 1.5, obsBonus: 0.15,
      color: '#aabb88', barrelColor: '#778855',
      upgrades: [
        { cost: 65,  hp: 90,  dmg: 0, range: 0, rate: 0, obsRadius: 2.0, obsBonus: 0.25 },
        { cost: 100, hp: 110, dmg: 0, range: 0, rate: 0, obsRadius: 2.5, obsBonus: 0.40 },
      ],
    },
    WIEZA_CIENIA: {
      name: 'Wieża Cienia', cost: 85, sellMult: 0.5,
      hp: 85, dmg: 15, range: 3.5, rate: 0.8, splash: 0,
      color: '#554466', barrelColor: '#332244',
      upgrades: [
        { cost: 65,  hp: 110, dmg: 22, range: 4.0, rate: 1.0 },
        { cost: 100, hp: 140, dmg: 32, range: 4.5, rate: 1.2 },
      ],
    },
    BASTION: {
      name: 'Bastion', cost: 120, sellMult: 0.5,
      hp: 250, dmg: 30, range: 1.5, rate: 0.6, splash: 0,
      color: '#667788', barrelColor: '#445566',
      upgrades: [
        { cost: 100, hp: 380, dmg: 45, range: 1.5, rate: 0.7 },
        { cost: 150, hp: 550, dmg: 65, range: 2.0, rate: 0.9 },
      ],
    },
  },

  // ─── Typy zbroi ──────────────────────────────────────────────────────────────
  // pierceMult  — mnożnik obrażeń od pocisków przebijających (łucznik)
  // splashMult  — mnożnik obrażeń od wybuchu (kanon splash)
  ARMOR: {
    NONE:  { id: 'NONE',  pierceMult: 1.0, splashMult: 1.0 },
    LIGHT: { id: 'LIGHT', pierceMult: 0.5, splashMult: 1.0 },
    HEAVY: { id: 'HEAVY', pierceMult: 1.0, splashMult: 0.25 },
  },

  GOBLIN: {
    hp: 60, speed: 3.0, reward: 15,
    dmgToCastle: 1, dmgToTower: 20, atkRate: 1.0,
    armor: 'NONE', regen: 0,
  },

  DRZEWIEC: {
    hp: 120, speed: 2.2, reward: 25,
    dmgToCastle: 2, dmgToTower: 30, atkRate: 0.9,
    killsToSpawn: 7,
    armor: 'LIGHT', regen: 1,
  },

  ANACONDA: {
    hp: 280, speed: 1.7, reward: 60,
    dmgToCastle: 3, dmgToTower: 45, atkRate: 0.7,
    killsToSpawn: 10,
    armor: 'LIGHT', regen: 2,
  },

  OGR: {
    hp: 600, speed: 1.1, reward: 120,
    dmgToCastle: 6, dmgToTower: 90, atkRate: 0.5,
    killsToSpawn: 50,
    armor: 'HEAVY', regen: 3,
  },
};
