# Support desk on the web

Status: planned. Milestones M1 to M17. Related design: `docs/design/gdd.md` (Support, Support desks), `docs/design/economy.md` (Pear One subscriptions, Tickets and work rates), `docs/design/shop-surfaces.md` (the surface list this plan copies for desks), `docs/design/plans/shop-software.md` and `web-presence.md` (install onto a web space, the app catalogue, Strateaux), `docs/design/plans/shop-portal.md` (one site, several software skins), `docs/design/plans/software-licences.md` (versions, free software ages). The mail lanes `mail-core`, `mail-client`, `webmail-consumer` and `webmail-server` are planned in parallel; this plan uses the names of `mail-core.md` (`MailAccount`, `Message` with its `thread` and `ticket` fields, `DeskChannel`, `MailRole`, `roleAccount`, `sentCopy`, `deskImports`) and lists what it needs beyond them at the end. The company DNS zone is built once by `webmail-consumer` M2 (`company-zone`, with the registrar DNS page), and M5 of this lane adds the `support` records and reachability on top of it. Where a name in this plan differs from `mail-core.md`, the `mail-core` name wins (app id `Pear Mail`, client state `s.pearMail`, server verbs `moveMessages`, `markMessages`, `deleteMessages`, `sendMessage`, `listFolder`).

## What changes

Today the Support app is one window with two modes. Without a desk it is a plain inbox that mixes customer requests, vendor mail, orders, sponsor offers and Pear letters. With a desk (a Pear Store item charged per seat) it gains filters, search, assignment, templates, timers, a customer card and reports. After this plan:

- Customer support requests are tickets, and tickets live in a support desk, which is a website. Everything else that arrives by email (bank, vendors, registrars, licence keys, partners, sponsors, orders) stays in mailboxes and is read in webmail or Pear Mail.
- The desk runs at `support.<company domain>` (for example `support.pxl-hosting.de`) in the Browser. Each of the four desks is its own web software: it has the pages, navigation and admin screens of its real counterpart, a staff side (`/scp` for OsTickit, `/agent` for Zendusk, and their equivalents) and a customer side where the real product has one, and its own look per era. Nothing is a shared shell with reskins. The shared part is non-visual: the actions, the data hooks, and the headless `ReplyPanel` and `TicketPane`.
- OsTickit and FreeScoot are self-hosted: the player installs them onto a web space, and the desk is down when that host is down. Zendusk and Freshdusk are hosted: the player subscribes on the vendor's website and picks a tenant name. A desk needs a DNS record for `support.<company domain>` to be reachable under the company's own name.
- The desk imports mailboxes as channels. The `support@` box becomes a channel, the desk fetches its mail and turns every customer message into a ticket, threads follow-ups by the number token in the subject, and replies go out from the channel address and land in the mailbox's Sent folder.
- Tickets get a department, an assignee (the owner or an employee), internal notes, priority, merge and spam handling. Employees work the tickets assigned to them through the existing work queue.
- The desks' features follow the real products, so `economy.md` is rewritten to match (M2).
- Zendusk and Freshdusk gain AI features in the years their real counterparts shipped them: suggested articles, answer bots, and from 2023 generative auto-answer and reply drafting. Auto-answer replaces the ChadGPT Support bot, which leaves the shop and the simulation. Self-hosted desks get no AI.
- Spam arrives in realistic amounts through the imported mailboxes and becomes tickets. Out-of-office loops happen only when an autoresponder is enabled, either a desk auto-reply or a mailbox vacation reply.
- The Support app stops being a window of its own once a desk exists. Its tile becomes a pinned tab that opens the desk in the Browser.
- Before any desk exists, a support request is a message in the support mailbox with a ticket link, and the player answers it in Pear Mail or webmail with the same replies, retention offers and actions. The reply loop, its right and wrong scoring, work minutes and follow-ups stay exactly as they are.
- The foundation leaves named hooks for later upgrades: live chat, a phone queue, customer satisfaction, multiple brands, SLA policies and workflow rules.

## Today (read from the code)

- `src/sim/10-catalog/desks.ts` lists four desks with a feature set each (`filters`, `search`, `assign`, `templates`, `slaTimers`, `customerSidebar`, `reports`). A desk is installed through `install(id)` in `src/sim/90-actions/store.ts` as a Pear Store item, `s.installed` holds its id, and `seats()` charges the owner plus every support employee monthly. One desk at a time; installing another replaces the first.
- `src/sim/40-support/tickets.ts` owns the gameplay: ticket kinds, `TEMPLATES`, `ACTIONS`, `TOPIC_ACTIONS`, `rightTemplate`, `shownTemplates` (a desk without `templates` shows three replies with the right one kept in), `dueAt` from the customer's profile, `MINUTES` per kind, and `createTicket`. `src/sim/90-actions/support.ts` queues replies and actions as player work; `src/sim/40-support/tick.ts` applies the work, bumps happiness for right and wrong answers, spawns tickets and charges the wait penalty.
- `Ticket.assignee` already reserves a ticket for one support employee. `answerTickets` in `src/sim/47-staff/staff.ts` lets that employee take it first, and bots such as ChadGPT Support work the same queue.
- `src/ui/apps/support/SupportApp.tsx` mixes four things: the ticket list and thread (`Thread`), the order and quote thread (`OrderThread`, `CustomOrder.tsx`), a compose form for new mail (`Compose.tsx`), and the boxes Lost sales, Incidents and Reports. The window style per desk and per mail provider lives in `mail-styles.css`, and the marks (`OsTickitMark`, `ZenduskMark`, `FreshduskMark`, `FreeScootMark`) in `src/ui/art/mailmarks.tsx`.
- Company mail, orders, sponsor offers and Pear letters are tickets too (kinds `mail`, `order`, `upgrade`, `sponsor`, `pear`, `extortion`), created by `deliverMail` and other helpers. Nothing separates mail from support work.
- The shop portal at `portal.<company domain>` is the pattern to copy: pure address tables in `src/sim/80-business/portal.ts`, one `PortalSite`, a `Skin` per shop system, shared screens under `sites/portal/shared`, status that follows the host (`shopStatus`), install onto a web space as machine id `shop`.
- The company site already has a Knowledge base page and a support page (`CompanySite.tsx`, `kbArticles`), and the Knowledge base Pear Store item deflects 30 percent of basic how-to questions (`KB_DEFLECT`).

## The model

### Tickets, messages and the desk

A ticket stays the gameplay record: status, `dueAt`, `work`, replies with right or wrong scoring, outcome. A message is the email the player sees. `mail-core` links them: a customer-facing ticket has an envelope Message (`Message.ticket`) in the mailbox of its role, the thread of its Messages is the ticket id (`Message.thread`), every reply is a Sent copy made by `sentCopy`, and for ticket threads the unread state is `Ticket.unread`, so a mailbox and a desk cannot disagree. The desk is the web workspace over tickets that arrive through its channels.

New optional ticket fields, all with defaults in `newGame` and filled by `deserialize`:

| Field | Meaning | Default |
|---|---|---|
| `channelId` | the DeskChannel that imported the ticket; null while only the mailbox holds it | null |
| `via` | `"email"` or `"web"` (open union, later `"chat"` and `"phone"`) | `"email"` |
| `ref` | the number the desk shows, assigned when the desk imports the ticket | `""` |
| `deptId` | department | null |
| `priority` | override of the derived priority | unset |
| `notes` | internal notes: `{ hour, by, key?, params?, text? }`, system events by key, typed notes as text | `[]` |
| `mergedInto` | the ticket this one was merged into | unset |

Priority is derived: urgent for an outage of a high-budget customer, high for outages, appeals, takedown deadlines and cancellations of customers above a monthly value, low for how-to questions, normal otherwise. The stored override is changed by the agent in desks that offer it.

### Which kinds are tickets

The desk lists customer support. Everything else keeps arriving as mail with its own widgets, which `mail-client` and `webmail-*` render.

