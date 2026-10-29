# Backbone game design document

You start as a one-person "basement hoster" and grow into a datacenter operator by automating your own company. At first you answer every ticket, send every payment reminder and plug in every cable yourself. Then you hire people, and later AI bots, to do it for you.

## Vision

The game is about running a whole hosting company, not just its hardware: infrastructure, support, billing, marketing and staff. Each part is done by hand until you automate it.

**Design pillars**

- **Automate yourself out of the job.** Every department starts as clicks you make yourself. Hiring staff, and later AI bots, turns those clicks into work that happens in the background.
- **Real infrastructure, simplified.** Racks, ports, clusters, transit and peering are close enough to reality that an engineer recognizes them. Real companies appear under parody names, so "Internet X" becomes "Internet Y".
- **Problems cascade like the real thing.** An outage floods support, unanswered tickets lose customers, and every cancellation is one more ticket.
- **You sit at a desk.** The whole game is a macOS-style desktop with apps, windows and notifications.

**Platform and scope**

- Free, open-source (MIT) browser game, made for fun. It's hosted as a static website: no server, no accounts, no multiplayer, no Steam.
- Saves stay in the player's browser.
- Set in Europe and North America. The map opens on Western Europe's big cities; the American hubs are a later expansion across the Atlantic, and the rest of the world only appears as distant transit destinations. The game starts around 2005, and technology advances over the years.
- Prices are in euros and roughly match the real European market.
- Time controls: pause, 1×, 2×, 4×, 8×. Only alerts pause automatically (see "The desktop"). A player can run the whole company alone if they want; hiring is how you scale, not a requirement.

**Inspirations:** Software Inc. (UI and company management), Der Planer (the office PC you play the whole game on), King of Retail (customer demand).

## Core loop

Win customers, handle the work they create, automate that work, and use the freed time and money to expand. You start out doing every job yourself.

&#91;embedded content: core loop · automate to grow, neglect to churn\]

The loop runs clockwise. Work you ignore turns into cancellations, and each cancellation is more work.

| Department | By hand | Automated by |
| --- | --- | --- |
| Support | Pick a reply and an action for each ticket | Support agents, later an AI support bot |
| Billing | Click to send each reminder and dunning notice | Bookkeepers and accountants |
| Infrastructure | Install, cable, upgrade and repair hardware, update software, migrate web spaces between panel hosts, notify customers about their outdated sites, clean up defaced ones, reset hung servers and management controllers, recover corrupted workloads | Technicians and rack templates |
| Network | Set up ports, buy transit, arrange peering, move the domains to another registrar partner | Network engineers |
| Marketing | Run campaigns, read reviews | Marketing manager |

## The desktop

The whole game is a macOS-style desktop. Every system is an app in the dock that opens in its own window, and notifications slide in at the top right so you always know what is happening.

&#91;embedded content: desktop mock-up · menu bar, two windows, notifications, dock\]

The menu bar holds the time controls, date and cash. The game saves itself in the browser. The logo menu on the far left shows your company logo; it exports the save to a file, imports one, and deletes all progress after a confirmation. A first visit, or one after deleting, opens a start screen with a New game button. Settings keeps the company name, logo mark and colour under Company, above Appearance (light, dark or automatic), Sound (a master switch and a volume slider, on at 60% by default) and Notifications (one Allow and one Sound switch per app, both on by default, and a list of notification types per app). A new game opens the Getting started guide without any popup, and the guide also sits on the desktop as an icon. The guide is the only tutorial, and every step is optional. It teaches where things are: a step carries no controls of its own, only an Open button, and it ticks once the player has done it in that app. Its steps name the place where each is done and carry an Open button that opens that app on the right view, in this order: "Choose the name, logo and colour of your company." (Settings; any saved change under Company ticks it), "Buy your first server in the Shop." (Shop), "Mount it in a rack, cable it to the router and power it on in Locations." (the basement), "Order an internet line in Locations under Internet line." (the line card), "Install a hypervisor or a web panel from the server's Add Software tile." (the server), "Choose a registrar and buy your company domain in Marketing under Domain." (Marketing, Domain; once a registrar contract exists it reads "Buy your company domain with <partner> in Marketing under Domain."), "Build your website and list your first product from the Admin page in the Browser." (the Browser, Admin; done once the web design is set up and the site lists a product), "Choose an email provider in the Email app." (the email settings; done once the company leaves free Notmail) and "Answer your first customer in Email." (Email, or Support once a desk is installed). A step that is done loses its Open button and gains a tick.

**Pear One and the Pear Store.** The desktop is Pear One, an all-in-one hosting platform from Pear, a fruit company with a familiar look. A new game starts with the starter apps in the dock: Locations, Shop, Customers, Support (shown as Email), Billing, Finance, Bank, Research and Settings. Getting started and Notes are desktop documents and stay out of the dock. Every other app sits in the Pear Store, the app store for Pear One. An item whose skill the company has not learned yet shows the skill it needs, and its button opens that skill in Research; once the skill is learned the item shows Get. The store never shows research costs. Installing an app adds it to the dock, and apps unlock further features as you go. Because of EU competition rules, some software comes in several competing products to choose from, such as the virtualization platform and monitoring. The introduction text lives in docs/design/intro.md.

**The store lives in the Shop.** The Pear Store is a Software section in the Shop, next to the hardware manufacturers. It opens with a banner in the Pear style: the Pear logo and "Unlock the future today. Great upgrades to your operating system that make your life easier." Below the banner, a featured app and curated rows (Essentials, Growth, Upgrades) list each app with its icon, subscription and a Get, Open or Research button; clicking one opens its page with what it includes, its price and Install or Cancel. An app has to be researched (or reached by company level) before you can buy it, and buying it installs it in the dock. Apps also sell upgrades as cards of their own. Email, or the support desk that replaces it, always shows its count of open tickets and requests from the start. The first upgrade is dock badges: once bought, the other apps in the dock show a count of what waits for you too, such as unpaid invoices in Billing or failed parts in Locations. Without the upgrade, only the dot under a running app shows on them. The desktop widgets (calendar, open tickets, cash, monthly revenue, customers and level) are upgrades too: a new game has none, and each one appears on the desktop once bought. Widgets need no research.

**Searchlight.** Searchlight is a Pear Store upgrade at 2 euro a month in 2005 that needs no skill. Once it is installed, Ctrl+K or Cmd+K opens a field in the centre of the desktop and Escape closes it; before it is owned the shortcut does nothing. Results update as you type and come in groups: Apps, Customers, Services (by hostname, label or domain), Machines (servers and your own VMs by hostname, label or address), Tickets (by subject), Sites and consoles (the company site, Admin, customer sites and the console address of every server and VM), Locations and the Settings sections. The arrow keys move through the results and Enter opens the result in its app: a customer in Customers, a server in Locations, a VM in Virtual machines, a ticket in Support, an address in the Browser. A group shows up to 6 results and the list at most 24. A match at the start of a hostname or name ranks first, then a match at the start of a word, then any other match; ties go to the newest ticket, the newest customer or the most recent purchase.

**What is new.** The save remembers which changelog entries it has been shown. Loading a save with newer entries opens a Pear OS update sheet that lists them by day, newest first, with an Open button on every entry that names an app in the dock; closing the sheet marks them seen, and a new game starts with every current entry seen. The What's new item in the logo menu opens the sheet with the whole changelog.

**Subscriptions.** Pear One is a funnel. The base is free, since you already paid for the hardware, and every app beyond the starter set is a feature expansion from the Pear Store with a monthly subscription, billed through the Bank like rent. Some expansions also sell in-app purchases: one-off extras such as an instant invoice run, alert text messages or extra dashboard slots. Prices scale with your size (per device, per customer or per employee), and Pear raises them every year, sometimes sharply, with a cheerful email about "new value". Cancelling a module removes the app from the dock and switches its features off, but keeps its data, so you can come back. Installing pays the first month at once and needs the cash for it; every later month is billed on the first with the other bills. Modules are a real cost to weigh against the work they save, and a steady drain that grows with the company.

| App | What it does |
| --- | --- |
| Locations | Grid of your locations; opens room views and rack front views |
| Shop | Servers, switches and patch panels by manufacturer, bought into storage |
| Network | Europe map, uplinks, topology view, DDoS protection |
| Products | Product lines, software licenses, clusters |
| Sales | Requests from new and existing customers, quota requests, later the shop |
| Virtual machines | VMs, hosts, storage pools, backups and incidents, branded after your virtualization platform |
| Browser | Opens the company site and its Admin page, customer sites, supplier sites and machine addresses; tabs, bookmarks, favicons |
| Terminal | A shell on the desk: ssh into a server, ping, traceroute and host lookups, and the server commands inside a session |
| Website | Shortcut that opens the Browser at the company site |
| Customers | Customer list, contracts, happiness |
| Support | Ticket inbox with reply templates and actions |
| Billing | Invoices, payment reminders, dunning, collections |
| Finance | Account statement, later profit and loss, cash flow, recurring revenue, churn |
| Bank | Loan offers, active loans and repayments |
| Staff | Job market, hiring, salaries, task assignment |
| Marketing | Campaigns, reviews, review platforms |
| Market | Market research: demand, customer requirements, lost-sale reports |
| Research | The skill tree: trainings that make Pear Store items available |

