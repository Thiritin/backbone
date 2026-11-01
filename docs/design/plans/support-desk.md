# Support desk on the web

Status: planned. Milestones M1 to M16. Related design: `docs/design/gdd.md` (Support, Support desks), `docs/design/economy.md` (Pear One subscriptions, Tickets and work rates), `docs/design/shop-surfaces.md` (the surface list this plan copies for desks), `docs/design/plans/shop-software.md` and `web-presence.md` (install onto a web space, the app catalogue, Strateaux), `docs/design/plans/shop-portal.md` (one site, several software skins), `docs/design/plans/software-licences.md` (versions, free software ages). The mail lanes `mail-core`, `mail-client`, `webmail-consumer` and `webmail-server` are planned in parallel; this plan uses the names of `mail-core.md` (`MailAccount`, `Message` with its `thread` and `ticket` fields, `DeskChannel`, `MailRole`, `roleAccount`, `sentCopy`, `deskImports`) and lists what it needs beyond them at the end. The company DNS zone is built once by `webmail-consumer` M2 (`company-zone`, with the registrar DNS page), and M5 of this lane adds the `support` records and reachability on top of it. Where a name in this plan differs from `mail-core.md`, the `mail-core` name wins (app id `Pear Mail`, client state `s.pearMail`, server verbs `moveMessages`, `markMessages`, `deleteMessages`, `sendMessage`, `listFolder`).

## What changes

Today the Support app is one window with two modes. Without a desk it is a plain inbox that mixes customer requests, vendor mail, orders, sponsor offers and Pear letters. With a desk (a Pear Store item charged per seat) it gains filters, search, assignment, templates, timers, a customer card and reports. After this plan:

- Customer support requests are tickets, and tickets live in a support desk, which is a website. Everything else that arrives by email (bank, vendors, registrars, licence keys, partners, sponsors, orders) stays in mailboxes and is read in webmail or Pear Mail.
- The desk runs at `support.<company domain>` (for example `support.pxl-hosting.de`) in the Browser. It has a staff side (`/scp` for OsTickit, `/agent` for Zendusk, and the equivalents for the others) and a customer side where customers open and follow tickets. Each of the four desks has its own look per era and imitates its real counterpart.
- OsTickit and FreeScoot are self-hosted: the player installs them onto a web space, and the desk is down when that host is down. Zendusk and Freshdusk are hosted: the player subscribes on the vendor's website and picks a tenant name. A desk needs a DNS record for `support.<company domain>` to be reachable under the company's own name.
- The desk imports mailboxes as channels. The `support@` box becomes a channel, the desk fetches its mail and turns every customer message into a ticket, threads follow-ups by the number token in the subject, and replies go out from the channel address and land in the mailbox's Sent folder.
- Tickets get a department, an assignee (the owner or an employee), internal notes, priority, merge and spam handling. Employees work the tickets assigned to them through the existing work queue.
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
- The addresses are pure data in `src/sim/80-business/deskroutes.ts` (next to `portal.ts`): a table per desk, `deskPath`, `parseDesk`, the way `portalPath` and `parsePortal` work. Areas: `portal` (customer home), `newTicket`, `status`, `kb`, `staff`, `ticket`, `admin`, `login`.

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
| Hosted | SPF TXT include and DKIM CNAMEs | replies go out marked "via" the vendor; M16 adds a deliverability effect if Open decision 5 is accepted |
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

### The shared surface

Every desk shows these screens in its own look. They are shared React components under `src/ui/apps/browser/sites/desk/shared/`, framed by a `Skin` per desk (see `makeSkin.tsx` in the portal for the pattern). A desk without a skin of its own renders the plain frame.

