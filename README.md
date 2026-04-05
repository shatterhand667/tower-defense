# Tower Defense — Dżungla

Przeglądarkowa gra tower defense z mechaniką budowania labiryntu. Czyste HTML5 Canvas + JavaScript, zero zewnętrznych bibliotek.

## Uruchomienie
Otwórz `index.html` w przeglądarce.

## Mechanika
- Budujesz **mury i wieże** które blokują ścieżkę wrogów → tworzysz labirynt
- Wrogowie używają **BFS** — zawsze idą najkrótszą wolną drogą
- Jeśli zablokujesz wszystkie ścieżki → wrogowie **niszczą mur**
- Wrogowie wchodzą z lewej (5 punktów spawnu), cel: zamek po prawej

## Struktura projektu

```
js/
  config.js       — wszystkie stałe (siatka, typy wież, statystyki wrogów)
  grid.js         — siatka 30×20, rendering kafelków (trawa/drzewo/spawn/zamek)
  pathfinding.js  — BFS, unia ścieżek ze wszystkich punktów spawnu
  towers.js       — stawianie, ulepszanie (lv 1→3), sprzedaż wież
  enemies.js      — klasa Goblin, ruch po ścieżce, tryb ataku na mury
  combat.js       — strzelanie wież, pociski, obrażenia, splash
  audio.js        — Web Audio API: ambient muzyka proceduralna + efekty SFX
  ui.js           — sidebar HTML, floating text, info o wieży
  game.js         — główna pętla, eventy myszy, zarządzanie falami
css/
  style.css
index.html
```

## Wieże (`js/config.js` → `C.TOWERS`)

| ID | Nazwa | Koszt | DMG | Zasięg | Strzały/s | Splash |
|----|-------|-------|-----|--------|-----------|--------|
| WALL | Mur | 2g | — | — | — | — |
| ARCHER | Łucznik | 50g | 10 | 3.5 | 1.0 | — |
| CANNON | Kanon | 75g | 25 | 2.5 | 0.5 | 1.0 |
| SNIPER | Snajper | 100g | 40 | 5.5 | 0.33 | — |

Każda wieża ma 3 poziomy ulepszeń. Sprzedaż: 100% przed falą 1, 50% po.

## Wrogowie (`C.GOBLIN`)
- **Goblin** — HP 60, prędkość 1.5 kafelka/s, nagroda 15g

## Status segmentów

| Segment | Status |
|---------|--------|
| Silnik & mapa | ✅ gotowy |
| Pathfinding BFS | ✅ gotowy |
| System wież | ✅ gotowy |
| System wrogów | ✅ gotowy |
| System fal | ✅ beta (1 fala) |
| System walki | ✅ gotowy |
| Ekonomia & UI | ✅ gotowy |
| Audio | ✅ gotowy |
| Win/Lose & Polish | 🔲 do zrobienia |

## Do zrobienia
- Więcej fal z rosnącą trudnością
- Dodatkowe typy wrogów (zwiadowca, czołg)
- Ekran wygranej
- Dodatkowe plansze
