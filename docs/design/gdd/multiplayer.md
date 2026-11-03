# Multiplayer

Proposal for friends running their own companies in the same market. The static site rule stands: we never run a server. Vision currently says "no multiplayer"; this document is what would change that line, and only for small groups of friends (2 to 8), never a public lobby.

## What is shared and what is not

Shared, one copy for the whole group:

- **The market.** One customer pool per city and profile. Customers choose between all hosts in the group, using the same three scores and the same prices as today (see Customers and market). A customer won by one friend is not available to the others until they cancel.
- **Public prices.** Each company's published product prices and its public scores (reputation, uptime record, review stars) are visible to the other players, because customers compare them.
- **Used hardware.** A trading board where a player lists a server, drive or switch at a price. Another player buys it and it arrives as a parcel at their door (see The world).
- **Domain names and IP blocks.** One registry per group, so two companies cannot own the same name.
- **Events.** Outages of a shared upstream, DDoS waves and price shocks hit everyone on the same day.

Not shared: money, books, staff, tickets, racks, cabling, research and the save itself. Every player keeps a full private company. Nobody can touch a friend's rack, only look at it (read-only visit, below).

## Sync model

The sim is deterministic from a seed and every change is a logged action (`ACTIONS`, `s.log`, `RunFile`). Multiplayer reuses that and splits actions in two kinds.

**Local actions** change only your own company: racking, cabling, hiring, answering tickets, setting up clusters. They are never sent anywhere during play. They stay in your own log, and replaying that log with the group's market feed gives your exact state.

**Market actions** change something another player can see or compete for. They are listed by name in one table next to `ACTIONS`, so a new action is local unless someone adds it there. The first list:

- publish or change a product price
- list, buy or withdraw a used item on the trading board
- register or transfer a domain, claim an address block
- accept or cancel a shared contract (a customer won in the market)

Market actions go into one shared **market log**, ordered by game hour, then by a fixed player order (player ids sorted). Every client applies the same market log in the same order, so every client agrees on prices, the board, the registry and who won which customer. Customer choice runs from a market seed with `hashRng(day, city, profile)`, so it needs no extra messages.

**Clock.** Each player keeps their own pause and speed, but the market only advances in whole game days. A client may run its company ahead only until the end of the next market day, then waits until every other player has sent that day's market actions (possibly none). A player who is paused holds the group at the day boundary, so the session has a "ready" indicator per player and a vote to drop a player who is away (their company then runs as a bot with its last prices, or is frozen and leaves the market).

**Hash check.** At each day boundary every client sends a short hash of the market state. A mismatch means a bug or a modified client, and the session pauses and shows who differs.

## Transport, in order of cost

1. **Shared leaderboard (exists).** `RunFile` with a claimed score, verified by `scripts/replay.ts`, published as `leaderboard.json`. No live play, but it already lets friends compare. Cost: none. Limit: no shared market.
2. **Exported market file.** Each friend exports a small file with their public prices, board listings and the market actions of a period, and imports the files of the others (drag onto the desktop, or a link in a chat). Play is asynchronous: the group agrees on a calendar month, everyone plays it alone, exports, imports, and the client replays the month's market resolution. Cost: low, no network code. Limit: turns, not real time, and trades need a round trip.
3. **Peer-to-peer over WebRTC.** Data channels between browsers, one per pair. Players meet through a public signalling service they pick (a field with a URL, default empty), and the offer and answer can also be pasted by hand with no service at all. Messages are the market actions and day hashes, a few hundred bytes per day. Cost: medium. Limits: strict NAT may need a relay (TURN) the players choose too, and everyone must be online together.
4. **Player-hosted relay over WebSocket.** A friend who already has a small server runs a stateless relay that forwards messages and keeps the market log so players can join late and reconnect. It is not ours, not required, and the game ships only the client side. Cost: highest for the player, best for groups spread over time zones.

Options 3 and 4 use the same message format, so the client has one protocol and two ways to carry it. The relay never decides anything; it only orders and stores messages.

## Conflicts

- **Same used server.** First market action in the shared order wins. The loser gets the money back and a message that the item is gone. Prices on the board are fixed by the seller, so there is no bidding in the first version.
- **Same domain name.** Same rule: first in order wins, the other registration fails with the existing "name taken" result.
- **Same customer.** The market seed decides from scores and prices, never from who clicked first.
- **A seller who leaves** with listed items: the items stay for sale, and the sale pays into the seller's company when they next join.
- **Late joiners** replay the market log from the start, then join at the next day boundary with a fresh basement.

## Cheating limits

The goal is friends who do not cheat by accident, not a hardened game.

- Each local log is replayable. Before a group score counts, any client can ask for a friend's log and run `verify`, the same check as the leaderboard. A claim that does not replay is marked invalid.
- Market actions carry only ids and prices, and the receiving client validates them against its copy of the market (can this player afford it, does the item exist). A bad action is dropped by everyone alike, because everyone applies the same rule.
- A player cannot fake their scores, since the public scores in the market are recomputed from the log by the others when logs are shared. Until then they are shown as claimed.
- Editing local storage is possible and cannot be stopped in a static site. Unverified players are shown without a check mark.

## Visiting a friend

Not a figure in your office. A friend's room is a **window on your desktop**: an app named for the friend's company that shows their room as a read-only isometric view, the same scene as the world, with racks, cabling and the cabinet fronts drawn from their public layout. You can click a rack to see its devices and their labels, not their customers, books or tickets. Visiting costs nothing and needs only the layout snapshot the friend publishes with each day's hash (a few kilobytes). Offline friends show their last snapshot with its date.

## Phases

1. **Group leaderboard.** Name the market actions in a table and add a `market` flag next to `ACTIONS` with a test that every action is either local or listed. Add a group page that lists friends' run files with the verified scores. Smallest useful step, because it forces the local or market split and needs no network.
2. **Exported market file.** Shared prices and customers in turns, trading board by file.
3. **Room window.** Read-only visit from the layout snapshot, which already works with files.
4. **WebRTC session** with manual paste signalling first, then the optional signalling URL.
5. **Relay** for late join and long sessions.

## Open questions

- How much does one player's pause cost the group? A daily barrier is simple but a slow friend slows everyone.
- Does a shared customer pool need scaling by group size, or does the pool stay as is and a bigger group means a harder market?
- Do shared events need a shared event log signed by one player, or can they come from the market seed alone?
- Is async by month fun, or does it need the live session to feel like a shared market?
