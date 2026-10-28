# Backbone first hour

This script follows a new player from the first second of a new game to level 2, using the numbers in the [economy model](economy.md).

## Goals

In the first real hour the player makes a sale, handles a ticket, an invoice and a failure by hand, and runs out of basement. The script assumes 1× for the first 15 minutes and 2× after that, which covers 1 January to mid-April 2005.

| Goal | Target |
| --- | --- |
| First ticket answered | Minute 1 |
| First paying customer | By minute 5 |
| First payment reminder sent by hand | By minute 25 |
| First hardware failure, fixed by hand | By minute 35 |
| First real decision: how to grow past the basement | By minute 50 |
| Level 2 | End of game year 1 (about 3 to 4 hours of play) |

There is no tutorial overlay. Everything the player learns arrives as a ticket, a notification or an item on a short checklist.

## Minute 0

The game opens paused on Saturday 1 January 2005 at 08:00, with the basement on screen and nothing urgent yet. The player looks around, then presses play.

**New game dialog.** Before the desktop appears, the player enters a company name and picks a home city from the map's eight cities. The seed is filled in and can be changed. The home city sets the electricity price, the first organic leads and the location score.

**On screen.**

- **Menu bar:** paused, the date, €5,000 cash, and the support badge at 0.
- **Dock:** all twelve apps. Market shows a lock until market research is unlocked, and Network shows only the home line.
- **Locations window, open on the basement:** a shelf with four slots. Slot 1 holds the tower with a green light, a spare-parts kit sits beside it, and the home router shows 1 Mbit/s up.
- **Notification center:** the "Getting started" checklist.

**Getting started checklist.** Each item ticks itself when done, and the list disappears after the last one.

1. Start the clock
2. Answer Jonas's ticket
3. Create a VPS plan
4. Send a payment reminder
5. Repair the tower
6. Add capacity outside the basement

The three friends (Jonas, Mira and Tobi) are already customers on resold web hosting at €6 a month.

## Beat sheet

