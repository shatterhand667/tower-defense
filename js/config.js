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

  WAVE_SIZE:           10,
  WAVE_SPAWN_INTERVAL: 2.0,

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

  GOBLIN: {
    hp: 60, speed: 1.5, reward: 15,
    dmgToCastle: 1, dmgToTower: 20, atkRate: 1.0,
  },
};
