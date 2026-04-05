const Pathfinding = (() => {

  function findPath(startR, startC, towerGrid) {
    const visited = Array.from({length: C.ROWS}, () => new Uint8Array(C.COLS));
    const prev    = Array.from({length: C.ROWS}, () => new Array(C.COLS).fill(null));
    const queue   = [{r: startR, c: startC}];
    visited[startR][startC] = 1;
    const dirs = [{r:0,c:1},{r:1,c:0},{r:0,c:-1},{r:-1,c:0}];
    let found = null;

    outer:
    while (queue.length > 0) {
      const cur = queue.shift();
      if (Grid.getCell(cur.r, cur.c) === C.CASTLE) { found = cur; break outer; }
      for (const d of dirs) {
        const nr = cur.r + d.r, nc = cur.c + d.c;
        if (nr >= 0 && nr < C.ROWS && nc >= 0 && nc < C.COLS &&
            !visited[nr][nc] && Grid.isWalkable(nr, nc, towerGrid)) {
          visited[nr][nc] = 1;
          prev[nr][nc] = cur;
          queue.push({r: nr, c: nc});
        }
      }
    }

    if (!found) return null;
    const path = [];
    let cur = found;
    while (cur) { path.unshift(cur); cur = prev[cur.r][cur.c]; }
    return path;
  }

  function hasAnyPath(towerGrid) {
    for (const r of C.SPAWN_ROWS) {
      if (findPath(r, 0, towerGrid)) return true;
    }
    return false;
  }

  return { findPath, hasAnyPath };
})();
