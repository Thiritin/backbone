# 2D world handoff, 2026-11-03

All world work lives on branch `2d`; main holds none of it (reverted in #459, recorded on `2d` with a `merge -s ours`). Lanes branch from `origin/2d`, pull requests target `2d`. The preview server for the user runs from a checkout of `2d` on port 5199.

## Merged into 2d today

Open game in room, cabling at rack back, remote hands jobs, room panels as popups, basement to the art direction, basement fixes, properties and desks, basement starts with shelf, datacenter floors, rack close-up scene, era trash and room icons (doc also on main as #472), diegetic close-ups, office room and staff. Design docs: `docs/design/gdd/the-world.md`, `travel.md`, `properties.md`, `connectivity.md` (on the connectivity branch), `docs/design/world-art.md`, `docs/design/era-icons.md`.

## Branches in flight, worktrees under the session scratchpad

| Branch | Worktree | State at cut-off |
| --- | --- | --- |
| `streets` | `wt24` | Done, merge of `2d` in progress with conflicts in CHANGELOG, datacenters.ts, Travel.tsx. Resolve keeping both sides, then PR to `2d`. |
| `rack-polish` | `wt30` | Name plate on rack top, wall socket out of frame, turntable, plain shelf art, Raum button removal. Check `git log` for what landed. |
| `lights` | `wt31` | Dusk and dawn fade, working light switch, letters close-up without brown backdrop, desk lamp on the desk. |
| `connectivity` | `wt29` | Provider patch panel, uplinks by year, provider cables, Network and Locations app. Brief in scratchpad `lane-connectivity.md`. |
| `hands2` | `wt32` | Self or remote hands as action buttons; self starts the drive and runs on arrival. |

Scratchpad: `/private/tmp/claude-501/-Users-martin-Projects-backbone/e39c85cd-e73c-407f-977f-1d83cac7c9ef/scratchpad/` holds every lane brief (`lane-*.md`) and screenshots (`shots*/`). If the scratchpad is gone, the branches may still exist locally; `git branch` lists them.

## Queued, not started

- `cabling2` (brief `lane-cabling2.md`): drag rack to rack, right-click new connection, side-by-side rack backs, provider panel drawn on the back with labelled jacks, provider cable orders and uplink booking from a jack. Needs `connectivity` and `rack-polish` merged first.
- Lid view as a drawn object (still a dark panel).
- Plane sequence for sea crossings; phone and on-call; multiplayer sync design; the one-rack server closet in an office; the post transition month.

## User rules to keep

Only the desk PC opens the desktop; every other object opens a drawn close-up, never a card or form. No light overlays. No player figure; staff figures at desks are fine. Clean code-drawn isometric, art direction in `docs/design/world-art.md`. Europe only for now. Pun names only, except the map data attribution.
