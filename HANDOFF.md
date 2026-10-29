# Handoff

## Goal

Make `docs/masterplan.md` complete and unambiguous, so Sonnet agents can implement each lane from its brief alone. Your job is the plan, not the code: check every lane against the owner's words quoted in it and against the current code, fill gaps, settle open design choices, and split lanes that are too big for one agent. The plan's "Working rules" section holds the owner's design preferences, commit rules and how to verify a lane. Read it, CLAUDE.md, docs/design/gdd.md, docs/design/economy.md and DESIGN.md first.

## Current progress

- main is at the latest "Plan ..." commit (run `git log --oneline -5`). Typecheck, 531 tests, build and balance pass (steady L2 2006.0, L3 2006.8, L4 2008.6, L5 2011.9, L6 2017.9; solo L5 2012.8; no bankruptcies).
- Everything built so far is listed under "Built" in the masterplan.
- Lane 1 (addresses and internet) is merged into main (191c25b); 550 tests, build and balance pass. Nothing is running. Lane 2b (vulnerable software, monitoring, update upsell, breaches and ransom, game server panels) was added after this handoff was first written.

## What worked

- One lane at a time on its own branch or worktree, merged into main only after `npm run typecheck`, `npm test`, `npm run build` and `npm run balance` all pass. Redirect long output to a file and search it (`rg 'FAIL|Tests '`).
- Seeded tests for every sim rule; `tests/fixtures.ts` has `readyGame(seed)` and `withServer(s)`.
- Browser checks with Playwright against a Vite dev server on a free port (not 5173). Change state in the page by importing the store through its exact module URL: `performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/ui/store.ts')).pop()`. Dock apps open by dispatching a click on the `.tip` element's parent.
- Keeping edits to hotspot files (50-state.ts, tick.ts, save.ts, en.ts, registry.ts, store.ts) additive avoids merge conflicts.

## What didn't work

- Assuming a UI bug is in the game: the "ticket closes on new order" report was the owner's dev page reloading when code merged into this checkout. Windows and the Support selection now survive reloads (`src/ui/session.ts`). Merging into main still reloads the owner's page on port 5173.
- Importing `/src/ui/store.ts` without the HMR query string gives a separate store instance; use the exact URL from performance entries.
- `tests/network.test.ts` "DDoS ... deterministically by seed" can hit the 5 s timeout under full-suite load and passes alone; rerun before chasing it, or give it a longer timeout.
- Charging a new price on top of existing ones (traffic) moved the late-game medians; take a new resource's share out of the existing rates instead.

## Next steps

1. For each lane in the masterplan, read the code it names and check the brief is complete for an implementer with no context:
   - every owner request quoted in it is covered by a numbered target (the owner's later additions are appended as "Owner additions" paragraphs; fold them into the targets);
   - file paths, function names and current behaviour are correct against main;
   - every open choice the brief leaves ("pick the rule, record it") is either decided in the plan or clearly delegated with bounds;
   - numbers that need real-world anchors (prices by year, IPv4 market prices, DRAM spikes, German 2005 DSL prices) are researched and written in, so implementers do not guess;
   - dependencies between lanes are explicit (Lane 2 needs Lane 1's address reputation function, Lane 3 needs hostnames and addresses, Lane 4 and 5 share hardware.ts);
   - tests, the browser check and the balance limits are listed.
2. Split any lane too large for one Sonnet agent into ordered sub-lanes with their own briefs (Lane 3 and Lane 4 are the likely ones), each ending in a green, mergeable state.
3. Turn "Smaller gaps" into small briefs too.
4. Lane 1 is built; read its code (src/sim/*/addresses.ts, attention.ts) where later lanes depend on it.
5. Commit the updated plan (message of at most 4 words, no co-author lines, never mention an AI tool) and push main. Tell the owner which lanes are ready to hand to Sonnet and in what order.
