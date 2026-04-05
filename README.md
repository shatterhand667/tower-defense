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
  monsters.js     — rejestr typów wrogów (id, tier, create factory)
  enemies.js      — klasy Goblin/Drzewiec/Anaconda, ruch po ścieżce, ataki na mury
  combat.js       — strzelanie wież, pociski, obrażenia, splash
  audio.js        — Web Audio API: ambient muzyka proceduralna + efekty SFX
  ui.js           — sidebar HTML, floating text, info o wieży
  mapObjects.js   — losowe drzewa terenowe z walidacją BFS
  game.js         — główna pętla, eventy myszy, zarządzanie falami, kill-eventy
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

## Wrogowie (`js/monsters.js`)

| ID | Tier | HP | Regen | Zbroja | Prędkość | Nagroda | Trigger |
|----|------|----|-------|--------|----------|---------|---------|
| GOBLIN | 1 | 60 | — | Brak | 1.5 | 15g | główna fala |
| DRZEWIEC | 2 | 120 | 1/s | Lekka | 1.1 | 25g | co 7 goblinów |
| ANACONDA | 3 | 280 | 2/s | Lekka | 0.85 | 60g | po 10 goblinach (1×/falę) |
| OGR | 4 | 600 | 3/s | Ciężka | 0.55 | 120g | co 50 goblinów (globalnie) |

**Typy zbroi:** Lekka = −50% od łucznika (pierce) · Ciężka = −75% od kanionu (splash)

## Status segmentów

| Segment | Status |
|---------|--------|
| Silnik & mapa | ✅ gotowy |
| Pathfinding BFS | ✅ gotowy |
| System wież | ✅ gotowy |
| Rejestr potworów | ✅ gotowy |
| System wrogów | ✅ gotowy (Goblin, Drzewiec, Anaconda, Ogr) |
| System zbroi i regeneracji | ✅ gotowy |
| System fal | ✅ beta (nieskończone fale) |
| System walki | ✅ gotowy |
| Ekonomia & UI | ✅ gotowy |
| Audio | ✅ gotowy |
| Obiekty mapy | ✅ gotowy |
| Win/Lose & Polish | 🔲 do zrobienia |

## Do zrobienia
- Więcej fal z rosnącą trudnością i nowym składem
- Ekran wygranej
- Dodatkowe plansze