- Ticket list with views, filters and search. Views: all open, unassigned, mine, overdue, waiting, escalated, solved and closed, spam. Filters: ticket type (the existing `KINDS`), department, priority, assignee. Row: number, subject, requester, priority, status, due, assignee, and the existing queued pill while the player works it.
- Ticket page with the thread (messages by customer, replies by player and employees with names, system events), a Reply tab and an Internal note tab, the reply picker, the action menu, the customer sidebar (the existing `CustomerCard`, shown where the desk has `customerSidebar`), properties (status, priority, department, assignee, requester, source), merge, and spam.
- Admin: channels, departments, agents, rules, SLA, host mapping and domain records, subscription or version, knowledge base.
- Reports: tickets per kind and per month (existing `Reports.tsx` data), per agent, first response time against `dueAt`, and a view of Incidents that every skin offers under its own name (the existing `Incidents.tsx` screen). Lost sales moves to the Sales app, which the desk links to.

### Replies, macros and actions

The picker is one list in four names: canned responses (OsTickit), macros (Zendusk), canned responses and scenarios (Freshdusk), saved replies (FreeScoot). It shows `templatesOf(t)`. A desk with `templates` shows every reply with its text; without it the picker shows `shownTemplates(s, t, false)` titles. Choosing a reply fills the editor with the text and Send submits `replyTicket`. The editor is locked to the template text. Ticket actions sit in the same list as macro-like entries (Zendusk "Apply macro", Freshdusk "Scenarios", OsTickit and FreeScoot "More"), and retention offers show as a group. The right and wrong scoring, the work minutes and the wrong-answer follow-up are untouched, because the picker calls the same actions. M1 extracts the logic as `useTicketReplies(game, ticket)` and a default `ReplyPanel`, which the mail clients also render.

### Assignment, departments, rules

- `assignTicket` accepts a support employee (a bot too) or `"owner"`. A ticket assigned to `"owner"` is skipped by staff, which is the player's own queue.
- A department is `{ id, name, members, autoAssign, channelId }`. Install creates "Support"; the player adds "Billing" and "Abuse". Empty `members` means every support employee. In `answerTickets` an employee takes tickets in this order: assigned to them, unassigned in a department they belong to, unassigned in a department with no members. Inside one priority, `dueAt` order stays.
- Rules (OsTickit ticket filters, Zendusk triggers, Freshdusk dispatch rules) are `{ when: kind or "*", set: department, assignee, priority }`, evaluated at import. FreeScoot has none; its workflows are a module in the upgrade path.
- Staff work a desk ticket only while the desk is up. Tickets without a channel (mailbox only) are always workable.

### Notes, merge, spam

- A note is internal and never emailed. Typed notes are saved as text; system events (assigned, status, merged) are saved as keys with parameters and shown in the language of the player.
- Merge moves a duplicate's thread into another ticket of the same customer, closes the duplicate with outcome `merged` and sets `mergedInto`. The real source of duplicates is already in the simulation: a high-budget customer writes three outage tickets for one service. One reply then settles all three and an overdue customer is charged one hourly wait penalty instead of three, at the cost of the two extra right-answer happiness gains.
- Spam: marking a ticket as spam closes it as `spam` with no happiness change. OsTickit also adds the sender to its ban list, Zendusk files it under Suspended, Freshdusk and FreeScoot use their Spam folder. New spam arrives in M16, as mail that passed the provider's filter.

### Customer side

