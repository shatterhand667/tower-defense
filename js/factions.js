// ─── System Stronnictw ────────────────────────────────────────────────────────
// Centralny plik systemu synergii.
// Nie modyfikuj innych plików aby zmienić stronnictwa/wieże — rób to tutaj.
//
// Zawiera:
//   DEFS          — 8 stronnictw z efektami Bronze/Silver/Gold
//   TOWER_FACTIONS — przypisanie każdej wieży do 2 stronnictw
//   TOWER_STATS   — statystyki wszystkich 16 wież (referencja + planowane)
//   getActiveTiers — liczenie aktywnych synergii na podstawie postawionych wież
//   getTowerFactions — stronnictwa konkretnej wieży

const Factions = (() => {

  // ─── Definicje stronnictw ─────────────────────────────────────────────────
  const DEFS = {

    PRECYZJA: {
      name: 'Precyzja', icon: '⚔️',
      thresholds: [2, 3, 4],   // Bronze / Silver / Gold
      effects: [
        '+25% zasięg wież Precyzji',
        'Strzały ignorują lekką zbroję (LIGHT armor = brak redukcji)',
        '25% szansa na trafienie krytyczne (2× DMG)',
      ],
    },

    DESTRUKCJA: {
      name: 'Destrukcja', icon: '💥',
      thresholds: [2, 3, 4],
      effects: [
        '+40% promień splash',
        'Ofiary splash spowalniają się o 30% przez 2s',
        'Kill powoduje eksplozję łańcuchową (50% DMG, promień 1 kafelka)',
      ],
    },

    FORTECA: {
      name: 'Forteca', icon: '🛡️',
      thresholds: [2, 3, 4],
      effects: [
        '+100% HP murów i Golema',
        'Zamek regeneruje 1 HP co 20s podczas fali',
        'Zniszczony mur/Golem wybucha — 60 DMG w promieniu 1.5 kafelka',
      ],
    },

    MECHANIKA: {
      name: 'Mechanika', icon: '⚙️',
      thresholds: [2, 3, 4],
      effects: [
        '−20% cooldown wież Mechaniki',
        'Co 5. strzał zadaje 2× DMG',
        'Po zabiciu wroga — 3s bez cooldownu dla tej wieży',
      ],
    },

    NATURA: {
      name: 'Natura', icon: '🌿',
      thresholds: [2, 3, 4],
      effects: [
        'Trafienia spowalniają wroga o 25% przez 2s',
        'Spowolnieni wrogowie tracą 4 HP/s (trucizna)',
        'Spowolnienie 50% + efekt przeskakuje na wrogów w promieniu 1.5 kafelka',
      ],
    },

    ZYWIOL: {
      name: 'Żywioł', icon: '🔥',
      thresholds: [2, 3, 4],
      effects: [
        '20% szansa na podpalenie (8 DMG/s przez 3s)',
        'Podpaleni wrogowie przy śmierci eksplodują (30 DMG, promień 1.5 kafelka)',
        'Podpalenie przeskakuje automatycznie na najbliższego wroga w promieniu 2 kafelków',
      ],
    },

    CIEN: {
      name: 'Cień', icon: '🌑',
      thresholds: [2, 3, 4],
      effects: [
        'Trafienia nakładają stack Cienia (max 3, każdy stack = −10% resistancji wroga)',
        'Wrogowie z 3 stackami Cienia otrzymują 2× DMG od wszystkich wież',
        'Co 10. trafienie ogłusza wroga na 2s',
      ],
    },

    BOGACTWO: {
      name: 'Bogactwo', icon: '💎',
      thresholds: [2, 3, 4],
      effects: [
        '+5g za zabicie Drzewca / Anakondy / Ogra',
        '+15g bonus na początku każdej fali',
        'Wieże Bogactwa generują 1g co 10s podczas fali',
      ],
    },

  };

  // ─── Przypisanie wież do stronnictw ───────────────────────────────────────
  // Mur jest celowo pominięty — jest poza systemem stronnictw (mechanika maze)
  // Każda wieża należy do dokładnie 2 stronnictw
  const TOWER_FACTIONS = {
    ARCHER:         ['PRECYZJA',   'NATURA'    ],
    CANNON:         ['DESTRUKCJA', 'MECHANIKA' ],
    SNIPER:         ['PRECYZJA',   'MECHANIKA' ],
    WIEZA_OGNIA:    ['ZYWIOL',     'DESTRUKCJA'],
    WIEZA_LODU:     ['ZYWIOL',     'NATURA'    ],
    WIEZA_TRUCIZNY: ['NATURA',     'CIEN'      ],
    WIEZA_BLYSK:    ['ZYWIOL',     'MECHANIKA' ],
    BALISTOR:       ['PRECYZJA',   'DESTRUKCJA'],
    KATAPULTA:      ['DESTRUKCJA', 'BOGACTWO'  ],
    MUR_KOLCZASTY:  ['FORTECA',    'CIEN'      ],
    MENNICA:        ['BOGACTWO',   'FORTECA'   ],
    KUSZNIK:        ['PRECYZJA',   'BOGACTWO'  ],
    WIEZA_OBS:      ['BOGACTWO',   'MECHANIKA' ],
    WIEZA_CIENIA:   ['CIEN',       'ZYWIOL'    ],
    GOLEM:          ['FORTECA',    'NATURA'    ],
    BASTION:        ['FORTECA',    'CIEN'      ],
  };

  // ─── Weryfikacja: każde stronnictwo ma dokładnie 4 wieże ─────────────────
  // PRECYZJA:   Łucznik, Snajper, Balistor, Kusznik
  // DESTRUKCJA: Kanon, W.Ognia, Balistor, Katapulta
  // FORTECA:    Mur Kolczasty, Mennica, Golem, Bastion
  // MECHANIKA:  Kanon, Snajper, W.Błyskawicy, W.Obserwacyjna
  // NATURA:     Łucznik, W.Lodu, W.Trucizny, Golem
  // ŻYWIOŁ:     W.Ognia, W.Lodu, W.Błyskawicy, W.Cienia
  // CIEŃ:       W.Trucizny, Mur Kolczasty, W.Cienia, Bastion
  // BOGACTWO:   Katapulta, Mennica, Kusznik, W.Obserwacyjna

  // ─── Statystyki wież (referencja) ─────────────────────────────────────────
  // Wieże zaimplementowane: WALL, ARCHER, CANNON, SNIPER, GOLEM
  // Pozostałe: zaplanowane — statystyki gotowe do implementacji
  const TOWER_STATS = {

    // ── Zaimplementowane ──────────────────────────────────────────────────
    WALL: {
      name: 'Mur', cost: 2,
      hp: 80, dmg: 0, range: 0, rate: 0, splash: 0,
      note: 'Poza systemem stronnictw. Bazowa mechanika maze.',
    },
    ARCHER: {
      name: 'Łucznik', cost: 50,
      hp: 100, dmg: 10, range: 3.5, rate: 1.0, splash: 0,
      factions: ['PRECYZJA', 'NATURA'],
    },
    CANNON: {
      name: 'Kanon', cost: 75,
      hp: 150, dmg: 25, range: 2.5, rate: 0.5, splash: 1.0,
      factions: ['DESTRUKCJA', 'MECHANIKA'],
    },
    SNIPER: {
      name: 'Snajper', cost: 100,
      hp: 80, dmg: 40, range: 5.5, rate: 0.33, splash: 0,
      factions: ['PRECYZJA', 'MECHANIKA'],
    },
    GOLEM: {
      name: 'Golem', cost: 110,
      hp: 300, dmg: 8, range: 1.0, rate: 0.5, splash: 0,
      tauntRadius: 2.5,   // kafelki — wrogowie w tym promieniu atakują Golema
      regen: 5,           // HP/s podczas fali
      innate: 'Taunt: zmusza wrogów w promieniu 2.5 kafelka do ataku. Regen 5 HP/s. Naprawa po fali.',
      factions: ['FORTECA', 'NATURA'],
    },

    // ── Zaplanowane (do implementacji) ────────────────────────────────────
    WIEZA_OGNIA: {
      name: 'Wieża Ognia', cost: 80,
      hp: 120, dmg: 12, range: 2.0, rate: 0.8, splash: 0.8,
      innate: 'Podpalenie: 8 DMG/s przez 3s',
      factions: ['ZYWIOL', 'DESTRUKCJA'],
    },
    WIEZA_LODU: {
      name: 'Wieża Lodu', cost: 70,
      hp: 110, dmg: 8, range: 3.0, rate: 0.7, splash: 0,
      innate: 'Spowalnia o 20% przez 2s',
      factions: ['ZYWIOL', 'NATURA'],
    },
    WIEZA_TRUCIZNY: {
      name: 'Wieża Trucizny', cost: 65,
      hp: 90, dmg: 5, range: 3.0, rate: 0.9, splash: 0,
      innate: 'Trucizna: 3 HP/s przez 4s',
      factions: ['NATURA', 'CIEN'],
    },
    WIEZA_BLYSK: {
      name: 'Wieża Błyskawicy', cost: 90,
      hp: 100, dmg: 18, range: 4.0, rate: 1.5, splash: 0,
      innate: 'Łańcuch błyskawicy na 1 dodatkowego wroga',
      factions: ['ZYWIOL', 'MECHANIKA'],
    },
    BALISTOR: {
      name: 'Balistor', cost: 120,
      hp: 90, dmg: 55, range: 7.0, rate: 0.25, splash: 0,
      innate: 'Pocisk przebija przez kolejnych wrogów',
      factions: ['PRECYZJA', 'DESTRUKCJA'],
    },
    KATAPULTA: {
      name: 'Katapulta', cost: 150,
      hp: 130, dmg: 40, range: 4.0, rate: 0.3, splash: 2.0,
      factions: ['DESTRUKCJA', 'BOGACTWO'],
    },
    MUR_KOLCZASTY: {
      name: 'Mur Kolczasty', cost: 20,
      hp: 140, dmg: 0, range: 0, rate: 0, splash: 0,
      innate: '15 DMG atakującemu wrogowi',
      factions: ['FORTECA', 'CIEN'],
    },
    MENNICA: {
      name: 'Mennica', cost: 60,
      hp: 80, dmg: 0, range: 0, rate: 0, splash: 0,
      innate: '+1g co 10s podczas fali',
      factions: ['BOGACTWO', 'FORTECA'],
    },
    KUSZNIK: {
      name: 'Kusznik', cost: 70,
      hp: 90, dmg: 12, range: 3.0, rate: 1.5, splash: 0,
      factions: ['PRECYZJA', 'BOGACTWO'],
    },
    WIEZA_OBS: {
      name: 'Wieża Obserwacyjna', cost: 80,
      hp: 70, dmg: 0, range: 0, rate: 0, splash: 0,
      innate: '+15% szybkość ataku sąsiednich wież (promień 1 kafelka)',
      factions: ['BOGACTWO', 'MECHANIKA'],
    },
    WIEZA_CIENIA: {
      name: 'Wieża Cienia', cost: 85,
      hp: 85, dmg: 15, range: 3.5, rate: 0.8, splash: 0,
      factions: ['CIEN', 'ZYWIOL'],
    },
    BASTION: {
      name: 'Bastion', cost: 120,
      hp: 250, dmg: 30, range: 1.5, rate: 0.6, splash: 0,
      factions: ['FORTECA', 'CIEN'],
    },

  };

  // ─── Publiczne API ────────────────────────────────────────────────────────

  // Zwraca aktywne stronnictwa i ich tier na podstawie listy ID wież na planszy
  // placedTypeIds: string[] — lista typeId aktywnych wież
  // Zwraca: { FACTION_ID: { count, tier } }
  function getActiveTiers(placedTypeIds) {
    const counts = {};
    for (const typeId of placedTypeIds) {
      const facs = TOWER_FACTIONS[typeId];
      if (!facs) continue;
      for (const f of facs) counts[f] = (counts[f] || 0) + 1;
    }
    const active = {};
    for (const [fac, count] of Object.entries(counts)) {
      const thresholds = DEFS[fac].thresholds;
      let tier = 0;
      for (let i = 0; i < thresholds.length; i++) {
        if (count >= thresholds[i]) tier = i + 1;
      }
      if (tier > 0) active[fac] = { count, tier };
    }
    return active;
  }

  // Zwraca definicje stronnictw dla konkretnej wieży
  function getTowerFactions(typeId) {
    return (TOWER_FACTIONS[typeId] || []).map(f => ({ id: f, ...DEFS[f] }));
  }

  // Sprawdza czy dane stronnictwo jest aktywne na podanym poziomie (1=Bronze, 2=Silver, 3=Gold)
  function hasTier(factionId, tier, placedTypeIds) {
    const active = getActiveTiers(placedTypeIds);
    return active[factionId] ? active[factionId].tier >= tier : false;
  }

  return { DEFS, TOWER_FACTIONS, TOWER_STATS, getActiveTiers, getTowerFactions, hasTier };

})();
