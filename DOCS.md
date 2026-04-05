# Tower Defense — Dokumentacja Techniczna

> Pełna dokumentacja implementacji. README.md zawiera skrót i status segmentów.

---

## Spis treści

1. [Architektura ogólna](#1-architektura-ogólna)
2. [Przepływ danych i inicjalizacja](#2-przepływ-danych-i-inicjalizacja)
3. [config.js — stałe gry](#3-configjs--stałe-gry)
4. [grid.js — siatka i rendering](#4-gridjs--siatka-i-rendering)
5. [pathfinding.js — BFS](#5-pathfindingjs--bfs)
6. [mapObjects.js — obiekty mapy](#6-mapobjectsjs--obiekty-mapy)
7. [towers.js — wieże](#7-towersjs--wieże)
8. [enemies.js — wrogowie](#8-enemiesjs--wrogowie)
9. [combat.js — walka i pociski](#9-combatjs--walka-i-pociski)
10. [audio.js — dźwięk i muzyka](#10-audiojs--dźwięk-i-muzyka)
11. [ui.js — interfejs](#11-uijs--interfejs)
12. [game.js — główna pętla](#12-gamejs--główna-pętla)
13. [Typy kafelków](#13-typy-kafelków)
14. [Stany gry](#14-stany-gry)
15. [Dodawanie nowych elementów](#15-dodawanie-nowych-elementów)

---

## 1. Architektura ogólna

Gra działa w przeglądarce bez zewnętrznych bibliotek. Każdy segment to IIFE
zwracające publiczne API (`const Foo = (() => { ... return { ... }; })()`).

### Zależności między modułami

```
config.js       — brak zależności, ładowany pierwszy
grid.js         — czyta C.*
pathfinding.js  — czyta C.*, woła Grid.*
mapObjects.js   — czyta C.*, woła Grid.*, Pathfinding.*, Towers.*
towers.js       — czyta C.*, woła Grid.*, Game.gold, Game.wave
enemies.js      — czyta C.*, woła Grid.*, Pathfinding.*, Towers.*, Audio.*
combat.js       — czyta C.*, woła Towers.*, Enemies.*, Game.*, Audio.*, UI.*
audio.js        — brak zależności (Web Audio API)
ui.js           — woła Game.*, Towers.*, Audio.*
game.js         — orkiestruje wszystko, ładowany ostatni
```

### Kolejność `<script>` w index.html

```
config → audio → grid → pathfinding → towers → enemies → combat → ui → mapObjects → game
```

### Układ wizualny

```
Canvas 960×640px (30×20 kafelków × 32px)   +   Sidebar 200px HTML
```

---

## 2. Przepływ danych i inicjalizacja

```
window.load
  └─ Game.init()
       ├─ _generateSpawns()          → losowe {r,c}[] na krawędzi
       ├─ Grid.init(spawnPositions)  → wypełnia cells[][]
       ├─ MapObjects.init(spawns)    → losuje drzewa, waliduje BFS
       ├─ Towers.init()              → czyści siatki wież
       ├─ Enemies.init()             → czyści listę wrogów
       ├─ Combat.init()              → czyści pociski
       ├─ UI.init()                  → binduje przyciski sidebar
       └─ Audio.init()               → rejestruje listener na pierwszy klik
```

### Główna pętla (`requestAnimationFrame`)

```
_loop(timestamp)
  dt = min((ts - lastTime) / 1000, 0.1)   ← cap na 100ms (tab nieaktywny)
  _update(dt, ts)
    ├─ spawnowanie goblinów (timer)
    ├─ Enemies.update(dt)
    ├─ Combat.update(dt, ts)
    └─ sprawdzenie dotarcia do zamku
  _render()
    ├─ Grid.draw(...)
    ├─ Towers.draw(...)
    ├─ range kółka
    ├─ Enemies.draw(...)
    ├─ Combat.draw(...)
    └─ UI.drawFloats(...)
```

---

## 3. config.js — stałe gry

Globalny obiekt `C`. Zmiana wartości tutaj wpływa na całą grę.

### Siatka

| Stała | Wartość | Opis |
|-------|---------|------|
| `C.COLS` | 30 | liczba kolumn |
| `C.ROWS` | 20 | liczba rzędów |
| `C.T` | 32 | rozmiar kafelka w px |

### Typy kafelków

| Stała | Wartość |
|-------|---------|
| `C.GRASS` | 0 |
| `C.TREE` | 1 |
| `C.SPAWN` | 2 |
| `C.CASTLE` | 3 |
| `C.TERRAIN` | 4 |

### Zamek i spawn

| Stała | Wartość | Opis |
|-------|---------|------|
| `C.CASTLE_ROWS` | [7..13] | rzędy zamku na prawej krawędzi |
| `C.SPAWN_COUNT` | 5 | liczba jam spawnu |
| `C.MAP_TREE_COUNT` | 14 | drzew terenowych na planszy |

### Ekonomia i rozgrywka

| Stała | Wartość |
|-------|---------|
| `C.START_GOLD` | 200 |
| `C.CASTLE_MAX_HP` | 20 |
| `C.WAVE_SIZE` | 10 |
| `C.WAVE_SPAWN_INTERVAL` | 2.0s |

### Definicje wież `C.TOWERS[id]`

Każda wieża ma pola:

```javascript
{
  name, cost, sellMult,      // wyświetlanie, koszt, % zwrotu przy sprzedaży
  hp, dmg, range, rate,      // bazowe statystyki
  splash,                    // promień splash w kafelkach (0 = brak)
  color, barrelColor,        // kolory do rysowania
  upgrades: [                // tablica 2 ulepszeń
    { cost, hp, dmg, range, rate, splash? }
  ]
}
```

| ID | cost | dmg | range | rate | splash |
|----|------|-----|-------|------|--------|
| WALL | 2g | 0 | 0 | 0 | 0 |
| ARCHER | 50g | 10 | 3.5 | 1.0/s | — |
| CANNON | 75g | 25 | 2.5 | 0.5/s | 1.0 |
| SNIPER | 100g | 40 | 5.5 | 0.33/s | — |

### Goblin `C.GOBLIN`

```javascript
{ hp: 60, speed: 1.5,        // kafelki/s
  reward: 15,                // złoto za zabicie
  dmgToCastle: 1,            // obrażenia zamku przy dotarciu
  dmgToTower: 20,            // obrażenia muru/wieży przy ataku
  atkRate: 1.0 }             // ataki/s na mury
```

---

## 4. grid.js — siatka i rendering

### Publiczne API

```javascript
Grid.init(spawnPositions)        // inicjalizacja, spawnPositions: {r,c}[]
Grid.getCell(r, c)               // zwraca typ kafelka lub -1 (poza mapą)
Grid.setCell(r, c, type)         // nadpisuje typ kafelka
Grid.isWalkable(r, c, towerGrid) // czy pole jest chodliwe (BFS/ruch wrogów)
Grid.draw(ctx, path, hover, selType, towerGrid)
```

### Logika `isWalkable`

Pole **NIE** jest chodliwe gdy:
- poza granicami mapy
- typ `TREE` lub `TERRAIN`
- w `towerGrid[r][c]` stoi wieża

### Rendering kafelków

Każdy kafelek rysowany proceduralnie na Canvas. Warianty wizualne trawy
oparte o pre-computed `grassV[r][c] = Math.random()` (raz przy `init()`).

Strzałka SPAWN obraca się zależnie od krawędzi:
- lewa (c=0) → prawo, prawa (c=29) → lewo, góra (r=0) → dół, dół (r=19) → góra

---

## 5. pathfinding.js — BFS

### Publiczne API

```javascript
Pathfinding.findPath(startR, startC, towerGrid)
// → [{r,c}, ...] od startu do najbliższego C.CASTLE, lub null

Pathfinding.hasAnyPath(towerGrid)
// → bool, sprawdza czy jakikolwiek spawn ma ścieżkę
```

### Implementacja

Klasyczne BFS z kolejką. Używa `Uint8Array` dla tablicy `visited` (szybsze
od zwykłej tablicy obiektów). Rekonstrukcja ścieżki przez tablicę `prev[][]`.

Kierunki: 4 (góra/dół/lewo/prawo), brak diagonalnych.

### Wyświetlanie ścieżki

`Game._buildCombinedPath()` uruchamia BFS z **każdego** punktu spawnu i
zwraca **unię** wszystkich kafelków na ścieżkach. Wynik przekazywany do
`Grid.draw()` jako parametr `path`.

---

## 6. mapObjects.js — obiekty mapy

Segment odpowiedzialny za generowanie losowych obiektów terenowych.

### Publiczne API

```javascript
MapObjects.init(spawnPositions)  // losuje i stawia obiekty
MapObjects.getPlaced()           // zwraca [{r, c, kind}]
```

### Algorytm

1. Zbierz wszystkie wnętrze-mapy kafelki `GRASS` jako kandydatów
2. Przetasuj (Fisher-Yates)
3. Dla każdego kandydata:
   - ustaw `Grid.setCell(r, c, C.TERRAIN)`
   - sprawdź BFS dla wszystkich spawnów
   - jeśli jakiś spawn nie ma ścieżki → cofnij (`setCell` z powrotem na GRASS)
   - jeśli OK → zapisz do `_placed[]`
4. Zatrzymaj po `C.MAP_TREE_COUNT` sukcesach

### Rozszerzanie

Dodaj nowy typ do `KINDS`:
```javascript
const KINDS = {
  tree: { tileType: C.TERRAIN, weight: 1 },
  rock: { tileType: C.TERRAIN, weight: 1 },  // nowy
};
```
Zaimplementuj jego rysowanie w `grid.js` (dodaj case w `drawTile`).
Jeśli potrzebuje osobnego typu kafelka — dodaj stałą w `config.js`
i zaktualizuj `Grid.isWalkable`.

---

## 7. towers.js — wieże

### Publiczne API

```javascript
Towers.init()
Towers.grid()                    // → _grid[][] (referencja live)
Towers.list()                    // → _list[] (referencja live)
Towers.canPlace(r, c)            // → bool
Towers.place(r, c, typeId)       // → tower obj lub null
Towers.sell(r, c)                // → zwrócone złoto (100% pre-fala, 50% po)
Towers.tryUpgrade(r, c)          // → bool, odejmuje gold z Game.gold
Towers.takeDamage(r, c, amount)  // → bool (true = zniszczona)
Towers.draw(ctx, selectedTile)
```

### Struktura obiektu wieży

```javascript
{
  r, c,           // pozycja na siatce
  typeId,         // 'WALL' | 'ARCHER' | 'CANNON' | 'SNIPER'
  level,          // 0/1/2 (lv1/lv2/lv3)
  hp, maxHp,      // aktualne i maksymalne HP
  dmg, range,     // aktualne statystyki (zmieniają się przy ulepszeniu)
  rate, splash,
  lastShot,       // timestamp (ms) ostatniego strzału
  totalCost,      // suma wydanego złota (koszt + ulepszenia) → podstawa sprzedaży
  angle,          // kąt lufy (aktualizowany przez combat.js)
}
```

### Logika sprzedaży

```javascript
const mult = Game.wave === 0 ? 1.0 : 0.5;
gold = Math.floor(tower.totalCost * mult);
```

### Stawianie wieży na murze (game.js)

Gdy gracz klika na WALL z wybranym innym typem — wall zostaje sprzedany
(z aktualnym mnożnikiem), nowa wieża postawiona, gracz płaci różnicę.

---

## 8. enemies.js — wrogowie

### Klasa `Goblin`

```javascript
new Goblin(spawnR, spawnC)
```

#### Stany (`this.state`)

| Stan | Opis |
|------|------|
| `walking` | porusza się po ścieżce BFS |
| `attacking` | stoi i atakuje blokujący mur |
| `dead` | zabitý przez wieżę |
| `reached` | dotarł do zamku |

#### Ruch

- Pozycja w pikselach (`this.x`, `this.y`), prędkość `C.GOBLIN.speed * C.T` px/s
- Co 0.5s wywołuje `recalcPath()` → BFS z aktualnej pozycji
- Po przeliczeniu `pathIdx = 1` (nie 0) — pomija aktualny kafelek, zapobiega drganiu
- Jeśli BFS zwraca null → przejście w stan `attacking`

#### Atakowanie muru

`_findAttackTarget(r, c)`: szuka wieży w tym samym rzędzie na prawo, fallback na najbliższą wieżę. Co `1/atkRate` sekund woła `Towers.takeDamage()`.

### Moduł `Enemies`

```javascript
Enemies.init()
Enemies.list()                   // → live array goblinów
Enemies.spawnGoblin(r, c)
Enemies.update(dt)
Enemies.draw(ctx)
Enemies.removeDeadAndReached()   // → { reached: N }, czyści listę
Enemies.allGone()                // → bool
```

---

## 9. combat.js — walka i pociski

### Publiczne API

```javascript
Combat.init()
Combat.update(dt, now)   // now = timestamp z requestAnimationFrame
Combat.draw(ctx)
```

### Cykl strzelania (`_towerShoot`)

Dla każdej wieży z `dmg > 0` (pomija WALL):
1. Sprawdź cooldown: `now - tower.lastShot < 1000 / tower.rate`
2. Szukaj najbliższego żywego wroga w `tower.range * C.T` px
3. Utwórz pocisk, ustaw `tower.angle` (dla animacji lufy)

### Prędkości pocisków

| Typ | px/s |
|-----|------|
| ARCHER | 280 |
| CANNON | 180 |
| SNIPER | 400 |

### Obrażenia

- **Normalny**: `target.takeDamage(dmg)`
- **Splash** (CANNON): dla każdego wroga w `splash * C.T` px od punktu trafienia

Złoto przyznawane dopiero gdy `enemy.dead === true` po `takeDamage`.

### Anti-spam

Per-dźwięk cooldown w `audio.js` (`COOLDOWN = { arrow: 80, cannon: 120, ... }`).

---

## 10. audio.js — dźwięk i muzyka

### Publiczne API

```javascript
Audio.init()                // rejestruje listener na pierwszy klik
Audio.play(name)            // odtwarza efekt dźwiękowy
Audio.setMusicVol(0..1)
Audio.setSfxVol(0..1)
```

### Efekty dźwiękowe

| Nazwa | Wyzwalacz |
|-------|-----------|
| `place` | postawienie wieży/muru |
| `sell` | sprzedaż wieży |
| `arrow` | strzał łucznika |
| `cannon` | strzał kanona |
| `sniper` | strzał snajpera |
| `goblinDeath` | śmierć goblina |
| `goblinAttack` | goblin atakuje mur |
| `castleHit` | zamek oberwał |
| `waveStart` | start fali |
| `gameOver` | koniec gry |

### Muzyka proceduralna

Trzy warstwy zbudowane z Web Audio API:
1. **Brown noise** (filtrowany bandpass 120–800 Hz, gain 0.10) — szum dżungli
2. **Bass drone** — sinusoidy A1 (55 Hz), E2, A2
3. **Melodia** — losowe nuty z gamy A minor pentatonicznej
   `[220, 261, 293, 329, 392, 440, 523]`, co 0.6–3 s

### Opóźniony start (browser policy)

`AudioContext` tworzony dopiero przy pierwszym `click` na dokumencie.
`Audio.init()` tylko rejestruje `{ once: true }` listener.

---

## 11. ui.js — interfejs

### Publiczne API

```javascript
UI.init()                         // binduje wszystkie przyciski HTML
UI.update(dt)                     // aktualizuje floating texts
UI.updateSidebar()                // odświeża gold/castleHP/wave + przycisk affordability
UI.showTowerInfo(tile)            // pokazuje panel wybranej wieży
UI.hideInfo()
UI.setWaveStatus(text)
UI.setStartBtnEnabled(bool)
UI.showFloatingText(text, x, y)   // floating text na canvas
UI.drawFloats(ctx)                // renderuje floating texts
```

### Floating texts

Animowane etykiety (`+15g`, `-1`) rysowane na Canvas.
Unoszą się w górę przez 1.2s, zanikają przez `alpha = life / maxLife`.

### Panel wieży

Wyświetla `ti-name`, `ti-hp`, `ti-dmg`, `ti-range`, `ti-rate`.
Przycisk Ulepsz pokazuje koszt następnego poziomu i jest disabled gdy brak złota.
Przycisk Sprzedaj pokazuje procent zwrotu: `100%` przed falą 1, `50%` po.

---

## 12. game.js — główna pętla

### Stan globalny (przez gettery/settery na `pub`)

```javascript
Game.gold          // get/set — setter woła UI.updateSidebar()
Game.castleHP      // get
Game.wave          // get
Game.selectedTowerType   // get/set
Game.selectedTile        // get/set
```

### Stany gry

```
prep → wave → prep → wave → ... → gameover
                                → won (TODO)
```

### Generowanie spawnów `_generateSpawns()`

Zbiera wszystkie kafelki krawędziowe (góra, dół, lewo, prawa bez zamku),
filtruje te w dystansie Manhattan < 2 od zamku,
tasuje i zwraca pierwsze `C.SPAWN_COUNT`.

### Logika kliku (`_onClick`)

```
klik na kafelek
├─ jest wieża?
│   ├─ to WALL + wybrany typ wieży → zamień (sprzedaj mur, postaw wieżę)
│   └─ inna wieża → zaznacz (showTowerInfo)
├─ wybrany typ wieży + kafelek GRASS → postaw wieżę
└─ nic nie pasuje → odznacz wszystko
```

### `resetGame()`

Resetuje wszystkie zmienne stanu, woła `init()` poszczególnych modułów ponownie.
Nie niszczy nasłuchiwaczy Canvas (dodawane tylko raz w `init()`).

### Wizualizacja zasięgu

Trzy scenariusze:
- **Podgląd** (hover na trawie + wybrany typ): żółte kółko
- **Zaznaczona wieża**: niebieskie kółko
- **Hover na istniejącej wieży**: zielone kółko

---

## 13. Typy kafelków

| Typ | Stała | Chodliwy | Budowalny | Opis |
|-----|-------|----------|-----------|------|
| Trawa | `C.GRASS` | ✅ | ✅ | zwykłe pole |
| Las (krawędź) | `C.TREE` | ❌ | ❌ | obwódka mapy |
| Jama spawnu | `C.SPAWN` | ✅ | ❌ | wejście wrogów |
| Zamek | `C.CASTLE` | ✅ | ❌ | cel wrogów |
| Teren | `C.TERRAIN` | ❌ | ❌ | losowe drzewa itp. |

---

## 14. Stany gry

| Stan | Opis |
|------|------|
| `prep` | gracz buduje obronę, można stawiać/sprzedawać |
| `wave` | trwa fala, wrogowie idą |
| `gameover` | zamek zniszczony, pętla zatrzymana |
| `won` | (TODO) wszystkie fale pokonane |

---

## 15. Dodawanie nowych elementów

### Nowy typ wieży

1. Dodaj definicję w `C.TOWERS` (`config.js`)
2. Dodaj przycisk w `index.html` + ikonę w `css/style.css`
3. Jeśli wieża ma specjalne zachowanie (np. spowalnianie) — obsłuż w `combat.js`
4. Jeśli wieża wygląda inaczej — dodaj case w `towers.js → _drawTower()`

### Nowy typ wroga

1. Dodaj definicję w `config.js`
2. Stwórz klasę w `enemies.js` (wzoruj się na `Goblin`)
3. Dodaj metodę `spawnXxx(r, c)` w module `Enemies`
4. Wywołuj z `game.js` w logice fal

### Nowy obiekt mapy

1. Opcjonalnie dodaj nowy typ kafelka w `config.js`
2. Zaktualizuj `Grid.isWalkable()` jeśli nowy typ blokuje ruch
3. Dodaj case rysowania w `grid.js → drawTile()`
4. Dodaj wpis do `KINDS` w `mapObjects.js`

### Nowa fala

Logika fal w `game.js → startWave()`:
```javascript
totalToSpawn = C.WAVE_SIZE + (wave - 1) * 3;
```
Skład fali (typy wrogów) na razie jednolity. Docelowo: tablica konfiguracji
per fala z różnymi typami i odstępami spawnu.

### Nowy efekt dźwiękowy

Dodaj funkcję w `SFX` (`audio.js`) używając pomocników `_osc()` i `_noise()`,
następnie wywołaj `Audio.play('nazwaEfektu')` w odpowiednim miejscu.