| Kind | Home mailbox role | Desk department | In the desk |
|---|---|---|---|
| outage, howTo | support | Support | yes |
| billing, appeal, refund, cancellation | support | Billing | yes |
| upgrade | support | Sales | yes, with a button that opens the sales request |
| migration, maintenance | support | Support | yes (our own notices, shown as sent) |
| abuse, notice, legal | abuse | Abuse | yes, when the abuse box is a channel |
| order, sponsor | sales | none | no, they keep their widgets in the sales mailbox |
| pear, mail, extortion | owner | none | no |

The roles are the ones `mail-core` routes by (`owner`, `sales`, `support`, `abuse`; `roleAccount(s, role)` picks the mailbox), and the table of kinds to roles and departments is `DESK_ROUTE` in the desk catalog. A department such as Billing is a desk concept and not a mailbox role. A player who imports `info@` into the desk gets the clutter real helpdesks get: every message without a ticket link becomes a ticket of kind `mail`, while ticket kinds outside the table (order, sponsor, Pear letters, extortion) stay in the mailbox that needs no reply and only waits to be closed. The Lexwear Helpdesk link keeps its Create quote button on order tickets, which stay in the sales mailbox with their own widget. Kind `mail` and the new kind `spam` never charge the wait penalty and have no reply templates, so `closeTicket` must handle a ticket without a customer.

### Threading and the number token

Each desk numbers tickets in its own style and puts the number in the subject of every outgoing mail, so a customer's reply joins the ticket. The formats are data in the catalog and are checked against the real products in M2.

| Desk | Number | Subject token |
|---|---|---|
| OsTickit | random six digits, unique | `[#178245]` |
| Zendusk | sequential | `[Request #4812]` |
| Freshdusk | sequential | `[#1043]` |
| FreeScoot | conversation number, no token | none; threads by mail headers |

Threads are ticket ids, so every Message the simulation writes for a ticket already belongs to it. The token matters for what the player reads in Sent and in the customer's mail, and for mail without a ticket link that a desk imports: such a message joins a ticket when its subject holds a known token and otherwise opens a new one. A message that joins a final ticket reopens it where the real product reopens it and starts a follow-up ticket where the real product does (Zendusk, when the ticket is closed). Tickets imported from a mailbox keep their thread, so installing a desk in the middle of a conversation does not split it.

### Statuses

The simulation keeps its five statuses. Each desk shows them under its own names.

| Simulation | OsTickit | Zendusk | Freshdusk | FreeScoot |
|---|---|---|---|---|
| open, unread | Open | New | Open | Active |
| open | Open | Open | Open | Active |
| waiting | Answered | Pending | Pending | Pending |
| escalated | Open, marked "with technician" | On-hold | Waiting on third party | Pending, with a note |
| resolved | Resolved | Solved | Resolved | Closed |
| closed | Closed | Closed | Closed | Closed |
| spam | Banned sender, closed | Suspended | Spam | Spam |

Overdue is derived from `dueAt` and shown as a tab (OsTickit), a badge (Zendusk, Freshdusk) or a filter.

## Before any desk: the mailbox loop

This is the minimum that keeps the loop playable and the only part of this plan that `mail-client` and `webmail-*` must render.

1. Every support ticket has its envelope Message in the mailbox that `roleAccount(s, "support")` names (the `support@` box, or the only box a young company has). The Message shows a due pill ("Reply due in 3 h", overdue in red) taken from `dueAt`.
2. A Message with a ticket link shows a Response list under the text and the resolve actions in a banner, which is what `mail-client` already plans. Both are built from `useTicketReplies` (M1): the three replies of `shownTemplates(s, t, false)` with titles only, retention offers for cancellations, the ticket actions (credit, cancel, unsuspend, keep, refund, accept and the rest of `actionsOf`), the domain transfer answer, Resolve for an answered ticket, and Close. Retention offers and the transfer answer are the parts a client would otherwise miss.
3. Choosing a reply calls `replyTicket`, an action calls `resolveTicket`, a retention card calls `retainTicket`. The player is busy for the same minutes. When the work ends `sentCopy` puts the reply in Sent, and a wrong answer brings the customer's follow-up into the same thread with a fresh due time. Nothing else changes in `finishWork`.
4. Employees and bots work the queue as today, and their replies show in Sent with their name.
5. There are no kind filters, search, assignment, timers or customer card. A player who wants them sets up a desk.
6. While a desk imports the mailbox the client shows "Handled in the support desk" with an Open button (`deskImports`). When the desk is down, or the ticket has not been fetched yet (`deskHandles(s, ticket)` is false), the Response list is back, because the ticket and the Message are one thing under two views. Answering from the mailbox is the fallback the player is taught.

When a desk becomes worth it follows the game's own curve. A 2005 company answers a handful of requests a week in Pear Mail on its free GMix box. The first pressure is volume and the lack of search and assignment, which a free OsTickit on a web space of the company's own panel host (or a Strateaux package that allows apps) relieves. Zendusk arrives in 2007 and is the expensive, polished choice at the per-seat price of `economy.md`, Freshdusk in 2010 is the cheaper hosted one, and FreeScoot in 2018 is the free, modern self-hosted one. A player who never sets up a desk keeps playing the mailbox loop.

### The Support app

The three options for the current Support app are the desk itself, a launcher and the pre-desk inbox. The desk cannot be the app because it is a website in the Browser. The pre-desk inbox would duplicate Pear Mail and webmail and show orders, sponsor offers and Pear letters twice. `mail-core` replaces the Support dock icon with Pear Mail, so the Support tile has no job before a desk exists. A launcher keeps the 49 existing places that open or notify "Support" (events, focus requests, the open-tickets widget, Searchlight hits, the dock badge, Getting started) and follows the precedent of the Chat tile, which `openApp` already sends to an address instead of opening a window.

| State | Tile | A click or a notification |
|---|---|---|
| No desk | hidden | a ticket opens its message in Pear Mail |
| Desk installed | the desk's name and mark, open-ticket badge | opens or focuses the Browser tab on the staff address; a ticket opens at its page |
| Desk down | the same, with a warning dot | the Browser shows the error; the tile's menu offers Open mailbox |

## The desk site

### Hosts and addresses

- `support.<company domain>` is the desk. It resolves when a desk is installed and its DNS record exists. A hosted desk also answers on `<tenant>.zendusk.com` or `<tenant>.freshdusk.com` from the day it is created.
- The addresses are pure data in `src/sim/80-business/deskroutes.ts` (next to `portal.ts`): one page table per desk, because each real product has its own pages. `DeskPage` is a union per desk, and `deskPath(desk, page, args)` and `parseDesk(desk, path)` work the way `portalPath` and `parsePortal` do. The table below lists the entry points; the full page sets are in The four desks.

| Desk | Customer side | Staff side | Admin |
|---|---|---|---|
| OsTickit | `/`, `/open.php`, `/view.php`, `/kb/` | `/scp/`, `/scp/tickets.php?id=<n>` | `/scp/admin.php`, `/scp/settings.php`, `/scp/emails.php` |
| Zendusk | `/hc`, `/hc/requests/new`, `/hc/requests` | `/agent`, `/agent/tickets/<n>`, `/agent/filters/<view>` | `/agent/admin` |
| Freshdusk | `/support/home`, `/support/tickets/new`, `/support/solutions` | `/helpdesk`, later `/a/tickets/<n>` | `/admin` |
| FreeScoot | none; `/` is the staff login | `/mailbox/<id>`, `/conversation/<n>` | `/manage` |

- `resolve()` in `src/sim/80-business/browser.ts` gets one line for `support.<company domain>` returning `{ kind: "desk" }`, one for the tenant host of a hosted desk, and one each for the vendor sites. The Browser's `Page` union and the favicon get a `desk` case that uses the existing marks.
- The staff login is the same prefilled form the shop admin uses, kept in `useSessionState("desk.agent")`.
- Every look works from 1024 px wide, goes through `t()`, uses labels and values only, and every real name is a pun. Self-hosted desks take their look from the installed version (as the other consoles will, see `console-by-version`); hosted desks take it from the calendar year, because the vendor upgrades every tenant at once.

### Availability