**The Terminal.** A window of 760 by 480 on near-black metal with the prompt `you@desk $`; it is a starter app, free, and the Pear Store lists it for older saves. The text it prints imitates the real tools. From the desk: `ssh <host>`, `ping <host>`, `traceroute <host>`, `host <name>`, `help` and `clear`. A host is a server hostname (`node001`), its full name under the company domain, a private address, or for `ping`, `traceroute` and `host` also a VM or service hostname and a management address. `ssh` opens a session on a server only when it is working, not hung, and reachable over the network path from the basement desk; otherwise it prints `ssh: connect to host <name> port 22: Connection timed out`. A VM or customer service answers `Permission denied (publickey).` and a management address refuses the connection. The prompt inside a session is `root@<host>:~#` and offers `uptime`, `df -h`, `free -m`, `top` (one snapshot of the server's CPU, RAM, disk and workloads), `shutdown -h now` (the graceful shutdown), `reboot` (a graceful shutdown followed by a boot, which never corrupts data), `recover <service hostname>` and `exit`. `recover` starts the 30 minute repair of a corrupted workload, prints its progress, and reports the outcome in the window once the game clock has passed it; a web space inside a panel VM is repaired through its VM. A session ends when the server stops answering. Anything else prints `bash: <command>: command not found`, and desk commands are not available inside a session. Open sessions, the screen and the command history belong to the window and survive a reload, not a new game. A hired technician runs the same `recover` on their own while the Recover corrupted data rule is on, which it is by default.

**The Browser.** A window of 1100 by 720 in Pear style: a tab strip, back, forward and reload, an address bar with a star for bookmarks, a Downloads button and a bar of bookmarks. Every address resolves from the game state. The company domain, with or without www, is the company site; `/admin` on it is the Admin page (no password, the player is the owner) and stays reachable while the site's host is down so the player can move the site. Every web hosting customer's domain is that customer's site, drawn from the customer's name and profile, and defaced when its host was compromised. Machine and service names from Hostnames (`node001`, `vm001`, `vps12345678` under the company domain) and private addresses typed as URLs reach the machine and show a page that says the host serves no web page; the later consoles replace it. Every hardware manufacturer has a one-page site at `<brand>.example`. `youtub.example` shows a single video page. Any other address shows Not found. A site on a host that is down shows Cannot reach, a site on a slow host (an overloaded node, a PHP upgrade, a RAM-crowded panel host) shows a progress bar for 2 seconds first (none with reduced motion), and the rented company site is always fast. Each site kind has a 16 px code-drawn favicon: the company colour for the company site and Admin, a letter for a customer, the brand mark for a manufacturer, a play button for the video, a cross for an unreachable host. Default bookmarks (the company site and Admin) are derived; the star adds the current address to the user's own bookmarks, kept per browser session. Tabs and bookmarks are interface state, not game state.

**Downloads.** The browser's Downloads button and the Downloads link on every manufacturer site open `youtub.example/watch?v=uptime`, a video page titled "Never Gonna Give You Uptime" by "Rick Astley-Packet" with a view count. Play opens the real video in a new browser tab. The page has no lyrics.

**Alerts.** A few events pause the game and open a sheet, like the bankruptcy warning, because the player has to look at them before time moves on. They are: cash below zero, a missed loan payment, a loan called in, every stage of a PHP security advisory (announcement, proof of concept, agency warning, patch) and a compromised panel host, lost customer data, a server seized by the authorities, the start of a DDoS attack, and a location that lost power. Later features add their own: a critical vulnerability on the player's own software, an extortion ticket after a breach, and corrupted data after a pulled plug. The sheet shows the event's title and text, up to two figures, an Open button for the app that handles the event (Bank, Security, Locations, Support or Network) and a Continue button that resumes the speed from before the pause; Escape is Continue. Opening the app leaves the game paused. Every alert also goes into the notification history, bankruptcy keeps its own sheet, and there is no setting to switch alerts off. The list lives in `ALERT_KEYS` in src/sim/alerts.ts; every other event stays a banner.

**Updates.** The build writes its id into version.json next to the page. Every five minutes and whenever the tab regains focus the page fetches that file; when the id differs from the build it runs, a sheet offers Reload and Later. Later keeps quiet for an hour. The game and open windows survive the reload. The dev server never offers one.

**Notifications.** Banners for new tickets, overdue invoices, hardware failures, attacks and staff requests. Each one opens the right app at the right place, and a notification center keeps the history. Alerts also pause the game (see below).

**Notification types.** Inside an app, notifications belong to types such as Bills and tax, Tickets, Attacks and saturation or Reviews. In Settings, under Notifications, every app row expands to its types, each with an On and an Off button, next to the app's Allow and Sound switches. A notification shows when its app is allowed and its type is on; a type that is not mentioned is on, so older settings keep every type on. Alerts show whatever the settings say. The gear in the notification center header opens Settings on the Notifications section, and the gear on a notification there expands that notification's app. The groups live in `NOTIFY_TYPES` in src/ui/notify-types.ts, and a test checks that every event the sim emits lands in exactly one group of its app; a key no group claims falls into Other.

**News.** The News app announces what becomes available, on the day it does, as a banner from the app News and as a headline in its list, newest first, each with a sentence that names a punned outlet: Heize online for hardware and software, Golem.dy for the internet and Handelsblah for the market. The announcements are a software's first year (1 January), a server generation (the day it reaches the shop), IPv6 at datacenters (2010) and on home lines (2013), RIPE's last /8 (September 2012) and run-out (November 2019), a website design generation (every four years from 2009), and, checked at each month start and told once per line, a product line the player could deliver but has not put on the website. What exists when a game starts is not announced, and a saved game does not replay what happened before it was saved. The News types in Settings (Hardware, Software, Internet, Market) can silence the banners without emptying the list. The News app is opened with the News button in the notification center and has no dock icon. The list lives in `NEWS` in src/sim/80-business/news.ts; `GameState.news` keeps what was published.

**Reloading the tab.** A reload of the page reopens the saved game with the same windows where they were, and Support, Virtual machines, Billing, Staff, Locations (with its cabling view) and the Pear Store keep their selections, tabs and filters. The clock keeps the speed it had; a new game starts paused. A closed tab starts from the desktop with no windows open.

**Challenges and leaderboard.** Every week has a challenge: the same seed for everyone, Frankfurt, and one twist. The seed comes from the ISO week (`challengeFor` in src/sim/10-catalog/challenges.ts), and the week number picks the twist from `CHALLENGES` in turn: SDSL 2048 is already in as the home line, every datacenter except Hetzler Park starts full, or the company starts with €2,000 instead of €3,500. The start screen has a Weekly challenge button next to New game, with the week, its twist and the top three by net worth. Every successful action the player takes is logged with its game hour (`s.log`, at most 50,000 entries), so a run is its seed, its challenge and that log, and anyone can replay it (`replay` in src/sim/92-run/run.ts). A run has three scores, counted until 1 January 2008: net worth at the end of 2007, the day level 3 was reached, and the mean of the hourly average customer happiness. Settings, Leaderboard shows the game's scores and exports the run file once 2007 is over; below it, the challenge's board ranks the top 50 by any of the three scores, with company name, colour and seed. Runs are submitted as a pull request that adds the file to `leaderboard/`; a GitHub workflow replays each run with the build it was made with and fails when a score differs, and after the merge it rebuilds `public/leaderboard.json` per build and challenge. A board belongs to one build, so runs from an older build stay on its board. While a challenge with runs is played, a desktop widget reads "At this date the leader had N customers and X", from the net worth leader's weekly samples.

**Sounds.** Short synthesized cues mark the events worth hearing: a chime arpeggio when a month closes (with a cash-register rattle and an extra top note when the month made money), a coin ping for paid orders and won deals, the ticket ding for everything else in Support, a soft falling two-tone for failures, outages, attacks and missed payments, a rising triad when an employee finishes training, and a bloom when the company learns a skill. Windows tick quietly as they open and close. A burst of events plays only its most important sound, each sound plays at most once every one and a half seconds, and nothing plays while the game is paused or the tab is hidden.

**Look.** Clean and light like macOS, with a dark mode. Interface text in Inter, numbers in a monospace font so columns line up, icons from Lucide. Rack and server fronts are drawn in code, so every device has a consistent, detailed front.

**Context menus.** Every object with actions has a Pear context menu: right-click it, or click its three-dot button on a touchpad. Rack devices, devices in storage, racks, ports, workloads, VMs, customers, tickets, panel hosts, invoices, domains, staff and loans all use it, so a window shows an object's state and keeps buttons for its main flow only, such as a ticket's replies or the steps of an order. The menu works with arrow keys, Enter and Escape, and submenus hold the choices of one action, such as Migrate to or Add to cluster. Destructive items (sell, fire, write off) still ask in a sheet, and an item that cannot run reports why as the usual action error. Sheets that switch between views use tabs sized to their labels, as in the server setup.

## Locations and space

Infrastructure lives in locations: your basement first, then space in other companies' datacenters, and in the end your own. You always own your racks and everything in them. A location gives you floor space, power, cooling and connectivity, and where you go decides a lot of what you can offer: which carriers and exchanges you reach, how well outages are covered, and which customers trust you.

**Regions and availability zones.** The game follows OpenStack: each location is an availability zone (AZ), and its city is the region. Frankfurt is region "fra"; the basement is its first zone fra1, and a rack share at Equinox FR5 becomes fra2. Everything with a place belongs to exactly one zone: racks, storage, clusters and every workload a customer books. A customer books a VM, a web space or a rack section in one specific zone, and gets redundancy by booking in two zones of the same region. Zones in one region are linked cheaply and with low latency; regions are far apart.

**Limited space.** Datacenter space is scarce. Every datacenter has a fixed floor that grows only in occasional expansion phases, and competitors rent most of it. You can rent only what is free at the moment. Space frees up when competitors cancel, at random, or when the building expands, and a waitlist tells you when what you need is available. Sooner or later every building is full, so growth means spreading across datacenters or building your own.

**Space**

| Space | What you get | Size | Billed |
| --- | --- | --- | --- |
| Basement | Room for one 24U rack and a home internet line | 1 position | Free; power at the household price |
| Rack share | Part of a rack the provider owns and installs, with its own lockable section and power share | 1/8, 1/4, 1/2 or a full rack | Per share per month, power per kWh |
| Rack positions | Floor positions in a provider's shared hall for your own racks | 1 to 4 positions | Per position per month, power per kWh |
| Cage | A fenced, locked area in the hall | 4, 8 or 16 positions | Per cage; cheaper per position than single positions |
| Private suite | A room of your own in the provider's building | 20 or 40 positions | Lease per month; you add your own UPS and feeds |
| Own datacenter | A building you lease or build | 100 positions and up | Lease or purchase; power room, generators and carrier room are yours |

**Extra power on a share.** A rack share is the provider's rack and has no feeds to add. Its Upgrades card offers extra power instead, in steps of 0.25 kW up to the share's base limit again, so at most twice the limit. A step is billed monthly with the share's rent and takes effect three days after booking. A rack over its limit still trips, and racks in your own positions keep the feed B and high-density feed upgrades.

**Flat-rate power.** Each datacenter bills the power of a rack position one way: metered per kWh, as a flat-rate contract, or either at your choice. Hetzler offers flat rate at all three sites (Hetzler NBG sells nothing else), and so do the small budget rooms (Docklands Data, Spree Colo, Next Lair VIE, SkyBlink Eygelshoven, Arubaba Hub, CoreSpite VA1 and CH1); the carrier hotels and the other large sites bill metered only. A contract is two feeds of 10 A (4.4 kW) or two of 16 A (7 kW) at a fixed monthly price. The rack's limit becomes the contract's kW, the breaker trips above it as on any rack, and the rack's draw leaves the power bill. The Power contract choice on the rack card switches between metered and the two contracts, and a change takes effect after three days. A rack bought at a flat-only site starts on 2 × 10 A, and a rack moved to another location takes the default of its new site. Shares stay metered and keep their extra power.

**Racks are yours.** You buy racks (24U, 42U or 47U) and place each one in a free position. A rack can move with everything in it: the servers inside go offline, cables to other racks and to the carrier panel are unplugged, and the rack arrives a day later in the same city or three days later in another. That is how a company grows out of the basement: you rent a position in a datacenter and move the basement rack there.

**Datacenters.** Every city has several datacenters from different providers, and each one has its strengths and weaknesses. The Add location dialog compares them side by side:

| Property | Varies between | What it changes |
| --- | --- | --- |
| Provider | Big carrier-neutral chains, local operators, budget hosts | Price, reputation and the rest of this table |
| Carriers on site | One to thirty | Which transit you can buy; a single-carrier site is cheap but locks you in |
| Internet exchange | On site, reachable by cross-connect, or none | Whether exchange peering is possible here |
| Private interconnects | Which big networks have a presence | Whether private peering is possible here |
| Power feeds | Single, or A and B | Whether dual power supplies pay off |
| UPS and generator | Neither, UPS only, or both | How many grid outages reach your servers |
| Green power | Yes or no | Customers who want green hosting; a slightly higher power price |
| Power price | Per kWh, by city and provider | Running cost |
| Power density | 4 to 20 kW per position | How many servers a rack can actually run |
| Cross-connects | Monthly fee per cable | The cost of every carrier, exchange and customer link |
| Remote hands | Price per hour and response time | Repairs without your own technician on site |
| Certification | Certified or not | Offices and enterprises require it |
| Lead time and term | Days until ready, months of commitment | How fast you can expand and how long you are bound |

**Provider logos.** Every datacenter provider has its own parody logo, drawn in code: an original mark and wordmark that hint at the real company through its name and colour without copying its logo. The basement shows a house icon.

**Location view.** The Locations app opens on an overview: a map with a pin per location and a card for each with its space, power protection, uplinks and how full it is. A switcher at the top jumps between locations, and a plus button opens the Add location dialog. Inside a location you see its floor: the positions with your racks in them, the free positions, and the carrier panel where uplinks and cross-connects arrive. Clicking a rack opens its front view; device fronts are drawn only there.

**Energy.** Every location bills the power your hardware draws at its own price per kWh. Your own datacenter can sign a custom contract with an energy provider.

**Power protection.** The grid fails now and then, and how much of that reaches your customers depends on the location.

| Location | Protection |
| --- | --- |
| Basement | None: every grid outage takes the servers down. A UPS from the shop (Eatin, from a 1U 1,500 VA unit to a 6U 10 kVA one) rides through outages until its battery runs out. |
| Datacenter | Whatever the site has: feeds, UPS and generator differ by datacenter |
| Private suite or own datacenter | Whatever you build: UPS, batteries, generators and two utility feeds |

A second feed only helps servers that have two power supplies, one on each feed. Dual-PSU servers cost more, so the player decides per server whether the protection is worth it. Customers who care about uptime pay for it: HA products can require dual feeds, or servers spread over two locations.

**Own datacenter rooms.** A private suite or own datacenter adds rooms beyond the server floor:

| Room | Holds | First available |
| --- | --- | --- |
| Power room | UPS, batteries, generators | Private suite |
| Cooling | Air handlers, later liquid cooling | Own datacenter |
| Carrier room | Hand-offs to carriers and internet exchanges | Own datacenter |

## Racks, hardware and cabling

Racks hold servers, switches and routers, and you cable them port by port. Bandwidth, redundancy and failures all follow from how you wire them.

**Hardware**

| Device | Size | Role |
| --- | --- | --- |
| Compute server | 1U | VPS, web and game servers |
| Storage server | 2U | Storage hosting, backups |
| GPU server | 4U | AI compute, late game |
| Access switch | 1U | Connects the servers in one rack |
| Core switch | 1–2U | Connects racks to each other |
| Edge router | 1–2U | Connects to transit and peering |
| Patch panel | 1U | Tidy cross-rack cabling; faster repairs |
| Aggregation switch | 1U | SFP fiber ports that link racks and uplinks |
| Small-office router | Carrier panel | The basement's internet router; replaces the provided one |
| UPS | 1–6U | Carries a location through a grid outage |
| Switched PDU | 0–1U | Power cycles and cuts the devices in its rack |

Switches come in several sizes: 8, 24 and 48 copper ports, each with a few SFP cages for fiber.

**Chassis and parts.** A server is a chassis with slots: DIMM slots, drive bays (3.5", 2.5" or NVMe-capable), PCIe slots and power supply bays, set by its line and generation (economy.md, Hardware, power and failures). Every RAM stick, drive and CPU has a size, and a server's cores, RAM and disk are the sum of its working parts, so a failed stick lowers the RAM of its node and can freeze it when workloads book more than is left. Drives of different sizes in one array count at the smallest size. A 3.5" bay takes 3.5" drives only, a 2.5" bay takes 2.5" drives, and an NVMe drive needs an NVMe-capable bay. The Components card in the inspector lists the slots of each group (CPU sockets, DIMM slots, drive bays, PCIe slots and power supply bays) with the part in each filled slot and Add on each empty one, which offers the spare parts in the zone's storage that fit. A powered-off server can be opened from the inspector (button and right-click menu): a top-down view shows the chassis laid out by its line, the lid slides off in 600 ms, and every slot is clickable, showing the part with Replace and Remove or offering the spare parts that fit. Close puts the lid back, and the server cannot be powered on while the lid is off.

**Buying servers.** Each server in the Shop is sold as a preset, a bare chassis, or a preset with extras. A preset ships with the CPUs, RAM and drives of its model. A bare chassis keeps the board, fans, network card and one power supply and ships without CPUs, RAM and drives; it costs the preset price minus those parts at the year's part prices, and never less than a quarter of the preset price. Extras are parts added to each unit in the cart, on a preset or on a bare chassis, and each costs the year's part price for its size. Extras that do not fit the chassis (more sticks than DIMM slots, more drives than bays, a drive that does not fit the bays, more memory than the board takes) are refused, and the cart line shows the parts and the total. A preset costs its chassis plus its parts at the year's prices, so it gets cheaper as parts fall and jumps when memory and flash spike; a custom build of the same parts costs as much or more. The Parts tab sells the parts alone into storage: RAM sticks, CPUs and drives of the current generation's sizes and the generation before, drives by form factor, and power supplies, fans, network cards and mainboards. Part prices follow the years (economy.md, Part prices by year), and a spare part sells at the current part price.

**CPU vendors.** CPUs and mainboards come from Indel or AMB (x86, from 2005) or Ampear (ARM, from 2020), with cores per socket, speed per core, watts and price per generation (economy.md, CPU vendors). The lead swaps over a long game: AMB is ahead in 2005, Indel leads per core and per watt from 2008 to 2016, and from 2017 AMB brings far more cores per socket for less money while Indel keeps the faster core. Ampear cores are the slowest but draw half the watts. A server card in the Shop offers its model as Indel or AMB on a segmented control (the ARM line is Ampear only), for the preset and the bare chassis alike, and the board takes that vendor's socket: a CPU fits only a board of its vendor and the chassis's generation, so switching vendors means another chassis, or another board in a chassis without CPUs. Every socket of a server holds the same CPU. A CPU change on a multi-socket server replaces every socket in one hand task, priced for all its CPUs with one remote hands job and one downtime, and needs one spare per socket; a failed CPU replaced by the same part swaps alone. Installing a CPU into an empty socket fills every free socket with the matching spares in storage. The Parts tab sells CPUs and mainboards per vendor, and the Shop filter and the used market have a Vendor chip. Saves from before vendors give every x86 server Indel parts and every ARM server Ampear parts, and a server with two different CPUs gets the larger one in every socket.

**Brands.** Servers and switches come from parody brands whose fronts look like the real ones: Dwell (hex-mesh bezel), Hewlett-Packet (silver front with a pull tab and a perforated grille), SuperMacro (black chassis with silver drive trays) and Sysko for switches. A player can tell a rack's contents apart at a glance.

**Rack front view.** Clicking a rack shows its front: every device drawn at its real height, with status lights. Clicking a device opens it in the inspector on the right.

**Ports and cables.** Clicking a switch or router lists its ports in the inspector. For each port you pick the other end: a device in the same rack, or another rack and device from a list. Copper covers 1G, short direct-attach cables 10–25G inside a rack, and fiber 10–400G between racks. Cables between racks run through the trays. Both ends must match in speed, and each port gets a role (server, uplink, or link to another switch).

**Patch panels.** A patch panel sits at the top of a rack, and the player decides what each jack is for: a carrier's cross-connect, a link to another rack, or a colocation customer's line. Incoming cables land on the back of the panel, and short patch cables connect the front jacks to switch ports. Re-patching a jack is quicker than pulling a new cable through the trays.

**Port groups.** Two to eight ports going to the same device can be bundled into a group (LACP). The group adds up their bandwidth and stays up when one cable or port fails. Both ends must be grouped, or the link falls back to a single port.

**Server network cards.** A server's network ports are bonded in one of two modes, set in the inspector:

| Mode | How it works | Bandwidth | Switch side |
| --- | --- | --- | --- |
| Failover | One port carries the traffic and the other takes over when it fails | One port | Nothing to set up; works across two switches |
| Load balance | All ports carry traffic (LACP) | All ports added up | Needs a port group; across two switches the pair must be stacked (an unlock) |

Failover is the safe default. Load balance doubles a server's bandwidth, but if the switch ports aren't grouped it falls back to one port and the inspector shows a warning.

**Port inspector.** Selecting a port shows the whole path as a diagram, from the switch port through any patch panel to the device on the other end, with the cable type and speed on each hop. Below it, a graph shows the port's traffic in and out over the last 24 hours.

**Technician PC.** A laptop that you plug into a free switch port gives you debug tools: ping, traceroute, a cable test that finds broken pairs, and port status. Finding the fault before sending a technician shortens the repair, because the technician brings the right part.

**Bandwidth.** Every port, switch and router has a capacity, and traffic can't exceed the slowest link on its path. One server on a 1G port can't serve 200 Gbps. Scaling up means faster ports, switches, uplinks and transit.

**Failures and redundancy.** Disks, power supplies, switches and routers fail at random, and more often as they age. Without a second path, everything behind a failed device goes offline. Two switches, two routers and servers wired to both keep services up. Until you hire technicians, you fix failures yourself.

**Lifecycle.** Every model leaves the Shop in its end of sale year: servers two generations after their own, switches, firewalls and edge routers six years after launch, UPS units eight years, and patch panels never. The Shop card shows "End of sale" with the year, the device page shows "End of support" with the year, and News reports each non-server model that goes. Devices keep working past both dates. Once a device is out of support, swapping, installing and removing parts takes twice as long, spare parts for it cost 1.5 times as much, and its components fail 1.2 times as often. While a model is on sale its price falls 5% a year from the second year, except servers, whose prices follow their parts. The newest model of each line (switches, firewalls, Sysko edge routers, the AVN, Sysko, MicroTick and Junipurr router lines, UPS units and PDUs) never leaves the Shop until a successor exists, and the 800G spine switch, the 400G firewall and the Sysko edge router XXL, all from 2027, keep the Shop stocked to the end of the game. KVMs, console servers and OOB switches never leave the Shop. See economy.md, Hardware, power and failures.

**Used hardware.** The Shop's Used tab sells second-hand gear from three channels, picked with a segmented control: eBuy (auctions), the WebHostingTalc marketplace (fixed asks from a hosting community board) and Telegrump deals (fixed asks in a chat group). Each month every channel posts a few listings of models that have been on sale for at least two years, spread over the month. Gear on sale at game start counts as three years older, so the market has listings from the first day; each listing shows the model, its age, a visible defect if it has one ("PSU 2 missing", "1 drive reports errors", "no rails"), the price or current bid, the time left and the shipping time. The true condition is hidden: every part arrives with its own age, so worn parts fail sooner through the normal ageing, and a drive that reports errors is already past its life expectancy. Used gear is paid in cash only, cannot be leased, and the hardware insurance never covers it. On eBuy the player bids a maximum; a rival bidder has a maximum of their own, the higher maximum wins when the auction ends at its set hour, and the winner pays the other's maximum. A Telegrump seller sometimes takes the money and vanishes, which a notification reports. Board and chat sellers in the city of the destination ship in a day. The player can also list a stored device for sale with "List for sale" in the Locations storage: on the board at an ask they set, or on eBuy from half its value. A buyer comes after a while unless the ask is far above the value, and an unsold device goes back to storage when the listing expires. Fair trades on the board (a purchase or a sale there) build a reputation: from 5 the player sees new board listings a day before everyone else, and from 15 a board contact asks for a VPS once a month through the normal sales requests. Once a year a hoster near the player goes bust and sells its servers on the board as one lot, all or nothing, and once a year a datacenter clearance weekend puts a batch of auctions on eBuy; both are in the News app. Bots never buy used.

**Burn-in.** A server in a rack that is on, has power and sits in no cluster can be burned in from the inspector (Quick burn-in and Full burn-in) or the right-click menu (Burn-in). The server is busy for the test, so no customer can be put on it, and it draws full power; in a datacenter it uses its rack position and power as usual, and the test needs no remote hands. A Quick burn-in takes 6 hours and marks every part that is near its end of life as Worn in the parts list. A Full burn-in takes 48 hours, shows the real age of every part and makes about half of the parts past their life fail while no customer is on the server. A used part shows "Unknown" for its age and "Untested" as its state until a burn-in has looked at it. A server that passes a Full burn-in without a failure breaks down less often for a year. Switching the server off or losing power aborts the test. Buying on the board or eBuy comes with buyer protection: when a part of the unit fails within 14 days of its arrival, half of the unit's price comes back once, so a failure found by a burn-in pays too; Telegrump deals never refund.

**Routers.** Routers are a class of the Shop with four sources. AVN builds the Fritz!Bocks small-office routers (2006 to 2024) for the basement: a bought one replaces the router that comes with the basement, keeps its cables on the same ports, and the replaced router goes into storage. The basement's home line carries the lower of the line's upload and the router's routed speed, so the provided 100 Mbit router holds back a fast line until a better one is installed. Sysko sells business and branch routers from 2005, MicroTick cheap routers from 2010 and Junipurr carrier routers from 2010; the Sysko edge routers stay. All of them mount in a rack, and a datacenter router passes on no more than its throughput, shared among the links on it. A router either holds a full BGP table (and so can run an own AS) or takes provider addresses and a default route. Announcing an address block from a datacenter needs a router with a full table that is up at that location; the basement's routers never have one. Prices, speeds and which models hold a full table are in economy.md, Routers, UPS and PDUs.

**UPS sizes.** Eatin sells four UPS sizes: 1,500 VA (1U), 3,000 VA (2U), 5 kVA (3U) and 10 kVA (6U, with two feeds). Every location counts the battery of the UPS units in its racks against the load of its devices, so a bigger unit carries the location through a longer outage.

**Switched PDUs.** Eatin sells a switched PDU as a 1U unit with 8 outlets and as a 0U unit with 24 outlets that hangs on the rack's side rail. A rack takes one. While it is up, every device in the rack can be power cycled and powered off from the inspector and the right-click menu, also a server without a management controller, with the same corruption roll as a pulled plug and without a remote hands fee. Devices plug into the PDU without extra cabling. A reset still needs the server's own controller.

**Load balancers and storage arrays.** The Shop has neither on purpose. High availability exists only for cloud clusters and web clustering is a panel trait, so a load balancer device would have no effect on any customer product, and a storage array would only repeat the storage server lines.

**Routers and BGP.** A router passes on at most its throughput. In the basement that caps the home line at the router's routed speed (100 Mbit for the provided router, up to 2.5 Gbit for the newest small-office one). In a datacenter the limit is shared among the links on a router, so a 100 Mbit branch router turns a 1 Gbit transit port into 100 Mbit. Announcing an address block needs a router with a full BGP table at the location (an edge router M or larger, a Sysko 4451 or 8300, a MicroTick CCR, a Junipurr MX); a router without one still takes provider addresses and a default route.

**Upgrades**

- A server swaps in place for another of the same height, for example a faster 1U. Bigger machines, such as a 4U GPU server, need free space. Drain the server first, or its workloads go offline during the swap.
- A switch or router swaps in place only if the new one has at least as many ports as are in use, so you can't downgrade below the used port count. Cables stay on their ports.
- A server grows in place by adding parts from the zone's storage to its free slots, and shrinks by taking parts out; a removed part goes back to storage and fits another chassis. Drives in a RAID array, fans and power supplies (with another one working) go in and out with the server running, and a drive added to an array starts a rebuild. RAM, CPUs and drives outside an array need the server off. The work takes 30 minutes in the basement, and at a datacenter the provider's remote hands do it at their hourly rate and response time, and a technician can do it instead. The server stays off afterwards until it is powered on and boots. A server in storage takes parts at once. The mainboard and network card cannot be removed, a failed or worn part is scrapped on removal, a part replaces a component of the same kind at the same size or larger, and a drive leaves an array only while the array still has the drives its RAID level needs.
- A second power supply is a part like any other. Servers sold in a single and a dual build become the dual build once the second supply is in and the single build again when it is out.

**Server models.** Every server is described by the same handful of specs, so comparing two is quick:

| Spec | Range | What it changes |
| --- | --- | --- |
| Height | 1U, 2U, 4U | Rack space |
| Architecture | x86; ARM from 2020 | ARM is cheaper per core and per watt, but a cluster runs one architecture |
| CPU | 1 or 2 sockets × cores per socket | Cores available to workloads |
| RAM | Fixed slots, filled at purchase or later | Memory available to workloads |
| Storage | Drive bays × disk type (HDD, SSD, NVMe) | Disk space and speed |
| Network | Ports × speed (1G up to 100G by year) | Bandwidth, and whether failover is possible |
| Power | Draw at idle and at full load | The power bill and the fuse limit per rack |
| Power supplies | 1 or 2 | Two connect to an A and a B feed and survive a failed supply |

The Shop app sells pre-built hardware from several manufacturers, each with its own parody logo. Within a class the manufacturers differ a little in price and failure rate, never in specs.

| Class | Lines | Notes |
| --- | --- | --- |
| Servers | Balanced 1U, compute-dense 1U, memory-optimized 2U, storage 2U, backup storage 4U, archive storage 4U, GPU 4U from 2011, ARM 1U from 2020 | One model per line and generation, so capacity can be matched to what customers need |
| Switches | Layer 2 or layer 3, with copper or SFP ports | All managed; layer 3 can route between networks and act as a gateway in later milestones |
| Security appliances | 1U firewalls with a throughput rating | Sit inline between the gateway and the switches; needed for firewall and DDoS features later |
| Patch panels | 24 or 48 ports, copper or fiber | Passive |

Storage servers hold fast disks for block and object storage. Backup servers hold many large HDDs for backups. Archive servers hold the densest, slowest drives and are the cheapest per TB, which makes archival backups a storage class customers can buy. Every model is pre-built with fixed CPU, RAM, disks, NICs and power supplies, so the choice is which model, architecture and size to buy. Bigger and denser models draw more power. Each model shows as a small isometric picture, so the sizes are easy to compare.

**Cart and leasing.** You add models to a cart and see the total before you check out. At checkout you pay in cash or lease the whole cart. A lease spreads the cost over 12, 24 or 36 monthly payments, and three leasing companies each make an offer. Offers vary at random from good to bad and change every month, so it pays to compare them. Leased hardware works like bought hardware, but it can't be sold until it is paid off. Buying it out early costs the remaining payments, and after the last payment it is yours.

**Storage.** Each availability zone has its own storage room. At checkout you choose the zone the Shop delivers to. An order is in transit for 3 days in 2005, falling to 1 day by 2015, and cannot be mounted until it arrives; the Cart shows the wait, and the first orders of a company without a server arrive at once. Units are mounted from the rack view of that zone by clicking a free slot, or from the storage list with Mount, which asks for the rack as cards and then the slot on that rack's front. Unmounting puts them back into the same zone's storage and drops their cables. Sending stored units to another zone is a shipment that costs and takes as long as a rack move. Identical units in storage form a stack, and a stack can be mounted in one step, each unit directly on top of the last. Hardware sells from storage or from a rack at its resale value: 80% of the price after the first month, falling evenly to 20% over the next two years. A new generation arrives every three years, and each one packs more resources per U and per watt, so replacing old servers cuts the energy bill as well as freeing space.

**Copy and paste.** A finished rack can be saved as a template and pasted into an empty rack slot. The game orders the hardware, and technicians install and cable it. A typical large location ends up with one core routing rack and many server racks, each with its own pair of switches.

**Rack view.** The left side shows the rack name, a Front and Back switch and the rack drawn large, every unit on its own with its number, so free units are as visible as used ones. Rack facts, power draw, utilization and upgrades (the basement's extra circuit, a rented rack's feed B and high-density feed) sit in cards on the right. On the back, cables leave each port to the right, run in a cable channel beside the rack, one lane per cable, and come back left into the other port. Devices outside the rack that it is or can be cabled to (the carrier panel, patch panels, a switch in another rack) sit above it as small labelled boxes, and their cables climb the channel into them. You drag from one port to another on the rack back to lay a cable.

**Port numbers and lights.** Every port face prints its numbers like real hardware: a switch numbers odd ports above the top row and even ports below the bottom row, a server counts its NICs from 0 as eth0, a patch panel counts each row from 1 and the carrier panel counts from 1. Each jack and SFP cage has a link light. It is dark without a link (nothing plugged in, a free patch jack behind the cable, or either end down), steady green with a link, and amber when the link runs slower than the port, such as a 10G cage cabled to a 1G port. With traffic it flickers, faster the larger the share of the link in use, on a logarithmic scale so a hobby site flickers slowly and a full link about five times a second. Each server's traffic follows its shortest cable path to the carrier panel and lights every port on the way. Switches and firewalls repeat the lights on their power-supply side as a numbered panel, one light per port. Patch panels are passive and have no lights. With reduced motion, the lights stay steady.

**Cabling manager.** Each location has a cabling view that lays every port of the location out on one plane, in three columns: the carrier panel, the network (switches, firewalls and patch panels) and the servers grouped by rack. Each device lists its ports top to bottom, and every cable runs from the edge of one port row to the other. You drag from one port to another to lay a cable, and the game picks copper, DAC or fiber from the port types and whether both ends are in the same rack. Ports that can't connect dim while you drag. Clicking a cable selects it so you can remove it. The rack view and the cabling view show the same cables.

**Wear, failures and maintenance.** Every device is built from components that wear out: drives, power supplies, fans, RAM, the mainboard, the CPU and network cards in servers, and power supplies, fans and the board in switches and routers. Each component type has a life expectancy. Before it, failures are rare; after it, they become likely, and drives fail far more often than RAM or mainboards. A failed component shows as an amber or red light on the device front, and what happens depends on what broke:

- **Drive:** in a RAID array the server keeps running degraded until the drive is replaced and rebuilt; without RAID the data on it is lost and the server goes down.
- **Power supply:** with two, the server keeps running on the other; with one, it goes down.
- **Fan:** the device runs hot and its other components fail twice as often until the fan is replaced.
- **RAM, mainboard, CPU or network card:** the device goes down until the part is replaced.

Spare parts are bought in the Parts tab of the Shop and kept in the zone's storage. You replace a part from the device in the Locations view. Drives in a RAID array, fans and one of two power supplies can be swapped while the device runs; everything else needs the device powered off, so its workloads go offline unless you migrate them first. At a datacenter the provider's remote hands do the swap, at their hourly rate and response time. A technician at the location can do it instead (see Staff). A spare replaces a component of the same kind at the same size or larger, and a drive spare has to fit the bays of the chassis. Replacing worn parts before they fail is your call, and it is cheaper than an outage.

**Hand work at a datacenter.** Every hand task (replacing, installing or removing a part, pulling the power, resetting a management controller) offers four ways in one sheet, each with its time and cost: Remote hands, Technician, Do it yourself and Send a friend. Do it yourself starts the work after the drive from your home city: 1 hour in the same city, 4 hours in the same country, 9 hours in another European country, and it is not offered overseas. The drive costs a fare and keeps you busy for the drive there, the work and the drive back, so the replies in your Email queue wait. The premium room of a city, the one with the highest position price, only lets visitors in on a booked slot, which adds a day. Send a friend costs a round of pizza and beer, can be done 3 times a year, leaves you free and has one chance in ten of a mishap that doubles the time the work takes.

**RAID.** Each server's drives run in a RAID level you choose in the BIOS setup on the server's screen (see Server console), or on the server page while it is off: none, RAID 1, RAID 5, RAID 6 or RAID 10. A new level deletes the array and asks first when it holds data. More redundancy means less usable space and more drive failures survived. A rebuild runs at the rebuild rate you set in the setup or, on a server with a controller, in its Storage tab: a fast rebuild slows the server, a slow one leaves it exposed for longer. Distributed storage pools across servers, Ceph style, are a later unlock.

**Power and labels.** Any device can be powered off and on from the Locations view; everything that depends on it goes down with it. A device that is switched on boots for one hour before it carries traffic. Every port sits on the back of the rack, so cables are drawn in the back view. Clicking a power supply's inlet on the rack plugs it in or pulls the plug, asking first when that takes devices offline. Switches and firewalls mount reversed, as in real racks: their port face looks to the rack back, next to the server NICs, and their power supplies and fans look to the rack front, so a switch is plugged in from the front. Servers show drive caddies, a control panel and status lights on the front, and NICs and power supplies on the back. Device names are small asset tags that start with the zone, such as fra1-srv-02, from the moment a unit lands in storage; a unit mounted in another zone takes that zone's next name. A server, a rack and a location each show CPU, memory, storage and network use as a bar of 20 lights: green, then 4 orange, then 2 red. Devices can be given a custom label, and cables a custom colour.

**Remote management.** Servers from the 2008 generation (Dwell and Hewlett-Packet) or the 2011 generation (SuperMacro and Lenovoid), and every ARM server, carry a management controller: iDRAQ on Dwell, iLOL on Hewlett-Packet, IPMI on SuperMacro and XClarify on Lenovoid. The 2005 generation has none. A controller has its own address on a management network (192.168.3.x in the basement, 10.n.2.x in a datacenter), shown on the server page with a link that opens the Browser. Its page imitates the brand's real one, logs in with one click, and offers Power (power on, graceful shutdown, reset, power cycle), Sensors (inlet temperature of the room, fan speeds with a failed fan at 0 RPM, power supply status) and the Event log of the server's last 20 events. It keeps answering while the server is off. The Locations inspector and the right-click menu route a server's power through the controller and say "via iDRAQ"; a server without one offers Shut down while its operating system answers, and Pull power on site. Pulling power on site is instant in the basement and costs remote hands for an hour, after their response time, in a datacenter.

**Server console.** Every server has a screen, reached three ways: a Console tile on the server page and a Remote console button on the controller's page open it in its own window (iDRAQ Virtual Console, iLOL Remote Console, SuperMacro iKVM, XClarify Remote Control), a KVM on the console end opens the same window from its page with the power keys the KVM can press, and clicking the blue console end on the back of a server in the rack plugs in a monitor, which replaces the server page with the screen and the buttons at the machine while the player stands at that location. The screen shows "No signal" while the server is off, the POST splash while the server boots (three game minutes, so pausing the game is the sure way to catch it), the firmware prompt a stuck boot waits at, the BIOS setup, and then the operating system's own first screen (a Debian login, VMwhere's direct console, a Windows logon) or "Operating system not found". Del or F2 during the splash or at the firmware prompt opens the BIOS setup; F1 at the prompt continues the boot. A server in setup never finishes booting, so its workloads stay down and its status reads "In BIOS setup" until F10 or Esc leaves it; a reset or a pulled plug leaves it too. The setup's Storage page holds the RAID level and rebuild rate. Keys come from the keyboard while the screen has focus and from a row of soft keys under it.

**Hangs and pulled plugs.** A server's operating system can hang: its workloads are down and it answers nothing, so a graceful shutdown is refused. Reset and Power cycle through the controller clear it, as do Pull power and a technician on site. A hung controller refuses every action and its page does not load; a hand task of 15 minutes on site (remote hands in a datacenter) resets it, and a hung server with a hung controller leaves only Pull power. Any hard stop of a server that ran workloads (pulled power, reset, power cycle) risks corrupting them: when the array has its redundancy intact the server only resyncs, slowed like a rebuild; otherwise each corrupted workload is down until it is recovered, which takes 30 minutes of hand work (in the Locations inspector, through a technician, and in the Terminal later). Most workloads come back fine; the rest need a restore from backup and are lost without one. A graceful shutdown never corrupts anything.

**Remote access.** A server without a controller can still be reached from afar through a KVM, and gear through a console server. Every server has a console end on its back, and switches and rack routers have a console port and a management port beside their data ports, drawn on the back view. These cables carry no customer traffic and count only for remote access.

- The PiKVN (Pear Street Electronics, 2019, 60 €) hangs on the rack rail without a rack unit. It takes a switch port for its own network and one cable to a server's console end, and switches the server's power through its own ATX adapter.
- The IP-KVN 8 (Avoscent, 2005, 1U, 1,200 €) serves eight servers but only shows their consoles. An ATX adapter (25 €, fitted from the server page) lets it switch that server's power as well.
- A server whose KVM can switch its power counts as remotely switchable: the inspector routes power through it and says "via PiKVN".
- The OpenGearbox 8, 16 and 48 console servers (2005, 1U, 1,500 €, 2,500 € and 6,000 €) connect to console ports with rollover cables.
- The OOB switch 8 (Rarytan, 2005, 1U, 150 €) links management ports and console servers into a network of their own.
- A KVM or console server is reachable when its network port sits on a working switch with a way out, or on an OOB switch that has its own way in. A console server or OOB switch can get its own way in through a management DSL line at 20 € a month or, from 2008, a cellular modem at 30 € a month. That path stays up while the production network is down.
- Each KVM and console server has an address on the management network (192.168.4.x in the basement, 10.n.3.x in a datacenter) and a plain page in the Browser. The page lists every device behind it with its power state, the last lines of its console, and buttons for power, Continue boot and Recover over console.
- The Terminal's `console <device>` command opens the console of a server, switch or router over the same path.
- KVMs fail at 4% a year. None of these devices needs research; the year gates them.

**Stuck boots.** After a part swap or a hard power event (lost power, Reset, Power cycle), a server has a 5% chance to stop at a BIOS prompt and wait for a key. Its workloads stay down until someone presses it: Continue boot takes 2 minutes over a controller or a console, and is a hand task on site otherwise.

**Power plugs.** Every power supply has to be plugged in before the device gets power. A newly mounted device arrives with its supplies unplugged; the Power card in the inspector lists each supply with Connect and Disconnect, and the rack back draws each plugged supply's cord running left behind the rack rail to the power strip (a Schuko strip in the basement, the PDU at a datacenter). A device runs while at least one plugged supply works: with two supplies plugged in, one can fail and the device keeps running, while a single plugged supply that fails takes it down. A switched-on device boots for one hour once it gets its first working supply. Unplugged devices draw nothing. The starting hardware comes plugged in.

**Power feeds.** A rented position comes with one power feed at the datacenter's kW limit. You can add a second feed (B) so that servers with two power supplies survive a feed failure, or a high-density feed that raises the kW limit. The basement can get one extra household circuit. A feed that draws more than its limit trips.

**Monitoring.** Without monitoring, the only way to notice a failure is to see the lights in the Locations view, or to wait for customers to complain. Monitoring software is an early research unlock. It notifies you of every failure and warns about parts past their life expectancy. It also opens the Monitoring app, a dashboard of every location, rack, feed, link and server with live usage and a list of alerts. Like other software, it comes in a few products with different prices.

**Keeping it fun at scale.** Cabling port by port is fun for the first few racks and tedious at 200. Three things fix that: rack templates, an auto-cable button that wires a server to the next free ports on its rack's switches, and technicians who do installs for you.

**Device inspector.** A selected device shows its front or back, then its status as plain values: power (On, Off, Booting, Unplugged, No power), link, and for a server its control plane and role, with Set up while it has none. One row of four meters shows CPU, memory, storage and network, followed by the ports, the cluster node, the power supplies, components and specifications as flat sections. Power on and off sit in the header and in the device's menu. A Balanced 1U with one power supply shows its empty second bay with an Add button and the price of the second supply.

## Clusters and products

Servers join clusters, and products draw their resources from clusters. Everything is virtualized, so adding a server to a cluster adds capacity for every product running on it.

**Clusters.** A cluster is a named pool of servers, such as "Webhosting 1" or "HA Cloud". Its capacity is the sum of its servers' CPU, RAM and storage; booking CPU and RAM past it is always allowed, only the disk limits what products can book (see Overprovisioning is always allowed). Its tier sets what it costs to run and how it handles failures:

- **Consumer cluster:** no failover. Cheap, and fine for customers who shrug off a day of downtime.
- **High-availability cluster:** keeps spare capacity in reserve and spreads servers over two switches or two locations. Costs more, and is sold to customers who can't tolerate outages.

**Everything runs on clusters.** Every product runs as workloads on a cluster, so draining, replicas, keep-apart rules and failover work the same for all of them. Web hosting runs inside shared web server instances with the control panel, and DNS, game servers, load balancers, databases and Kubernetes run as instances too. Object storage runs on a storage cluster made of storage nodes. Two things stay outside: a dedicated server is a whole node taken out of the scheduler's pool and handed to one customer (OpenStack's bare-metal service, Ironic), and colocation is the customer's own hardware using your space, power and ports. The basement server starts as a one-node cluster, which is why a second node and the HA unlock matter.

**Workloads.** Every contract runs as one or more workloads, placed on the servers (nodes) of a cluster:

| Workload | Uses | Moves to another node by |
| --- | --- | --- |
| Virtual machine | vCPUs, RAM, disk | Live migration; customers don't notice |
| Web space | A slice of a web server's CPU, RAM and disk | Copying its files; a few seconds offline |
| Game server | Mostly CPU and traffic | Restarting on the new node; players are kicked |
| Storage volume | Disk | Copying its data; slow, and uses bandwidth |
| GPU server | vCPUs, RAM, disk and whole GPU cards | Moving to a node with enough free cards |
| Dedicated server | A whole node | It can't move; the customer rents that machine |

**GPU servers.** From 2011 a GPU 4U server carries four GPU cards, and a hypervisor cluster with a free card on one of its nodes can sell GPU servers once the team has learned GPU computing in Research. A GPU server is a virtual machine that books 1, 2, 4 or 8 whole cards of one node together with its vCPUs, RAM and disk, so no order for more cards than a node holds can be placed. Cards are parts of the server: they sit in PCIe slots, add their watts to the rack's power, fail like other parts and cannot be taken out while a virtual machine uses them. Demand for GPU servers is small until deep learning in 2017 and generative AI in 2023, and the News app announces both and every new card. Card prices and the rental market are in economy.md, Prices over time.

**Placement.** The cluster's scheduler picks a node for every new workload, the way OpenStack does. Each cluster has a policy: *pack* fills one node before the next, so fewer servers draw full power, and *spread* keeps every node equally loaded, so a failed node hits fewer customers. Each cluster also sets two rules in its settings, in the spirit of Ceph's default placement rules:

- **Replicas:** how many copies of each workload's disk the cluster keeps (1 to 3). More replicas survive more failed nodes and cost that much more storage.
- **Spread across:** host or rack. A cluster lives in one availability zone, so a customer's workloads and the replicas of one disk go to different hosts or racks within it wherever the cluster has room, and fall back to hosts when it doesn't. Spreading across zones is the customer's choice: they book in two zones. The node view flags workloads placed against the rule. CPU, RAM and disk can be overcommitted per cluster (see Usage and overcommit). A workload has to fit on one node, so a cluster can have enough free RAM in total and still refuse a big VM. The Rebalance button moves small workloads around to make room.

**Node states.** Each node in a cluster has one of four states:

| State | Meaning | OpenStack |
| --- | --- | --- |
| Active | Takes new workloads | Compute service enabled |
| Cordoned | Keeps its workloads but takes no new ones | Compute service disabled |
| Draining | The scheduler moves every workload to other nodes | Live-migrating every instance off the host |
| Maintenance | Empty; safe to upgrade, re-cable, swap or remove | Disabled and empty |

Draining stops with a message when the rest of the cluster has no disk for what the node holds, and says how much is missing; CPU and RAM never stop it. Uncordoning returns the node to Active. Migrations share the links between nodes, so the scheduler moves a few at a time.

**OpenStack as the model.** Virtual machines and cloud servers follow OpenStack, so players who know it recognise everything and players who don't learn something real. The game uses plain names on screen and keeps the OpenStack concept behind each one:

| In the game | OpenStack concept | How it plays |
| --- | --- | --- |
| Cluster | Compute region or cell | A pool of nodes with one scheduler |
| Node | Compute host (Nova) | A server that runs instances |
| Instance size | Flavor | vCPUs, RAM and disk; requests name a size |
| Location (datacenter) | Availability zone | Every booking names one; a cluster lives in one |
| City | Region | Holds one or more zones |
| Hardware class | Host aggregate | Nodes tagged NVMe, ARM or high-memory; sizes can require a class |
| Placement policy | Scheduler filters and weighers | Filters drop nodes that can't fit; *pack* or *spread* weighs the rest |
| Overcommit | CPU, RAM and disk allocation ratios | No limit on CPU and RAM, disk (thin provisioning) up to 2:1 |
| Keep apart | Server group (anti-affinity or soft anti-affinity) | A customer's instances land on different nodes, strictly or when possible |
| Disk replicas and spread | Ceph-backed volumes with CRUSH failure domains | 1 to 3 copies spread across hosts, racks or locations |
| Volume | Block storage (Cinder) | Disks that outlive an instance and move with it |
| Image | Image service (Glance) | The operating systems you offer; each one is a convenience point |
| Private network | Project network (Neutron, VLAN or VXLAN) | Overlay networks are the VXLAN unlock |
| Public IP | Floating IP | Each one uses an address from your pool |
| Customer account | Project (Keystone) with quotas | Cloud quotas and quota requests |
| Restart after a failure | Evacuation, instance HA (Masakari) | Part of HA clusters |
| Load balancer | Octavia | Runs as instances on the cluster |
| Object storage | Swift or Ceph RGW | Runs on storage nodes |
| DNS hosting | Designate | Two DNS workloads per cluster |
| Managed databases | Trove | Database instances you patch and back up |
| Managed Kubernetes | Magnum | Needs a Kubernetes engineer |

**Software on machines.** Software is installed on a machine: a server or one of the player's own VMs. Each machine runs one hypervisor ("Proxmocks", "VMwhere", "HyperVee", "OpenStash"), one hosting panel ("cPanic", "Pleskit", "DirectAdmen", "FreePanel") or one game server panel ("TCAdmen", "MultiKraft", "Pterodaktyl"), or nothing (a dedicated server or colocation). A panel next to a hypervisor runs in a VM on it, never beside it on the bare metal, and VMs take no hypervisor. The server inspector and a VM's detail view show the installed software as a grid of tiles with a dashed Add Software tile last; Add Software opens the catalog with each item's license and install hours, and software that cannot go on the machine is dimmed and says why when picked. A tile's menu opens, uninstalls, or for a hypervisor joins another cluster. The software's management services take a fixed slice of CPU, RAM and disk on the machine. Installing takes the software's install hours; uninstalling needs the machine empty of what it serves. Booking vCPU and RAM is never limited by the software (see Overprovisioning below). A custom VM can be resized later: growing only its RAM is live on a hypervisor that balloons guest memory (Proxmocks, VMwhere, HyperVee from 2012), and any other resize restarts the VM for 10 minutes. Software inside a VM runs 5% slower than on bare metal, so a panel VM holds 5% less vCPU and RAM than its booking.

**Hypervisor clusters and panel hosts.** A hypervisor installed on a server forms a one-server hypervisor cluster; a server running the same hypervisor joins another cluster of its zone once nothing runs on it, and a server with a different hypervisor or none is refused. Clusters host virtual machines: the customers' VMs (VPS, game servers, DNS, VPN, storage and cloud servers) and the player's own VMs, which the player books with any vCPU, RAM and disk in the Virtual machines app (New VM) and then fills with Add Software; a VM with a panel is a panel VM. Web hosting runs on panel hosts. A panel host is either a bare-metal server with a panel installed, whose capacity is the server, or one of the player's own VMs on a hypervisor cluster with a panel installed, whose capacity is the VM's booked vCPU, RAM and disk; the player sizes the VM and can resize it as long as its disk still holds its web spaces and its server has the disk for it. Licences are per panel host as the software's pricing says. PHP versions, PHP upgrades and security advisories apply per panel host. Web hosting on a bare-metal panel server dies with that server; on a panel VM it moves with the VM, so a panel VM on a cluster with failover survives a server failure.

**High availability.** The High availability research (tier 3, after Product management and Monitoring; it replaced Virtualization, which used to open the Virtual machines app) gives every hypervisor cluster three switches. Live migration moves running VMs without downtime, on a hypervisor that can (HyperVee cannot); without it a move is cold and the VM is offline while its disk and RAM copy over. Auto-balancing needs live migration and moves the smallest running VM off a node that runs hot (90% of its installed RAM in use, more busy vCPUs than cores, or booked beyond its bookable capacity) to the idlest node that is not hot, one VM per node an hour. Automatic failover restarts the VMs of a failed node on other nodes with room within about five minutes, counted as five minutes of downtime, and moves the control plane first when its node failed; VMs that fit nowhere stay down and the player hears about them once. Without failover, a failed node's VMs stay down until the node is repaired or the player cold-migrates them. Cloud servers need a cluster with failover on.

**CPU vendors in a cluster.** A node's vCPU is its cores times the speed of one core of its CPUs (economy.md, CPU vendors), and a game server on a node with slower cores runs slower by that factor; VPS and cloud servers care about vCPU only. A VM moves live only between nodes whose boards share a vendor, and auto-balancing skips nodes of another vendor. The High availability card has a Compatibility mode switch (the EVC analogue): with it on in both clusters a VM moves live across vendors, and every node of the cluster holds 10% less vCPU. Failover restarts VMs on any node, since a restart is not a live move. A share of VPS, game server and cloud orders needs x86 (economy.md, x86 orders), so an Ampear node takes only the rest, and the order shows x86 in its spec.

**Server view.** Selecting a server in a location shows everything about it in one place. Its ports work like a switch's: each port with its speed, link state, bond group and the device and port at the other end. Below that come live utilization of CPU, RAM, disk and network against the hardware and the overcommit limits, the workloads running on it with their customers, and the control-plane roles it hosts. The node card puts booked vCPU, RAM and disk next to the CPU, RAM and disk in use, row by row. Each workload row shows its customer, its service (the domain for web hosting) and three small CPU, RAM and disk gauges of use against its booking, sorted by CPU; a gauge at 90% or more turns amber, and a workload that ran its CPU flat out for most of the last day is marked Pegged. A menu on each row moves the workload to another node with room (live or with downtime as the platform allows), stops or starts it, or opens it in Virtual machines.

**Overprovisioning is always allowed.** Booking more vCPU and RAM than a server, a cluster or a panel VM has never refuses a placement, a resize or a migration, whatever the software, since most workloads don't use all of theirs; it only costs performance. The owner's rule: a cluster must never claim to have no room when room is there, a web hosting package needs minimal resources, and overprovisioning is not something that depends on the software. The one hard limit is disk, at twice the usable RAID disk of a node and at the VM's own disk inside a panel VM, because data has to sit somewhere; the order, the placement or the resize fails with a message about the disk. Automatic placement prefers a node whose installed RAM the booking still fits and otherwise takes the idlest node. The capacity bars in Products, Virtual machines and Locations show booked against physical, without a cap line, and run past 100% in the warning colour. While the CPU in use passes the cores, everyone on the node slows down. When the RAM actually in use passes the installed RAM, the server freezes: every workload on it is down, which is an outage for each customer on it, until the player moves or stops workloads, adds RAM or the load drops. The node, its rack lights and the server view show it as Frozen with the RAM in use. The cheap tier 2 training **Memory reservation** adds a per-cluster switch that refuses placements and moves that would book more RAM than a node has installed; it is the only way RAM refuses a booking.

**Usage and overcommit.** Customers rarely use everything they booked at once, so a cluster can sell more than it physically has. Every workload follows a usage curve for its customer type over the hours of the week: game servers sleep through the working week and run hot on weekend afternoons and evenings, online shops are busy from morning to 22:00, news sites peak at breakfast, and backups run at night. The load on a node is the sum of its workloads' curves. As long as that sum stays below the hardware, overcommitting is free money. When the peaks line up, it isn't: CPU contention slows every customer on the node, RAM pressure swaps and then kills workloads, and a full thin-provisioned disk pool stops writes. Mixing customer types on a cluster flattens the peak, and a cluster of nothing but game servers melts every Saturday night. The cluster view shows booked capacity next to the forecast peak for the coming week, and sale seasons, game launches and breaking news push the curves higher for a while.

**When a node fails.** In a high-availability cluster its workloads restart on other nodes within minutes. In a consumer cluster they stay down until the node is repaired. Disks and power supplies often warn before they die, which gives a careful player time to drain the node first. A workload stuck on a switched-off or failed server whose cluster's control plane is down can be recovered by hand to another cluster in the same location.

**Automation.** Unlocks turn these chores into rules: drain a node automatically when it reports a hardware warning, rebalance every night, and restart workloads elsewhere when a node fails.

**Product catalog**

| Product | Runs on | Needs | Notes |
| --- | --- | --- | --- |
| Web hosting | Cluster | Control panel license |  |
| Domains |  | Reseller account, later your own registrar | Can be resold; needs DNS hosting |
| DNS hosting | Cluster | Two DNS workloads on different nodes | Tiny load, but if both go down every customer domain stops resolving |
| SSL certificates |  | Certificate reseller account | Can be resold; often bought with domains |
| Game servers | Cluster | A license per game | Gamers attract DDoS attacks |
| VPS | Cluster | Virtualization platform | Fixed size, monthly |
| Cloud servers | HA cluster | Cloud platform license | Hourly, within a quota; late game |
| VPN | Cluster |  | Uses a lot of bandwidth |
| Dedicated servers | Whole machines | Spare servers in racks | Individuals rent small machines, companies big ones |
| Storage hosting | Storage servers |  | Backups and file hosting; uses a lot of bandwidth |
| Object storage | Storage servers |  | Billed per TB stored and per TB downloaded |
| Managed databases | Cluster | Database license or open source | You run backups and updates; database tickets |
| Load balancers | Cluster |  | Sold with cloud servers; small load, many connections |
| Managed Kubernetes | Cluster | A Kubernetes engineer on staff | Each engineer looks after a limited number of customer clusters |
| CDN | Clusters in several cities | Presence in 3+ locations |  |
| Colocation | Your racks in a datacenter | Datacenter space | Customers rent a rack share or a full rack; you wire their uplinks |
| Add-ons |  | Unlocked per product | Backups, extra IPs, priority support, DDoS protection |

**Colocation.** Customers rent space in your racks: 1/8, 1/4 or 1/2 of a rack or a full rack, the same sizes the datacenters rent to you. A request names the size, the power it needs and its uplinks, such as 2 × 1G or 2 × 10G. You assign a rack with enough free units and power, and the game marks that section as the customer's and puts a patch panel at its top. The customer's hardware is a closed block that draws its power. Your job is to cable the panel's requested ports to your switches. The service is online once every requested uplink reaches the internet at its speed, and it counts against the rack's power limit like your own servers.

Worth adding later: email hosting.

**How the first build plays.** These decisions hold until the parts above them are built:

- A cluster has a name, a zone and a placement policy, and takes every cluster product. Its name says what the player uses it for, such as "Webhosting 1"; there are no cluster kinds.
- Every service with hardware runs as one workload. The scheduler books what the service asks for against the node's cores × 8, its installed RAM and usable disk × 2 (RAM × 1.5 when the player picks the node), and skips nodes that are cordoned, draining, in maintenance or not working.
- A service is online when every workload's server reaches the internet, still holds the data written since the workload was placed, and the customer is not suspended. Domains, certificates and services from saves made before clusters have no workload and stay online.
- Draining moves every workload that fits at once and the rest each hour as room appears; an empty node goes into maintenance. A workload moved off a node that lost its data starts on a fresh disk and comes back online.
- Dedicated servers take a whole mounted server that no cluster or other customer uses. Colocation takes free units at the top of a datacenter rack and adds its watts to the rack, and it is online while the rack has power.
- Servers in a cluster or rented out can't be unmounted or sold, and their racks can't move to another zone.
- The game starts with an empty basement rack and no internet. The player buys the first server in the Shop, mounts it in Locations, plugs in its power and cables it to the home router, and orders a home line in Locations, which goes live after its install days. Once the server is online, the player opens it in Locations and uses Add Software to install a panel (simplest, web hosting only) or a hypervisor, then books a VM on the hypervisor and installs a panel in it; the panel's install follows the hypervisor's. The three friends wait for web hosting and move their sites onto the first panel host that finishes installing while the line is live.
- The Guide walks through these steps in order (buy a server, mount and power it, add internet, install software, register your domain, switch on a product, set up company email, first customer) and checks each one off when the game state shows it done. Registering the domain means signing a registrar contract and registering the company domain in Network, Domains; company email is booked in Settings, Email.

- A hypervisor cluster runs nothing until the player installs its hypervisor; a panel host is created with its panel and runs it once the install hours pass. The installed software decides what sells: web hosting needs a panel host with room, VM products need a hypervisor cluster, dedicated servers and colocation need neither.
- The website, order emails and leads only offer product lines that the company can deliver and that the player switched on in the site's Admin page: a panel host or hypervisor cluster the internet reaches, a spare server for dedicated, a datacenter rack for colocation. A dynamic home line sells web hosting only. A new game sells nothing until the setup is done.
- Load follows the usage curves; an overloaded node slows its customers and draws "really slow" tickets instead of killing workloads.
- A cluster backs up daily or weekly to another cluster. A lost array opens an incident report, and every lost workload can be restored from its backup or on an empty disk. Customers without a backup send one refund request per incident to Support, and refusing it loses them.
- The Virtual machines app is free in the Pear Store once a hypervisor is installed. It lists every VM, the player's panel VMs included, to start, stop, resize (panel VMs) and migrate between nodes. Moves between zones wait for links between locations. The Network app is free and available from the start for the location's lines and ports; buying transit and peering needs the Network operations research.

Still to build on top of this: surges in the usage curves, migration times shared between moves, two DNS workloads on different nodes, replicas and keep-apart rules, backup retention settings and hourly backups, distributed storage pools, quotas and self-service for cloud customers, and the uplinks of colocation customers.

**Software choices.** Some products need software bought on the market. Each choice offers four balanced options. The cheap ones are tempting early, but switching later means a migration with downtime and tickets.

| Control panel (web hosting) | Pricing model | Trade-off |
| --- | --- | --- |
| "cPanic" (cPanel) | Per hosted account, in tiers | Customers know it; gets expensive as you grow |
| "Pleskit" (Plesk) | Per server, by number of domains | Good value at mid size |
| "DirectAdmen" (DirectAdmin) | Per server, flat tiers | Cheap; fewer features, more tickets |
| "FreePanel" (open-source panels) | Free | No license fee; more admin work and tickets |

| Cloud platform (cloud servers) | Pricing model | Trade-off |
| --- | --- | --- |
| "OpenStash" (OpenStack) | Free | Every feature above; needs the most admin work until you have staff for it |
| "VMwhere" (VMware) | Per CPU core, yearly | Polished and few tickets; the license bill grows with every node |
| "Proxmocks" (Proxmox) | Free, optional support per socket | Easy to run; no quotas or self-service until the shop unlock |
| "HyperVee" (Hyper-V) | Per server, with an OS license | Business customers like it; Linux customers don't |

Software exists from a year: a panel or hypervisor cannot be installed before its first year (OpenVeeZee, the free container platform, and VMwhere from 2005, Proxmocks and HyperVee 2008, OpenStash 2010), and an old save keeps whatever it has installed. Each panel has traits the picker shows as labels. A panel imports web spaces from the same panel and from other panels from a year of its own, or never: cPanic imports from cPanic from 2005 and from other panels from 2012, Pleskit from 2005 and 2015, DirectAdmen from itself from 2010 and from no other, FreePanel from none. Most panels run web hosting on a single host; FreePanel clusters from 2009, so a second server running FreePanel can join a FreePanel host, and its sites stay up while any of its servers works. No panel of the period replicated sites between hosts, and the game has no replication.

**Migrating a web space.** Moving a web space to another panel host is a hand task that the player runs from the web space's menu or hands to a technician trained on panels. It takes 2 hours between hosts of the same panel and 4 between different panels, plus 3 minutes for each GB of web storage, and half of that when the target's migration tool applies; the hours are shown with each target. The site stays up while it is copied and is unreachable for the last 10 minutes. It costs no money, and a web space on a clustered host moves between its servers by itself.

Game servers work the same way: each game has its own license terms (one-time, per server or per player slot) and its own demand.

Game servers can run on a game server panel ("TCAdmen" from 2005, "MultiKraft" from 2010, the free "Pterodaktyl" from 2016) or in a plain VM on a hypervisor. An order goes to a game panel with room first. A game panel gets updates and vulnerabilities like any software, and while one is compromised its game servers are down until the player cleans it up. The per-game license is not built yet; a panel bills its own fee per server.

**Consoles.** Every panel host, hypervisor node, panel VM, mail host and game panel answers in the Browser at its hostname under the company domain (`node001.<company domain>`, `vm002.<company domain>`) with a login page styled after the product it imitates, without real logos: cPanic has a blue header and an orange button, Pleskit a dark sidebar, DirectAdmen grey with green, FreePanel plain forms, OpenStash Horizont a red sidebar, VMwhere vSphear a blue tree, Proxmocks VE an orange and grey tree, HyperVee Manager a Windows-style list, OpenVeeZee a plain web panel, Postfixit and Mailpig a plain mail admin, and the game panels a dark look. Login is one click. The console lists the software's objects (web spaces, virtual machines, game servers, the mailbox count) with status and usage and offers only the actions its software has; each calls the same action as the desktop apps, which keep working. A console on a host that is down cannot be reached; a console on a hacked host shows a defaced page and nothing else. Every console the company runs is a default bookmark. `consoleFeatures(softwareId, year)` returns the matrix:

| Feature | cPanic | Pleskit | DirectAdmen | FreePanel | Horizont | vSphear | Proxmocks VE | HyperVee | Game panels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| List objects, status, usage | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Create and delete | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Stop and start | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Migrate to another host | by hand from 2012 | by hand from 2015 | no | no | yes (live) | yes (live) | yes (live) | cold only | no |
| Resize | yes | yes | yes | no | yes | yes | yes | yes | no |
| Backups and restore | yes | yes | yes | no | no | yes | yes | no | Pterodaktyl only |
| Update the software | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Take sites offline, clean up | yes | yes | yes | yes | no | no | no | no | yes |
| Cluster view (nodes) | no | no | no | from 2009 | yes | yes | yes | from 2012 | no |

A panel migrates from the year its tool imports a web space from another panel (the `migration.other` year of the software); hypervisors migrate live or cold by the software's `live` trait. OpenVeeZee follows HyperVee without the cluster view. The mail servers list their mailbox count, update and nothing else. The console shows the hours a migration takes before the player confirms it. FreePanel has no restore on purpose; the player restores from the Virtual machines app. A hacked host shows only the defaced page, so cleaning it up stays in the Products app.

**Storage, backups and data loss.** Workload disks live on their server's RAID array (see RAID), and later on distributed storage pools. If more drives fail before a rebuild finishes than the RAID level survives, or a drive fails without RAID, the data on them is gone. Every affected workload is marked "Lost disk", and the game opens an incident report that lists the lost disks, the affected volumes, workloads and customers, and the age of each one's last backup, so nothing has to be hunted down across apps.

Backups are on-site: backup rules per cluster set how often (hourly, daily, weekly) and how long to keep them, and they write to backup servers in the same zone, mostly at night. A lost disk with a backup can be restored, from the incident report or from the virtual machine manager, and only the data since that backup is gone. Without a backup the customer's data is lost for good.

Data loss hurts. Affected customers ask for a refund, and unhappy ones leave reviews. A refund calms them, but some still write a review: often a 3-star one, sometimes worse. Most customers never write a review at all.

**Virtual machine manager.** A desktop app for running workloads, branded after the virtualization platform you chose: its name and logo in the menu bar and window change with the platform (Proxmocks, VMwhere, OpenStash, HyperVee). It has the usual inventory tree of zone, cluster, host and VM. VMs can be started, stopped, restarted and migrated live or cold to a host you pick, and restored from a backup point. Hosts can be cordoned, drained or put into maintenance. Storage shows each server's RAID health, rebuild progress and rebuild rate, and later the distributed pools. The incidents tab lists open incident reports. It uses the same window design as every other app.

**Requests instead of price lists.** Customers ask for the resources they need, such as disk and mailboxes for a site or vCPUs, RAM and disk for a server. You decide what to build and offer, and customers come to you with requests, by email at first and later through your website's order form. Each customer picks a host by its size, its scores and hidden factors. Your job is choosing which requests to accept and at what price.

**Where requests come from.** Every request arrives as an email in the Support app, and answering one takes a few minutes of your time like a ticket. There are few of them early on, and more as the company grows. A lead who wants a standard product (a basic SLA and no big budget) writes an **order email** that names the resources it wants, and you work it in steps (see Custom orders); you may also decline it, and an order left unanswered past its due time goes to a competitor. Everyone else, and every expansion, writes a **sales request** that you answer with a quote. Once you own the website's **order form** in Marketing, three in four standard orders skip the inbox: the form charges the order's resources at your rates (see Per-resource pricing) and sets the service up at once. The other quarter still write an order email, and an order the form cannot place, for lack of a location, product or room, arrives as an email too. Later the **shop** unlocks: customers order there themselves, and it accepts every request it can serve as long as the target cluster stays below a limit you set.

**The company website.** Every company starts with a basic one-page website at its own domain, shown in the Browser at www.<company domain>: the company's name and logo, a short pitch, the contact address sales@ the domain and the product lines on offer. The player switches each line on or off on the site's Admin page, which the Admin button on the site opens. The company name and a tagline of up to 60 characters (shown under the name on the site, empty by default) are set there too. A line can only be switched on while some installed control plane sells it, and the switch says what is missing otherwise; switching a line off is always allowed. Every new customer comes through the website: organic leads, referrals, forum posts, campaigns, fairs, the first order email and the shady VPS request are all people who looked at it, and a lead whose product is not listed leaves without writing. The lead flows themselves do not change, so Marketing's numbers count everyone who looks, and the listed lines decide who writes. Existing customers keep their services, renewals and upgrades when their line comes off the website. At the start the site is a small business page: each listed line shows its name and a one-sentence description, and the page ends in one call to action, "Contact us", with the sales address. Once the order form is owned, each line also shows "from €X a month" ("a year" for domains and SSL), the price of its smallest size this year at your rates, and the call to action goes away when email orders are switched off. The site looks home-made in the style of 2005 until the Web design channel is bought in Marketing, which redesigns it in the company colour. A new game lists nothing, and the first step of Getting started that follows the domain is to put a product on the website. Saves from before the website list every line they could sell when loaded. The site needs a host. A new company rents one from "Strateaux" at €9.90 a month, billed with the web design upkeep once the web design is bought; a rented host is always up. The player can instead move the site onto any web hosting panel host of their own (a bare-metal panel server or a panel VM), instantly and for free, if the host has room for a small web space. The site is then only as reliable as that host: it is down while the host is off, failed, frozen, offline for patching or compromised, and slow while the host performs below full speed (overload, a PHP upgrade) or has over 90% of its RAM booked. A down site brings no website leads and no order form orders and builds no awareness, a slow site brings half of them, and the first hour of every outage of an own host sends one notification. The web design ages: it belongs to a design generation (2005, 2009, 2013, 2017, 2021, 2025, one every four years) and is fine one generation behind, then costs the website leads and order form orders 20% for each further generation, down to 40% of them. A redesign costs the web design price again and brings the design to the current generation; it is not available while the design is current. The Browser shows the site in the look of its generation (a table layout with a visitor counter in 2005, glossy buttons in 2009, a flat hero in 2013, cards and a large header in 2017, a minimal page that follows the theme in 2021, and the same with a chat bubble that answers nothing in 2025), its design year with the Redesign button, and a Hosting card with the host, the site state and a segmented control to move the site. Every web hosting customer also has a small site of their own, generated from their name and business, which is up, slow, defaced (their host was compromised) or down with their web space.

| Request | From | Example |
| --- | --- | --- |
| New customer | A lead that chose you | "A VPS with 4 vCPUs and 8 GB for our shop backend" |
| Expansion | An existing customer that grew | "Our news site needs twice the RAM" |
| Quota increase | A cloud customer | "Raise our quota to 64 vCPUs for the Black Friday sale" |

**The request card.** Every request shows:

- the customer's name and type, for example "Bloomfield Florist, sole proprietor";
- what they want, with resources, location and contract length;
- the SLA they ask for (uptime and response time);
- the monthly revenue, or the expected revenue for hourly cloud usage;
- their requirements with a check or a cross each;
- a bar per resource of the target cluster (CPU, RAM, storage, bandwidth) showing usage before and after. A bar is green below 70%, orange from 70% and red from 90%.

You accept or decline. A declined customer goes to a competitor. Requests you can't serve still arrive, greyed out with what's missing ("needs a location in London", "needs two carriers"), so you can see what demand you are leaving on the table. The Market app adds them up.

**Growth.** Every customer has a growth path with a ceiling. A blog stays about the same size forever, a news site grows to a few times its start, and a startup can grow fifty-fold or shut down. When a customer nears the size they rent, an expansion request follows.

**Cloud servers.** Cloud customers rent virtual machines by the hour and start and stop them as they like. Each cloud customer has a quota (vCPUs, RAM, storage), and their usage moves up and down within it. Raising the quota takes a request with a reason, which you approve, cut down or decline. Quotas can add up to more than the cluster holds, because customers rarely use all of it at once; if they do, their new machines fail to start and they get unhappy.

**Quoting a price.** Every request comes with a market reference: what this kind of customer expects to pay for this service in that year, adjusted for its SLA and features. When you answer, you quote your own monthly price, and the market reference stays next to the field so you can go slightly above or below it. The customer replies by email. Close to the reference, most accept. Well above it, they write that they don't have the budget and will look for another provider, and the deal is lost. A customer who says they can't make it is usually gone, though a lower counter-offer sometimes wins them back. Existing customers accept more for the same service, because switching is a hassle for them. Orders through the order form are charged at your rates per resource, which the Products app shows against the market's rates (see Per-resource pricing).

**Changing prices.** You can raise the price of a running service. Customers judge a raise by its percentage, so a small step costs little at once while a big jump costs a lot. Every customer also has a maximum they will pay, which the player never sees. While a service costs more than the market, happiness wears down every month, and past the maximum it drops fast enough that the customer leaves within a few months. After a noticeable raise, or while a raised price stays high, customers may write a billing ticket saying the new price is too expensive; you can explain the price, give a credit or revert it. A retention offer only works on a customer who is still reasonably happy and whose price, less the free month, is within their maximum. Anyone else refuses and leaves.

**Agencies first.** Agencies host many small websites for their clients and grow with them. Winning an agency with a very good web hosting offer pays off later, when its clients need VPS and more. Marketing can target agencies directly, and a discount offered in a campaign is quoted back to you when the agency writes in.

**Billing.** Services are billed for every hour they run and invoiced once a month for the month that just ended. Hours a service is down are not billed, so an outage costs you its revenue. Business and Premium SLAs pay credits on top. Usage such as traffic over the included amount, object storage and CDN traffic is billed per TB on the same invoice. Domains and SSL certificates are the exception: they are paid a year in advance and renewed each year, and a customer who doesn't renew is gone.

**Commitment.** Each contract has a minimum term: none for cloud servers, one month for hosting and VPS, twelve months for dedicated servers and colocation. Customers only leave when their term runs out, unless a missed SLA lets them leave early.

**Features.** Each product line has features you switch on in its settings once the unlocks and the infrastructure allow them. Customers require some features and want others: a request whose required features are missing arrives greyed out, and every wanted feature you offer makes customers likelier to pick you and adds to the price.

| Feature | Needs |
| --- | --- |
| High availability | An HA cluster |
| Replicas | 2 or 3 replicas in the cluster settings |
| Spread across racks | Nodes in at least two racks |
| Spread across locations | The cluster stretched over two locations |
| Backups | A backup cluster or storage servers |
| DDoS protection | On-demand or always-on protection on the location |
| Private network | The private networks unlock |
| Two carriers | Uplinks from two carriers at the location |

| Customer | Requires | Wants |
| --- | --- | --- |
| Private individual |  | Backups |
| Gamer, small game server |  | DDoS protection |
| Gamer, game server of 8 GB or more | DDoS protection | A location in their country |
| Hobby developer |  | Private network |
| Sole proprietor |  | Backups |
| Small business | Backups | High availability |
| Agency or startup |  | Private network, replicas |
| Doctor's or law office | Backups, high availability | A location in their country |
| Online shop | High availability, backups | DDoS protection, replicas |
| Enterprise | High availability, replicas, spread across racks, private network | Two carriers, spread across locations, DDoS protection |

## Customers and market

Customers come from nine profiles on a 3×3 grid of budget and technical skill. Each profile weighs three scores on every host, and its budget sets how much it offers to pay. This borrows King of Retail's model, where every product has quality, fashion and luxury scores and customers sit on a wealth × fashion grid ([customer wiki](https://king-of-retail.fandom.com/wiki/Customers)).

**The three scores**

| Score | Raised by | Matters most to |
| --- | --- | --- |
| Performance | Hardware, resources, network capacity, latency | High technical skill |
| Reliability | HA clusters, uptime record, SLA, support response time | High budget |
| Convenience | Control panel, add-ons, one provider for everything | Low technical skill |

Low-budget customers offer the least and ask for the lowest SLA.

**The nine profiles**

| Budget \\ Skill | Low skill | Medium skill | High skill |
| --- | --- | --- | --- |
| Low budget | Private individual: a blog, family photos | Gamer: game server and a small site | Hobby developer: the cheapest VPS |
| Medium budget | Sole proprietor: a flower shop's website | Small business: site, email, domains | Agency or startup: VPS, many sites |
| High budget | Doctor's or law office: managed, must not fail | Online shop: HA hosting, SSL, backups | Enterprise: dedicated, cloud, colocation |

**Hidden profiles.** Behind each profile the game keeps: products wanted and how likely they are bought together, budget, request size, outage tolerance, ticket habits, and requirements on the host (see Company level and reputation).

| Profile | Usually buys together |
| --- | --- |
| Gamer | Game server, small website, domain; never enterprise support |
| Sole proprietor | Web hosting, domain, email |
| Online shop | Web hosting, SSL, backups, DDoS protection |
| Enterprise | Dedicated or cloud servers, SSL (with every domain), priority support |

**Cross-selling.** Unlockable boosts raise those odds, such as a free SSL certificate with every domain or a game server and website bundle. Each gives customers a bonus and you more sales per customer.

**Market research.** Requirements start hidden. The Market Research app reveals, per profile, budget ranges, which scores they weigh, and what they demand from a host. It also shows demand by product and city, and reports on lost sales, for example "chose another host: no domains on offer".

**Competitors.** A few big, established hosts with parody names dominate the market, such as a Hetzner stand-in, an IONOS stand-in and an OVH stand-in, alongside specialists: game server hosts, VPS-only budget hosts and managed WordPress hosts. Each has its own product line with prices, and each targets different segments, so a cheap VPS host competes for hobbyists and a game server host for gamers. They run passively in the background: the game doesn't simulate their customers one by one, only their offers and their share of each segment. They are a fixed backdrop and don't react to you, but the market is crowded and hard-fought. A customer first drops hosts that miss its requirements, then compares the remaining hosts on the three scores.

**In the game.** The competitors are Ionose, OVHeat, Hetzna and Rackspice, plus the specialists Nitradoh for game servers and WP Engyne for managed WordPress. Requests arrive in Support as emails: a card with the need, the requirements with a check or a cross, the target cluster's resource bars, the customer's thread and a price field with the market reference beside it. Requests you cannot serve stay in a Cannot serve box, and every request that got away is listed under Lost sales with its reason. The card does not name the customer's profile. The Customers app changes the price of a running service next to its market reference. Numbers are in economy.md, Sales and quotes.

**Market app.** The Market research skill opens the Market app with four sections. Demand shows, per city, the buyers a month for each product, the requests that reach you and how the rest split over the named competitors. Profiles lists the nine profiles with their share of buyers; each stays locked until you buy a market study by Gartnah for it, which reveals the budget range, the size and SLA they ask for, the weights of the three scores, their price sensitivity, the products they buy and what they demand from a host. Lost sales groups the reasons of the last 3, 6 or 12 months and counts them. Competitors shows each competitor's scores, price position, product line and the profiles it sells to. Study prices are in economy.md, Market research.

**Undercutting and awareness.** You can price just below a competitor's offer to win more of its segment, but customers don't switch overnight. How many people know your company limits how many consider you at all, and that awareness grows slowly through marketing, reviews and word of mouth. A price cut brings a gradual trickle of customers over months, not an instant wave, and a well-known competitor keeps most of its customers even when you are cheaper.

**Domains.** Every web hosting customer comes with a domain, made once when the order or request arrives and kept on the service for good. The service is listed under that domain everywhere: order emails and requests, ticket subjects and texts, notices, the customer page (whose contact address uses it) and the product and machine lists. The rules:

- The country of the customer's city sets the top-level domain: Frankfurt, Berlin, Düsseldorf, Munich, Nuremberg and Falkenstein .de, Vienna .at, Zurich .ch, London .co.uk, Paris .fr, Amsterdam and Kerkrade .nl, Milan .it, and the American cities .com. Its language sets the words. Customers in American cities also have American names and companies (Inc instead of AG).
- A private customer uses their name (katrin-maurer.de, motto.fr), a hobby developer their name with a developer touch (frankcodes.fr, haas-dev.it), and a gamer a handle (frostottoplays.co.uk).
- A sole proprietor or office puts the trade before the surname (baeckerei-weber.de, zahnarzt-lorenz.ch, solicitors-pohl.co.uk); a small business puts the surname first (roth-logistica.it). An agency uses its brand (pixelwerk.fr), a shop its shop name, an enterprise its name with a group word (kaiser-group.co.uk).
- Names are lowercase ASCII, umlauts written out (ä is ae, ß is ss) and accents dropped. A domain is unique in the game: the next wording is tried, then a number is appended.
- The seed picks the wording, so a seed always gives the same domains. Saves from before domains get them on load, and the service takes the domain as its name.

The company's own domain comes from its name and the country of its first location (basement-hosting.de); replies use it for the mail server, the name servers, the control panel and the signature.

**Custom orders.** Every order email asks for its own resources: web hosting names its disk space, monthly traffic, mailboxes and its domain (one the customer wants registered, or one they own already, about one in three); a VPS or game server names its vCPUs, RAM and disk. Each order starts from the size its profile's budget picks, and web hosting, VPS and game server orders scale it by a factor from a half to one and a half, so no two read alike; its reference price follows the resources (see Per-resource pricing). The order ticket is worked in steps, each a button in Support and a line in the customer's work log; the customer gets three emails in all, the quote, the confirmation and the notice that the service is live. The first step is the quote; the account, the confirmation, the domain and the setup open only after the customer accepts it:

1. **Quote** takes the monthly price (it starts at the market reference, which is shown beside it) and a setup fee (it starts at the line's rate) and sends them to the customer. The ticket then waits on the customer, who answers within their reply time the way a sales lead does: they take it, counter once with a price of their own, or turn it down by their budget. A counter or a refusal puts the ticket back in the inbox for another quote. A customer who turns the quote down for good closes the ticket, and no account was ever made.
2. **Create customer account** makes the customer record, with no service yet, and sends no email.
3. **Confirm order** sends the confirmation with the first invoice at the accepted price: the setup fee, the first month, plus the domain fee for a new domain or the transfer fee for an owned one. The ticket then waits on the customer, who pays by their usual habit (on time, late or never), and the invoice status shows on the ticket.
4. **Register domain** or **Transfer domain**, for web hosting, books the registry's yearly cost; the registry answers two minutes later, and the live email tells the customer.
5. **Set up** sets the service up with its custom resources and mails the customer that it is live, with the domain registered or transferred, the panel address and user name for a site or the root login for a server. You pick the host: the step lists every cluster or panel host in the order's city that sells the product, as cards with the RAM and disk booked on it against what it holds, and a Select button on each. RAM and CPU never refuse a booking; a host without the disk, without software that sells the product or with its control plane down is refused. Automatic, where the game picks the first host with room, is not offered until the company learns Provisioning automation (see Research and unlocks).

Orders through the order form skip the quote: the website's prices are the quote and ordering is the acceptance. They wait in the inbox like an email order and need the account, the confirmation, the domain and the setup by hand, with the website's price on the invoice. With Provisioning automation learned, Settings has a Place orders automatically switch. With it on, an order form order is invoiced and placed the moment it arrives, and an email order runs the account, confirmation, domain and an Automatic setup in one go the moment the customer accepts the quote. A step that cannot run, such as a setup with no room, leaves the order there for you. The quote stays yours to send.

You may set up before the money is in and risk never being paid, or wait. Once paid, an order without its service goes back to the inbox and is due within the customer's reply time on their clock; waiting longer costs happiness like any late answer. A paid order with its service is done. An order that is never paid goes through dunning as usual: collections closes the account and ends the service. Declining a confirmed order, or letting one lapse before it is confirmed, closes the account and writes off its invoice. An accepted quote that is not worked within three days lapses. The first invoice prepays the service's first 730 hours, so the monthly bill starts after them. Support staff trained on orders work the steps after the quote in order, set the order up on the first host with room, and leave the setup until the invoice is paid; the quote stays with the player.

**Per-resource pricing.** Every order, sales request, upgrade, service and lost sale is a spec: the resources the customer asks for. Web hosting asks for disk, traffic and mailboxes; a VPS, game server or cloud server for vCPUs, RAM, disk and traffic; a dedicated server for the smallest server RAM it accepts; colocation for rack units and watts; storage for gigabytes; DNS for zones and VPN for users, both with traffic; and a domain or SSL for one service. Requests, emails, Sales rows, tickets, the customer's service cards and events all write a spec the same way, for example "VPS, 2 vCPU, 4 GB, 80 GB", "Web hosting, 2 GB, 3 mailboxes" or "DNS hosting, 12 zones". Each line charges a base fee per service plus a price per unit, traffic per 100 GB included, and the market's rates per unit set every market reference (numbers in economy.md, Per-resource pricing).

The Products app's Pricing view has one card per line with your rate for each unit in euros. An empty rate charges the market rate, which is shown beside it, and Market rates resets the whole line. The card shows the line's from-price, its smallest size this year, at your rates and at the market's. Your rates apply to new sales through the order form: it charges the order's spec at your rates times the SLA factor, less any campaign discount, and, with Provisioning automation switched on, places the order at once without asking the customer; without it the order waits in Support for its steps. Overpricing costs you through customer choice, where your price index brings fewer leads, and through price tolerance and churn. Services already sold keep the price they were sold at; to raise a running service you change its price in the Customers app, which goes through the usual price tolerance, complaints and retention. Email orders are quoted by hand, starting from the market reference.

Traffic is cheap on purpose: hosts in 2005 bundled it, so it is a few percent of a typical bill, more on game servers and colocation, and its rate falls as traffic grows. The market's traffic rate takes its share out of the line's other rates, so an average customer pays what they paid before traffic was priced.

**Setup fees.** Each line on the order form has a one-time setup fee in Pricing, next to its rates, with the market's fee beside it; empty charges the market's. When an order arrives through the form and is placed, the customer gets an invoice at once with the setup fee and the full first month, and the monthly run starts billing the service after that prepaid month. A fee above the market's makes the form a little less attractive to leads, and one below a little more, through the same price weighing as the rates. An email order carries a setup fee on its confirmation invoice too: the quote step has a Setup fee field next to the monthly price, prefilled with the line's fee, and the invoice lists it before the first month.

Saves from before per-resource pricing give every service, request and lost sale that named a plan that plan's size as its spec in the year it started, and start with every rate at the market's. DNS and VPN services from before zones and users get the count their price buys at the market's rates, and setup fees start at the market's.

**Email orders.** With the order form owned, the Admin page has a Contact by email switch, on by default and in older saves. Turning it off removes the contact call to action from the website, and orders by email stop: every order lead uses the order form, and an order the form cannot place (no room, or the product is not sold in that city) goes elsewhere and is a lost sale. Sales requests from business customers, upgrades and the shady VPS request still arrive by email. It is a real trade: it saves the step work of a quarter of the order leads and costs the orders the form cannot place.

**Company email.** A new company starts on a free Notmail box, which needs no domain and delivers like any other service; its address is the company name at notmail.com, and the website shows it as the sales address. Moving to mail under the own domain is optional and needs the domain first. Businesses trust a freemail sales address less: while the company is on Notmail, only half of the email orders from sole traders, small businesses, agencies, offices, online shops and enterprises arrive, while private users, gamers and developers write as usual. Orders through the order form are unaffected. The Email app opens straight to the inbox; its Settings button and the Change provider item in its app menu open the email settings, which show the service, status and address. The upgrade offers two ways. External providers charge per seat and month; seats are the owner plus every employee, recomputed at each month start: Hosted Exchange by Ionose from 2005 (EUR 10 a seat, falling to 6 by 2015), Goggle Workspace from 2007 and Lookout 365 from 2011. External mail is always up and its address is never listed. Self-hosted mail is software on a server or in a VM, installed like a panel with Add Software: Postfixit from 2005 and Mailpig from 2015, free, one mail server per company. The self-hosted view of the Email app lists them with an Open button to Locations, where the server's Add Software tile installs one. A mail server needs a public address, so on a dynamic home line its address is always listed and only a business line makes it work from the basement. While the mail host is down or its address is listed, delivery is impaired: half of the order emails arrive and invoices sent in that window are paid 3 days later; Settings, Email shows "Mail delivery impaired" as its Status. Cancelling a provider or uninstalling the mail server returns the company to Notmail. Support tickets arrive in the Support app regardless.

**Upgrades.** A service's upgrade request asks what upgrading would cost and names the resources it needs, from the current to the requested amount (one and a half to two times each). The request shows both and the price difference a month; you set the new monthly price and accept it in one step, which the customer takes, counters (accept again at or below the counter) or refuses. Taken, the service grows in place when its server has room and is otherwise placed again on the target you pick.

**Domain registration.** Each TLD has its registry: DENIQ for .de, nick.at for .at, SWISCH for .ch, Nominot for .co.uk, AFNIQUE for .fr, SIDNey for .nl and Registrato.it for .it. A domain is registered or transferred for a year at the registry's cost of that year; you renew it by hand in **Billing, Domains**, which lists every domain with its customer, registry, expiry and yearly cost, and the customer page lists the customer's own. Renewing pays the registry and invoices the customer the yearly fee. A month before expiry a notification reminds you; a domain left to expire takes its site offline, and the customer complains like about any outage until you renew it. Domains of customers who left are not renewed.

**Registrar partners.** The company resells domains through one registrar partner at a time, signed in **Network, Domains**: NameCheep (no signup, no fee, one rate for every size), GoDuddy Reseller (a monthly fee, rates falling with size), InterNetY (a signup fee and a monthly minimum of which the unused part is lost; .de at the registry's own cost in every tier) and OpenSRSly (a signup fee, rates falling with size). The partner's wholesale for a domain is the registry's cost of the year times the partner's factor for the current tier, plus the ICANN fee on a .com. The tier follows the number of domains under management (the company's and the customers'), checked at every month start: 0, 100, 500 and 5,000 domains. Billing is monthly: at a month start the partner invoices the signup once, the fee (or the part of the minimum the domains did not use) and one twelfth of the yearly wholesale of every domain under management. Registering or renewing a domain no longer books the registry cost; the customer still pays the yearly fee. Switching partners transfers every domain, a hand task of 5 minutes per domain that the player does in Domains or hands to a technician trained on panels; nothing is down during the transfer, and the new partner's signup comes with the next month start.

**The company domain.** Going online needs a domain of the company's own. Once a contract is signed, the player registers a name in Network, Domains (3 to 40 letters, digits or hyphens in front of a TLD the registries sell, not a customer's); it joins the domains under management, renews with the contract, and is the domain of the website, the sales address and the mail server. Switching a line on in Admin and setting up the web design are refused until it exists. Until then the texts that need a domain use the name the company name suggests. Saves from before registrars load with that suggested name registered at NameCheep.

**Hostnames.** Every server has a hostname, `node` and a three-digit number in purchase order (`node001`), and every VM of your own has `vm` and the next number (`vm001`). Every customer service except domains and SSL certificates has a hostname made of a product prefix (web, vps, game, dns, vpn, dedi, store, cloud, colo) and an eight-digit number. The first number lies between 10,000,000 and 19,999,999 for each game and each new service adds 1 to 97, so the numbers look like a real provider's. A customer's workload carries its service's hostname. The full name is the hostname under the company domain, for example `vps12312312.backbone.de`. Customers quote it in tickets ("vps12312312.backbone.de takes ages to answer tonight") instead of their own name for the service, and replies from support use it too. The hostname shows on the customer page (service rows and cards), in the Virtual machines app (rows and detail) and under the label in the server inspector. A save from before hostnames numbers servers by purchase date and services by start date when it loads.

**Reach and new cities.** Only buyers in cities where you have a location can buy from you, and only a share of each city's new customers ever looks at your offer. That share grows with your level, from about 2% in the basement to about 6% for a Datacenter Baron, so marketing fills your reach in a city and new locations widen it. Once your awareness is up, opening a location in another city is the main way to keep growing; a 1/8 rack share there costs €32 to €140 a month.

## Company level and reputation

Your company climbs a ladder of levels set by its net worth. Business customers only consider a host at a level they trust, so no enterprise moves its systems to a company running out of a garage.

**Net worth** combines three things: customers (recurring revenue), hardware you own, and years in operation.

| Level | Name | Typical setup | Who will buy |
| --- | --- | --- | --- |
| 1 | Basement Hoster | One rack in the basement | Friends, gamers, hobbyists |
| 2 | Garage Hero | A rack position in a datacenter | Private individuals, sole proprietors |
| 3 | Rack Renter | Several racks in datacenters | Small businesses |
| 4 | Cage Fighter | A cage and a small team | Agencies, mid-size companies |
| 5 | Room Service | Own rooms, HA clusters | Mid-size companies, first enterprises |
| 6 | Datacenter Baron | Own datacenter | Enterprises, public sector |

**What customers check.** Each customer profile has hidden requirements about the host itself, not just the product:

- Company level and years in operation
- Number of employees
- Portfolio: many want one provider for everything, such as web hosting and domains together
- Uptime history and review score
- Location, for example German companies preferring German datacenters

Market research reveals these requirements (see Customers and market).

## Support

Support is the first job that overwhelms you. Every outage, question, install request and cancellation arrives as a ticket in the Support app, next to order emails and sales requests. The app is called Email until the company buys a support desk, and the internal app id stays "Support" everywhere (saves, notification types, alerts, Searchlight, focus requests); only the shown name, dock icon and window style change.

**Email.** Without a desk the app is a plain inbox: one list of every open email, newest first, unread in bold, and a ticket view with the reply choices, resolve and the order steps. It has no kind filters, search, assignment, template picker or queue boxes. Its dock icon and window follow the company's mail service: Goggle Workspace shows a four-colour envelope in a white window with coloured labels and a rounded header, Lookout 365 a blue envelope with an O and a dark blue header bar with dense rows, Hosted Exchange by Ionose the Ionose mark in a teal-accented list, and self-hosted mail (Postfixit or Mailpig) a plain envelope called Pear Mail in a light list under a grey header. A company without mail service shows the Pear Mail envelope dimmed. Marks are code-drawn parodies.

**Orders.** An order email is a ticket with its own steps. It starts with the quote: the customer has no account until they accept a price, and a declined quote closes the ticket. After the acceptance the order is worked as account, confirmation with the invoice, domain and setup, and the setup is a pick from the hosts of the order's city with what each has booked. Provisioning automation adds Automatic to that pick and a Settings switch that runs the steps after the quote by themselves. The steps and numbers are in Custom orders (Sales) and in economy.md, Sales and quotes. Staff and the automation pick the host the same way: the first host with disk room, preferring one whose installed RAM covers the booking.

**Support desks.** A desk is a Pear Store item, charged once for the owner and once for every employee on the support desk, billed monthly with the yearly rise. One desk at a time: installing another replaces the first. With a desk the app is called Support, shows the desk's mark and window style, and the desk decides which features exist: the kind filters, a search field, assignment to agents, the reply template picker (without it the player picks from the first three replies), due-in timers on rows, the customer card beside the ticket, and a Reports tab with tickets per kind and per month. The inbox, sales, type and incident boxes belong to every desk. The desks, from their year of release, are OsTickit (free, kind filters, grey tables), Zendusk (all features, dark green sidebar), Freshdusk (everything but the customer card and reports, teal header with cards) and FreeScoot (free, filters, search and assignment, light blue list); prices are in economy.md, Pear One subscriptions. 

**Answering a ticket.** Each ticket offers a few pre-written replies and predefined actions, such as restart the service, issue a credit, escalate to a technician, or process the cancellation. The right choice closes it; a wrong one brings a follow-up. Each customer expects an answer within a set time, which depends on their segment and profile (priority support shortens it).

| Ticket type | Triggered by | Typical actions |
| --- | --- | --- |
| Outage report | A service the customer uses goes down | Status reply, credit, escalate |
| How-to question | New customers; cheap control panels | Template answer |
| Billing question | Invoices and payment reminders | Explain, resend invoice, grant an extension |
| Suspension appeal | A high-budget customer's services are suspended | Unsuspend with a payment extension, keep suspended |
| Expansion request | Customer nears the size they rent | Opens the sales request |
| Cancellation | Unhappy or departing customer | Retention offer, process the cancellation |
| Colocation install | Colocation customer ships hardware | Book an install with a technician |
| Abuse report | Spam or attacks from a customer's server | Warn, suspend |
| Copyright notice | A rights holder reports a URL on a customer's domain | Forward to the customer, take the content down, reject |
| Legal request | A government agency asks for data or a takedown | Comply, object, ignore at your peril |
| Refund request | An outage or a data loss hit the customer | Refund one month, credit 10%, refuse |
| Migration offer | The player offers a customer a move | None; the customer answers |

**Planned maintenance.** "Plan maintenance" on a server (right-click and inspector), a cluster or a location takes a start, offered as tonight, tomorrow night or the next weekend night at 01:00, and a length of 2, 4 or 8 hours. The sheet lists the affected services and customers and what each will answer. Planning sends every affected customer a Maintenance notice at once. Online shops that have the window on a weekday between 08:00 and 20:00 write back asking to move it, and gamers write back declining a Friday or Saturday night; the player can move the window at no cost (every customer gets a new notice) or close the ticket. Customers who accepted are covered: for those told at least 24 hours ahead an outage inside the window costs nothing, and a later announcement halves the penalties (economy.md, Happiness and churn). Windows show on the server inspector, the cluster and the location page with their start, length and customers, and can be moved or cancelled until they start. Starting and ending a window raises a notification.

**Migration offers.** "Offer migration" on a service (the customer page, or the web spaces and VMs of a host) picks a target from the hosts the service can move to and sends the customer a Migration ticket. The player has no reply or action on it; the customer answers once their reply time is up. Below happiness 40 they decline and the ticket resolves. Otherwise they accept and name a window by their segment: players the first 02:00 to 06:00 after the answer, businesses the next weekday from 18:00 to 22:00, private customers any time. The move then runs at the start of the window as the normal move with its downtime (economy.md, Workloads and migration), resolves the ticket and gives +5 happiness when it leaves the basement for a datacenter. A move that has not run within 48 hours of the window costs 10 happiness and reopens the ticket, which the player can close. "Announce migration" on a host offers every service on it the same target in one step. Closing the ticket withdraws the offer.

**Unanswered tickets.** A customer whose ticket gets no answer long past its due time gives up and closes it themselves, marked Ignored. They have already lost happiness for every hour of waiting, and closing stops that loss; the limits per ticket type are in [economy.md](economy.md#tickets-and-work-rates). Cancellations are processed at the next billing date instead, and notices, legal requests and orders are not the customer's to close.

**Abuse and copyright notices.** Rights holders and complainers write in about URLs on your customers' domains. Studios such as Warner Bras. or Universal Pickchers send copyright notices, and a YouTuber demands you remove a site that called their video bad and links it. Some notices are real, some are fake, and some point to domains you don't even host. Each one names the URL, so you can check it against your customers before acting. Taking down content on a fake notice angers the customer; ignoring a real one invites the next, angrier letter.

A notice comes from its sender, not the customer, and shows the sender's address and the URL. Real notices come from the sender's own domain, fake ones from a free mail address, and the YouTuber is always fake. The notice offers three actions:

- **Forward to the customer** settles a real notice, and the customer removes the content. A shady customer leaves it up, so the next notice follows anyway. Forwarding a fake one mildly annoys the customer.
- **Take content down** takes the named service offline for 48 hours and settles the notice. On a fake notice it angers the customer.
- **Reject** is the right answer to a fake notice, and the only one for a domain no customer uses. Rejecting a real notice counts as ignoring it.

Ignoring a notice (rejecting a real one, closing it, or leaving it open for 7 days) brings a second, angrier notice from the same sender 3 to 7 days later, and ignoring that one brings a legal request.

**Legal requests.** Government agencies send requests through the inbox with a verified mark next to the sender, and each has a deadline. Answer in time and the matter closes. Miss the deadline and the agency seizes the physical server, with every disk in it. Customers on that server lose their data unless you have a backup on another system, and the server comes back after 3 months to 2 years. Agencies mostly come after malicious customers, so who you accept matters.

A legal request shows a verified mark next to the agency's name and a countdown to its deadline, 5 to 14 days. Comply hands over what the agency asks for and costs the customer's goodwill; object keeps the customer happy, but a quarter of objections (half for shady customers) come back as a court order with a 3-day deadline. Closing a request does not answer it. When the deadline passes, the agency takes the server that runs the target customer's service: it leaves its rack, its cables and its cluster. Each workload on it restarts on another node of its cluster if one has room, from a backup if there is one and empty otherwise. Without a backup the customer's data is gone and they ask for a refund; with one they lose an outage's worth of goodwill. The server returns to storage at its location 3 months to 2 years later.

**Incidents.** The Support sidebar lists every incident under Reports: grid outages, generator failures and seizures, each with its start, how long it lasted, how much of it reached the servers, the devices and the customers it hit. Customers hit by an outage of an hour or more may ask for a refund, and some write a review.

**Shady customers.** Now and then a sales request sounds off: high volume, no questions asked, and payment in crypto. You can accept it. The crypto arrives as ordinary money in your bank account, the customer pays well and on time, and abuse reports and legal requests follow.

**Business time.** Customers expect answers and uptime on their own clock. Most keep business hours (Monday to Friday, 9:00 to 17:00, when staff work too): a ticket written Friday afternoon with a reply time of one business day is due Monday afternoon, and nights and weekends do not count against you. An outage hurts only once the customer notices it, and that depends on who is looking at that hour (economy.md, Noticing outages). A private customer may take a few days or three weeks, a few notice within hours; gamers notice at once in the evening and on weekends but nobody plays at 4:00 on a Tuesday, so night maintenance on game servers goes unseen; offices notice at once during business hours. An online shop or an enterprise and wants a reply within 4 hours around the clock, which takes AI bots or night staff. The Support inbox shows when each ticket is due ("15:00", "Mon 13:00", "Now"), and the customer card and each sales request show the reply time and how soon outages are noticed. Values per type are in economy.md, Happiness and churn.

**The cascade.** Customer happiness drops while tickets wait, and unhappy customers cancel or don't renew. Cancellations are tickets too, so a bad week snowballs into a flood. An outage creates tickets from every affected customer, weighted by segment: a flower shop writes once, an online shop three times.

**Automating support.** Support agents work through the queue at their own speed. Later, an AI support bot handles simple ticket types such as how-to and billing questions, and passes the rest to humans. A public status page (an unlock) cuts outage tickets.

**Assigning tickets.** The Support ticket header lists the support agents as chips. A ticket assigned to an agent waits for that agent, who answers it before the rest of the queue; the other agents leave it alone. Choosing Nobody hands it back, and a ticket whose agent has left the company counts as unassigned.

**Customer credit and suspension.** The right-click menu of a customer page has Credit, which takes an amount and lowers the customer's next invoice by it (what the invoice is too small to take stays for the one after), and Suspend or Unsuspend, which holds every service of the customer offline. The first suspension costs happiness and brings a ticket, as an invoice suspension does. The two Cancel subscription buttons for bots and Pear Store subscriptions ask for confirmation first.

**Replies.** Everything you or an employee do on a ticket or order goes out as an email in the thread, written in the company's voice for that situation: a template answer, a credit or refund with its amount, a retention offer, a cancellation confirmation, an unsuspension with its payment deadline, a forwarded or rejected notice, an answer to an authority, an accepted order with what was set up, where and when, and a declined order or request with its reason in the customer's terms (the product is not offered in that city, the city is full, or no reason beyond not taking it on). Each email has three wordings, picked by the seed, so the inbox does not repeat itself. Customers may write with dry humour; the company's replies stay professional.

## Billing, finance and insurance

Every contract is invoiced monthly for the hours it ran, domains and certificates yearly, and some customers don't pay. Chasing them is a manual job until bookkeepers and accountants take it over.

**Starting money.** A new game starts with €3,500 of savings, enough for the first server and a little more, so the first loan from the bank pays for the second server. A level-1 company can borrow up to €10,000 from day one.

**Invoices and dunning.** Invoices go out automatically on the first of each month. Some customers pay late and a few never pay. When a dunning step is due, a button appears in the Billing app, and clicking it sends the notice (starting values, to tune):

1. **Payment reminder**, 7 days after the due date. Friendly, no fee.
2. **First dunning notice (Mahnung)**, after 14 days, with a fee.
3. **Final notice**, after 28 days. The customer's service is suspended, which creates tickets.
4. **Collections**, after 42 days. The debt goes to a collection agency for a fraction of its value, and the customer is gone.

Payment habits differ by segment. Private individuals forget most often, and enterprises pay slowly but always pay.

**Bookkeepers and accountants.** Bookkeepers record payments and send reminders. Accountants handle the later dunning steps, collections and month-end reports. Each works at their own rate, so a growing customer base needs a growing team.

**Finance app.** The account statement, and later profit and loss, cash flow, monthly recurring revenue, churn, revenue by product and segment, and costs by category, each as charts.

**Account statement.** The Finance app lists every booking on the company account: date, counterparty, description, category and amount, with the running balance. Filters narrow it by category (customer payments, hardware, rent, power, transit, salaries, loans, tax) and by month.

**Bank app.** The Bank app holds only loans. Your active loans appear as cards with the remaining balance, monthly instalment, instalments left and a Repay button. Below them, offers appear as a grid of cards in the style of the shop: you pick a term (1, 2, 3, 5 or 10 years), and each card shows a preset amount up to your limit, plus one for the whole remaining limit, with its interest rate, monthly instalment, total interest and a Take loan button. The rate and the limit depend on your company level and repayment history, and missed repayments add penalties.

**Insurance.** SLA insurance pays the credits you owe customers when you miss an SLA. It covers three claims; after the third, the insurer blocks you for a year. The premium rises with a poor uptime record.

**Hardware insurance.** Until SLAs exist, hardware insurance is the one policy on sale, from the start of the game. It pays the spare part and the remote hands for a component that fails while the policy runs, but only within the component's life expectancy: normal wear and tear is not covered. Its monthly premium is the expected cost of replacement parts for the covered hardware with a 50% markup. Buying it pays the first month's premium; cancelling ends it at once without a refund.

**Tax.** Corporate tax takes 30% of the previous calendar year's profit on 1 April, and a loss carries forward against later profits. Profit is read from the ledger: loan principal is left out, interest and missed-payment fees count as costs, and hardware counts as a cost in the year it is bought.

**Bankruptcy.** When cash stays below zero for 30 days and the bank lends nothing that would bring it back to zero (loans are blocked, or the remaining loan limit is below the deficit), the company is insolvent and the game ends. A sheet offers a new game or loading an export. A notification warns when cash first drops below zero.

**Finance app views.** The sidebar holds Overview (cash, monthly recurring revenue, last month's profit and runway, with the cash flow chart of the last 12 months), Profit and loss (a year's revenue and cost categories per month with totals, profit before tax, tax and net profit), Cash flow (money in and out per month and the balance at each month's end over 12 or 24 months, as a chart and a table), Tax and insurance (the next tax estimate, the last tax paid and the policies to buy or cancel), and the account statement by month.

**Suspension.** You can suspend a customer's services over an unpaid invoice. A suspended customer usually pays within days, because their site or server is down, but they open a ticket and lose happiness, and some leave instead. Nobody chases an invoice unless you or a rule do it, so a customer who stops paying keeps using the service for free until someone notices. The Billing app shows how much is owed by customers who are still being served.

**Suspension by customer.** Suspension hits customers differently. Low- and medium-budget customers grumble and pay, or leave per their payment habit. High-budget customers (offices, online shops and enterprises) run their business on the services, so going offline costs them twice the happiness and they pay much faster. Often they first write a suspension appeal: they forgot to pay, the manager who signs invoices is on vacation, nobody has access to the payment details, or the money is already on its way. The appeal ticket offers two actions. Unsuspend brings the services back online at once with a 7-day payment extension; most pay within it, and if the extension runs out unpaid, the suspend rule takes the services offline again, this time without a second appeal. Keep suspended leaves them offline and costs more happiness. A reply that says the services return once the payment arrives settles the appeals of customers who are paying anyway.

**Rules and automation.** The Billing sidebar has a Rules entry that holds the billing rules, each set with a switch or a segmented control. Rules say what should happen; bookkeepers and accountants trained on the task carry them out in their work hours, and every action takes time from their day ([Time per action](economy.md#billing-and-payment-habits)). Bookkeepers send reminders, accountants send dunning and final notices, hand debts to collections and suspend services. With nobody on billing, the rules wait and you act by hand. The Rules page names who carries them out. After the Automation research the entry is called Automation and the rules run by themselves, day and night, without staff time. Renaming the entry was chosen over a switch on the Rules page, since nobody would turn automation back off.

- **Send reminders**: the reminder, dunning and final notices go out on schedule.
- **Suspend services after**: Off, 7, 14 or 30 days overdue. Services come back as soon as the invoice is paid.
- **Send to collections after**: Off, 42, 60 or 90 days overdue, once the final notice has gone out. Off by default, so collections stays a manual step until you turn it on.

**Customers as a CRM.** The Customers app is the hub for everything about a customer: a searchable, filterable list, and for each customer a full-page dashboard in the spirit of a hosting control panel's client summary. The list gives way to the dashboard, and a back control returns to it. The header carries the name, status, monthly value, open balance, customer since and happiness; tabs below it hold the Summary (contact, figures, services at a glance, recent invoices and tickets), Services (one card per service with its resources, price, billing, SLA, term and location, and the price change), Invoices, Tickets and Activity. The contact email is drawn on the customer's own domain when one of their services is a domain, otherwise on one named after them. Every item links to the app that handles it (Billing, Support, the virtual machine manager).

## Staff and AI bots

Staff are named people with a skill level, a work rate and a salary. Juniors cost little and grow into experts; seniors are good from day one but cost far more, as on the real job market.

**Employees.** Each employee has a name, role, skill (0–100), work rate, salary and tenure. Work rate rises with skill. Skill grows with tenure, fastest in the first years. The salary is set by skill at hiring, and yearly raises stay small, so a junior who stays is the cheapest expert you can get. Once a year each employee asks for a raise, and refusing makes them more likely to leave and take their skill with them.

**Roles**

| Role | Takes over | Notes |
| --- | --- | --- |
| Support agent | Tickets |  |
| Technician | Repairs, worn-part swaps, software upgrades such as PHP versions and software updates, VM migrations, installs, cabling, colocation installs | Works at one location, one operation per hour; until hired, you are the technician |
| Network engineer | Port setup, routing, transit and peering contracts |  |
| Kubernetes engineer | Managed Kubernetes clusters | Needed to sell managed Kubernetes; each looks after a set number of customer clusters |
| Sales agent | Answering sales requests in the Support app |  |
| Bookkeeper | Recording payments, payment reminders |  |
| Accountant | Dunning, collections, month-end reports |  |
| Marketing manager | Campaigns, review platforms, market research |  |

**Training.** A new employee knows nothing about your processes. Before they handle a ticket type or a task, they are trained on it, which takes time and money, and each skill is trained separately: an agent trained on billing questions still cannot handle abuse reports. Once an employee is fully trained, you can make them a trainer. A trainer does nothing but train others until nobody is left to train, then goes back to their normal work. Once you have staff, they handle the work across all of these areas, including abuse and legal requests.

**Technicians.** A technician works at one location, the basement when hired, and works through that location's queue of operations in office hours, one operation per hour. An operation is one job on one device: replacing a failed or worn part with a spare from the zone's storage, shutting a device down or starting it, draining a cluster node (moving all its VMs off counts as a single operation however many move), or upgrading one node of a cluster to the current PHP version. Operations on the same device run in queue order, and an operation waits while a swap is under way or no spare is in storage. A part that only swaps with the server off costs three operations: the technician shuts the server down, swaps the part and starts it again. A technician's swap takes 15 minutes and bills no remote hands. Technicians train on three kinds of operation like support agents train on ticket types: parts and power, draining servers, and PHP upgrades.

The Locations inspector shows a button next to Replace, Shut down or Power on, and Drain that queues the operation and names the technician and the hour, such as "Lena, 10:00"; a queued operation shows Queued with a Cancel. The cluster's PHP row in the inspector upgrades every node by hand or queues one upgrade per node. Without a technician the player keeps doing everything directly: swaps in the basement are free and immediate, at a datacenter the provider's remote hands do them as before.

**Repair rules.** Technicians follow two rules without the player, set in the Staff app on any technician: Replace failed parts (on by default) queues a swap for each failed part a spare in storage can cover, and Replace worn parts (off by default) does the same for parts past their life, only for parts that swap while the device runs, so the rule never takes customers offline. The rules work at every location with a technician trained on parts and power. A rule to keep a minimum of spares in storage is not built yet.

**On-call duty.** In the Staff app the player puts technicians trained on parts and power into the on-call rotation of their location. Duty rotates weekly through the rotation in the order technicians joined it, with the handover on Monday at 09:00; a single technician in the rotation is always on call. Outside office hours the on-call technician comes in for urgent work only, one thing per call-out hour, in this order: a DDoS attack that saturates the location's links gets blackholed (the third rule, Blackhole attacks, on by default), then urgent operations from the location's queue run (a swap of a failed part, which the failed-parts rule queues, and starting a device again, since a device left off is an outage), then up to two open abuse reports get the right reply. Abuse reports come by email and belong to no location, so the first on-call technician without other work answers them. Worn parts, draining, PHP upgrades and shutdowns wait for office hours. A technician called out needs 11 hours of rest after the last call-out hour and starts late the next day, so a rotation of several technicians keeps the office hours covered. The Locations inspector names the on-call technician when an urgent job would go to them, such as "Leon (on call), Sat 02:00". The pay follows the German public-sector model and is paid with the monthly payroll as two lines per technician: an allowance per on-call day and the call-out hours. Numbers are in economy.md, On-call duty.

**PHP versions.** Every cluster node runs a PHP version from a dated catalogue, 4.4 in 2005 and then each release from 5.1 to 8.5 from the year after it came out. A new node gets the current version; a cluster's sites run on its oldest node's version. Old PHP raises how-to tickets a little, a version three or more releases behind is unsupported and brings more abuse reports from hacked sites, and from three releases behind some web hosting requests in Sales need a newer version and go to another host. Upgrading a node slows its sites for an hour. Numbers are in economy.md, PHP versions.

**Security.** A few times in the game's history PHP has a serious vulnerability (economy.md, Security advisories). It only reaches a player who runs web sites on an affected version, and it unfolds over two and a half game days: news outlets and the PHP project announce it with a patch date, someone on Twister posts a proof of concept, the Bundesamt für Sicherheit in der Informationstechnick warns to take affected systems offline, and the patch comes out on the announced date. Each stage pauses the game and opens a sheet like the first-time setup, with a button to the Security app. The Security app lists the affected nodes with their cluster, PHP version, sites, and whether they are online, offline, patched or compromised, with Take offline, Bring online, Patch and Clean up. From the proof of concept on, every unpatched node with its sites online can be compromised, more often after the agency warning: its sites are defaced and down, its customers get a data leak notice, send abuse reports and write bad reviews, and the node stays down until the player cleans it up from backups or rebuilds it. Offline sites count as outages, so the player weighs hours of planned downtime against the chance of a breach. Patching is the PHP upgrade, by hand or queued for a technician, and only works once the patch is out. A compromised host also sends spam: every day it stays compromised its mail address collects spam like any other source and loses reputation until it is listed, and its web sites run slower at 70% performance, so mail customers there write in about bounces until the player cleans the host up. **Customer applications.** Every web hosting service runs an app: WordPass, Joomlah, Drupel or plain HTML, drawn from the market shares of its start year. Each app has vulnerabilities of its own every year, like the company's software, and each site records which release it runs and when it was last updated. After a patch comes out, most customers update by themselves within a week, the more likely the more skilled they are, and WordPass sites do so far more often from 2013, when it began to install minor updates itself. The rest stay open, and an open site can be defaced: only that site changes, its customer writes in, and it sends spam from the host's mail address until it is cleaned up. A medium or high skill customer sometimes cleans it up within three days; otherwise the player does it from Monitoring or from the ticket in half an hour. A customer whose site is defaced three times in a year cancels. The Monitoring tab lists the customers' apps next to the company's own software, with chips for Own software and Customer sites. Notify customers writes to everyone running an app with a given vulnerability, at half an hour per ten customers; about half of those who would not update by themselves answer with a ticket asking for help. The player answers with a one-off update, managed updates, or does it for free. Most customers who asked buy the one-off, some take managed updates at a monthly fee that raises their price, and some refuse; customers with a basic budget never take managed updates. Doing it for free takes 20 minutes and makes the customer happier. A managed site is updated within a day of every patch without further work.

**Software versions and vulnerabilities.** Every installed software has a version, the year of the release it runs, and a new install runs this year's release. Every software family ships a release each year, and each release has a few vulnerabilities of its own: hosting panels, hypervisors and mail servers (economy.md, Security advisories, Generated vulnerabilities). A vulnerability is open from the day its patch comes out until the software is updated. A low or high one raises a banner when monitoring is installed, and a critical one stops the game with a sheet that opens the Security app. Open vulnerabilities cost nothing until an attacker finds them: each day every software that has customers on it risks a compromise, and the risk grows the longer a vulnerability stays open. A compromised panel host or hypervisor behaves like a compromised node from an advisory: its sites or virtual machines are down until clean-up, its customers get a data leak notice, send abuse reports and write bad reviews, and the host sends spam. A compromised mail host sends spam until it is cleaned up.

**Monitoring tab.** Nagiosaurus is a Pear Store app that needs the Monitoring skill. Owning it adds a Monitoring tab to the Security app that lists every installed software with its version, its worst open vulnerability, the days it has been exposed, the server it runs on and whether it is compromised, the most exposed first.

**Updating software.** Update on the software tile, in its right-click menu and in the Monitoring tab installs this year's release and closes every vulnerability patched so far. The customers on the software are down for a short time while it updates (economy.md, Security advisories, Updating software). The update can be queued for a technician at the server: panel and mail updates are panel work, hypervisor updates are server work. The technician rule Update vulnerable software, set in the Staff app next to the repair rules and off by default, queues an update for every software with an open high or critical vulnerability.

**Breaches and ransom.** A critical vulnerability left open on the player's own software for more than a month can end in a breach instead of a plain compromise (economy.md, Security advisories, Breaches and ransom). The attackers steal the customer data on the host and an extortion ticket arrives from them, as an alert that opens the ticket in Support. It names the sum and says the data is for sale online. Pay ransom books the money; one time in ten the data is sold anyway. Refuse, Ignore, and a missed 72-hour deadline all sell it. A sale costs every customer on the host 40 happiness, makes 30% of them cancel and 20% write a 1-star review, lowers awareness in every profile by 20%, brings a press banner and, after 30 days, perhaps a data protection fine (a small chance before 25 May 2018, a coin flip under the GDPR). The Security app keeps a Breaches card with the date, host, ransom, decision and outcome of every case.

**Hiring.** The Staff app lists candidates on the job market with their name, role, skill and salary ask, at 8 and at 2 hours a day. Job ads cost money, and better ads bring more candidates. Hiring asks for the hours first and shows the monthly cost at those hours with the runway before and after the hire; the first hire starts at 2 hours a day, the cheapest way in. Letting someone go asks first and shows the monthly saving; they leave the same day and are paid for the days worked that month, with no notice period.

**Working hours.** Each employee works 2, 4, 6 or 8 hours a day, set with a segmented control in the Staff app, from 9 on weekdays. Salary is pro rata to the hours, and the hours are the employee's whole capacity: they work actions in priority order until the day's minutes run out and the rest waits for the next workday. Bots have no hours; they work around the clock at their fixed rate.

**Activity log.** Every action an employee, a bot, the automation or the player takes on a customer's tickets, invoices or services goes into an activity log with who did it and how many minutes it took. A service's log in the Customers app shows its own entries and the customer-wide ones (invoices, suspensions). The log keeps 90 days, at most 3,000 entries.

**Staff app.** The Team view lists each employee with role, skill, salary, assignment and a bar per task type that fills as training finishes. Selecting an employee opens their training plan, where you pick task types as cards, set the assignment (work queue, trainer or forums), answer a raise request or let them go. The Job market view shows candidates as cards grouped by role with a Hire button, and posts standard or premium job ads. The roles in play are support agents, bookkeepers, accountants, marketing managers and technicians. A technician's page also sets their location, lists the operations queued there with a Cancel for each, and holds the repair rules. Bots appear in the Team view after the employees with a Bot badge, their tasks and their subscription price; selecting one shows what it handles and cancels the subscription.

**AI bots.** Bots unlock late through research. They work fast and cost a monthly subscription instead of a salary. They never gain skill, handle only routine task types, and sometimes make mistakes that create follow-up work, such as a wrong ticket answer that angers a customer.

The Automation skill (tier 3, after Employee management and Monitoring) puts two bots in the Pear Store, each its own subscription with the yearly Pear price rise. "ChadGPT Support" answers how-to and billing tickets, and "Clipsy Reminders" sends payment reminders. Clipsy sends every reminder that is due, whatever the billing rules say, and takes what the automation leaves. Bots work around the clock at twice the base work rate and never learn. ChadGPT picks the right reply 60% of the time on how-to tickets and half the time on billing tickets, below any trained human; a wrong reply brings the usual follow-up in the same thread, and ChadGPT tries again. ChadGPT has a small base subscription and bills every reply in tokens, and since each reply rereads the whole thread, a retry costs more than the first answer. After four replies on one ticket it leaves the ticket to staff and the player, and the customer resents the runaround. A solved ticket costs about half of what a support agent costs for one, so ChadGPT saves money without being free: many customers, an outage or a price rise make for a large monthly bill. The Staff app shows the month's replies, tokens, cost and cost per solved ticket, and the bill arrives as one ledger line on the first of the month. During office hours the staff take the queue first and the bots take what is left. A reminder from Clipsy now and then confuses the customer into a billing ticket, and once in a long while a bot does something memorable, such as telling a customer to speed up their website by deleting the disk. The customer then loses happiness and opens an angry billing ticket; the bot never touches data. Only one copy of each bot exists.

## Marketing and reviews

Marketing brings in new customers, and reviews decide how many of them trust you. You can run basic campaigns yourself; review platforms need a marketing manager.

**Your own channels.** Besides paid campaigns, the Marketing app manages the acquisition channels you own and grow step by step. You start with email only: customers find you through friends and write to your inbox, and every order is a conversation. Every company has a basic website from the start (see The company website); next you buy a web design, which makes the site findable and brings in a steady trickle of requests. The website then gets extended with an online order form, so customers can order standard products on their own and the order lands as a ready service instead of an email. The web design and the order form can also be set up from day one (the Marketing app sets up channels), so a first-year company can switch on automatic orders before it learns Marketing campaigns. With a website in place you can run Google ads (search ads below) that send visitors to it, and later AI ads, which target better and cost more. Each step is a one-off setup cost plus upkeep, and the website and order form are also where your prices and reviews show.

**Staff in the community.** Once you have employees, you can assign one to post in hosting and gaming forums. Helpful posts bring in customers slowly and cheaply, and the effect grows with the employee's skill. Bigger companies can send staff to trade fairs and industry meetups. Fairs bring business customers, and the people you meet there get you better transit prices and make networks more willing to peer with you.

Five fairs run every year: "SeeBIT" (CeBIT, until 2018), "CloudFeast" (CloudFest), the "RIPE-ish Meeting" (RIPE Meeting), the "DE-SIX Summit" (DE-CIX Summit) and "Data Centre Whirled" (Data Centre World). Each has a date, a cost, a required company level and an audience. Booking one sends an employee of any role, who does no other work for the fair's days. When the fair ends the attendee brings back leads from the fair's business audiences, which arrive over the following month, plus awareness with those audiences and network contacts. The contacts add the fair's bonus to your goodwill with networks, which lowers transit prices and makes peering requests more likely, and fades month by month. A marketing manager trained on fairs brings back half again as many leads. If the attendee has left the company by then, the stand stays empty and the money is gone.

**Campaigns.** In the Marketing app you pick a channel, the profiles to target and a monthly budget.

| Channel | Reaches | Notes |
| --- | --- | --- |
| Word of mouth | Friends, gamers | Free and slow; the only channel in the basement |
| Search ads ("Goggle Ads") | Anyone searching for hosting | Paid per click; needs a website |
| AI ads | Anyone, with better targeting | Unlocks late; costs more per click and converts better; needs a website |
| Gaming communities | Gamers | Sponsor a streamer or a server list |
| Trade fairs | Businesses, enterprises, carriers | Expensive; needs staff; only pays off at higher company levels; improves transit prices and peering acceptance |
| Forum posts | Hobbyists, gamers, small businesses | Needs an employee assigned; cheap and slow |
| Cold calling | Small shops, local businesses | Cheap to start but converts poorly; the cost per customer depends on who you call. Reaches businesses that never search for hosting |
| Agency outreach | Web agencies | Targets agencies with a discounted offer; they bring their clients' later VPS needs |
| Partner program | Agencies, small businesses | Commission per referred customer |

**Reviews.** Customers leave reviews after tickets, outages and cancellations. By default you can only read them and use the free listing. ProvenExpat and TrustPylon need a marketing manager on staff; when the last one leaves, the company falls back to the free listing at the next month start:

| Platform | Cost | Effect |
| --- | --- | --- |
| Free listing | Free | Collects reviews; small trust boost |
| "ProvenExpat" (ProvenExpert) | Moderate monthly fee | Review invites, a website badge; medium boost |
| "TrustPylon" (Trustpilot) | High monthly fee | Strong marketing tools; the biggest boost |

The review score feeds into your reputation and into the host requirements customers check.

**How the Marketing app works.** Marketing is preinstalled and free. Until the Marketing campaigns skill is learned it shows only Domain, where the company buys its own domain: a registrar picker while no contract exists, a name field with the suggested name and a Buy button that signs the contract and registers the domain together; once bought it shows the domain, registry, registrar and yearly price. The skill opens the other sections. Channels lists the owned steps as cards: email is always on, the web design comes first, and the order form, Goggle Ads and AI ads each need the web design. AI ads become available in 2023. Campaigns shows one card per paid channel (Goggle Ads, AI ads, gaming communities, cold calling, agency outreach) with the audiences it reaches as toggles and a monthly budget as a segmented control; agency outreach also offers a discount of 10%, 20% or 30%. A campaign's budget is billed at each month start, and so are website and order form upkeep and the review platform fee. Campaigns spread their budget evenly over the cities where you have a location. Awareness shows how well each audience knows you. Reviews shows the score, the latest reviews and the platforms, of which you use one at a time; paid platforms show that they need a marketing manager until one is hired. Trade fairs shows the next run of every fair as a card with its city, dates, cost, company level, leads, audience and network contacts, the employees free on those days as chips, and a Book button. Community lists the running and past sponsorships. Forum posts come with the Staff app; the partner program comes later.

**Marketing manager.** A marketing manager trains on campaigns, review platforms and trade fairs. Trained on campaigns and working the queue, the best one adds 5% to 15% to every campaign's leads by skill. Trained on review platforms, they make platform invites 50% more frequent.

**Community events.** From the first weeks, a club or meetup asks for a free service now and then: a request arrives in the inbox every 4 to 8 weeks, drawn from the events open at the company's level. Each names the service, its size and how long it should run, such as two game servers for the weekend, a VPS for three months or web hosting for a year. Accept provisions the services at no charge through the normal placement, so they take capacity, traffic and an IPv4 address like any customer, and the accept fails with the usual error when there is no room. Decline closes the request without any penalty, and a request left unanswered lapses after two weeks without one either. The services end by themselves when the event does. At the end the event pays out. A technical event (the Chaos Computing Club meetup, the Hack-a-Sorus hackathon, the Debonair Linux mirror, from level 3 the DevOops Conference) adds know-how, and with a 20% chance a recommendation puts a technician with 20 more skill than a typical applicant into the Staff market for a month. A public event (the LAN-tastic LAN party, the Frag-Fest tournament, the Linux User Group website) raises the awareness of its audience once, with a 50% chance of a 5-star review, and brings 3 to 6 leads of that audience in the month after. If a sponsored service was down for more than 2 hours during the event, none of that happens: two 1-star reviews appear and the awareness of the event's audience drops by 10%, since everyone saw the logo. Overbooked nodes make this likely. The organiser is a hidden customer who pays nothing, is not counted among customers and does not churn; their outage emails reach the inbox like any other.

## Network and DDoS

Each location connects to the internet through what its city offers: transit carriers, internet exchanges and, later, private peering. Bandwidth costs money, and your customers' traffic has to fit through your links.

**The map.** The Network app opens on Western Europe's big cities, such as Frankfurt, Amsterdam, London, Paris, Berlin, Vienna, Zurich and Milan. The rest of the world stays zoomed out and only matters as distant transit destinations. The map itself covers the whole world, with coastlines, cities and the submarine cables from Series of Tubes (MIT). Datacenters stand in Europe (the big cities plus Düsseldorf, Munich, the budget hoster parks in Nuremberg and Falkenstein, and SkyBlink in Kerkrade on the Dutch-German border) and in North America (Ashburn, New York, Chicago, Dallas and Los Angeles). The cables are drawn without gameplay. The Add location dialog switches between Europe and North America; a wave or a rack move across the Atlantic costs much more than one within a continent. The Locations overview and the Add location dialog use the same map. Each city has its own carriers and prices, internet exchanges, datacenter operators, power price and demand.

**Ways to connect**

| Option | How it works | Cost | When |
| --- | --- | --- | --- |
| Home line | A consumer line in the basement, from DSL in 2005 to fiber later; upload stays slow until business fiber | A flat monthly fee per line; business lines with static addresses cost more | Start |
| Datacenter bandwidth | The datacenter's own transit, through its handoff | Per TB or per Mbps | Early |
| IP transit | A port with a carrier present in the city | Billed at the 95th percentile, with a minimum commit | Mid game |
| Exchange peering | A port at an internet exchange, then sessions with other networks | Port fee; the traffic itself is free | Mid game; needs your own network number (ASN) |
| Private peering | A direct cable to one big network | Cross-connect fee; weeks of lead time | Late game |
| Links between locations | Leased wavelengths or dark fiber | Monthly fee | Several locations |

**The basement's line.** The basement sends all its traffic through the home line's upload. Once a second server's customers push the evening peak past it, the basement's sites get slow: customers lose a little happiness each hour and some write in, as on an overloaded server. Locations and Network show the line's peak upload over the last week, and the first time a line runs full a notification says so. A faster line in Locations is the fix, alongside the move to a datacenter. Lines get faster over the years: DSL 16000 in 2005, VDSL 50 from 2007, VDSL 100 from 2014, each also as a business line with static addresses. 

**The move to a datacenter.** Once the basement's four servers are full, growth needs datacenter space. The cheapest start is a rack share in the home city, such as a quarter rack at Hetzler Park in Frankfurt for €63 a month, billed monthly with power and bandwidth. RAM is what runs out first, so the memory-optimized 2U (32 GB for €4,500 in 2005) is the server to buy there, and a lessor carries it when the bank's limit is used up: a 36-month lease of about €135 a month is paid for by the server's first 10 GB of customers. A new location needs its own cluster, because a cluster stays within one zone. A cluster that sells in a datacenter is created in Locations, with a hypervisor installed in Products.

**Uplinks.** A location can have as many uplinks as its routers have ports. Each uplink is a contract with one carrier or exchange and has one or more links. Every link uses one router port, and its speed is limited by that port and by what the carrier sells that year, from 1G in 2005 to 400G in the 2020s. A small router has a few 1G ports, and bigger ones have 10G, 100G and 400G ports, so faster or more links mean a better router. Two links on two routers keep the uplink up when one router fails, and a second carrier keeps you online when the first has an outage.

**Joining an exchange.** You apply for membership at the exchange, which needs your own network number (ASN) and costs a setup fee plus a yearly fee. Then you order ports: one, two or more, each at a speed your routers support. The exchange delivers each port as a cross-connect to your patch panel after a lead time. Connecting to the exchange's route servers gives you sessions with every network that peers openly, and other networks need their own session. Exchanges such as DE-KICKS also offer ports in other cities, so one membership can cover several locations.

**Peering requests.** Once you are a member of an exchange, other members ask to peer with you, and each request arrives in your inbox. It shows the network's name, its PeeringDB-style facts (how many routes and prefixes it announces, its traffic level, its peering policy and which exchanges it is on) and what it expects in return. Small networks with a handful of routes save you little transit but cost a session to maintain; large ones move real traffic off your paid transit. You accept or reject each request. Big eyeball networks rarely ask and are hard to win over; small hosters and hobby networks ask often. As you grow, more and bigger networks ask, and your own requests to them are accepted more often.

**Topology view.** A second view of the same data draws the network as a tree from left to right: carriers and exchanges, uplinks, routers, switches and the servers on each switch. Every line shows its speed and is coloured by load with the same thresholds as the request bars. Clicking anything opens it in the inspector, and switches with many servers collapse into a count until you expand them.

**Uplinks in the Network app.** A location's page lists its uplinks as cards, one per carrier or exchange, with the type, every link with its speed and router port, the 95th percentile against the commit, and the monthly cost.

**Private networks.** Customers with several workloads, such as agencies, shops and enterprises, ask for a private network between them. A private network is a VLAN on your switches: workloads in it reach each other only if every node they run on has a switch port that carries the VLAN. A port to a node can carry all customer networks with one toggle, which is the easy setting. Enterprise customers require a private network, and other customers buy one as an add-on. One switch domain holds up to 4,094 VLANs; overlay networks (an unlock) lift that limit and stretch a private network across racks and locations.

**Every zone has its own network.** Carriers, transit, exchange ports, private peering and the gateway belong to one availability zone, just like racks and storage. A new zone starts with only what its datacenter offers. The one thing that ties zones together is a link you book between them, leased capacity or dark fiber. Over that link a zone can send traffic out through another zone's better transit and peering, so one well-connected site can carry a weaker one, at the cost of the link and the latency. The same link carries migrations between zones, and how long they take depends on the bandwidth left over. Without a link, zones share nothing.

**Path and latency.** `pathTo` lists the hops between two devices over the cables, with patch panels skipped: gateways, firewalls and switches, the home line as a hop named after its carrier, the datacenter's handoff as an uplink hop named after the datacenter, and a core hop for the distance between two cities. Ping and traceroute from the desk start at the basement home router. A stopped switch, firewall or gateway, or a basement without a line, ends the route: traceroute prints the hops that answer and `* * *` for the rest, ping reports 100% packet loss, and `ssh` times out. Each hop adds its latency (economy.md, Traffic and bandwidth) and every printed time varies by 10%. A line or uplink above 80% of its exit capacity adds delay and loses packets.

**Routing,** simplified from Series of Tubes ([repo](https://github.com/fjaeckel/seriesoftubes), MIT license). Traffic leaves through the cheapest exit available: private peering first, then exchange peering, then transit. Equal exits share the load, and anything over a link's capacity spills to the next option. Transit is billed on the 95th percentile of the last 30 days, never less than 20% of the port. Networks peer openly, only above a traffic threshold, only for a fee, or (the big carriers) not with small players at all.

**Parody names.** Series of Tubes has ~200 network names and is MIT-licensed, so we can reuse them with credit. We add our own for hosting brands, such as the OVH stand-in.

| Real company | Parody | Role |
| --- | --- | --- |
| Cogent | Cogentle | Cheapest transit; some customers demand "no Cogentle" |
| Lumen | Level Tree | Premium transit |
| Arelion (Telia) | Tell-Ya Carrier | Transit |
| Hurricane Electric | Drizzle Electric | Cheap transit, peers with everyone |
| Deutsche Telekom | Doitsche Telekomm | Big eyeball network, hard to peer with |
| Vodafone | Voda-Phony | Eyeball network |
| DE-CIX | DE-KICKS | Frankfurt exchange, raises prices yearly |
| AMS-IX | HAMS-IX | Amsterdam exchange |
| LINX | LYNX | London exchange |
| Equinix | Equinox | Datacenter operator |
| Interxion | Interaction | Datacenter operator |
| Cloudflare | Crowdflare | CDN, peers openly |
| Deutsche Bank | Deutsche Bankrupt | Bank in the Bank app |

**DDoS attacks.** Attacks target one customer, and gamers attract the most. The flood saturates your links, so everyone sharing them suffers. Your options:

- **On-demand protection:** pay per incident. It kicks in after a detection delay, so there are minutes of downtime first.
- **Always-on protection:** a monthly fee. It filters everything all the time and adds a little latency. Game servers need it.
- **Blackholing:** an emergency button that drops all traffic to the attacked address. The target goes offline, but everyone else is saved.

Customers can also buy DDoS protection from you as an add-on.

**Gear firmware and the console.** Switches, routers, KVMs, console servers and OOB switches run firmware from the year they were bought. Update firmware, in the inspector or the Security app, installs the current year's version and reboots the device for 10 minutes. A switch or router hangs on 10% of updates, and a port group change locks you out of it 2% of the time; either way it stops forwarding. Recover over console fixes it in 5 minutes through a console server on its console port, and a lockout also clears through its management port on an OOB switch. Without either, the same fix is a hand task on site. A management device open to the internet (a KVM on a switch whose way out has no firewall, or a console server or OOB switch with its own line) is an exposed instance: the Security app lists it with its firmware's open vulnerabilities, one a year. An intruder on one cuts power to the servers behind it and locks out the gear behind it until it is recovered.

**How the Network app works.** The sidebar lists every zone, then Peering and DDoS. A zone page shows its traffic over the last week against what got through, and switches between Uplinks, Topology and Map. Uplinks lists the zone's uplinks as cards, then the carriers on site and the exchange as order cards, then links to other zones. Peering holds your AS number, your exchange memberships, the request inbox and the networks you can ask. DDoS holds the protection contracts and every running attack with its blackhole switch. The basement only has its home line, and every other zone starts with its datacenter's bandwidth. Private peering, remote exchange ports, carrier outages and DDoS protection sold to customers are not built yet.

## Research and unlocks

Unlocks cost know-how points plus a one-time launch cost in money. You earn know-how from every active contract each month, so progress comes from running the business, not just from a big bank balance. Some unlocks also need a minimum company level.

**Skills.** Pear Store apps and upgrades are gated by skills the company learns in the Research app, such as Monitoring, Employee management or Market research. Research shows them as a tree in tier columns from left to right, with lines from each skill to the skills it builds on. A skill is learned (filled), in training (with a progress bar and the days left), ready to start, or locked with the skills it still needs. Selecting a skill opens a side panel with its description, cost, training time, prerequisites, what it leads to and what it makes available in the Pear Store.

Starting a training needs every prerequisite learned and enough know-how, which is paid up front. One training runs at a time, and the skill is learned when its training time has passed. The company then gets a notification and a short click-through sheet in the style of the introduction that explains the new feature and points to the Pear Store; the skill's panel reopens it under How it works. The sheet text lives in docs/design/research.md. Costs, durations and the tree are in economy.md under "Know-how and unlock costs". Product management is a tier 1 skill, so a company that works its first orders by hand can set its own rates per resource in the Products app by the middle of its first year.

Provisioning automation is a tier 2 skill after Product management. It adds Automatic to the setup of an order and a Place orders automatically switch in Settings that runs an accepted order from the customer account to the setup by itself; before it, every order is quoted and set up by hand on a host the player picks.

**Starting kit:** a 24U rack in the basement with one compute server and a small switch, a reseller account for domains, and web hosting, game servers and VPS on your own hardware.

| Branch | Unlock path, in order |
| --- | --- |
| Products | SSL certificates → email → dedicated servers → storage hosting → VPN → CDN → cloud servers → colocation |
| Infrastructure | Rack share → datacenter positions → second location → cage → private suite → own datacenter; HA clusters; rack templates; auto-cable |
| Network | Transit contracts → internet exchange peering → own network number (ASN) → always-on DDoS protection |
| Business | First hire → status page → market research → cross-selling boosts → review platforms → insurance → AI bots |
| Independence | Domain registrar, own control panel and other in-house replacements for bought-in services |

Hardware generations unlock by year, not through research (see Racks, hardware and cabling).

## Prices

Starting values come from today's Western European market (checked October 2026, excluding VAT, dollars converted at about €0.86). Because the game starts around 2005, transit starts higher and falls every year until it reaches these levels, while hardware prices follow the parts, whose prices change by year (economy.md, Part prices by year).

**Space and power**

| Item | Price today | Source |
| --- | --- | --- |
| 1U in a shared rack | €25–170 per month | [hosttest.de](https://www.hosttest.de/vergleich/colocation-frankfurt.html) |
| Quarter rack (~10U, 1 kW) | ~€420 per month | [MIRhosting](https://mirhosting.com/colocation-in-frankfurt) |
| Half rack (~22U, 2 kW) | ~€840 per month | [MIRhosting](https://mirhosting.com/colocation-in-frankfurt) |
| Full 47U rack | €1,300–4,000 per month, plus ~€2,500 setup | [IMT Systems](https://www.imt-systems.com/en/colocation.html) |
| Extra power | €275–420 per kW per month | [IMT Systems](https://www.imt-systems.com/en/colocation.html) |
| Cage | €10,000–30,000 per month (estimate) |  |
| Business electricity | ~17 ct per kWh | [BDEW](https://www.bdew.de/service/daten-und-grafiken/bdew-strompreisanalyse/) |

**Network**

| Item | Price today | Source |
| --- | --- | --- |
| Transit, 1 Gbps commit on a 10G port | ~€190 per month | [Genius Weer](https://geniusweer.com/en/solutions/transit-ip) |
| Transit, 10 Gbps commit | ~€1,100 per month retail; ~€600 wholesale | [Genius Weer](https://geniusweer.com/en/solutions/transit-ip), [TeleGeography](https://resources.telegeography.com/ip-transit-price-erosion-significant-regional-differences-remain) |
| AMS-IX port, 10G / 100G | €650 / €3,240 per month | [AMS-IX](https://www.ams-ix.net/ams/pricing) |
| DE-CIX port | On request; assume close to AMS-IX |  |

**Hardware (purchase)**

| Item | Price today | Source |
| --- | --- | --- |
| 1U server, configured | €3,000–6,000 | [Thomas-Krenn](https://www.thomas-krenn.com/de/produkte/server-hardware) |
| 2U server, configured | €6,000–12,000 | [Thomas-Krenn](https://www.thomas-krenn.com/de/produkte/server-hardware) |
| Storage server with disks | €15,000–25,000 | [Thomas-Krenn](https://www.thomas-krenn.com/de/produkte/server-hardware) |
| GPU server, 8 GPUs | ~€300,000 | [AMCompute](https://www.amcompute.com/gpu-server-values/h200) |
| 1G switch, 48 ports | €500 (budget) to €5,000 | [dectdirect](https://www.dectdirect.nl/de/crs354-48g-4s2qrm.html) |
| 25G switch, 48 ports + 8×100G | ~€6,000 | [ServeTheHome](https://www.servethehome.com/fs-n8560-48bc-48x-25gbe-8x-100gbe-switch-review/3/) |
| 100G switch | €1,900 (budget) to €30,000 | [MikroTik](https://mikrotik.com/product/crs520_4xs_16xq_rm) |
| Edge router | €2,400 (budget) to €25,000 | [MikroTik](https://mikrotik.com/product/ccr2216_1g_12xs_2xq) |

**What customers pay (market base rates)**

| Product | Price today | Source |
| --- | --- | --- |
| Shared web hosting | €2–28 per month | [Hetzner](https://www.hetzner.com/webhosting/), [IONOS](https://www.ionos.de/hosting/webhosting) |
| VPS | €8 (2 cores, 4 GB) to €67 (16 cores, 64 GB) per month | [netcup](https://www.netcup.com/de/server/vps) |
| Dedicated server | €59–99 small, €159–614 large, per month | [Hetzner](https://www.hetzner.com/dedicated-rootserver/matrix-ax/) |
| Game server | €2.40–6.10 per GB of RAM per month | [Tech Insider](https://tech-insider.org/de/nitrado-g-portal-und-shockbyte-im-berblick/) |
| Object storage | ~€6.50 per TB per month | [Hetzner](https://www.hetzner.com/storage/object-storage/) |
| Backup storage | €2–3.20 per TB per month | [Hetzner](https://www.hetzner.com/storage/storage-box/) |
| .de / .com domain | €5–18 / €10–29 per year retail; €3–3.60 / €12–13 wholesale | [Experte](https://www.experte.de/domains/guenstige-domain), [INWX](https://www.inwx.de/de/domain/pricelist) |
| SSL certificate | DV from €8 (free via Let's Encrypt), OV ~€100, EV ~€140 per year | [Hostinger](https://www.hostinger.com/de/tutorials/ssl-zertifikat-kosten) |

**Running costs**

| Item | Price today | Source |
| --- | --- | --- |
| Support agent, junior / senior | €38,700 / €46,200 gross per year | [gehalt.de](https://www.gehalt.de/beruf/first-level-support) |
| Sysadmin, junior / senior (median) | €40,200 / €54,800 | [StepStone](https://www.stepstone.de/gehalt/Junior-Systemadministrator-in.html), [StepStone](https://www.stepstone.de/gehalt/Senior-Systemadministrator-in.html) |
| Network engineer | €54,000–67,700 | [gehalt.de](https://www.gehalt.de/einkommen/suche/senior-network-engineer) |
| Bookkeeper (median) | €38,300 | [StepStone](https://www.stepstone.de/gehalt/Buchhalter-in.html) |
| Marketing manager (median) | €45,300 | [StepStone](https://www.stepstone.de/gehalt/Marketingmanager-in.html) |
| Employer costs on top of salary | +29% | [Destatis](https://www.destatis.de/DE/Themen/Arbeit/Arbeitskosten-Lohnnebenkosten/Tabellen/lohnkosten-deutschland.html) |
| cPanel | ~€26–60 per server per month by account tier, +€0.42 per extra account | [cPanel](https://cpanel.net/pricing/) |
| Plesk | €7–31 per server per month by domain tier | [Plesk](https://www.plesk.com/pricing/) |
| DirectAdmin | ~€4–25 per server per month | [DirectAdmin](https://www.directadmin.com/pricing.php) |
| HestiaCP (open source) | Free | [HestiaCP](https://hestiacp.com/) |
| Search ads | €2–6 per click (estimate) | [CodeDesign](https://codedesign.org/google-ads-cost-europe-your-complete-guide/) |
| Trustpilot | ~€85–690 per month | [Trustpilot](https://business.trustpilot.com/pricing) |
| ProvenExpert | €30–100 per month | [ecom-tools](https://ecom-tools.de/provenexpert/) |
| Always-on DDoS filtering | ~€3.90 per Mbps of clean traffic per month | [Gcore](https://gcore.com/pricing/security) |
| DDoS-protected IP via a reseller | ~€2.60 per IP per month | [BuyVM](https://wiki.buyvm.net/doku.php/ddos) |
| Small-business loan interest | ~4% (startups 5–8%, estimate) | [Bundesbank](https://www.bundesbank.de/resource/blob/964884/37fc1e33c4e286356ad5b89489fb2a46/472B63F073F071307366337C94F8C870/2026-10-01-mfi-zinsstatistik-download.pdf) |

OVH includes always-on DDoS protection at no extra cost, which is a good model for the wholesale provider players resell from.

## Tech stack and project structure

Build it with TypeScript, Vite and React, keep the simulation as plain TypeScript, and organize the repo the way Series of Tubes does. That means numbered topic folders, a CLAUDE.md with hard rules, skills for recurring jobs, and one test suite per feature. The code is MIT-licensed.

| Layer | Choice | Why |
| --- | --- | --- |
| Language and build | TypeScript, Vite | Fast reload; builds a static site |
| Desktop and apps | React + Zustand | A window manager with a dozen app panels is UI work, React's strength |
| Rack and room views | SVG drawn by React components | Crisp device fronts at any zoom; no game engine needed |
| Europe map | Canvas 2D + d3-geo, Natural Earth outlines | Series of Tubes draws its map on a plain canvas too |
| Charts | uPlot | Many live series, cheap to draw |
| Simulation | Plain TypeScript, seeded randomness, an hourly tick | Testable without a browser; same seed, same game |
| Saves | localStorage, versioned and compressed; old saves repaired on load | Switch to IndexedDB if saves outgrow localStorage's ~5 MB |
| Tests | Vitest for the simulation, Playwright for the UI | Claude Code can run both by itself |
| Hosting | GitHub Pages; a service worker for offline play | No server at all |

**Folder layout**

```text
CLAUDE.md                 hard rules, layout, commands
.claude/skills/           edit-the-game, add-content, write-tests, balance, release
docs/design/              game design, economy model, first-hour script
docs/ARCHITECTURE.md      how the pieces fit
docs/adr/                 decision records (static only, saves, i18n)
src/sim/                  pure TypeScript, never imports React
  00-core/                seeded random, time, money, ids
  10-catalog/             hardware, products, licenses, prices
  20-world/               cities, datacenters, carriers, exchanges
  30-market/              customer profiles, demand, competitors
  40-company/             staff, levels, reputation
  50-state.ts             game state and new-game setup
  60-infra/               locations, racks, ports, clusters
  70-network/             routing, transit billing, peering
  80-business/            tickets, invoices, dunning, marketing
  85-incidents/           failures, outages, DDoS
  88-tick/                the hourly and monthly tick
  90-actions/             every player action, used by UI and tests alike
  91-save/                save, load, repair old saves
src/ui/desktop/           menu bar, dock, windows, notifications
src/ui/apps/              one folder per app
src/ui/art/               code-drawn rack and server fronts
src/i18n/                 player-facing strings by label
tests/                    one seeded suite per feature, save fixtures
.github/workflows/        CI, deploy to Pages, @claude action
```

**Hard rules for CLAUDE.md,** adapted from Series of Tubes:

- Static site only; never add a server.
- Every real company appears as a pun.
- Player actions go through `90-actions`, so the UI and tests use the same path.
- Old saves must keep loading: every new field gets a default when a save is repaired on load.
- Every change comes with a test, using seeded randomness and never luck.
- Player-facing text goes through i18n labels, never sentences glued together from fragments.

## Addresses and internet

Every server reaches the internet through an address, and addresses cost money. Numbers in economy.md, Addresses and internet.

**Internet is never free.** A new game has no line. The player orders one in Locations and pays it monthly. A consumer line has one dynamic address that the router shares with every basement machine; the provider forces a reconnect every night at 03:00, a few minutes offline that business customers notice and dislike. A business line costs more, keeps a static address and brings a /29: the router's address and four more to assign to machines, with more for a monthly fee. A dynamic line can only sell web hosting, since every other product needs an address of its own. Business customers still buy on a dynamic line and grow unhappy with the nightly drops.

**Datacenter addresses.** In a rented location every server holds its own public IPv4 from the provider, about €1 a month at the start, cheaper per address as the company rents more, and rising after RIPE runs out of IPv4 in 2019. IPv6 arrives in datacenters in 2010 and on home lines in 2013 and costs next to nothing. Later the company can join RIPE as a LIR, get an AS number and its own blocks: a free first allocation that shrinks over the years, then /24s bought on the transfer market and announced from a datacenter.

**Customers need addresses.** Every machine has a private address in its location's range that the player never manages. A VPS, game server, cloud server, VPN, dedicated server or colocation needs a public address of its own, and a sale fails without a free one. Some web hosting orders ask for a dedicated IPv4 for SSL or mail before SNI, and from 2012 a growing share asks for IPv6. The dedicated IPv4 has its own price per address in Pricing.

**Reputation.** Every IPv4 has a mail reputation. Spam from a hacked panel host or a shady customer lowers it, and so do spam, phishing, attack and copyright reports in the abuse inbox. Below a threshold the address gets blocklisted and mail customers behind it write in about bounced mail. Delisting is a hand task in the address list once the spam stopped. Dynamic home line addresses are always listed.

**The address list.** Network lists each location's addresses with what holds them, their reputation and listing. The player buys and releases addresses, requests a delist, joins RIPE and announces blocks there. A server's and a VM's addresses show in their inspector: private, public IPv4 (shared on a basement line) and IPv6.

## MVP and milestones

The MVP has the basement rack, one datacenter location, web hosting and VPS, support and billing done by hand, and the first hires. That's the smallest version where you can feel the automation loop. Each milestone ends in something playable.

1. **Desktop shell.** Menu bar, dock, draggable windows, notifications, time controls, saving in the browser. Done when apps open and the clock runs.
2. **Locations and racks.** The basement rack, adding a datacenter location from the catalog, buying and moving racks, the rack front view, buying servers and switches with their specs, cabling ports in the inspector, bonding a server's ports. Done when a rack moved from the basement to a datacenter comes back online there.
3. **Clusters and products.** One cluster, web hosting and VPS on your own hardware, colocation in rack sections with uplinks to wire, workloads placed by the scheduler, cordoning and draining a node, the virtual machine manager with storage pools, control planes, the server view with workloads and utilization, the Sales app with request cards and resource bars. Done when an accepted request runs as a VM that survives a drain.
4. **Customers and support.** Customer profiles, purchases, tickets with templates and actions, happiness and churn, disk failures with data loss, backups and restores, incident reports, refunds and reviews, abuse and copyright notices, legal requests with server seizure, shady crypto customers. Done when an outage floods the inbox.
5. **Billing and finance.** Invoices, dunning buttons, collections, profit and loss, a bank loan. Done when an unpaid invoice can go all the way to collections.
6. **First hires.** The job market, a support agent and a bookkeeper working through their queues, training per skill, trainers. Done when a hire visibly empties a queue.

**After the MVP:** more location tiers, the Network app with several carriers, exchange memberships and multi-link uplinks, private networks for customers, automatic rebalancing and evacuation, more products, marketing and reviews, the research tree, company levels, competitors, DDoS, AI bots.

## Open questions

- [x] Room layout: predefined slots (as written here) or free placement? -> Predefined Slots
- [x] Research: know-how points plus money (as proposed), or money only? -> as propsoed
- [x] Should the player have limited working hours per day? That would make hiring feel necessary instead of optional. -> no, they can also pause the game if they feel like pausing it, they could technically run it alone if they wanted to.
- [x] Start in the present day, or in the past (around 2005) with technology advancing over time? past and yes technology would advance but dont make too much variety between servers we want to keep it on resources on the servers mainly, so bigger ram etc. unlocks over time, oh energy costs are also athing depending on what the lcoation charges per energy (own datacetners can have custom contracts with energy providers) it should move users to replace old servers with new ones to be more energy erficinet
- [x] Do competitors expand and react to you, or are they a static backdrop? they are a static backdrop, there should be like some other bigger providers, and its a really hard and fought overm arket
- [x] Parody names: puns on the real name ("TrustPylon") or fully invented names? puns on real names
- [x] Which open-source license (MIT, GPL)? MIT
- [x] Which events auto-pause the game? Alerts: the owner asked (October 2026) for notifications that pause and pop up like the bankruptcy warning. The list is in "The desktop", paragraph Alerts.
- [x] Do hardware brands differ in price and failure rate, or only in look? Both: each manufacturer has a price factor and a failure factor (economy.md, Manufacturers).
- [x] Without price lists, should the player still have one lever on price, such as a premium or discount per product that changes which requests arrive? Yes: you quote a price on every request against a market reference, set rates per resource for the order form, and can raise prices of running services (see Quoting a price).

Ideally at the start they are enthised to either rent a server from a company to get resources to place on, we always have servers as "clusters" so they can be assigned to different products/workloads, so they can fully rent out a server from a existing bigger provider at the start.&#32;