The portal imitates the real customer site of each desk: home with Open a ticket and Check ticket status, a ticket form with department or help topic, the status lookup by email and number, the knowledge base page (reusing `kbArticles` and the company site's article view). FreeScoot has no customer side, as the real product has none without a module. The portal adds a second ticket source: a share of customers open tickets through the form when the desk is reachable (`via: "web"`), and such tickets need no mailbox. If the desk is down the customer writes by email instead. The Knowledge base Pear Store item keeps controlling deflection; the desk's Knowledge base screen shows the article reads that `KnowledgeBaseApp.tsx` shows now.

### Reports and SLA

SLA is read from `dueAt`, which is the customer's own expectation by profile. The desk shows it as the real product does: due date and an Overdue tab (OsTickit), a next-reply timer (Zendusk), due-by and overdue views (Freshdusk), a waiting-since column (FreeScoot, which has no SLA). The SLA page lists the plan names with the hours from the profile table and edits nothing in the foundation. `slaTimers` still gates the timers.

## The four desks

| Desk | Real counterpart | Hosting | From | Looks |
|---|---|---|---|---|
| OsTickit | osTicket | self-hosted, free | 2005 | classic 1.6 tables and tabs (to 2015), 1.10 flat blue (2016), current (2022) |
| Zendusk | Zendesk | hosted, per seat | 2007 | 2007 classic, Lotus tabbed agent UI (2012), current workspace (2019) |
| Freshdusk | Freshdesk | hosted, per seat | 2010 | 2010 first look, flat blue with properties sidebar (2014), new UI (2019) |
| FreeScoot | FreeScout | self-hosted, free | 2018 | clean light shared inboxes (2018), refreshed (2026) |

The real version and release data go into `docs/design/software-versions.md` before M10 to M13, the way the panels were done.

- **OsTickit.** Staff Control Panel (`/scp`) with the tabs Dashboard, Tickets, Knowledgebase, Directory and Admin Panel; the ticket queues Open, Answered, Overdue, My tickets and Closed; the ticket page with a details table, the Post Reply and Post Internal Note tabs, Dept. Transfer and Assign; mass actions; the Admin Panel (Settings, Manage with Help Topics, Ticket Filters and SLA Plans, Emails with fetching, Banlist and templates, Staff with Departments and Teams). Customer side: Open a New Ticket and Check Ticket Status. The first look is the table-and-bevel interface of the 1.6 line; 1.10 and later are flat.
- **Zendusk.** Agent workspace with Views on the left (your unsolved, unassigned, all unsolved, recently updated, pending, recently solved, suspended), tickets as tabs in the Lotus era, a properties column, a public reply and internal note toggle, Apply macro, and Submit as Open, Pending, On-hold or Solved. Admin has Channels (Support addresses with the forwarding verification), Business rules (Triggers, Automations, Views, Macros, SLA policies), People and the host mapping. The add-ons Zendusk Guide, Talk and Chat show as upsell tiles and are the upgrade path.
- **Freshdusk.** Ticket list with saved views and a Ticket properties sidebar (type, status, priority, group, agent, tags, due by), a toolbar with Reply, Forward, Add note, Merge and Close, canned responses and scenario automations, Admin with Support emails, Helpdesk productivity (dispatch, time and update rules) and Solutions for the knowledge base. Customer side: Submit a ticket and Solutions.
- **FreeScoot.** Shared inboxes: a mailbox picker, folders Unassigned, Mine, Starred, Drafts, Assigned, Closed and Spam, conversations with Reply and Note, status Active, Pending, Closed and Spam, a customer sidebar, Manage with Mailboxes, Users, Modules and Logs. The Modules page lists the paid modules, which are the upgrade path.

Features: the seven existing flags (`filters`, `search`, `assign`, `templates`, `slaTimers`, `customerSidebar`, `reports`) stay as they are in `economy.md`. Four new flags (`merge`, `departments`, `rules`, `portal`) follow the table below, and notes, spam handling and channels exist in every desk. Open decision 2 asks whether the free desks should gain the features their real counterparts have.

| Flag | OsTickit | Zendusk | Freshdusk | FreeScoot |
|---|---|---|---|---|
| notes, spam, channels | yes | yes | yes | yes |
| merge | yes | yes | yes | yes |
| departments | yes | yes | yes | no (mailboxes) |
| rules | yes | yes | yes | no |
| portal | yes | yes | yes | no |

## Names

Every real company and product in this lane is a pun, and the code, tests and copy use only the pun.

- Desks: OsTickit (osTicket), Zendusk (Zendesk), Freshdusk (Freshdesk), FreeScoot (FreeScout). Their sites: `ostickit.com`, `zendusk.com`, `freshdusk.com`, `freescoot.net`.
- Add-ons of the upgrade path: Zendusk Guide, Zendusk Talk and Zendusk Chat. Freshdusk names its knowledge base Solutions. FreeScoot modules are named by what they do (Satisfaction Ratings, Live Chat, End-User Portal, Knowledge Base, Workflows).
- Existing puns this lane touches: Pear Mail, Pear Store, GMix, Goggle Workspace, Lookout 365, Hosted Exchange by Ionose, Postfixit, Mailpig, Strateaux, Fantastiko, Softaculus, ChadGPT Support, Searchlight, KeePassive and the Lexwear Helpdesk link.
- Words that name a feature and not a company (Views, Macros, Triggers, Canned responses, Scenarios, Saved replies, Help topics, Departments) stay as the real products write them. Brand-named rules are written as plain words (dispatch, time and update rules).
- Open decision 11 asks for the pun of the Help Scout ancestor that FreeScoot copies, which appears only if the game mentions it.

## Staff and bots

- Employees with the support role are the desk's agents; bots are listed as bot agents and can be assigned. The Agents page shows each agent's department membership and current queue (`busyUntil`, tickets assigned).
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
| End-user portal | FreeScout End-User Portal module | the `portal` flag | a customer side for FreeScoot |
| Bot agents | ChadGPT Support as desk agent | bots already assignable | suggested replies, auto-resolve of basic topics |

## Failure modes

- A self-hosted desk shares its host's fate: down with the host, slow when the host is crowded, and lost when the disk is lost without a usable backup (`web-presence`'s `self-host-loss`). A lost desk loses its configuration. Open tickets whose mail the channel deleted from the server are lost with a happiness hit; tickets whose mail stayed on the server come back when the channel is added again. This is why "delete from server" is a choice with a price.
- A hosted desk costs the seat price every month and stops when the subscription is cancelled.
- A channel whose mailbox lost its protocol, or whose mail host is down (the mail waits in the `mail-core` queue), shows the failed fetch on the Channels page.
- An unsupported self-hosted version collects vulnerabilities through the `lifecycle` lane, and a breach exposes the customer list.

