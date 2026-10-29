# Backbone

Browser management game: grow a hosting company from a 2005 basement to an own datacenter. Static site, TypeScript + Vite + React + Zustand, simulation in plain TypeScript.

Design: `docs/design/gdd.md` (game), `docs/design/economy.md` (numbers), `DESIGN.md` (visual system).

## Commands

- `npm run dev` starts Vite on port 5173.
- `npm run typecheck`, `npm test` (Vitest), `npm run build`, `npm run balance`.

## Layout

- `src/sim/` never imports React. Numbered folders: `00-core` (rng, time, money), `10-catalog` (prices, hardware), `50-state.ts` (state and new game), `60-infra` (derived infra status), `88-tick`, `90-actions` (every player action), `91-save`.
- `src/ui/desktop/` shell (menu bar, dock, windows), `src/ui/apps/` one folder or file per app, `src/ui/art/` code-drawn rack and device fronts.
- `src/i18n/en.ts` player-facing strings by key.
- `tests/` one seeded suite per feature.

## Hard rules

- Static site only; never add a server.
- Every real company appears as a pun (Dwell, Hewlett-Packet, SuperMacro, Sysko).
- Player actions go through `src/sim/90-actions`; the UI calls them via the store's `act`, tests call them directly.
- Old saves must keep loading: every new state field gets a default in `newGame`, and `deserialize` fills it.
- Every sim change comes with a seeded test.
- Text the simulation produces (events, notifications, ledger lines, action errors) goes through i18n keys. UI labels stay inline in components for now; the game is English only.
- Every change that lands in main adds one or two bullets to CHANGELOG.md under today's `## YYYY-MM-DD` heading: one player-facing sentence each saying what changed in the game, no file or code names. The game shows new bullets when it offers a reload, and tests/update.test.ts checks the shape.
- Commit each change as soon as it is green, and push to main often. Stage only the paths your change touches, since other work may be in progress in the same tree.
- No em dashes in code, comments, docs or UI copy.
- UI copy: labels and values only, no filler hints; captions are full sentences with a verb.
