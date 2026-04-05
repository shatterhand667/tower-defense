// ─── Segment: Obiekty Mapy ────────────────────────────────────────────────────
// Odpowiada za losowe rozmieszczanie obiektów terenowych (drzewa, głazy, itp.)
// na planszy przed startem gry. Każdy obiekt ustawia kafelek na typ C.TERRAIN
// (niechodliwy, niebudo­walny). BFS jest weryfikowany po każdym postawieniu.
//
// Rozszerzanie: dodaj nowe rodzaje do KINDS, zaimplementuj ich rysowanie w grid.js.

const MapObjects = (() => {

  const KINDS = {
    tree: { tileType: C.TERRAIN, weight: 1 },
    // rock: { tileType: C.TERRAIN_ROCK, weight: 1 },  // przyszłe typy
  };

  let _placed = []; // [{r, c, kind}]

  function init(spawnPositions) {
    _placed = [];

    // Zbierz kandydatów: wnętrze mapy, tylko GRASS
    const candidates = [];
    for (let r = 1; r < C.ROWS - 1; r++)
      for (let c = 1; c < C.COLS - 1; c++)
        if (Grid.getCell(r, c) === C.GRASS) candidates.push({r, c});

    // Przetasuj
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Próbuj stawiać drzewa — cofaj jeśli blokują wszystkie ścieżki
    let placed = 0;
    for (const pos of candidates) {
      if (placed >= C.MAP_TREE_COUNT) break;

      Grid.setCell(pos.r, pos.c, C.TERRAIN);

      const allPathsOk = spawnPositions.every(sp =>
        Pathfinding.findPath(sp.r, sp.c, Towers.grid())
      );

      if (allPathsOk) {
        _placed.push({...pos, kind: 'tree'});
        placed++;
      } else {
        Grid.setCell(pos.r, pos.c, C.GRASS); // cofnij
      }
    }
  }

  function getPlaced() { return _placed; }

  return { init, getPlaced };
})();