## Old saves

A save with a desk in `s.installed` and no `s.desk` loads with a legacy desk: hosting `legacy` (up always, no seat change), one channel on the primary mailbox (before `mail-core` lands, a built-in stand-in channel), every existing ticket fetched at its creation hour with a `ref`, one department "Support". The Pear Store item remains in `s.installed` for billing until the player cancels. A save without a desk gets `s.desk = null`. Tickets get the defaults of the table above. Old saves need only to load.

## Shared hotspots

| File | Edited by this lane | Rule |
|---|---|---|
| `src/sim/50-state.ts`, `newGame` | one key `desk` in its own commented line | default null |
| `src/sim/42-mail/` | extra `DeskChannel` fields, `applyAfter`, `adoptMessage` | agreed with `mail-core`; the type stays in its file |
| `src/sim/91-save/save.ts` | one `fillDesk` call, function in `91-save/desk.ts` | fills ticket fields and the legacy desk |
| `src/sim/40-support/tickets.ts` | optional ticket fields, new kind `spam` | appended; `mail` and `spam` skip the penalty |
| `src/sim/47-staff/staff.ts` | `answerTickets` ordering | one function |
| `src/sim/80-business/browser.ts` | `Page` union, three host lines | one block |
| `src/sim/88-tick/tick.ts` | one `deskTick` call | own line |
| `src/sim/10-catalog/store.ts`, `desks.ts` | desk items leave the Pear Store catalog; desk catalog grows | `install(id)` keeps working for saves and old tests |
| `src/sim/90-actions/index.ts` | one export line for `desk.ts` | |
| `src/ui/apps/support/` | `SupportApp.tsx` shrinks in M8; `Thread` logic moves to `reply/` | `mail-client` imports the reply panel, never SupportApp |
| `src/ui/store.ts` | `openApp("Support")` router, like the `Chat` special case | one branch |
| `src/ui/apps/browser/BrowserApp.tsx`, `Favicon.tsx` | `desk` and vendor cases | one line each |
| `src/i18n/` | `ui-desk.ts`, `ui-desk-ostickit.ts`, `-zendusk.ts`, `-freshdusk.ts`, `-freescoot.ts`, `ui-desk-sites.ts` | mirrors in `de`, `es`, `fr`, `it`, `pt` |