`deskStatus(s)` mirrors `shopStatus`: a self-hosted desk follows its web space (workload online, slow when the host performs below 1 or is over 90 percent booked, down when offline); a hosted desk is up, with a vendor incident hook for later. It runs as machine id `desk` on a panel host, takes one account on that host and counts against its licence cap, as the shop does. While the desk is down its pages show the Browser's error, tickets already imported cannot be opened there, and the fetch pauses. The mailbox still holds the mail.

### Setting up a hosted desk (Zendusk, Freshdusk)

1. The vendor site (`zendusk.com`, `freshdusk.com`; marketing page, pricing per agent a month, Sign up) takes a tenant name, defaulting to the company slug, and pays the first month as today. Seats keep the existing rule: the owner plus every support employee.
2. A welcome mail with the agent address arrives in the owner's mailbox. The agent site opens with an onboarding list: connect support email, add agents, map the domain, open the help center.
3. Support email is a forwarding setup in the mailbox provider: the desk shows `support@<tenant>.zendusk.com` as the forwarding target and the player sets the rule on `support@` with `setForward`. The desk marks the address verified when the rule exists and the first forwarded message arrives. This is the real Zendusk "support addresses" flow.
4. Host mapping to `support.<company domain>` needs a CNAME `support` to `<tenant>.zendusk.com` (Freshdusk: its own target host). Sending as `support@<company domain>` without the vendor's "via" label needs the vendor's SPF include in the zone's TXT record and DKIM CNAMEs.

### Setting up a self-hosted desk (OsTickit, FreeScoot)

