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
