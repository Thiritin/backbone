# Backbone first hour

This script follows a new player from the first second of a new game to the tenth customer after the three friends, using the numbers in the [economy model](economy.md). At 1×, one game day lasts one real minute, so those ten customers arrive after about an hour of play, between 9 February and 16 March 2005.

## Goals

| Goal | Target |
| --- | --- |
| Everything bought and set up | Day 2, Monday 3 January, once the company is registered |
| Friends moved in | The day the line goes live, day 14 with the business line |
| First paying customer after the friends | Days 15 to 18 |
| First invoice paid | Days 17 to 20 |
| Ten customers after the friends | Days 39 to 74, typically day 56 |
| Level 2 | End of game year 1 (about 3 to 4 hours of play) |

The Getting started document on the desktop lists the steps. Each step names where to do it and opens that place, and it ticks itself when done.

## Minute 0

The game opens paused on Saturday 1 January 2005 at 00:00. The Welcome sheet asks for the company name, logo and colour. The player fills it in or skips it, then presses play when ready.

**On screen.**

- **Menu bar:** paused, the date and €0 cash. The player's €3,500 of savings wait on a personal account until the company has a bank account.
- **Dock:** only the Browser. The [tutorial](tutorial.md) has the player open a business account on a bank's site, which brings in the €3,500 savings as its first booking, then register the company at the trade office, which opens at 08:00 on Monday 3 January and charges €40 by bank transfer. The registration fills the dock with the starter apps. Finance, Customers, Marketing and the rest arrive later, each when its problem does, as the tutorial lists.
- **Locations window, open on the basement:** an empty 24U rack, a line jack on the carrier panel and the flat's Fritz!Bocks 5050 in storage. The router has four LAN ports and a DSL port. There is no server and no internet line.
- **Desktop:** the "Getting started" document.

## Getting started

The steps run in this order, with the 2005 prices from the game.

| Step | Where | What it costs | How long it takes |
| --- | --- | --- | --- |
| Open a bank account | Browser, a bank's site from the Yahoy! directory | The bank's account fee, €8 a month at Sparklasse; the €3,500 savings arrive as the first booking | Instant |
| Register your company | Browser, trade office | €40 registration fee, paid by bank transfer with a TAN | From 08:00 on Monday 3 January |
| Install a bookkeeping program | Shop, Pear Store, Bookkeeping | Lexwear Office €249 once and €99 a year for updates; WIZO Mein Büro €149, orgaMIN €199 and Saga Office Line €599 once; Collmix €15 a month | Instant |
| Buy a server | Shop | Dwell Balanced 1U G1, €2,500 (2 cores, 8 GB RAM, 500 GB disk, 250 W) | The first server arrives at once; later ones take 3 days |
| Mount and power it | Locations | Nothing; the rack is already there | Instant |
| Mount the router | Locations | Nothing; the Fritz!Bocks 5050 waits in storage and goes on a shelf in the rack, its DSL port cabled to the line jack | Instant |
| Add internet | Locations, Internet line | DSL 16000, €45 a month, 1 Mbit/s up, no fixed address. DSL 16000 Business, €59 a month, fixed addresses. SDSL 2048, €129 a month, 2 Mbit/s up, fixed addresses | 7 days; 14 days for the business line and the SDSL |
| Install software | Locations, the server's Add Software tile | FreePanel and the OpenVeeZee hypervisor are free. Pleskit is €12 a server, DirectAdmen €4 a server and cPanic €0.40 an account | 2 hours for FreePanel; 3 hours for OpenVeeZee, which then hosts a FreePanel VM |
| Find the server's address | Browser, fritz.bocks, Home network | Nothing; the password is on the router's label in Locations | Instant |
| Share the web port | Browser, fritz.bocks, Internet, Permit access | Nothing; on a business line with addresses of its own this step ticks by itself | Instant |
| Build the website | Marketing, Channels | Free | 3 days |
| Register your domain | Network, Domains | NameCheep has no signup fee and no monthly fee; a .de domain costs €18 a year, booked as €1.50 a month | Instant |
| Launch it and list a product | Marketing, Channels and Products | €9.90 a month for the site Strateaux hosts, or nothing on an own panel host | Instant |
| Set up company email | Email app | Hosted Exchange by Ionose, €10 a month for the one seat | Instant |
| Win your first customer | Support | Nothing | Days |

The registration fee, the server and Lexwear Office leave €711 of the €3,500; with WIZO Mein Büro €811, or €960 less €15 a month with Collmix. The fixed bills that follow are €80.40 a month with the business line (€59 line, €9.90 site, €10 email, €1.50 domain) or €66.40 with the DSL 16000 line, plus electricity at the household price.

The three friends (Jonas, Mira and Tobi) sign up for web hosting at €6 a month once the first panel host is ready and the internet reaches it. They bring in €18 a month and always pay.

## Beat sheet

The player buys and sets up everything on the first day, then waits for the line. The days and cash below follow the seeded happiness runs (seeds 1 to 5), moved to the Monday registration, for a player who follows the steps above, buys the web design on day 2 and picks the business line. The beats after the friends arrive come from the normal simulation and shift with the seed.

| Real time at 1× | Game date | What happens | Player does | Teaches |
| --- | --- | --- | --- | --- |
| 0:00 | 1 Jan | The game opens paused on the basement | Names the company, opens a bank account, presses play | Desktop, Browser, time controls |
| 0:02 | 3 Jan | The trade office opens at 08:00 and the company is registered | Fills in the office form and confirms the €40 transfer with a TAN | Bank site, TANs |
| 0:02 | 3 Jan | The server and the router stand in the rack, the server cabled to the router, the router to the line jack, and powered on; cash is €960 | Buys, mounts and cables the Dwell server, mounts the router from storage | Shop, racks, ports |
| 0:02 | 3 Jan | The line is ordered and the panel installs in 2 hours | Orders the line, installs FreePanel | Lines, software |
| 0:02 | 3 Jan | The domain, web design and company email are in place; cash is €560 | Signs NameCheep, registers the domain, buys the web design, lists web hosting, books email | Registrar, website, mail |
| 0:16 | 17 Jan | The business line goes live and the friends move onto the panel host | Opens Customers | Customers arrive once the host is reachable |
| 0:17 to 0:20 | 18 to 21 Jan | The first customer after the friends writes in, and the last step of Getting started ticks | Answers in Support | Tickets, sales |
| 0:19 to 0:22 | 20 to 23 Jan | The first invoice is paid | Opens Billing | Invoices pay themselves |
| 0:31 | 1 Feb | The monthly tick books the fixed bills, the registrar and the first report | Opens Finance | Monthly rhythm |
| 0:39 to 1:14 | 9 Feb to 16 Mar | The tenth customer after the friends signs up, typically on day 56 (26 February) | Answers tickets, reminds late payers | Sales arrive on their own |

Cash stays between about €510 and €660 until the first customers pay. By the end of February the seeded runs have earned 15 to 30 know-how and taken a bank loan for the second server. The Bank lends up to €10,000 from the first day.

## After the first ten

The company then grows toward level 2 at the end of 2005 with about 40 customers and €400 of monthly revenue, the targets in [Clock and pacing](economy.md#clock-and-pacing). The headless balance run checks that pacing (see [Balancing](economy.md#balancing)).
