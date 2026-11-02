# Tech stack and project structure

Build it with TypeScript, Vite and React, keep the simulation as plain TypeScript, and organize the repo the way Series of Tubes does. That means numbered topic folders, a CLAUDE.md with hard rules, skills for recurring jobs, and one test suite per feature. The code is MIT-licensed.

| Layer | Choice | Why |
| --- | --- | --- |
| Language and build | TypeScript, Vite | Fast reload; builds a static site |
| Desktop and apps | React + Zustand | A window manager with a dozen app panels is UI work, React's strength |
| Rack and room views | SVG drawn by React components | Crisp device fronts at any zoom; no game engine needed |
| Europe map | Canvas 2D + d3-geo, Natural Earth outlines | Series of Tubes draws its map on a plain canvas too |
| Charts | uPlot | Many live series, cheap to draw |
| Simulation | Plain TypeScript, seeded randomness, an hourly tick | Testable without a browser; same seed, same game |
| Saves | localStorage, versioned and compressed; old saves repaired on load | Switch to IndexedDB if saves outgrow localStorage's ~5 MB |
| Tests | Vitest for the simulation, Playwright for the UI | Claude Code can run both by itself |
| Hosting | GitHub Pages; a service worker for offline play | No server at all |

**Folder layout**

```text
CLAUDE.md                 hard rules, layout, commands
.claude/skills/           edit-the-game, add-content, write-tests, balance, release
docs/design/              game design, economy model, first-hour script
docs/ARCHITECTURE.md      how the pieces fit
docs/adr/                 decision records (static only, saves, i18n)
src/sim/                  pure TypeScript, never imports React
  00-core/                seeded random, time, money, ids
  10-catalog/             hardware, products, licenses, prices
  20-world/               cities, datacenters, carriers, exchanges
  30-market/              customer profiles, demand, competitors
  40-company/             staff, levels, reputation
  50-state.ts             game state and new-game setup
  60-infra/               locations, racks, ports, clusters
  70-network/             routing, transit billing, peering
  80-business/            tickets, invoices, dunning, marketing
  85-incidents/           failures, outages, DDoS
  88-tick/                the hourly and monthly tick
  90-actions/             every player action, used by UI and tests alike
  91-save/                save, load, repair old saves
src/ui/desktop/           menu bar, dock, windows, notifications
src/ui/apps/              one folder per app
src/ui/art/               code-drawn rack and server fronts
src/i18n/                 player-facing strings by label
tests/                    one seeded suite per feature, save fixtures
.github/workflows/        CI, deploy to Pages, @claude action
```

**Hard rules for CLAUDE.md,** adapted from Series of Tubes:

- Static site only; never add a server.
- Every real company appears as a pun.
- Player actions go through `90-actions`, so the UI and tests use the same path.
- Old saves must keep loading: every new field gets a default when a save is repaired on load.
- Every change comes with a test, using seeded randomness and never luck.
- Player-facing text goes through i18n labels, never sentences glued together from fragments.