1. The vendor's own site (`ostickit.com`, `freescoot.net`, in the software site pattern with Versions and News) lists the release. The install itself is a tile in the web host's app catalogue (Fantastiko from 2005, Softaculus from 2009 in `web-presence`'s `app-catalogue` lane) and in Strateaux's dashboard when the package allows apps: pick the web space, install. One desk at a time; installing another replaces the first and drops its channels, departments, rules and canned text. Tickets and mail stay.
2. The first visit to `support.<company domain>/setup` (OsTickit) shows the installer: helpdesk name, default email (a MailAccount), admin user. FreeScoot shows its installer with the same fields. Leaving the setup directory in place is a security hint the admin screen shows in red until the player removes it.
3. A record `A support <host address>` is needed in the company zone.
4. Mail comes in by fetching IMAP or POP3 on a schedule. Piping through an alias on a mail server the player runs (Postfixit, Mailpig) is a later option.

### Domain records

| Desk | Record | Effect when missing |
|---|---|---|
| Self-hosted | `A support` to the host's address | `support.<company domain>` does not resolve; the desk is reachable only by the host's name |
| Hosted | `CNAME support` to the tenant host | the desk answers on the tenant URL only; the customer portal link in mails shows the tenant URL |
| Hosted | SPF TXT include and DKIM CNAMEs | replies go out marked "via" the vendor; M17 adds a deliverability effect if Open decision 3 is accepted |
| Hosted | forward rule on the mailbox to the desk's address (`setForward`) | no mail reaches the desk |

The company zone is `s.company.zone`, built by `webmail-consumer` M2 with `setCompanyRecord`, `removeCompanyRecord` and `recordAt(s, type, name, hour)`, which returns the old value until the replaced record's TTL has passed. The desk reads it through `recordAt`, so a new `support` record starts working after its TTL, and checks it on a Verify button, which is also what the real products do.

### Channels

A channel is a MailAccount imported by the desk. `mail-core`'s `DeskChannel` holds `id`, `accountId`, `desk`, `after` (keep, read, move, delete), `folder` and `since`; this lane adds `deptId`, `mode` (imap, pop or forward), `every` (hours between fetches), `autoReply`, `unknown` (accept mail from unknown senders), `topic` (help topic), `verified` and `error`. The Admin page lists channels and has Add: pick one of the player's mailboxes, then the desk-specific fields. Deleting a mailbox that a channel reads is refused by `mail-core` until the channel is removed.

| Desk | Where | Fields |
|---|---|---|
| OsTickit | Admin Panel, Emails | address, incoming IMAP or POP3, fetch frequency, emails per fetch, after fetch (nothing, mark as read, delete, move to folder), department, help topic, auto-response, accept mail from unknown users |
| Zendusk | Admin, Channels, Email, Support addresses | forwarding address, verification state, default group, brand placeholder |
| Freshdusk | Admin, Email, Support emails | forwarding or IMAP, group, reply-to, auto-reply |
| FreeScoot | Manage, Mailboxes | name, address, IMAP or POP3 and outgoing server, fetch, signature, auto-reply, assigned users |

Common behaviour in the simulation:

- Fetch: IMAP and POP3 channels import at the hourly tick, forwarding channels import at once. A mailbox on a host that is down holds its mail in the `mail-core` queue, so nothing arrives, and an account whose plan lacks the protocol cannot be added. The channel's `after` rule runs when the desk imports a message: delete empties the mailbox, keep and read leave a copy.
- Import turns each unfetched Message into a ticket (or joins it to one by thread or token), assigns `ref`, sets `channelId`, `deptId` (channel department, else the kind route) and sends the auto-reply when it is on.
- Reply out: the reply is sent from the channel address with the token in the subject and lands in that mailbox's Sent.
- Send test email: a button that delivers a Message from the owner to the channel account, runs a fetch and shows "1 message imported" and the auto-reply in the owner's inbox. It creates no ticket.
- A channel whose mailbox changes plan or loses its protocol shows the failed fetch in the Channels page.

## Working in the desk

### What is shared and what is not

Shared, and non-visual:

- The simulation: actions for replies, assignment, notes, merge, spam, status, priority, departments and channels, and the derived data (views, counts, first response, SLA hits).
- Data hooks: `useDeskTickets(view)`, `useDeskViews()`, `useTicketPane(ticketId)` and `useTicketReplies(ticketId)`.
- Two headless components that render only the markup their caller passes in. `TicketPane` takes the thread (customer messages, replies by the player and by employees, system events, internal notes, move and outcome lines) and the ticket's properties as data and slots. `ReplyPanel` takes the templates, retention offers, actions with their amounts, the domain transfer answer, Resolve and Close the same way. Pear Mail renders the same two pieces for a ticket in a mailbox.

Not shared: pages, navigation, admin screens, copy, icons, CSS, login, onboarding, and the router of each desk. A desk folder never imports another desk's folder. `DeskSite` only maps the host and path to a desk app, like the registry for software sites.

### What every desk must cover

This is the list of what the game needs from every desk, so play works the same in all four. Each desk puts it where its real counterpart does and calls it what its counterpart calls it.

| Capability | OsTickit | Zendusk | Freshdusk | FreeScoot |
|---|---|---|---|---|
| Ticket queues and views | Tickets tabs Open, Answered, Overdue, My tickets, Closed | Views | Ticket views | Mailbox folders |
| Reply | Post Reply with a canned response | Public reply with Apply macro | Reply with canned responses | Reply with a saved reply |
| Ticket actions and retention offers | More menu and action select | a macro group | Scenarios | the conversation's actions menu |
| Assign | Assign tab and Assigned to | Assignee and group fields | Ticket properties: Group and Agent | Assign menu |
| Internal note | Post Internal Note | Internal note | Add note | Note |
| Merge | Link or merge in More | Merge | Merge | Merge |
| Spam | Ban Email | Suspended tickets | Spam | Spam status |
| Channels | Admin Panel, Emails | Admin Center, Channels, Email | Admin, Email, Support emails | Manage, Mailboxes |
| Departments | Staff, Departments | People, Groups | Admin, Groups | none, mailboxes serve |
| Rules | Manage, Ticket Filters | Business rules, Triggers and Automations | Helpdesk productivity, creation, time and update rules | none |
| Agents | Staff, Agents | People, Team members | Admin, Agents | Manage, Users |
| Knowledge base | Knowledgebase | Help Center | Solutions | Modules, Knowledge Base (paid) |
| Reports | Dashboard | Reporting | Reports | Reports |
| Subscription or version | Admin Dashboard | Account, Subscription | Admin, Account | Manage, System |
| Incidents (the game's ops incidents) | Admin Dashboard, System Logs | Home, known problems | Dashboard, problems | Manage, Logs |
| AI | none | AI agents (from the AI table) | Freddie (from the AI table) | none |

### Replies, macros and actions

The picker is the desk's own widget, fed by `ReplyPanel`. It shows `templatesOf(t)`. A desk where the feature `templates` has started shows every reply with its text; before that the picker shows `shownTemplates(s, t, false)` titles. Choosing a reply fills the editor with the text and Send submits `replyTicket`. The editor is locked to the template text. Ticket actions and retention offers sit where the capability table puts them. The right and wrong scoring, the work minutes and the wrong-answer follow-up are untouched, because every picker calls the same actions.

### Assignment, departments, rules

- `assignTicket` accepts a support employee (a bot too) or `"owner"`. A ticket assigned to `"owner"` is skipped by staff, which is the player's own queue.
- A department is `{ id, name, members, autoAssign, channelId }`. Install creates "Support"; the player adds "Billing" and "Abuse". Empty `members` means every support employee. In `answerTickets` an employee takes tickets in this order: assigned to them, unassigned in a department they belong to, unassigned in a department with no members. Inside one priority, `dueAt` order stays.
- Rules (OsTickit ticket filters, Zendusk triggers, Freshdusk creation rules) are `{ when: kind or "*", set: department, assignee, priority }`, evaluated at import. FreeScoot has none; its workflows are a module in the upgrade path.
- Staff work a desk ticket only while the desk is up. Tickets without a channel (mailbox only) are always workable.

### Notes, merge, spam

- A note is internal and never emailed. Typed notes are saved as text; system events (assigned, status, merged) are saved as keys with parameters and shown in the language of the player.
- Merge moves a duplicate's thread into another ticket of the same customer, closes the duplicate with outcome `merged` and sets `mergedInto`. The real source of duplicates is already in the simulation: a high-budget customer writes three outage tickets for one service. One reply then settles all three and an overdue customer is charged one hourly wait penalty instead of three, at the cost of the two extra right-answer happiness gains.
- Spam: marking a ticket as spam closes it as `spam` with no happiness change. OsTickit also adds the sender to its ban list, Zendusk files it under Suspended, Freshdusk and FreeScoot use their Spam folder. Spam arrives in realistic amounts through the imported mailboxes (M17).

### Customer side

The customer pages are part of each desk's own app and imitate the real customer site: OsTickit's home with Open a New Ticket and Check Ticket Status, the Zendusk Help Center, the Freshdusk support portal. FreeScoot has no customer side, as the real product has none without a module. A portal adds a second ticket source: a share of customers open tickets through the form when the desk is reachable (`via: "web"`), and such tickets need no mailbox. The form and the status lookup by email and number are simulation actions in M7 that every portal calls. If the desk is down the customer writes by email instead. The knowledge base page reuses `kbArticles` and the company site's article view. The Knowledge base Pear Store item keeps controlling deflection, and each desk's knowledge base screen shows the article reads that `KnowledgeBaseApp.tsx` shows now.

### Reports and SLA

SLA is read from `dueAt`, which is the customer's own expectation by profile. The simulation derives first response time, SLA hit rate and counts per agent and per kind (M8), and each desk draws them on its own report screen. Each desk shows the timer as the real product does: due date and an Overdue tab (OsTickit), a next-reply timer (Zendusk), due-by and overdue views (Freshdusk), a waiting-since column (FreeScoot, which has no SLA). The SLA page lists the plan names with the hours from the profile table and edits nothing in the foundation. `slaTimers` gates the timers.

## The four desks

| Desk | Real counterpart | Hosting | From | Looks |
|---|---|---|---|---|
| OsTickit | osTicket | self-hosted, free | 2005 | classic 1.6 tables and tabs (to 2015), 1.10 flat blue (2016), current (2022), by installed version |
| Zendusk | Zendesk | hosted, per seat | 2007 | 2007 classic, Lotus tabbed agent UI (2012), current workspace (2019), by calendar year |
| Freshdusk | Freshdesk | hosted, per seat | 2010 | 2010 first look, flat blue with properties sidebar (2014), new UI (2019), by calendar year |
| FreeScoot | FreeScout | self-hosted, free | 2018 | clean light shared inboxes (2018), refreshed (2026), by installed version |

The real version and release data go into `docs/design/software-versions.md` before M10 to M13, the way the panels were done. The page sets below are the plan's starting point; the research pass corrects them against the products.

- **OsTickit** (`ostickit/`, three version looks).
  - Customer side: the home page with Open a New Ticket and Check Ticket Status, the new ticket form (help topic, name, email, subject, message), the confirmation page, Check Ticket Status by email and number leading to the ticket view with a reply box, and the Knowledgebase with FAQ categories.
  - Staff Control Panel: login; Dashboard with the Ticket Activity report; Tickets with the queues Open, Answered, Overdue, My tickets and Closed (counts in the tab labels), search and Advanced search, mass actions; the ticket page with a details table, the thread, Post Reply and Post Internal Note, the canned response and signature selects, the status select, Dept. Transfer, Assign, Ban Email, link or merge, Print; New ticket for phone requests; Knowledgebase; Directory; Preferences.
  - Admin Panel: Dashboard with System Logs; Settings (System, Tickets, Emails with fetching and the autocron switch, Autoresponder, Alerts and Notices); Manage (Help Topics, Ticket Filters, SLA Plans, Pages); Emails (addresses with fetch settings and send-test, Banlist, Templates, Diagnostic); Staff (Agents, Teams, Departments). The red warning about the setup directory sits on its dashboard.
  - Versions: the Tasks tab and "Agents" naming from 1.10, the Users tab from 1.8, and the pages each version adds.
- **Zendusk** (`zendusk/`, three calendar looks).
  - Help Center: home with search and categories, article pages, Submit a request, My activities with the request page and comment box, sign in.
  - Agent workspace: Home; the Views list (your unsolved, unassigned, all unsolved, recently updated, pending, recently solved, suspended); the ticket list; the ticket page, with tabs per open ticket in the Lotus era, properties (requester, assignee, CCs, tags, type, priority) on the left, the user profile and related tickets on the right, the public reply and internal note toggle, Apply macro, and the Submit as Open, Pending, On-hold or Solved button; Users and Organizations; Reporting (Reports, later dashboards); Search.
  - Admin: Channels (Email with Support addresses and the forwarding verification, Help Center and host mapping), People (Team members, Groups, Roles), Business rules (Triggers, Automations, Macros, Views, SLA policies), Account (Subscription and seats, Cancel), Apps and add-ons (Zendusk Guide, Talk and Chat as upsell tiles), AI agents.
- **Freshdusk** (`freshdusk/`, three calendar looks).
  - Support portal: home with search, Solutions categories and articles, Submit a ticket, My tickets with the ticket page and reply.
  - Agent portal: Dashboard with the activity feed and unresolved widgets; Tickets with the views list, bulk actions, search and New ticket; the ticket page with the Ticket properties sidebar (requester, type, status, priority, group, agent, tags, due by), the toolbar Reply, Forward, Add note, Merge and Close, and More with Scenarios; Customers (Contacts and Companies); Solutions; Reports.
  - Admin: General, Email (Support emails by forwarding or IMAP, notifications), Helpdesk productivity (Canned responses, Scenario automations, creation, time and update rules, SLA policies), Agents, Groups, Customer portal, Account (plan and seats), Freddie.
- **FreeScoot** (`freescoot/`, two version looks).
  - No customer side: `/` is the login and customers write by email.
  - Mailbox view: the mailbox picker, folders Unassigned, Mine, Starred, Drafts, Assigned, Closed and Spam, the conversation list, the conversation page (Customer, Agent and Note blocks, Reply, Note, Phone conversation for the phone upgrade, Assign, Status, Merge, Move, Follow, Delete, saved replies, a customer sidebar with earlier conversations), Customers, Search, Reports.
  - Manage: Settings, Mailboxes (incoming and outgoing connection, fetch status and test, auto reply, saved replies, signature, permissions), Users, Modules (the paid modules Satisfaction Ratings, Live Chat, End-User Portal, Knowledge Base and Workflows are the upgrade path), Logs (the fetch log), System (cron status, version, update).

Features follow the real products. The vocabulary stays `DeskFeature` (`filters`, `search`, `assign`, `templates`, `slaTimers`, `customerSidebar`, `reports`, plus the new `merge`, `departments`, `rules`, `portal` and `ai`), but each flag now starts, per desk, when the real product got it: a calendar year for the hosted desks, the release that introduced it for the self-hosted ones. The earlier gates, such as OsTickit with kind filters only, fall away. The exceptions that stay are real ones: FreeScoot has no SLA timers, rules or portal, and only the hosted desks have AI.

| Flag | OsTickit | Zendusk | Freshdusk | FreeScoot |
|---|---|---|---|---|
| filters, search, assign, templates | from its first release | from launch | from launch | from launch |
| slaTimers | from the release with SLA plans (1.6) | from SLA policies | from launch | none |
| customerSidebar | from the release with a users directory (1.8) | from launch | from launch | from launch |
| reports | dashboard statistics | from launch | from launch | from launch |
| merge | from the release that adds it | from launch | from launch | from launch |
| departments | yes | groups | groups | no (mailboxes) |
| rules | ticket filters | triggers and automations | creation, time and update rules | none |
| portal | yes | Help Center | yes | none |
| ai | none | by the AI table | by the AI table | none |

M2 settles every date in research, rewrites the Support desks table and text in `economy.md` and the Support desks paragraph in `gdd.md`, and updates `tests/support-desks.test.ts`. What the hosted desks sell afterwards is uptime, the AI add-ons and the later channels (chat, phone). What the self-hosted desks cost is a web space, an install, upgrades, the risk of losing the host and the data, and the time to run them.

## AI on the hosted desks

Zendusk and Freshdusk offer AI in the years their real counterparts did. The years below are placeholders; M2 replaces them with researched ones.

| Feature | Real analogue | Year | What it does |
|---|---|---|---|
| Suggested articles | article suggestions in the help center form and in the agent sidebar | 2014 | A customer who fills in the ticket form sees articles for the topic and some read one instead of writing in, on top of the Knowledge base item's deflection. The agent sidebar shows the article behind the ticket's topic. |
| Answer bot | Zendesk Answer Bot, Freshdesk's Freddy bot | 2018 | Answers basic how-to tickets with an article reply before an agent sees them. A solved ticket costs a per-resolution fee; an unsolved one continues with its original due time and no runaround penalty. |
| Generative auto-answer | AI agents | 2023 | The behaviour of ChadGPT Support moves here: how-to and billing tickets, right with P = 0.6 and 0.5, up to four replies of its own, a runaround penalty of -10 when it gives up, around the clock at twice the base rate, billed in tokens as one monthly ledger line, plus a monthly add-on fee. It replaces the answer bot while it is on. |
| Reply drafting | AI reply suggestions, copilot | 2023 | The ticket pane shows a draft for how-to and billing tickets: the right template with the same probabilities, otherwise a plausible wrong one. Sending the draft is one click, choosing another reply is the usual picker, and each draft costs tokens. |

- All of it sits behind an AI page in the admin of the desk (Zendusk AI agents, Freshdusk Freddie) with a switch per feature and the month's usage. The token and price model of `src/sim/47-staff/chad.ts` is reused unchanged; `economy.md` gets the answer bot's price per resolution and the add-on fees.
- The generative auto-answer appears as a bot agent, assignable and listed in the Staff app with its usage facts. It works only while the hosted desk is up, which a hosted desk always is.
- The AI add-on needs the Automation skill, like the bots it replaces (Open decision 11).
- Self-hosted desks have no AI page and no module that adds one.

## Names

Every real company and product in this lane is a pun, and the code, tests and copy use only the pun.

- Desks: OsTickit (osTicket), Zendusk (Zendesk), Freshdusk (Freshdesk), FreeScoot (FreeScout). Their sites: `ostickit.com`, `zendusk.com`, `freshdusk.com`, `freescoot.net`.
- Add-ons of the upgrade path: Zendusk Guide, Zendusk Talk and Zendusk Chat. AI features: Zendusk Answer Bot and Zendusk AI agents, and Freshdusk's assistant Freddie. Freshdusk names its knowledge base Solutions. FreeScoot modules are named by what they do (Satisfaction Ratings, Live Chat, End-User Portal, Knowledge Base, Workflows).
- Existing puns this lane touches: Pear Mail, Pear Store, GMix, Goggle Workspace, Lookout 365, Hosted Exchange by Ionose, Postfixit, Mailpig, Strateaux, Fantastiko, Softaculus, ChadGPT Support, Searchlight, KeePassive and the Lexwear Helpdesk link. ChadGPT Support leaves the shop; its name survives only in the old ledger lines of saves that used it.
- Words that name a feature and not a company (Views, Macros, Triggers, Canned responses, Scenarios, Saved replies, Help topics, Departments) stay as the real products write them. Brand-named rules are written as plain words (dispatch, time and update rules).
- Open decision 10 asks for the final add-on names and the pun of the Help Scout ancestor that FreeScoot copies, which appears only if the game mentions it.

## Staff and bots

- Employees with the support role are the desk's agents; bots are listed as bot agents and can be assigned. After ChadGPT leaves, the only bot agent a desk can show is the generative auto-answer of a hosted desk (see AI on the hosted desks); Clipsy Reminders stays a bookkeeping bot. The Agents page shows each agent's department membership and current queue (`busyUntil`, tickets assigned).
- Employees do not log in. The player is the one admin agent.
- Hosted desks keep the seat price rule. Self-hosted desks cost no seats.
- Priority order for staff is priority first, then `dueAt`. `npm run balance` verifies the change does not move the curves.

## Upgrade path

The foundation stores hooks for these, so each one is a new milestone and no rewrite.

| Upgrade | Real analogue | Hook in the foundation | What it adds later |
|---|---|---|---|
| Live chat | Zendusk Chat, Freshdusk chat, FreeScoot Live Chat module | `Ticket.via`, `DeskState.addons.chat` | chats arrive as tickets with a short timer, agents need to be online |
| Phone queue | Zendusk Talk, FreeScoot phone conversations | `via: "phone"`, `DeskState.addons.phone` | calls ring, the player's `playerBusyUntil` decides who answers, missed calls become tickets |
| Customer satisfaction | satisfaction ratings | `Ticket.rating?`, a resolve hook in `tick.ts` | rating requests after solve, scores in Reports, happiness effect |
| Multiple brands | Zendusk multibrand | `Department.host?`, `DeskState.brands` | a portal and support address per additional company domain |
| SLA policies | Zendusk and Freshdusk SLA | `Department.slaId`, the SLA page | policies by priority that drive timers and breach events |
| Workflows | FreeScout Workflows module, Zendusk automations | `DeskState.rules` | conditions and time-based rules |
| Plan tiers | Zendusk and Freshdusk plans | `DeskState.hosting.plan` | features unlock by plan, price per tier |
| End-user portal | FreeScout End-User Portal module | the `portal` flag and the Modules page | a customer side for FreeScoot |
| Further AI | agent assist, sentiment, voice bots | `DeskState.ai` and the AI page | more switches on the AI page, priced as add-ons |

## Failure modes

- A self-hosted desk shares its host's fate: down with the host, slow when the host is crowded, and lost when the disk is lost without a usable backup (`web-presence`'s `self-host-loss`). A lost desk loses its configuration. Open tickets whose mail the channel deleted from the server are lost with a happiness hit; tickets whose mail stayed on the server come back when the channel is added again. This is why "delete from server" is a choice with a price.
- A hosted desk costs the seat price every month and stops when the subscription is cancelled.
- A channel whose mailbox lost its protocol, or whose mail host is down (the mail waits in the `mail-core` queue), shows the failed fetch on the Channels page.
- An unsupported self-hosted version collects vulnerabilities through the `lifecycle` lane, and a breach exposes the customer list.

## Old saves

A save with a desk in `s.installed` and no `s.desk` loads with a legacy desk: hosting `legacy` (up always, no seat change), one channel on the primary mailbox (before `mail-core` lands, a built-in stand-in channel), every existing ticket fetched at its creation hour with a `ref`, one department "Support". The Pear Store item remains in `s.installed` for billing until the player cancels. A save without a desk gets `s.desk = null`. Tickets get the defaults of the table above. A save with the ChadGPT Support subscription loses it: `deserialize` removes `chadGpt` from `s.installed` and drops `chadUsage`, and the old ledger lines keep their text. Old saves need to load and nothing more.

## Shared hotspots

| File | Edited by this lane | Rule |
|---|---|---|
| `src/sim/50-state.ts`, `newGame` | one key `desk` in its own commented line; `chadUsage` is removed in M16 | default null |
| `src/sim/42-mail/` | extra `DeskChannel` fields, `applyAfter`, `adoptMessage` | agreed with `mail-core`; the type stays in its file |
| `src/sim/91-save/save.ts` | one `fillDesk` call, function in `91-save/desk.ts` | fills ticket fields and the legacy desk |
| `src/sim/40-support/tickets.ts` | optional ticket fields, new kind `spam` | appended; `mail` and `spam` skip the penalty |
| `src/sim/47-staff/staff.ts`, `chad.ts` | `answerTickets` ordering (M7); `BOTS`, `activeBots` and the `billChadUsage` call, and `chad.ts` becomes `deskai.ts` (M16) | separate functions |
| `src/sim/balance/model.ts`, `src/sim/10-catalog/research.ts` | the bot model and the Automation unlock text (M16) | |
| `src/sim/80-business/browser.ts` | `Page` union, three host lines | one block |
| `src/sim/88-tick/tick.ts` | one `deskTick` call | own line |
| `src/sim/10-catalog/store.ts`, `desks.ts` | desk items leave the Pear Store catalog; desk catalog grows | `install(id)` keeps working for saves and old tests |
| `src/sim/90-actions/index.ts` | one export line for `desk.ts` | |
| `src/ui/apps/support/` | `Thread` renders the headless `ReplyPanel` and `TicketPane` from `browser/sites/desk/headless/` (M1); `SupportApp.tsx` is deleted in M14 | `mail-client` imports the headless pieces, never SupportApp |
| `src/ui/apps/browser/sites/desk/` | `DeskSite.tsx` (dispatcher), `headless/`, and one folder per desk | a desk folder never imports another desk's folder |
| `src/ui/apps/shop/Software.tsx`, `src/ui/apps/staff/StaffApp.tsx` | the desk shelf leaves the Pear Store (M4); the ChadGPT tile and usage facts go (M16) | |
| `docs/design/economy.md`, `docs/design/gdd.md` | Support desks (M2), AI bots and ChadGPT usage (M16) | |
| `src/ui/store.ts` | `openApp("Support")` router, like the `Chat` special case | one branch |
| `src/ui/apps/browser/BrowserApp.tsx`, `Favicon.tsx` | `desk` and vendor cases | one line each |
| `src/i18n/` | `ui-desk.ts`, `ui-desk-ostickit.ts`, `-zendusk.ts`, `-freshdusk.ts`, `-freescoot.ts`, `ui-desk-sites.ts`, `ui-desk-ai.ts` | mirrors in `de`, `es`, `fr`, `it`, `pt` |

## Milestones

Each milestone is one pull request, green on `npm run typecheck`, `npm test` and `npm run build`, with `npm run balance` where noted. Every milestone adds one or two lines to `CHANGELOG.md`.

**M1. Headless reply panel and ticket pane.**
- Sim: none.
- UI: move the logic of `Thread` into `src/ui/apps/browser/sites/desk/headless/` as `useTicketReplies(game, ticket)`, `useTicketPane(game, ticket)` and the headless `ReplyPanel` and `TicketPane`. They hold the templates with previews, retention offers, actions with their amounts, the domain transfer answer, Resolve and Close, the thread items, notes, events and properties, and they render only the slots they are given. `SupportApp` uses them with no visible change. `useTicketReplies` takes a third argument, `previews`, which shows every template with its text (the desk feature `templates`); without it the model holds the three `shownTemplates` titles a mail client shows. Both hooks are plain functions of the state, so tests call them directly. Pear Mail's Response list and resolve banner use `useTicketReplies` when `mail-client` builds the client.
- i18n: none; existing keys.
- Tests: `tests/support-reply-model.test.ts` for the hooks' output per kind (howTo, billing, cancellation, refund, domain transfer), and the existing support suites unchanged.

**M2. Desk catalog, routes, tokens and features.**
- Sim: `desks.ts` gains `hosting`, `hosts`, `refFormat`, per-desk page tables, `DESK_ROUTE`, and features with a start per desk (year or release); `80-business/deskroutes.ts` with a `DeskPage` union per desk, `deskPath` and `parseDesk`; `refToken`, `priorityOf` and the status label tables as data; the AI years as data; research rows for the four products in `docs/design/software-versions.md`.
- Docs: `economy.md` Support desks table and text rewritten to the per-desk, per-era feature sets of The four desks, and the Support desks paragraph in `gdd.md`.
- UI: none.
- i18n: none yet.
- Tests: `tests/desk-catalog.test.ts` (every page of every desk round-trips, `parseDesk` rejects other desks' paths, token formats, priority table, a feature starts in the researched year), and `tests/support-desks.test.ts` rewritten from the old gates to the new ones.

**M3. Desk state, ticket fields, old saves.**
- Sim: `DeskState` (`id`, `hosting`, `departments`, `rules`, `addons`, `tenant`; channels live in `s.mail.channels` of `mail-core`), `s.desk`, ticket fields with defaults, `fillDesk` for old saves and the legacy desk, `deskStatus`, `deskReachable(s, ticket)`, `closeTicket` and `supportTick` for customerless kinds, `resolve()` returning `notfound` for `support.<domain>` until a desk exists.
- UI: none.
- i18n: error keys.
- Tests: `tests/desk-state.test.ts` (new game defaults, old save with a Pear Store desk loads and keeps every ticket visible, old save without a desk, status of a hosted and a self-hosted desk), edits to `tests/support-desks.test.ts`.

**M4. Install and subscribe.**
- Sim: `subscribeDesk(tenant, deskId)` for hosted desks with the existing per-seat billing and first month at once; `installDesk(clusterId, deskId)` for self-hosted ones as machine id `desk` on a web space; `removeDesk`; switching drops configuration and keeps tickets; welcome mail through mail-core; desk items leave the Pear Store catalog.
- UI: vendor sites `zendusk.com` and `freshdusk.com` (marketing, pricing, sign-up, one look per era), software sites `ostickit.com` and `freescoot.net` in the software site pattern, a tile in the app catalogue (and a stand-in install form in `HostSettings.tsx` until `app-catalogue` exists), the Pear Store shelf removed. The installer and the onboarding screens belong to each desk's own app (M10 to M13).
- i18n: `ui-desk-sites.ts`.
- Tests: `tests/desk-install.test.ts` (refusal without cash, seat price, one desk at a time, self-hosted install needs a web space, switching keeps tickets), plus the news-unlocks suite.

**M5. Domain records and reachability.**
- Depends on: `webmail-consumer` M2 (company zone and registrar DNS page). Without it this milestone waits.
- Sim: `deskRecords(s)` lists the records the installed desk needs (`A support`, or `CNAME support` plus the vendor's SPF and DKIM records) and reads them with `recordAt`; `deskReachable` by record for `support.<domain>`, the tenant URL always for hosted desks, sender-domain state, a Verify action. No new zone state.
- UI: none of its own. Each desk's admin shows the host mapping and domain records page in its own style (M10 to M13): the records to add as copyable rows, status chips, Verify, and a link to the registrar DNS page.
- i18n: keys in `ui-desk.ts`.
- Tests: `tests/desk-records.test.ts` (records listed per desk, resolves with and without the record and before the TTL has passed, hosted tenant URL, Verify result, an old save).

**M6. Channels and fetch.**
- Sim: `addChannel`, `setChannel`, `removeChannel`, `testChannel` over `s.mail.channels`; `deskTick` import: IMAP and POP3 at the hour, forwarding at once, `ref` assignment, `channelId`, department, rules, auto-reply, the channel's `after` rule through `applyAfter`, ticketless messages adopted as kind `mail`, a queued message waits; replies reach Sent through `sentCopy`; `deskImports` and `deskHandles` for the clients. Until `mail-core` lands the built-in stand-in channel treats every ticket as fetched.
- UI: none of its own. Each desk's channel screens are part of its app (M10 to M13).
- i18n: keys in `ui-desk.ts`.
- Tests: `tests/desk-channels.test.ts` (import order and refs, a follow-up after a wrong answer stays in its ticket, an adopted ticketless message, POP delete versus IMAP keep, queued mail waits, test email, `deskHandles` while the desk is down).

**M7. Desk work actions, staff rules and web tickets.**
- Sim: `assignTicket` accepts `"owner"`; departments and `autoAssign`; `mergeTickets`, `markSpam`, `addNote`, `setPriority`, `setDepartment`; rules at import; `answerTickets` ordering (assigned, department, open) and the `deskReachable` condition, with priority first and `dueAt` inside one priority; `submitWebTicket` and `lookupTicket` for the customer pages, with the share of web tickets while the desk is reachable; the data hooks `useDeskTickets(view)` and `useDeskViews()`.
- UI: none; the desk apps use the actions and hooks.
- i18n: error keys.
- Tests: `tests/desk-work.test.ts` (merge of three outage tickets, one wait penalty, merged outcome, spam, owner queue skipped by staff, department membership, desk down blocks channel tickets but not mailbox ones, a web ticket needs no mailbox, none while the desk is down, lookup needs the right email). `npm run balance` must show no change in the curves.

**M8. Report data and SLA.**
- Sim: first response time, SLA hit rate against `dueAt`, counts per agent, kind and month, `slaPlans(s)` from the profile table, all derived from tickets and replies.
- UI: none; each desk draws its own report screens.
- i18n: none.
- Tests: `tests/desk-reports.test.ts`.

**M9. Dispatcher and Support launcher.**
- Sim: none.
- UI: `DeskSite.tsx` maps the host and path to a desk app through a registry and renders the down and not-found states. `openApp("Support")` is a router like the Chat special case: a ticket opens at its page in the desk when the desk's app exists, in Pear Mail otherwise; the tile is hidden until a desk exists, shows the desk's mark afterwards and keeps the open-ticket badge. `useFocus`, Searchlight hits, the widget and the Getting started steps follow. A desk whose app has not landed yet still opens the old Support window, which lists only the mail kinds the mail client does not render.
- i18n: `ui-desk.ts` for the dispatcher states.
- Tests: `tests/desk-site.test.tsx` (host and path map to the right app, down and not-found states, the launcher routes each state).

**M10. OsTickit.**
- Sim: none.
- UI: `sites/desk/ostickit/` is a web app with its own router, markup, CSS and logo from `OsTickitMark`. It holds the installer at `/setup`, the customer side, the Staff Control Panel and the Admin Panel listed in The four desks, in three version looks (1.6, 1.10, current) where the page set also changes with the version. It registers itself in the dispatcher.
- i18n: `ui-desk-ostickit.ts` and the mirrors.
- Tests: `tests/desk-ostickit.test.tsx` (every page of every version renders, the queue tabs count the right tickets, a reply from the ticket page has the same outcome as the old thread, Ban Email, adding a channel on the Emails page, the setup warning, a customer form ticket arrives as a web ticket).

**M11. Zendusk.**
- Sim: none.
- UI: `sites/desk/zendusk/` is a web app: the Help Center, the agent workspace, the admin and the sign-up completion at the tenant URL, in three calendar looks (2007, Lotus, workspace). It includes the Support addresses forwarding flow, the Views, Apply macro, the Submit as button, host mapping and the add-on tiles.
- i18n: `ui-desk-zendusk.ts` and the mirrors.
- Tests: `tests/desk-zendusk.test.tsx` (pages per look, forwarding verifies after the rule and the first message, views count, macro and submit as behave like the old reply and actions, suspended tickets).

**M12. Freshdusk.**
- Sim: none.
- UI: `sites/desk/freshdusk/` is a web app: the support portal, the agent portal with the Ticket properties sidebar, the admin including Support emails, canned responses, Scenario automations and the three rule types, in three calendar looks (2010, 2014, 2019).
- i18n: `ui-desk-freshdusk.ts` and the mirrors.
- Tests: `tests/desk-freshdusk.test.tsx` (pages per look, properties change assignment and priority, scenarios run actions, rules route at import).

**M13. FreeScoot.**
- Sim: none.
- UI: `sites/desk/freescoot/` is a web app: the login, the mailbox view with folders, the conversation page, Customers, Reports and Manage with Mailboxes, Users, Modules, Logs and System, in two version looks (2018, 2026). The Modules page lists the paid modules as the upgrade path and offers none of them yet.
- i18n: `ui-desk-freescoot.ts` and the mirrors.
- Tests: `tests/desk-freescoot.test.tsx` (folders count correctly, a mailbox form adds a channel, there is no customer side, the fetch log shows the fetches).

**M14. Retire the old Support window.**
- Sim: none.
- UI: delete `SupportApp.tsx`, `Thread`, `OrderThread` leftovers that the mail client now renders, the fallback in the launcher, and the desk rules in `mail-styles.css`, `support.css` and the `MAIL`, `GMIX` and `PEAR` constants in `support/desk.ts`; the provider rules go to the mail lanes.
- i18n: remove the keys nothing uses, in every language.
- Tests: the launcher test drops the fallback; `tests/i18n.test.ts` passes.

**M15. AI on the hosted desks: suggested articles and answer bots.**
- Sim: `DeskState.ai` (switches and usage), the AI years from M2, suggested-article deflection on the customer form added to `KB_DEFLECT`, the answer bot answering basic how-to tickets before an agent sees them, the per-resolution fee as a ledger line, and no AI on self-hosted desks.
- UI: the AI pages in the Zendusk and Freshdusk apps, the article suggestion on the customer form and in the agent sidebar.
- i18n: `ui-desk-ai.ts` and the mirrors.
- Tests: `tests/desk-ai-articles.test.ts` (nothing before the researched year, self-hosted desks have none, deflection and kbReads, the fee only on a solved ticket, an unsolved ticket keeps its due time and costs no runaround).

**M16. Generative AI and the end of ChadGPT.**
- Sim: the token model of `chad.ts` moves to `deskai.ts` and drives the generative auto-answer (how-to and billing, P = 0.6 and 0.5, four replies, runaround -10, around the clock) and reply drafting from 2023 on hosted desks, billed as one monthly ledger line plus the add-on fee. `chadGpt` leaves `STORE`, `BOTS` and `activeBots`, which now derive the desk's AI agent from `s.desk.ai`. `chadUsage` leaves `GameState` and `newGame`. `deserialize` removes `chadGpt` from `s.installed` and drops `chadUsage`, so old saves load without the bot. The key `ledger.chadUsage` stays for old ledger lines and the new line is `ledger.deskAi`.
- UI: the ChadGPT tile leaves the Pear Store, `StaffApp` shows the desk's AI agent with its usage facts and a link to the desk's AI page, the AI pages gain the generative switches and the usage, the ticket pane shows the draft.
- Docs and balance: `economy.md` (AI bots table row, ChadGPT usage section renamed Desk AI usage, the balance section), `gdd.md` line on the Automation skill, `research.ts` unlock text, and `src/sim/balance/model.ts`. From 2005 to 2022 the game has no auto-answer, so `npm run balance` is rerun and the solo bot is retuned.
- i18n: `ui-desk-ai.ts`, and the shop and staff keys for ChadGPT removed in every language.
- Tests: `tests/chad-usage.test.ts` becomes `tests/desk-ai.test.ts` with the same checks on the desk's AI agent (attempts and tokens per reply, runaround after four tries, the monthly line, cost per solved ticket against an agent), and adds: no generative AI before 2023, none on self-hosted desks, the draft is right with the stated probabilities, an old save with ChadGPT installed loads without the bot or a usage line.

**M17. Spam and noise.**
- Sim: junk that passes the provider's filter reaches the imported mailboxes at the amounts `mail-core` generates, and the desk adopts it as `spam` tickets with no customer and no timer; the desks' own filters (Zendusk's spam detection files most into Suspended, Freshdusk into Spam, OsTickit and FreeScoot rely on the mailbox filter and the ban list); false positives, where a real customer message is filed as spam and the customer's wait penalty runs once its due time passes unless the player recovers it; spam types (search-engine and web design offers, fake invoices and domain renewal scams, lottery and pharma, cold vendor mail). Out-of-office noise exists only with an autoresponder on our side, a desk auto-reply or a mailbox vacation reply: the customer's own autoresponder answers it, and on a desk without loop detection each answer opens a new ticket and triggers another auto-reply, until the guard stops it or the player turns the autoresponder off. A single out-of-office notice on a manual reply adds a note and opens no ticket. Also here: "thanks" replies that reopen solved tickets and chasers (Open decision 4), desk data loss with the `self-host-loss` lane, vendor incidents for hosted desks, and the deliverability effect of Open decision 3.
- UI: the Spam, Suspended and ban list views of each desk fill up and offer Recover, Ban and Delete; incident banners.
- i18n: keys in `ui-desk.ts` and the desk files.
- Tests: `tests/desk-noise.test.ts` (spam amounts per year, false positives recover, no out-of-office loop without an autoresponder, a loop with a desk auto-reply and no guard, the guard stops it, a vacation reply starts one), with `npm run balance`.

Build order: M1 to M3 can start now and run in parallel. M4 follows M3. M5 needs `webmail-consumer` M2 (the company zone), and M6 needs `mail-core` M4; before that, M6 ships with the stand-in channel. M7 follows M3 and M8 follows M6. M9 follows M1, M3 and M7. M10 to M13 follow M5 to M9 and run in parallel, each owning its folder, CSS and i18n files. M14 follows the last of them. M15 follows M11 and M12. M16 follows M15. M17 follows M10 to M13 and `mail-core`'s junk milestone, and is last.

## What this lane needs from mail-core beyond the contract

Used as `mail-core.md` defines them: `Message.ticket` and `Message.thread`, `MailRole` and `roleAccount`, `sentCopy`, `MailAccount.forward` and `setForward`, the delivery queue for a down host, `Message.junk`, `DeskChannel` with its `after` rule, and the refusal to delete a mailbox a channel reads.

1. When the `after` rule runs. `mail-core` applies it at delivery. The desk needs it at import so the fetch interval is visible, which means an exported `applyAfter(s, channel, messageId)` called from `deskTick`, and delivery applying it at once only for forwarding channels.
2. Adopting a ticketless message. A function `adoptMessage(s, accountId, messageId)` that creates a ticket of kind `mail` whose envelope is that message, for the clutter of an imported `info@`.
3. A forwarding target that is a desk. `setForward` must accept `<name>@<tenant>.zendusk.com` or the Freshdusk equivalent and deliver into the matching channel at once, so Zendusk's support address verifies the way the real one does.
4. Protocol capability per plan. `MAIL_HOSTS[plan]` gets flags for IMAP, POP3 and SMTP, so a channel can refuse a plan without the protocol, and the real gotchas (IMAP switched on, app passwords on modern providers) can follow later.
5. Web tickets have no envelope. `sentCopy` needs a fallback mailbox for a ticket without one: the mailbox of its department's channel.
6. The subject token. The subject renderer for a ticket envelope and its Sent copies appends `subjectToken(ticket)` when the ticket has a `ref`.
7. Company zone. Built by `webmail-consumer` M2, not by this lane. This lane only reads it through `recordAt` and links to the registrar DNS page.
8. The clients call `deskImports(s, accountId)` and `deskHandles(s, ticket)`, which this lane exports from `src/sim/40-support/desk.ts`, to switch between the Response list and the "Handled in the support desk" banner.
9. Staff mail. A reply sent by an employee with a mailbox appears in that mailbox's Sent (already planned). The desk shows the same name.
10. Vacation replies. `vacationOn(s, accountId)`, read from the vacation rule of the account's `ServerFilter` set that the webmail lanes edit, so the desk can tell when a mailbox has an autoresponder on. Out-of-office noise exists only when that or a desk auto-reply is on (M17).
11. Junk that passes the filter. `mail-core` keeps `Message.junk` on mail that reached an Inbox and exposes the leak per mailbox and day (more for an address on the website or in a registrar record), so the desk adopts it as spam tickets at realistic amounts.

## Decisions taken in this plan

Decided by the user:

1. Each desk follows the real product with its real differences. Each is its own web software with its own pages, navigation and admin screens, not one shell with skins. The shared part is non-visual: actions, data hooks, and the headless `ReplyPanel` and `TicketPane`. `economy.md` desk features are updated in M2.
2. The hosted desks, Zendusk and Freshdusk, gain AI features in their real years: suggested articles and answer bots from their real launch years, and generative auto-answer and reply drafting from 2023. Auto-answer replaces the ChadGPT Support bot, which leaves the shop and the simulation in M16, and old saves with a ChadGPT subscription load without it. Self-hosted desks get no AI.
3. Spam tickets are realistic. Out-of-office loops happen only when an autoresponder is enabled, either a desk auto-reply or a mailbox vacation reply.

Settled in `mail-suite.md`:

4. The Support app keeps its id and its dock tile, and becomes a launcher: hidden until a desk exists, then a pinned tab that opens the desk site in the Browser. Before a desk exists, ticket notifications open the message in Pear Mail.
5. A ticket stays a ticket. Its email is an envelope message in the mailbox of its role, and before a desk exists the player answers it from that message with the existing templates, scoring and work minutes.
6. The company DNS zone is built once, in `webmail-consumer` M2, and this lane adds the `support.` records to it.
7. `mail-core`'s names win: app id `Pear Mail`, client state `s.pearMail`, server verbs `moveMessages`, `markMessages`, `deleteMessages`, `sendMessage`, `listFolder`.

Decided in this plan:

8. Desks are third-party software: they leave the Pear Store. Hosted desks are bought on the vendor's site, self-hosted ones come through the app catalogue.
9. A ticket and its Message are one thing seen two ways. Importing a mailbox into a desk changes visibility, never gameplay state.
10. Employees work desk tickets only while the desk is up. The player can always answer from the mailbox.
11. Looks follow the installed version for self-hosted desks and the calendar for hosted desks.
12. The editor in a reply is locked to the template text.
13. The ticket number shown by the desk is `ref`. The id `tkt<n>` stays internal.
14. The company site's Knowledge base stays the single source of articles and reads.

## Open decisions

Each recommendation is the planner's; the decision is the user's.

1. Hosted plans. One plan per desk now, with a 30-day trial, or plan tiers (starter, regular, plus) at once? Recommended: one plan now, tiers in the upgrade path.
2. Typed notes. Free text typed by the player, or generated notes only? Recommended: typed.
3. Deliverability. Should an unverified sender domain delay customer replies (reusing `MAIL_DELAY_HOURS`)? Recommended: yes, in M17.
4. "Thanks" replies that reopen solved tickets and customers who chase an overdue ticket with a new message: in the game, and how often? Recommended: yes, rarely.
5. Importing `info@` or any other box into the desk fills the queue with mail tickets. Recommended: allow it, as real helpdesks do.
6. Switching desks drops configuration. Recommended: keep it, as a cost of switching, with no migration tool.
7. Customer-side tickets: what share of tickets should come through the portal when it exists (recommended 25 percent), and may the player submit test tickets as a customer?
8. The Pear Store Knowledge base item (10 euros a month): keep as the deflection switch, or include a built-in knowledge base in the desks that have one in real life?
9. Balance. From 2005 to 2022 the game has no auto-answer once ChadGPT leaves, which lowers the solo bot's curve until M16 retunes it. Recommended: accept this and retune in M16.
10. Names. Add-ons (Zendusk Guide, Zendusk Talk, Zendusk Chat), the AI names (Zendusk Answer Bot, Zendusk AI agents, Freddie), and the pun for the Help Scout ancestor of FreeScoot.
11. The AI add-on and the generative bot need the Automation skill, like the bots they replace. Recommended: keep the requirement.
