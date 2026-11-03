# 2D world handoff, 2026-11-03

All world work lives on branch `2d`; main holds none of it (reverted in #459, recorded on `2d` with a `merge -s ours`). Lanes branch from `origin/2d`, pull requests target `2d`. The preview server for the user runs from a checkout of `2d` on port 5199.

## Merged into 2d today

Open game in room, cabling at rack back, remote hands jobs, room panels as popups, basement to the art direction, basement fixes, properties and desks, basement starts with shelf, datacenter floors, rack close-up scene, era trash and room icons (doc also on main as #472), diegetic close-ups, office room and staff. Design docs: `docs/design/gdd/the-world.md`, `travel.md`, `properties.md`, `connectivity.md` (on the connectivity branch), `docs/design/world-art.md`, `docs/design/era-icons.md`.

## State at the second cut-off, 2026-11-03 evening

Merged into `2d` since the first handoff: streets and site positions (#475), dusk fade and light switch (#476), rack polish and plain shelf (#477), self or remote hands buttons (#478), provider panel and uplinks (#479), lid scene on rails (#480), fly across the sea (#481), wall phone and on call (#482), office closet and line (#483), connections between racks (#484), show failed parts (#485), corkboard on the wall (#486), multiplayer design (#487), figures at racks (#488). Decision record: `docs/design/world-systems.md` (lands with the power-trip branch).

## Branches in flight, worktrees under the session scratchpad

| Branch | Worktree | State |
| --- | --- | --- |
| `power-trip` | `wt-power-trip` | Done and merged with 2d; one ride-along pending: make error.breakerOverload and the provider reset key outcome-only in six languages. Then PR to `2d`. |
| `qa-sim` | `wt-qa-sim` | Brief `lane-qa-sim.md`: mount plugs the cord (severe), Selbst from the desktop plays the trip, every delivery at the door, banner attribution, one model name, two stale tests (zones by:"drive", notify-types staff events), desktop German. Check `git log` for progress. |
| `qa-ui` | `wt-qa-ui` | Brief `lane-qa-ui.md`: port tag layout, lid captions, London label and flight hover, corkboard router card, add-location dialog. |
| `travel-art` | `wt-travel-art` | Brief `lane-travel-art.md`: street scenes redrawn in the clean flat style. |

## Queued, not started

- Own datacenter: design in scratchpad `own-datacenter-design.md` (copy it to `docs/design/gdd/own-datacenter.md`), build after power-trip lands: hall refit and Halle listing, rows laid out by the player, cooling and power upgrades, carriers' build fees, colocation customers.
- Second QA play-through after the fix lanes merge, then its fixes.
- Multiplayer: doc merged; decision taken: the shared market runs asynchronously by month, never a day-boundary barrier. First step is the group leaderboard with the market flag on actions.

## User rules to keep

Only the desk PC opens the desktop; every other object opens a drawn close-up, never a card or form; UI copy reports outcome only. No light overlays. No player figure; staff and technician figures are fine. Clean code-drawn isometric per `docs/design/world-art.md`. Europe only for now. Pun names only, except the map data attribution. Stop each lane after its merge.