The hour ends in mid-April with 8 VPS customers, the three friends, about €70 of monthly revenue and a rented server next to the basement. Beats marked "taught" are scripted ([next section](#taught-events)); the rest come from the normal simulation and may shift by a few minutes.

| Real time | Game date | What happens | Player does | Teaches |
| --- | --- | --- | --- | --- |
| 0:00 | 1 Jan | The game opens paused on the basement | Looks around, presses play | Desktop, time controls |
| 0:00 | 1 Jan | Taught: Jonas asks how to upload his website | Picks the FTP reply in Support | Tickets and reply templates |
| 0:02 | 1 Jan | Checklist: create a VPS plan. The plans editor shows the base rate, €8 for 512 MB, and that the tower fits 8 of them | Creates "VPS 512", priced around €6.50 | Plans, base rates, capacity |
| 0:05 | 5 Jan | Taught: the first lead buys. A gamer orders VPS 512, and an invoice goes out, due 19 Jan | Opens Customers to look at them | Leads, profiles |
| 0:12 | 12 Jan | Likely: a second customer, often a hobby developer | Nothing | Sales arrive on their own |
| 0:15 | 15 Jan | The friends pay; cash rises by €18 | Switches to 2× | Invoices pay themselves |
| 0:21 | 26 Jan | Taught: the gamer has not paid, and a reminder button appears in Billing | Sends the reminder; they pay two days later | Dunning by hand |
| 0:24 | 1 Feb | Monthly tick: about 5 know-how and a January report in Finance. Research shows rented rack units at 50 know-how | Opens Finance and Research | Monthly rhythm, research |
| 0:33 | 18 Feb | Taught: the tower's power supply fails. Every VPS goes down and outage tickets arrive | Clicks Repair, which uses the spare kit; answers the tickets with a status reply or a credit | Failures, no redundancy, spares |
| 0:35 | 22 Feb | No spare kit is left in stock | Buys a new kit for €50 | Spares cost money |
| 0:45 | 15 Mar | The home line passes 60% at peak, and the performance score starts to fall | Opens Network and sees the evening peak | Bandwidth, headroom |
| 0:50 | 25 Mar | The tower's RAM is 80% sold, and lost-sale reports name low performance | Weighs three options (below) | The first real decision |
| 0:55 | 4 Apr | The rented server comes online and joins the cluster | Moves new sales onto it | Clusters span locations |
| 1:00 | Mid-April | Checklist complete | Plays on | |

**The decision at 0:50.** The player picks one of three ways out of the basement:

| Option | Cost | Fixes RAM | Fixes upload | Catch |
| --- | --- | --- | --- | --- |
| A second tower | €1,000 once | Yes | No | The line is still full |
| Rent a server from the wholesale provider | €59 a month | Yes, 8 GB | Yes, 100 Mbit/s | Thin margin until it fills up |
| Wait for rented rack units | 50 know-how and €500, then rent and a €2,500 server | Yes | Yes | Know-how arrives around May; sales are lost until then |

## Taught events

Four scripted first occurrences make sure every player meets a ticket, a sale, a late payment and a failure in the first hour. After the fourth, the game runs on the simulation alone.

| Event | Fires when | Forced outcome |
| --- | --- | --- |
| Jonas's ticket | The clock starts for the first time | A how-to ticket from a friend |
| First sale | The first lead that passes the requirements, if a VPS plan is priced at 1.3× base or less | The lead buys |
| Late payer | The first invoice to a customer who is not a friend | They pay only after a reminder |
| Power supply failure | Day 45 with at least 2 VPS customers, or 1 March at the latest | The tower's power supply fails, and at least one customer writes an outage ticket |

**Rules.**

- Each event fires once, and only in the first 60 game days of a new game.
- Events wait for their condition, so a player who rushes or idles still meets them in order.
- A forced outcome replaces the random roll it stands for, so the same seed still plays the same game.
- A taught event never costs more than it teaches: the failure happens while a spare kit is in stock and few customers are affected.
- The new game dialog has a "Scripted start" checkbox, on by default. Unticked, the four events stay random like everything else.

## Hour 1 to level 2

The rest of 2005 takes about 2 to 3 more hours at 2× to 4×. The player grows from 11 to about 40 customers, moves VPS out of the basement into a rented rack unit, and reaches level 2 in December with a net worth around €15,000.

| Month | Customers | Monthly revenue | What happens | Typical decision |
| --- | --- | --- | --- | --- |
| Apr | 11 | €70 | The rented server comes online | Moves new sales to it |
| May | 14 | €90 | 50 know-how: rented rack units unlock | Pays €500 to unlock, buys a G1 server for €2,500 and rents 1U for €60 a month |
| Jun | 18 | €120 | A gamer draws the first DDoS attack, which fills the line their server shares | Blackholes the address, or waits it out |
| Jul | 22 | €160 | 80 know-how: SSL certificates unlock | Adds SSL to web hosting |
| Aug | 26 | €200 | 100 know-how: the first hire unlocks; support runs at about 8 tickets a month | Most players keep doing it alone |
| Sep | 30 | €250 | The tower has half the resources of the rented servers, and the home line is still full | Moves VPS customers off the basement |
| Oct | 34 | €300 | About 5 reviews; the score sits near 3.6 | Answers tickets faster |
| Nov | 37 | €350 | Organic leads flatten out | Tries search ads at €100 a month for about 11 leads |
| Dec | 40 | €400 | Net worth passes €15,000: level 2 | Unlocks email hosting and dedicated servers; the rented rack follows at 400 know-how |

**Net worth in December:** about €2,600 cash, €3,000 hardware book value and 24 × €400 = €9,600 of customer value.

## Changes to the economy model

Working through the script turned up four changes, all now applied to the [economy model](economy.md).

| Change | Before | After | Reason |
| --- | --- | --- | --- |
| Rented server from the wholesale provider | €99 a month | €59 a month | At €99, a full server of 16 VPS at €6.50 earned €5 a month |
| Level 2 threshold | €10,000 net worth | €15,000 | The €5,000 starting cash counts toward net worth, so €10,000 arrived in August instead of December |
| Starting hardware | Tower only | Tower plus one spare-parts kit | The taught failure needs a quick repair |
| Price of resold lines | Not set | 40% of the base rate | Resold web hosting at €6 costs €2.40 |

The script also assumes 1U of rented rack space costs €60 a month in 2005, including a shared 100 Mbit/s uplink, which sits inside the GDD's range.

## Open questions

- The game starts paused so the player can look around. Is that compatible with the GDD's rule that nothing pauses automatically?
- At 1× a sale arrives about every 10 game days, which is every 10 minutes. Is that too quiet, or should organic leads start higher in the first months?
- Should the friends always be Jonas, Mira and Tobi, or should their names vary with the seed and language?
- Is the "Scripted start" checkbox wanted, or should every game get the taught events?
- Should the first DDoS attack be a fifth taught event, since it reliably lands in the first year?
