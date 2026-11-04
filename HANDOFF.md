# Handoff: the 2D world of Backbone

Written 2026-11-04 by the planning session that ran the world build. The next agent is the project manager: it plans, briefs lanes, verifies, merges. It writes no code itself. Planning runs on Opus at medium effort; build lanes run on Sonnet. Stop every lane with TaskStop after its merge.

## Goal

Build the 2D world of the game into a polished, bug-free, fully featured part of Backbone: every physical thing the company does happens in isometric rooms, everything software stays on the macOS-style desktop. The user's mandate: make full design decisions per system, rebuild parts if necessary, aim at a ready game.

## Where the work lives

- Branch `2d` on origin holds all world work. Main holds none of it: the world merges on main were reverted (#459) and that revert is recorded on `2d` with `git merge -s ours`, so merging main into `2d` never deletes world files. Merge `origin/main` into `2d` now and then.
- Lanes get a worktree from `origin/2d` under the session scratchpad, build on a branch, never push. Merging is direct, no pull request (user rule 2026-11-04): in a worktree on branch `2d`, `git merge --squash <lane>`, commit with the lane's title, push `2d`. SSH to GitHub was refused on this machine from 2026-11-04 morning: fetch with `git -c url.https://github.com/.insteadOf=git@github.com: fetch origin` and push with `git push "https://x-access-token:$(gh auth token)@github.com/Thiritin/backbone.git" 2d`. GitHub had a minor outage that morning; retry pushes after 20 seconds.
- The preview dev server for the user runs from a detached checkout of `2d` on port 5199 (scratchpad `play`); after each merge: `git checkout --detach origin/2d` there, the server reloads itself.
- Design records: `docs/design/world-systems.md` (one row per system: room, close-up, desktop), `docs/design/world-art.md` (art direction), `docs/design/gdd/the-world.md`, `travel.md`, `properties.md`, `connectivity.md`, `own-datacenter.md` (on the `own-dc` branch until merged), `multiplayer.md`, `docs/design/era-icons.md`.
- Memory files in `~/.claude/projects/-Users-martin-Projects-backbone/memory/` carry every user rule; read `MEMORY.md` first.

## User rules, in the user's own priority

1. Only the desk PC (and the NOC PC) opens the desktop. Every other object opens a close-up that is the object itself drawn large with its parts to use: breakers, papers, label tags, turntables. Never a card, form or title-bar popup.
2. UI copy reports outcome only: "Überlast.", never "turn devices off first".
3. No light overlays. Night is one flat step darker; bulbs light when the switch is on.
4. No player figure, no carrying. Staff and technician figures at desks and racks are wanted. Anything in a location's storage is available to its racks directly; parcels by the door are a picture of what arrived in the last day.
5. Clean code-drawn isometric, flat two or three tones per object, darker-hue edge lines, no outlines, no pixel art, no sprites. The purchased top-down tileset at `/Users/martin/Projects/backbone-assets/` is not used; its licence forbids redistribution.
6. Europe only for now, behind one switch in `datacenters.ts`.
7. Pun names everywhere, except the map data attribution the licence requires.
8. A changelog bullet per merge under today's heading, one heading per day.

## What landed on 2d

Basement with shelf start, fuse box, letterbox, scanner, boiler, washer, drying rack, chair, lamps, cable ducts, light switch, corkboard with the getting-started cards; datacenter floors (share among neighbour racks, cage, suite, aisles per site); office rooms with staff at desks by office hours, server section and closet; rack close-up as a scene with front and back, turntable, paper label tags, drag cabling into the duct, cross-rack connections by drag or right-click with side-by-side backs, the provider panel drawn large with uplink booking and provider cable orders from a jack; lid scene with the chassis on rails and parts on tags, failed parts marked and swapped; properties (rent, expand, refit, buy, address follows, desks limit hiring), connectivity (provider panel, uplinks by year, provider cables, office line), remote hands jobs and the Selbst or Remote Hands buttons; travel with streets, car, taxi and plane scenes in the flat style, logos on pins; wall phone and player on call; breaker trips on overload with heat; technician and provider figures at racks; dusk fade and working light switch; era icons for trash and room; first QA play-through fixed except what is listed below.

## Lanes in flight at handoff

None. Every lane from the planning session is merged and stopped. `2d` holds, after the first handoff draft: polish-1, qa-sim (play-through fixes, deliveries into storage, carrying removed), tube-wash, and own-dc (the hall: refit and Halle listing, rows, cooling and power upgrades, carriers' build-in, colocation customers, the hall room). The own-dc lane's simplifications, to pick up later: no separate meet-me rack (any fiber patch panel rack counts), customer lines are not jacks on the player's panel, no customer cage, no exchange ports in a hall, no route leg for the Halle place.

When a lane reports: verify its screenshots with the Read tool, check `git log` and a clean tree in its worktree, merge `origin/2d` into it if 2d moved (conflicts are usually CHANGELOG.md: take 2d's file, the lane's bullet on top of today's heading), squash-merge into `2d`, push, move the preview, remove the worktree, TaskStop the lane. Chain git commands with care: an SSH fetch in a `&&` chain fails and skips the merge while later cleanup still runs; always fetch over HTTPS.

## Next steps, in order

1. Second QA play-through on Sonnet, read-only, from the start screen to the phone ringing; brief pattern in the first QA spawn: defects only, screenshots per step, console errors. Known leftovers for it: `scratchpad/qa-extra.md`.
2. Fix lanes for its list, split sim versus UI, on Sonnet.
3. Weather on the windows (rain streaks, snow) per `world-systems.md`; router LEDs under attack; the one-rack office server closet exists, the office line exists.
4. Multiplayer, first step the group leaderboard with a market flag on actions; decision taken: the shared market runs asynchronously by month, never a day-boundary barrier.
5. When the user says the world ships: merge main into `2d` once more, then `2d` into main through a pull request.

## What worked

- One task per lane, a brief file in the scratchpad with goal, collisions, rules, verification and a ten-line report; the lane reads CLAUDE.md first; explicit pathspec commits; browser walk with screenshots as the proof; the PM looks at the screenshots before merging.
- Decisions written down before building (`world-systems.md`, `world-art.md`), so lanes do not improvise.
- A QA play-through lane after a batch of merges found the loop-breaking defect (mounted servers never plugged in) that no feature lane saw.
- Fresh lanes resume from a dead lane's worktree with its brief plus a one-paragraph delta; nothing is lost because lanes commit each green piece.

## What did not work

- Pixel art and sprites: the user found the hotel look noisy and the top-down tileset cannot be rotated into isometric. Clean code-drawn isometric won on screenshots.
- A walking avatar and carrying: both removed on the user's request.
- Light overlays: removed, no lighting model behind them.
- Parallel lanes in the same file: textual conflicts every time (`World.tsx`, `layout.ts`, `CHANGELOG.md`); keep lanes in separate files or sequence them.
- Lanes stopping on the usage limit mid-task; the machine sleeping kills lanes mid-response. Keep the Mac awake (`caffeinate -dims`) during long runs.
- Idle lanes keep sending notifications; stop each lane right after its merge.