## Milestones

Each milestone is one pull request, green on `npm run typecheck`, `npm test` and `npm run build`, with `npm run balance` where noted. Every milestone adds one or two lines to `CHANGELOG.md`.

**M1. Reply panel extraction.**
- Sim: none.
- UI: move the compose half of `Thread` into `src/ui/apps/support/reply/` as `useTicketReplies(game, ticket)` (templates, previews, retention offers, actions with their amounts, transfer answer, resolve, close) and a default `ReplyPanel`. `SupportApp` uses it with no visible change.
- i18n: none; existing keys.
- Tests: `tests/support-reply-model.test.ts` for the hook's output per kind (howTo, billing, cancellation, refund, domain transfer), and the existing support suites unchanged.

**M2. Desk catalog, routes and tokens.**
- Sim: `desks.ts` gains `hosting`, `hosts`, `refFormat`, `paths`, new feature flags, `DESK_ROUTE`; `80-business/deskroutes.ts` with `deskPath` and `parseDesk`; `refToken`, `priorityOf`, status label tables as data; research rows for the four products in `docs/design/software-versions.md`.
- UI: none.
- i18n: none yet.
- Tests: `tests/desk-catalog.test.ts` (every desk has every area, path round trips, `parseDesk` rejects other desks' paths, token formats, priority table).

**M3. Desk state, ticket fields, old saves.**
- Sim: `DeskState` (`id`, `hosting`, `departments`, `rules`, `addons`, `tenant`; channels live in `s.mail.channels` of `mail-core`), `s.desk`, ticket fields with defaults, `fillDesk` for old saves and the legacy desk, `deskStatus`, `deskReachable(s, ticket)`, `closeTicket` and `supportTick` for customerless kinds, `resolve()` returning `notfound` for `support.<domain>` until a desk exists.
- UI: none.
- i18n: error keys.
- Tests: `tests/desk-state.test.ts` (new game defaults, old save with a Pear Store desk loads and keeps every ticket visible, old save without a desk, status of a hosted and a self-hosted desk), edits to `tests/support-desks.test.ts`.

**M4. Install and subscribe.**
- Sim: `subscribeDesk(tenant, deskId)` for hosted desks with the existing per-seat billing and first month at once; `installDesk(clusterId, deskId)` for self-hosted ones as machine id `desk` on a web space; `removeDesk`; switching drops configuration and keeps tickets; welcome mail through mail-core; desk items leave the Pear Store catalog.
- UI: vendor sites `zendusk.com` and `freshdusk.com` (marketing, pricing, sign-up, one look per era), software sites `ostickit.com` and `freescoot.net` in the software site pattern, a tile in the app catalogue (and a stand-in install form in `HostSettings.tsx` until `app-catalogue` exists), the installer page, the Pear Store shelf removed.
- i18n: `ui-desk-sites.ts`.
- Tests: `tests/desk-install.test.ts` (refusal without cash, seat price, one desk at a time, self-hosted install needs a web space, switching keeps tickets), plus the news-unlocks suite.

**M5. Domain records and reachability.**
- Depends on: `webmail-consumer` M2 (company zone and registrar DNS page). Without it this milestone waits.
- Sim: `deskRecords(s)` lists the records the installed desk needs (`A support`, or `CNAME support` plus the vendor's SPF and DKIM records) and reads them with `recordAt`; `deskReachable` by record for `support.<domain>`, the tenant URL always for hosted desks, sender-domain state, a Verify action. No new zone state.
- UI: the host mapping and domain records page of the desk admin in a plain frame, with the records to add shown as copyable rows, status chips, and a link to the registrar DNS page.
- i18n: keys in `ui-desk.ts`.
- Tests: `tests/desk-records.test.ts` (records listed per desk, resolves with and without the record and before the TTL has passed, hosted tenant URL, Verify result, an old save).

**M6. Channels and fetch.**
- Sim: `addChannel`, `setChannel`, `removeChannel`, `testChannel` over `s.mail.channels`; `deskTick` import: IMAP and POP3 at the hour, forwarding at once, `ref` assignment, `channelId`, department, rules, auto-reply, the channel's `after` rule through `applyAfter`, ticketless messages adopted as kind `mail`, a queued message waits; replies reach Sent through `sentCopy`; `deskImports` and `deskHandles` for the clients. Until `mail-core` lands the built-in stand-in channel treats every ticket as fetched.
- UI: channel admin screens in the plain frame.
- i18n: keys in `ui-desk.ts`.
- Tests: `tests/desk-channels.test.ts` (import order and refs, a follow-up after a wrong answer stays in its ticket, an adopted ticketless message, POP delete versus IMAP keep, queued mail waits, test email, `deskHandles` while the desk is down).

**M7. Desk work actions and staff rules.**
- Sim: `assignTicket` accepts `"owner"`, departments and `autoAssign`, `mergeTickets`, `markSpam`, `addNote`, `setPriority`, `setDepartment`, rules at import, `answerTickets` ordering (assigned, department, open) and the `deskReachable` condition, with priority first and `dueAt` inside one priority.
- UI: none yet (covered by M8).
- i18n: error keys.
- Tests: `tests/desk-work.test.ts` (merge of three outage tickets, one wait penalty, merged outcome, spam, owner queue skipped by staff, department membership, desk down blocks channel tickets but not mailbox ones). `npm run balance` must show no change in the curves.

**M8. Desk site shell, plain skin and the Support launcher.**
- Sim: none.
- UI: `DeskSite` (route, login, down and not-found states), `skins.ts` with the plain frame, shared ticket list, ticket page, notes, merge dialog, customer sidebar, Incidents page, plain reports. `openApp("Support")` routes tickets to the desk URL when a desk exists and to the mail client otherwise; the tile is hidden until a desk exists, shows the desk's mark afterwards, keeps the open-ticket badge, and `useFocus`, Searchlight hits, the widget and the Getting started steps follow. Until the mail client renders orders, sponsor offers, Pear letters and company mail, the old window stays and lists only those kinds. The `MAIL`, `GMIX` and `PEAR` constants in `support/desk.ts` and the provider rules in `mail-styles.css` and `support.css` go to the mail lanes; the four desk styles move into the skins.
- i18n: `ui-desk.ts`.
- Tests: `tests/desk-ui.test.tsx` (plain desk lists tickets, a reply from the ticket page behaves like the old thread, the launcher routes), edits to `tests/support-desks.test.ts`.

**M9. Admin screens.**
- Sim: SLA plan table read from the profile table, agents list data.
- UI: Departments, Agents, Rules, SLA, Subscription or Version, Knowledge base (the article reads), Reports with per-agent and first-response tables, all shared and reachable from every skin.
- i18n: `ui-desk.ts`.
- Tests: `tests/desk-admin.test.tsx`.

**M10. OsTickit skin.**
- Sim: none.
- UI: `sites/desk/ostickit/` with the Staff Control Panel, Admin Panel, customer side, three version looks, `skin.css`, favicon and logo from `OsTickitMark`.
- i18n: `ui-desk-ostickit.ts`.
- Tests: `tests/desk-ostickit.test.tsx` checks that each version look renders every area and that the queues count the right tickets.

**M11. Zendusk skin.** As M10 for `sites/desk/zendusk/` including the Support addresses forwarding flow, Views, Apply macro and the two eras by calendar year. i18n `ui-desk-zendusk.ts`.

**M12. Freshdusk skin.** As M10 for `sites/desk/freshdusk/` including Support emails, Ticket properties, scenarios and the three eras. i18n `ui-desk-freshdusk.ts`.

**M13. FreeScoot skin.** As M10 for `sites/desk/freescoot/` including the mailbox picker, folders, Modules page and two looks. i18n `ui-desk-freescoot.ts`.

**M14. Customer side and knowledge base.**
- Sim: `submitWebTicket` as an internal event, the share of web tickets while the desk is reachable, status lookup by email and number, `via: "web"`.
- UI: portal pages of OsTickit, Zendusk and Freshdusk, the knowledge base page reusing the company site's article view, the link from the company support page to `support.<domain>`.
- i18n: keys in the skin files.
- Tests: `tests/desk-portal.test.ts` (web ticket needs no mailbox, no web ticket when the desk is down, lookup requires the right email).

**M15. Reports and SLA display.**
- Sim: first response time, SLA hit rate and per-agent counts derived from replies.
- UI: each skin's report page in its own style, SLA timers per skin.
- i18n: keys in the skin files.
- Tests: `tests/desk-reports.test.ts`.

**M16. Noise and failure modes (deferred, last).**
- Sim: spam that passes the provider filter, false positives in Suspended or Spam that expire into a late answer, out-of-office and bounce messages, "thanks" replies that reopen solved tickets, customers who chase an overdue ticket with a new message, desk data loss with the `self-host-loss` lane, vendor incidents for hosted desks, deliverability effect of an unverified sender domain.
- UI: Spam and Suspended views fill up; incident banners.
- i18n: keys in `ui-desk.ts`.
- Tests: `tests/desk-noise.test.ts`, with `npm run balance`.

Build order: M1 to M3 can start now and run in parallel. M4 follows M3. M5 needs `webmail-consumer` M2 (the company zone), and M6 needs `mail-core`'s accounts and messages; before that, M6 ships with the stand-in channel. M7 follows M3. M8 follows M1, M3 and M7. M9 follows M8. M10 to M13 follow M8 and M9 and run in parallel. M14 and M15 follow the skins. M16 is last.

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

## Decisions taken in this plan

1. The Support app keeps its id and its dock tile, and becomes a pinned-tab launcher like the Chat tile: no window of its own once a desk exists. Before a desk exists the tile is hidden and ticket notifications open the message in Pear Mail.
2. Desks are third-party software: they leave the Pear Store. Hosted desks are bought on the vendor's site, self-hosted ones come through the app catalogue.
3. A ticket and its Message are one thing seen two ways. Importing a mailbox into a desk changes visibility, never gameplay state.
4. Employees work desk tickets only while the desk is up. The player can always answer from the mailbox.
5. Looks follow the installed version for self-hosted desks and the calendar for hosted desks.
6. The editor in a reply is locked to the template text.
7. The ticket number shown by the desk is `ref`. The id `tkt<n>` stays internal.
8. The company site's Knowledge base stays the single source of articles and reads.

## Open decisions

1. Support app. Recommended: launcher as decided above. Alternatives: remove the tile entirely and use only the Browser bookmark, or keep a small window with counts.
2. Gating versus realism. Today OsTickit has only kind filters although the real product assigns, has canned responses and SLA plans. Recommended: follow the real products, make progression come from effort and cost (self-hosting risk, seat price, era), and update `economy.md` in M2. Alternative: keep today's gates exactly.
3. Hosted plans. One plan per desk now, with a 30-day trial, or plan tiers (starter, regular, plus) at once? Recommended: one plan now, tiers in the upgrade path.
4. Typed notes. Free text typed by the player, or generated notes only? Recommended: typed.
5. Deliverability. Should an unverified sender domain delay customer replies (reusing `MAIL_DELAY_HOURS`)? Recommended: yes, in M16.
6. Noise in M16 (spam false positives, reopen on "thanks", chasers, out-of-office loops): in the game at all, and how often?
7. Importing `info@` or any other box into the desk fills the queue with mail tickets. Recommended: allow it, as real helpdesks do.
8. Switching desks drops configuration. Recommended: keep it, as a cost of switching, with no migration tool.
9. Customer-side tickets: what share of tickets should come through the portal when it exists (recommended 25 percent), and may the player submit test tickets as a customer?
10. Pear Store Knowledge base item (€10 a month): keep as the deflection switch, or include a built-in knowledge base in desks that have one in real life?
11. Add-on names for later (Zendusk Guide, Zendusk Talk, Zendusk Chat) and the pun for the Help Scout ancestor of FreeScoot.
