// ─── Rejestr Potworów ─────────────────────────────────────────────────────────
// Każdy wpis definiuje jeden typ potwora.
// Fale (game.js / config WAVES) odwołują się do potworów przez id.
//
// Jak dodać nowego potwora:
//   1. Napisz klasę w enemies.js (wzoruj na Goblin)
//   2. Dodaj statystyki do config.js
//   3. Dodaj wpis tutaj — reszta systemu działa automatycznie

const Monsters = {

  GOBLIN: {
    id:          'GOBLIN',
    name:        'Goblin',
    description: 'Szybki i liczny. Słabe HP, ale przytłacza ilością.',
    tier:        1,       // 1=zwykły, 2=elita, 3=boss
    create:      (r, c) => new Goblin(r, c),
  },

  DRZEWIEC: {
    id:          'DRZEWIEC',
    name:        'Drzewiec',
    description: 'Ożywione drzewo dżungli. Silniejszy od goblina, wolniejszy od anakondy.',
    tier:        2,
    create:      (r, c) => new Drzewiec(r, c),
  },

  ANACONDA: {
    id:          'ANACONDA',
    name:        'Anakonda',
    description: 'Wytrzymała i powolna. Łuski tłumią strzały. Mocno niszczy mury.',
    tier:        3,
    create:      (r, c) => new Anaconda(r, c),
  },

  OGR: {
    id:          'OGR',
    name:        'Ogr',
    description: 'Boss. Masywny, wolny, odporny na splash. Regeneruje HP. Niszczy mury jednym uderzeniem.',
    tier:        4,
    create:      (r, c) => new Ogr(r, c),
  },

};

// Pomocnik: lista wszystkich ID potworów
Monsters.ids = () => Object.keys(Monsters).filter(k => typeof Monsters[k] === 'object' && Monsters[k].id);
