# Backbone

Browser management game: grow a hosting company from a 2005 basement to an own datacenter. Static site, TypeScript + Vite + React + Zustand, simulation in plain TypeScript.

Design: `docs/design/gdd.md` (game), `docs/design/economy.md` (numbers), `DESIGN.md` (visual system).

## Commands

- `npm run dev` starts Vite on port 5173.
- `npm run typecheck`, `npm test` (Vitest), `npm run build`, `npm run balance`.

## Layout

- `src/sim/` never imports React. Numbered folders: `00-core` (rng, time, money), `10-catalog` (prices, hardware), `50-state.ts` (state and new game), `60-infra` (derived infra status), `88-tick`, `90-actions` (every player action), `91-save`.
- `src/ui/desktop/` shell (menu bar, dock, windows), `src/ui/apps/` one folder or file per app, `src/ui/art/` code-drawn rack and device fronts.
- `src/i18n/` English by key (`en.ts`, topic files, `ui-<area>.ts` for UI text); translations in `src/i18n/<lang>/` mirror the English file names. `lang.ts` picks and loads the language.
- `tests/` one seeded suite per feature.

## Hard rules

- Static site only; never add a server.
- Every real company appears as a pun (Dwell, Hewlett-Packet, SuperMacro, Sysko).
- Player actions go through `src/sim/90-actions`; the UI calls them via the store's `act`, tests call them directly.
- Old saves must keep loading: every new state field gets a default in `newGame`, and `deserialize` fills it.
- Every sim change comes with a seeded test.
- Every player-facing string goes through `t(key, params)`, in the sim and the UI. New English keys need the same key in every `src/i18n/<lang>/` file; `tests/i18n.test.ts` checks keys and parameters. Ids, app names used as ids and saved values stay English; translate only where they are shown. Format numbers and dates with `LOCALE` from `src/i18n/lang.ts`.
- Work on a branch and open a pull request for every change; never commit to main directly. Commit each piece as soon as it is green and push the branch often. Stage only the paths your change touches, since other work may be in progress in the same tree. Commit messages stay short, so the pull request description says what changed and why in plain sentences: the pull request history is the release log. Merge with `gh pr merge --auto --squash --delete-branch`.
- CHANGELOG.md is written at release time, never per change. When asked for a release: find the last release tag (`gh release list --limit 1`), read every commit message and merged pull request since it (`git log <tag>..origin/main`, `gh pr list --state merged --search "merged:>=<tag date>" --json number,title,body`), and write one player-facing sentence per visible change under today's `## YYYY-MM-DD` heading, skipping invisible work. Each sentence says what changed in the game, no file or code names. Merge that through a pull request, then run `gh workflow run release.yml`: it tags the date as the version (`2026.10.31`, then `2026.10.31.2`), publishes the GitHub release with the new bullets and posts them to Discord. The game shows the bullets a newer build has when it offers a reload, and tests/update.test.ts checks the shape.
- No em dashes in code, comments, docs or UI copy.
- UI copy: labels and values only, no filler hints; captions are full sentences with a verb.
