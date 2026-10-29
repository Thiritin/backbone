# Handoff

## Goal

Build the lanes in `docs/masterplan.md`, in order, one at a time. Every lane brief names the files, the current behaviour, the settled decisions, the numbers with their anchors, the tests and the browser check. Read the plan's "Working rules" and "What Lane 1 left behind" first, then CLAUDE.md, docs/design/gdd.md, docs/design/economy.md and DESIGN.md, then the code the lane names.

## Current progress

- Every lane in docs/masterplan.md is built and on origin main (Lanes 2.0 to 13, all Lane 6 items except the hand playtest 6.9). GitHub issues 2 to 21 are closed with the commit that fixed each; issue 1 (German translation) is untouched on purpose.
- origin main is the source of truth. Another session works and commits in the main checkout at the same time; when its working tree holds uncommitted edits, integrate on a side worktree (`git worktree add -b integ .claude/worktrees/integ main`, merge the lane branch and origin/main there, verify, then push `integ:main` in a fetch, merge, push loop) and let the main checkout pull.
- Verification baseline: typecheck clean, 1083 tests, build, balance steady L2 2006.3 to L6 2018.2 and solo L5 2012.9, 0 bankrupt, happiness harness seeds all growing.
- Conventions added this round: every UI action call is `act(fn, ...args)` with fn exported from a 90-actions module and registered in src/sim/90-actions/index.ts (tests/replay.test.ts enforces it, the action log drives the leaderboard replay); every change adds one or two CHANGELOG.md bullets under today's date (the update sheet and What's new read them; tests/update.test.ts checks the shape).

## What worked

- One lane at a time on its own branch or worktree, merged into main only after `npm run typecheck`, `npm test`, `npm run build` and `npm run balance` all pass. Redirect long output to a file and search it (`rg 'FAIL|Tests '`).
- Seeded tests for every sim rule; `tests/fixtures.ts` has `readyGame(seed)` and `withServer(s)`.
- Browser checks with the Playwright MCP against a Vite dev server on a free port (not 5173). Change state in the page by importing the store through its exact module URL: `performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/ui/store.ts')).pop()`. Dock apps open by dispatching a click on the `.tip` element's parent.
- Keeping edits to hotspot files (50-state.ts, tick.ts, save.ts, en.ts, registry.ts, store.ts) additive avoids merge conflicts.
- Auditing briefs with read-only subagents, one per lane, that report file:line facts and a list of wrong statements; the plan was then rewritten from those reports.

## What didn't work

- Assuming a UI bug is in the game: the "ticket closes on new order" report was the owner's dev page reloading when code merged into this checkout. Windows and the Support selection now survive reloads (`src/ui/session.ts`). Merging into main still reloads the owner's page on port 5173.
- Importing `/src/ui/store.ts` without the HMR query string gives a separate store instance; use the exact URL from performance entries.
- `tests/network.test.ts` "DDoS ... deterministically by seed" can hit the 5 s timeout under full-suite load and passes alone; rerun before chasing it, or give it a longer timeout.
- Charging a new price on top of existing ones (traffic) moved the late-game medians; take a new resource's share out of the existing rates instead.
- Web searches for launch prices of 2005-era network gear return only resale listings; the plan records those prices as game anchors from memory of contemporary reviews, not as sourced facts.

## Next steps

1. Lane 2.0 (alerts that pause), then 2.1, 2.2, 2b.1 to 2b.4, 3.1 to 3.5, 3b, 4.1 to 4.5, 5.1, 5.2. Lane 4.1 can run in parallel with Lane 3 since they touch different files.
2. Lane 6 items are independent small briefs; pick them up between lanes or hand them to a second agent.
3. After each lane: update "Built" and "Balance today" in the masterplan, record rules in gdd.md and numbers in economy.md, commit (at most 4 words, no co-author lines, never mention an AI tool), push main.
