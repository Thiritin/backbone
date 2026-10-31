# Lane plan: mail-dns-vpn-storage

> Critic note (i18n): `src/i18n/en.ts` loads every `ui-*.ts` by glob and `lang.ts` loads every `<lang>/*.ts` by glob, so this lane's new English file is `src/i18n/ui-<topic>.ts` with mirrors `src/i18n/<lang>/ui-<topic>.ts`, and no `en.ts` or `lang.ts` registration edit is needed anywhere below that says otherwise.

Lane id `mail-dns-vpn-storage`. Source of truth for scope is `docs/design/panel-features.md` (sections "Infrastructure consoles" and "Signature mechanics"). Numbers extend `economy.md`, sections "Addresses and internet", "Happiness and churn", "Noticing outages" and "Tickets and work rates".

## 1. Scope

Every feature below is owned by this lane. Tags follow `panel-features.md`.

| # | Feature | Console | Tag | panel-features.md source |
| --- | --- | --- | --- | --- |
| 1 | Mail queue with the deferred count, flush and delete | Mailpig (web admin), Postfixit (CLI page) | [Sim] | Mailpig and Postfixit, bullet 1 |
| 2 | IP blacklist incident from a shady sender, delisting delay, happiness loss for every mail customer on the IP | Mailpig, Postfixit | [Sim] | Mailpig and Postfixit, bullet 2, and Signature mechanics |
| 3 | Mailbox quotas | Mailpig | [Sim] | Mailpig and Postfixit, bullet 4 |
| 4 | Zones list and records editor | PowerDNZ | [Sim] | PowerDNZ, bullet 1 (without the DNSSEC switch, which is cut) |
| 5 | Secondary servers | PowerDNZ | [Sim] | PowerDNZ, bullet 2 |
| 6 | Zone typo incident that takes a site down | PowerDNZ | [Sim] | PowerDNZ, bullet 4 |
| 7 | User certificates with revoke | OpenVeePeeN, AnyConnekt | [Sim] | OpenVeePeeN and AnyConnekt, bullet 2 |
| 8 | Certificate expiry incident | OpenVeePeeN, AnyConnekt | [Sim] | OpenVeePeeN and AnyConnekt, bullet 4 |
| 9 | Buckets with access policies | MinnIO | [Sim] | MinnIO and OwnClod, bullet 1 |
| 10 | Erasure coding health, a failed drive shows as degraded | MinnIO | [Sim] | MinnIO and OwnClod, bullet 3 |
| 11 | Shared links and quotas per user | OwnClod | [Sim] | MinnIO and OwnClod, bullet 4 |

Each feature also has a [UI] half (the screen that shows it); it is planned together with the sim half, not separately.

Not owned here and left to the `readouts` lane: SPF and DKIM checks per domain, the query stats chart, connected sessions, the throughput chart and usage over time. This plan leaves a named slot for each on the screens it builds (a `Readout` area at the top of each tab) and never draws them.

Cut and stays cut: DNSSEC switch, network topology graph, extensions catalog. No feature of this lane is on the deferred list, so there is no deferred milestone.

## 2. Current state

- The six consoles are skins. `src/ui/apps/browser/consoles/powerdnz/PowerDnz.tsx` (52 lines) draws a zones table from `tenants()` and a Server tab from `useSoftware`; the zones are invented from `Spec.zones` in `services.ts:9-17` and nothing can be edited. `openveepeen/OpenVeePeeN.tsx` (62 lines) lists gateways and users by count. `anyconnekt/AnyConnekt.tsx` (56 lines), `minnio/MinnIO.tsx` (49 lines) and `ownclod/OwnClod.tsx` (58 lines) do the same with rows from `useRows`.
- `mailpig/Mailpig.tsx:36` shows a fixed "queue is empty" line; mailbox quotas at `:30` are `hash()` noise from `services.ts:26`. Postfixit has no web console; `hostcli/HostCli.tsx:49-51` prints `mailq` as "Mail queue is empty" in the default branch, and `CLI_ONLY` at `:10` lists it with Bound, Knut and WireGuarded.
- Reputation is built. `Address` in `src/sim/60-infra/addresses.ts:20-24` has `rep`, `listed`, `spam` and `delistAt`. `reputation()` (`:328`) runs daily from `addressTick` (`:366-376`): spam lowers `rep` by `REP.perThousand` per thousand mails, an address lists below `REP.listAt` and clears at `REP.clearAt`. Only shady customers' services (`SPAM.shady`) and hacked panel hosts (`SPAM.hacked`) send spam (`:329-338`). `bounces()` (`:352`) opens a "bounce" howTo ticket for mail customers behind a listed address with `BOUNCE_CHANCE` (0.01 a day). `requestDelist` (`src/sim/90-actions/addresses.ts:62-72`) sets `delistAt = hour + DELIST_HOURS` (24) and fails with `error.stillSpamming` while `spam > 0`. The Addresses app (`src/ui/apps/network/Addresses.tsx:38,119`) shows and requests delisting.
- What is missing for the blacklist mechanic: a listing costs no happiness directly, spam is not attributed to an account the player can see, the daily spam loop ignores suspension (`addresses.ts:331` filters `c.shady && c.churnedAt === null` only), and no mail console shows any of it. Suspension exists (`suspendCustomer`, `src/sim/90-actions/customers.ts:42`; `isSuspended`, `src/sim/45-billing/billing.ts:107`).
- Mail routing: `mailAddress(s, clusterId)` (`addresses.ts:224`) resolves a panel host's outgoing address from its own machine. The Mailpig and Postfixit software installs on a cluster of kind `mail` (`platforms.ts:122-123`), used for company mail (`src/sim/80-business/mail.ts:12-18`). Customer mailboxes are web hosting `Spec.mailboxes` on panel clusters, so a mail console today has no customers of its own.
- Downtime has one gate: `serviceOnline` in `src/sim/40-support/status.ts:9-12` (suspended, taken down, workloads down, blackholed, domain expired). The outage penalty, SLA credit and review code all read it, so any new "site broken" cause only needs one more clause there. Tickets by topic follow the "bounce" pattern: `createTicket(s, cust, "howTo", serviceId, topic)` (`addresses.ts:360`), text keys `ticket.howTo.<topic>.subject/text` (`src/i18n/addresses.ts:16-17`), topic actions at `src/sim/40-support/tickets.ts:100`, resolution in `src/sim/90-actions/support.ts:64`.
- DNS, VPN and storage customers exist as services on clusters of kind `dns`, `vpn`, `storage` (`SERVICE_KINDS`, `platforms.ts:136`) with `Spec.zones`, `Spec.users` and `Spec.diskGb` (`products.ts:13`). `Service.slowedAt` exists (`customers.ts:17`).
- Drives: `Component.failedAt` (`src/sim/50-state.ts:114`) and `failComponents` (`src/sim/88-tick/tick.ts:137`) record failures; a rebuilt or replaced drive gets a new `installedAt`. Storage capacity sums `raidUsable` per node in `src/sim/85-products/products.ts:159`.
- Save pattern: top-level objects are defaulted in `newGame` (`50-state.ts:329-340`, e.g. `sites: newSites()`, `ips: newIps()`) and spread in `deserialize` (`src/sim/91-save/save.ts:87,92`).
- Era looks already chosen in code: PowerDNZ and AnyConnekt 2005/2016 (`erasFrom(2005, 2016)`), OpenVeePeeN 2005/2017, OwnClod 2010/2016, MinnIO 2016/2021.

## 3. Design

### 3.0 Shared foundation: one `netsvc` state object

All new state lives in one top-level object so only one hotspot edit is ever made in `50-state.ts` and `91-save`. `src/sim/60-infra/netsvc.ts` defines:

```ts
interface NetSvc {
  mail: Record<string, { deferred: number; hit: number; listings: number[] }>;  // by address id
  relay: Record<string, string>;            // panel cluster id -> mail cluster id
  quotas: Record<string, QuotaState>;       // by service id
  zones: Record<string, ZoneEdit>;          // by zone name
  vpn: Record<string, VpnState>;            // by service id
  buckets: Record<string, Bucket[]>;        // by service id
  ec: Record<string, number>;               // storage cluster id -> parity
  shares: Record<string, Share[]>;          // by service id
  policy: { shareExpiryDays: number };
  broken: Record<string, { cause: "dns" | "cert" | "storage"; since: number }>;  // by service id
}
```

- `newNetSvc()` returns empty records and `shareExpiryDays: 0`. `newGame` sets `netsvc: newNetSvc()`. `deserialize` adds `netsvc: { ...base.netsvc, ...data.netsvc }`, which fills every sub-key added later by any milestone, so later milestones never touch `91-save` again. Every entry is created lazily on first use, so an old save with an empty object behaves like a fresh game.
- `netsvcBroken(s, serviceId)` returns true when `broken[serviceId]` exists; `serviceOnline` (`status.ts:11`) gets one more clause `&& !netsvcBroken(s, v.id)`. This one clause serves DNS typos, expired VPN certificates and offline erasure sets.
- `netsvcTick(s): SimEvent[]` is registered once in `src/sim/88-tick/tick.ts` next to `addressTick` (`:296`) and calls each feature's tick function, which sits in its own file. Later milestones add one call line inside `netsvcTick`, not in `tick.ts`.
- Tickets raised by this lane follow the "bounce" pattern. Topics: `mailFull`, `dnsChange`, `certLost`, `bucketPublic`, `quotaFull`, `linkExpired`. Texts are `ticket.howTo.<topic>.subject/text` in `src/i18n/ui-netsvc.ts`. A topic action in `tickets.ts:100` marks the ticket resolved when the player performs the matching sim action.
- Ledger entries use the existing `LedgerEntry` shape (`50-state.ts:127`); the category used is `subscriptions` (verify its set of allowed values in `finance` before the VPN certificate milestone).
- i18n: every new key goes in the new topic file `src/i18n/ui-netsvc.ts` (export `NETSVC_EN`), registered in `src/i18n/en.ts` with one import and one `...NETSVC_EN,` line beside `SHOP_EN` (`en.ts:15,61`). Translations are `src/i18n/de/ui-netsvc.ts`, `es/netsvc.ts`, `fr/netsvc.ts`, `it/netsvc.ts`, `pt/netsvc.ts`, default-exporting a `Dict` like `de/shop.ts`; `lang.ts:25` loads them with a glob, so they need no registration. `tests/i18n.test.ts` checks keys and parameters.

Console UI rule for this lane: `PanelBase.tsx` and `HypervisorBase.tsx` are not edited. Each console keeps its own `useState` sub-view inside its own folder and calls actions through `useStore((s) => s.act)` as `PanelBase.useRows` does (`PanelBase.tsx:119`). `PanelProps` and `ConsoleFeatures` do not change.

### 3.1 Mail queue (Mailpig, Postfixit)

Real screens: Mailpig's Queue tab imitates the mailcow "Queue manager" (Deferred queue table with queue ID, sender, recipients, arrival time, and the buttons Flush queue and Delete all) in the existing dark pink tabbed look (`mailpig.css`, one look for both eras). Postfixit stays a CLI page imitating a root shell: `mailq` prints real-looking Postfix queue lines (`4F2A1C0B2D*  1523 Sat Oct 31 09:12:44  sender@x.com` with the deferral reason `(connect to mx.x.com[…]: Connection timed out)` or `(host … refused to talk to me: 554 5.7.1 Service unavailable; Client host [ip] blocked using …)`) and the buttons are labelled with the commands `postqueue -f` and `postsuper -d ALL deferred`.

State: `netsvc.mail[addressId] = { deferred, hit, listings }`. Default: absent means `deferred: 0`, `hit: 0`, `listings: []`.

Tick (daily, right after `reputation`/`bounces` in `addressTick`, so the sim keeps its hour-0 cadence): for each IPv4 address that mail customers use (panel hosts via `mailAddress`, plus mail clusters via the relay in 3.2),
- `perDay = sum over mail customers on the address of mailboxes * mailsPerBox(year)`, with `mailsPerBox(year) = round(25 + 1.75 * (year - 2005))`.
- While the address is listed or its mail machine is down: `deferred += perDay`, capped at 20,000.
- Otherwise `deferred = floor(deferred * 0.5)` per day (the real queue runner retries and drains).
- `bounces()` multiplies `BOUNCE_CHANCE` by `1 + min(2, deferred / 2000)`.

Actions (`src/sim/90-actions/netsvc-mail.ts`, registered in `90-actions/index.ts`):
- `flushQueue(s, addressId)`: fails with `error.mailStillListed` when the address is listed or the host is down; otherwise sets `deferred = 0`.
- `deleteQueue(s, addressId)`: sets `deferred = 0` and every mail customer on the address loses 2 happiness (their mail is gone); allowed once per 24 hours per address.

The Mailpig Queue tab lists up to 30 invented deferred entries derived from `hash` of the address and day (entries are a readout of the count, not stored) with the count, the reason, Flush and Delete buttons. Extends `economy.md`, "Addresses and internet".

### 3.2 Blacklist incident (Mailpig, Postfixit)

Reuse the existing reputation engine; add what it lacks.

- Sender attribution: `spamSenders(s, addressId)` returns the active, non-suspended shady customers' services whose mail leaves that address, sorted by service id, each with its daily thousands (`SPAM.shady`). The Blacklist tab and the Postfixit page print them (Postfixit as a `mailq`-style top-senders block).
- Suspend stops spam: the spam loops in `reputation()` (`addresses.ts:329-338`) skip customers where `isSuspended(s, customerId)` is true. A suspended sender's spam falls to zero from the next daily run, after which `requestDelist` works.
- Mail relay so a mail console has customers: `setMailRelay(s, panelClusterId, mailClusterId | null)` stores `netsvc.relay[panel]`. `mailAddress(s, clusterId)` resolves the relay first, so the customers of a relayed panel host send from the mail server's IP. Default is no relay, which keeps the current behavior and old saves. Mailpig's Domains tab imitates Mailu's "Relayed domains": each panel host in the cluster's zone gets a toggle "Relay through this server".
- Happiness: on the day an address becomes listed, every mail customer on it loses 3 happiness; each further day listed costs 1 more. `netsvc.mail[id].hit` accumulates the loss and stops at 10 per listing episode; it resets when the address clears. Extends `economy.md`, "Happiness and churn" with a line "A listed mail address".
- Delisting delay: `listings` holds the hours of the last listings. `requestDelist` uses `delistHours = DELIST_HOURS * min(4, 1 + listings in the last 30 days)` (24, 48, 72, 96). Repeat offenders wait longer, which makes suspending quickly matter. The change is in `src/sim/90-actions/addresses.ts:70`, a shared file with the address code (no other lane in this program edits it).
- UI: Mailpig gets a Blacklist tab drawn as a Spamhaus-style lookup box (mailcow's own Blacklist tab is a sender allow and deny list, so it is not the model): address, status "Listed" or "Not listed", reputation bar from `rep`, delisting countdown from `delistAt`, the senders table with a Suspend button (calls `suspendCustomer`), and a "Request delisting" button (calls `requestDelist`). When the `panel-host-sim` lane adds its Suspend control to the panel rows, both call the same action.

### 3.3 Mailbox quotas (Mailpig) and OwnClod per-user quotas

One quota module serves both products: `src/sim/60-infra/netsvc-quota.ts`.

State: `netsvc.quotas[serviceId] = { perUserMb, usedMb }`, created on first read with the era default. Default per-user quota:

- Mailbox: 50 MB in 2005, a straight line to 1,000 MB in 2012, to 5,000 MB in 2020, 15,000 MB flat from 2026.
- OwnClod user: 1,000 MB in 2010, a straight line to 5,000 MB in 2016, 20,000 MB flat from 2024.

Tick (monthly): `usedMb += perUserMb * users * 0.08 * (0.5 + rand)`, where `users` is `Spec.mailboxes` for web hosting services with mailboxes and `max(3, round(diskGb / 2))` for storage services on OwnClod (verify that storage specs carry no `users` field). A customer clears 50% of their data with a 10% chance a month. When `usedMb >= 0.95 * perUserMb * users` a `mailFull` or `quotaFull` ticket opens once (no second one while one is open). About one year of growth to fill at the defaults, so the player meets it, not constantly.

Actions: `setQuota(s, serviceId, perUserMb)` raises or lowers the quota. Booked disk is `users * perUserMb * 0.25` (typical fill); the action fails with `error.quotaNoDisk` when the booked sum on the workload's host exceeds its disk. Raising resolves the open quota ticket; lowering below current use sets `usedMb` to the new cap and the customer loses 3 happiness. Overselling disk by quota is the decision.

UI: Mailpig's Mailboxes tab replaces the `hash()` noise (`Mailpig.tsx:30`) with real quota and usage columns and a Quota dropdown (the Mailu "Edit user > Quota" field); OwnClod's Users page imitates ownCloud's "Users" admin table with the "Quota" dropdown (Default, 1 GB, 5 GB, Unlimited is not offered). Extends `economy.md`, "Tickets and work rates" (one new ticket topic each).

### 3.4 PowerDNZ zones and records editor

Real screen: PowerDNS-Admin. A Dashboard of domains, then a zone page with a records table (Name, Type, Status, TTL, Data, Comment, Edit and Delete) and the Save and "Apply changes" button. Early era (2005 to 2015) imitates the plain PowerDNS "poweradmin" grey table with Edit/Delete links; the late era (2016 on) imitates PowerDNS-Admin's cards and DataTables styling. The existing `ERAS = erasFrom(2005, 2016)` is kept; `pd-box` markup is reused.

State: `netsvc.zones[zoneName] = { records, secondary, typoAt }`, copy-on-write. Until the player edits a zone it is not stored, and `defaultRecords(s, zone)` derives `NS ns1/ns2`, `A @` and `A www` pointing at the address of the customer's web hosting service that owns that domain, `MX @` to `mail.<zone>` and an SPF `TXT`. A record is `{ id, type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS", name, ttl, data }`.

Actions (`src/sim/90-actions/netsvc-dns.ts`): `saveRecord(s, zone, record)`, `deleteRecord(s, zone, id)`. Validation like the real tool: an `A` record needs a valid IPv4 (`error.badRecord`), a `CNAME` cannot sit at the apex, names stay inside the zone. TTL choices 300, 3600, 86400.

Zone typo incident: when the apex or `www` `A` record of a zone that belongs to a customer's web hosting service stores a valid address that is not that service's address, `netsvc.broken[webServiceId] = { cause: "dns", since }` is set and `typoAt` records the hour. The site is then offline by `serviceOnline`, so the existing outage penalty, SLA credit and the Browser app's "site not found" page (`src/sim/80-business/browser.ts`) apply. The customer writes in after 4 hours (a `howTo` ticket with topic `dnsChange`). Saving the correct address clears `broken`. Numbers: ticket after 4 h of broken DNS; no extra happiness constants, the outage machinery in "Noticing outages" decides the loss.

Why the player edits at all: each month a DNS service with at least one zone that has a web hosting service raises a `dnsChange` ticket with probability 0.10, asking to move `www` to a new address (the address is given in the ticket text). The player opens the editor and types it; a wrong digit is the typo. Resolving needs the expected value, and a wrong but valid value breaks the site until fixed. This is the only generator of edits, which keeps the editor a decision and not a chore. Extends `economy.md`, "Tickets and work rates", and "Noticing outages" (a DNS fault is an outage).

### 3.5 Secondary servers (PowerDNZ)

Real screen: PowerDNS-Admin's "Create zone" type `Slave` with "Master" addresses, and the zone list showing Type Native, Master or Slave. Here the zone page gets a "Secondary" row with a dropdown of other `dns` clusters in the same zone or region (`setSecondary(s, zone, clusterId | null)`).

Effect: `dnsCovered(s, serviceId)` is true when every zone of the service has a secondary on a cluster whose workloads are up. `serviceOnline` for a `dns` product service stays true while the primary is down and `dnsCovered` holds. So a second DNS cluster, in a different location, protects against an outage penalty. Requirement: the secondary cluster must differ from the primary and have room (one extra workload slot per zone is not modeled; it costs nothing, which keeps the feature a placement decision). The zones list shows the Secondary column; the Server tab shows "Slaves served" for a cluster used as a secondary. Extends `economy.md`, "Noticing outages".

### 3.6 VPN user certificates with revoke (OpenVeePeeN, AnyConnekt)

Real screens: OpenVeePeeN Access Server admin, "User Management > User Permissions" (user table, columns Username, Group, Allow Auto-login, with "Revoke" via the Show-Connection-Profile row actions) and "Status > Current Users"; the early era 2005 to 2016 is the pre-AS OpenVPN with easy-rsa, so the early look keeps the plain table and shows the certificate list as `index.txt` style rows (`V`/`R`, expiry, serial, CN). AnyConnekt imitates Cisco ASDM: "Configuration > Remote Access VPN > Certificate Management > Identity Certificates" with columns Issued To, Issued By, Expiry Date, Usage and buttons Add, Show Details, Delete, Export; revoke is "Delete" with a CRL prompt in the early era and the "Certificate Management > CA Certificates > Revoke" button later.

State: `netsvc.vpn[serviceId] = { serverIssuedAt, serverExpiresAt, revoked: number[], lost: number | null, lostAt: number | null, autoEnroll: boolean }`. Created on first read: `serverIssuedAt = service.startedAt`, `serverExpiresAt = startedAt + 365 days`. Per-user certificates are derived (`users` from `Spec.users`, CN `user<n>`, serial from `hash`); only revoked indices are stored.

Actions (`src/sim/90-actions/netsvc-vpn.ts`): `revokeCert(s, serviceId, index)`, `reissueCert(s, serviceId, index)` (free; reissuing a revoked user costs the customer 1 happiness for the hassle).

Lost-laptop incident (decision generator): each month a VPN service with `users` users has a chance of `0.015 * ceil(users / 10)` capped at 0.2 that one user's device is lost: `lost` and `lostAt` are set and a `certLost` ticket opens naming the user. Revoking within 72 hours resolves it with +1 happiness. Left unrevoked after 72 hours, the intruder gets in: the customer loses 20 happiness once and the event log gets `event.vpnIntrusion`. Extends `economy.md`, "Happiness and churn".

### 3.7 Certificate expiry incident (OpenVeePeeN, AnyConnekt)

The gateway certificate of each VPN service is valid 365 days from the service start. Thirty days before expiry the sim posts `event.vpnCertSoon` (also visible in the console as an amber expiry cell). At expiry `netsvc.broken[serviceId] = { cause: "cert", since }`, the service is offline by `serviceOnline`, and the usual outage penalty runs until the player renews.

Renewal: OpenVeePeeN offers "Regenerate certificate" in its Configuration > Web Server page (the real AS admin page for SSL), free, manual, never automatic. AnyConnekt offers "Enroll" with a CA fee of 12 per service per year, and an "Auto-enroll (SCEP)" switch (`autoEnroll`) that renews 7 days early and charges the fee each year on the ledger. The paid product therefore buys the absence of the incident, matching the AutoSSL rationale in `panel-features.md`. Action: `renewCert(s, serviceId)` and `setAutoEnroll(s, serviceId, on)` (only for AnyConnekt clusters, `error.noAutoEnroll` otherwise). Extends `economy.md`, "Platforms and licenses" with the fee and "Noticing outages".

### 3.8 MinnIO buckets with access policies

Real screen: the MinIO Browser until 2020 (dark sidebar with bucket list, the "+" menu, bucket Edit policy dialog with Prefix and Read Only, Write Only, Read and Write) and from 2021 the MinIO Console (cards, Buckets list, bucket page with Summary: Access Policy Private, Public or Custom, Versioning, Object Locking, Usage). The existing `ERAS = erasFrom(2016, 2021)` and the `mn-list` and `mn-cards` markup are kept.

State: `netsvc.buckets[serviceId] = Bucket[]` with `{ id, name, policy: "private" | "readonly" | "public", usedGb, publicSince }`. Default derived and not stored: one private bucket `<customer-stem>-data` per storage service holding `Spec.diskGb` times the usage curve; further buckets appear when the customer's tick adds one (monthly 20% chance, up to 5).

Actions (`src/sim/90-actions/netsvc-storage.ts`): `setBucketPolicy(s, serviceId, bucketId, policy)`.

Decision generator: each month a storage service raises a `bucketPublic` ticket with probability 0.06 asking to make a bucket public. Approving (setting `public`) gives +3 happiness and starts exposure risk: each month a public bucket has a 0.04 chance of a data exposure, which costs the customer 25 happiness and posts `event.bucketExposed`. Declining (resolving without the change) costs 2 happiness. Setting a public bucket back to private costs 1 happiness. Extends `economy.md`, "Happiness and churn", and uses the same breach-style event wording as "Breaches and ransom".

### 3.9 Erasure coding health (MinnIO)

State: `netsvc.ec[clusterId]` is the parity, default 2 (EC:2); the console offers 2 and 4 (`setParity`). The health is derived each time it is read by `ecHealth(s, cluster)`: drives are the drive components of the cluster's nodes, the erasure set size is `min(16, drives)`, `failed` counts components with `failedAt !== null`, and:

- `healthy` when `failed = 0`;
- `degraded` when `0 < failed <= parity`, shown as "Healing" with a progress bar once the failed drive has been replaced (heal progress is `(hour - installedAt of the replacement) * 40 GB per hour / usedGb`, derived and not stored);
- `offline` when `failed > parity`.

Effects (`netsvc-storage.ts` tick, hourly): `degraded` marks every storage service on the cluster as slowed (`Service.slowedAt = hour`, so no month-without-slowdown review); degraded for more than 72 hours without a replacement costs each customer 1 happiness a day. `offline` sets `netsvc.broken[serviceId] = { cause: "storage" }` for all storage services on the cluster and clears when `failed <= parity` again. Parity trades capacity: usable disk in `src/sim/85-products/products.ts:159` is multiplied by `(n - parity) / n` for MinnIO clusters (EC:2 on 8 drives is 75%, EC:4 is 50%). Verify the capacity function's inputs when starting that milestone. Extends `economy.md`, "Hardware, power and failures" (a short "Erasure sets" paragraph).

UI: the MinnIO Settings tab shows the Drives panel imitating the MinIO Console "Drives" page (per drive state Online or Offline, and the "Healing" status from `mc admin heal`), with the overall "Erasure code health" line and the parity dropdown (Storage class standard, EC:2 or EC:4).

### 3.10 OwnClod shared links and per-user quotas

Real screen: ownCloud Files with the sharing sidebar ("Share link": Allow upload and editing, Password protect, Expiration date) and the Admin > Sharing page ("Set default expiration date", "Enforce expiration date", "Days until link expires"). The list of links imitates the Files "Shared by link" view. Quotas are in 3.3.

State: `netsvc.shares[serviceId] = Share[]` with `{ id, name, createdAt, expiresAt | null, password: boolean }`; `netsvc.policy.shareExpiryDays` is the admin setting (0, 7, 30 or 90).

Tick (monthly): each storage service on OwnClod gains `round(users * 0.5 * (0.5 + rand))` links; 30% carry an expiry, 25% a password. A link without expiry older than 90 days has a monthly exposure chance of 0.015 (0.003 with a password): the customer loses 20 happiness and `event.linkLeaked` is posted. With `shareExpiryDays > 0`, new links get that expiry and existing links without one are given it when the policy is saved; an expired link is dropped, and each expired link has a 0.10 chance to produce a `linkExpired` ticket (resolved by `extendShare`). That is the trade-off: loose links leak, strict expiry produces tickets.

Actions: `deleteShare`, `setShareExpiry`, `extendShare`, `setSharePolicy(days)` in `netsvc-storage.ts`. Extends `economy.md`, "Happiness and churn".

## 4. Milestones

Each milestone is one pull request, green on its own. Tests are seeded Vitest suites in `tests/`; each tests the sim through direct action calls. Where a milestone changes only part of the UI, the console tests in `tests/panel-consoles.test.tsx` and `tests/console-screens.test.ts` get one added case.

1. **Foundation.** `netsvc.ts` (state, `newNetSvc`, `netsvcBroken`, empty `netsvcTick`), the `serviceOnline` clause, `newGame` and `deserialize`, the `netsvc` i18n topic file and registration, `tick.ts` registration. Tests: `tests/netsvc-state.test.ts` (serialize and deserialize round trip; an old save without `netsvc` loads with empty records; `broken` marks a service offline).
2. **Mail queue.** Daily deferred count, `flushQueue`, `deleteQueue`, `bounces` multiplier, Mailpig Queue tab, Postfixit `mailq` page and command buttons. Tests: `tests/netsvc-mail-queue.test.ts` (queue fills while listed and drains by half while clean, flush refused while listed, delete costs happiness once a day, bounce chance rises with the queue).
3. **Blacklist incident and mail relay.** Sender attribution, suspension stops spam, relay setting, happiness loss per listing, escalating delisting delay, Mailpig Blacklist and Domains tabs, Postfixit sender block. Tests: `tests/netsvc-blacklist.test.ts` (shady sender lists the address, every customer on it loses 3 then 1 a day capped at 10, suspending stops the spam, second listing within 30 days waits 48 hours, relay moves customers to the mail server's address, old saves keep no relay).
4. **Quotas.** The quota module, tick, `setQuota`, `mailFull` and `quotaFull` tickets, Mailpig Mailboxes columns and the dropdown; the OwnClod Users table quota column ships with milestone 11, which shares the module. Tests: `tests/netsvc-quota.test.ts` (era defaults, monthly growth, ticket opens once, raise fails without disk, lowering below use costs 3 happiness).
5. **DNS zones and records editor, typo incident.** `defaultRecords`, `saveRecord`, `deleteRecord`, `dnsChange` generator and ticket, `broken` cause `dns`, PowerDNZ zone page in both eras. Tests: `tests/netsvc-dns.test.ts` (default records derive from the customer's service, copy-on-write on first edit, bad IPv4 refused, a valid wrong address takes the web service offline and the right one restores it, the ticket opens after 4 hours).
6. **Secondary DNS.** `setSecondary`, `dnsCovered`, clause in `serviceOnline`, PowerDNZ zone Secondary row and Server tab. Tests: `tests/netsvc-dns-secondary.test.ts` (DNS service stays online with the primary down when covered, offline when only some zones are covered, same-cluster secondary refused).
7. **VPN certificates and revoke.** Certificate lists, `revokeCert`, `reissueCert`, the lost-laptop incident, OpenVeePeeN and AnyConnekt screens. Tests: `tests/netsvc-vpn-certs.test.ts` (revoke within 72 hours resolves the ticket, after 72 hours the intrusion costs 20 happiness once, revoked indices persist through save).
8. **Certificate expiry and auto-enroll.** Gateway certificate dates, the 30-day warning event, `broken` cause `cert`, `renewCert`, AnyConnekt `autoEnroll` and its yearly fee. Tests: `tests/netsvc-vpn-expiry.test.ts` (warning at 30 days, service offline at expiry, renew restores it, auto-enroll renews 7 days early and posts the ledger entry, OpenVeePeeN refuses auto-enroll).
9. **Buckets and access policies.** Buckets, `setBucketPolicy`, the `bucketPublic` ticket and exposure risk, both MinnIO eras. Tests: `tests/netsvc-buckets.test.ts` (default bucket is derived, approving a public bucket gives +3 and an exposure roll with a seeded RNG costs 25, declining costs 2).
10. **Erasure coding health.** `ecHealth`, `setParity`, effects, the capacity factor, Drives panel. Tests: `tests/netsvc-erasure.test.ts` (healthy, degraded and offline by failed drive count, offline sets `broken` and recovery clears it, a replacement heals over the derived time, parity 4 lowers usable disk to the stated fraction).
11. **OwnClod shared links, expiry policy and Users quotas.** Shares, tick, `setSharePolicy`, `linkExpired` tickets, the ownCloud Files "Shared by link" view, Admin > Sharing and the Users quota column. Tests: `tests/netsvc-shares.test.ts` (leak chance only for old unprotected links, policy stamps expiry on existing links, expired links raise tickets, quotas through `setQuota` on a storage service).

The order keeps mail first because its sim already exists and only needs wiring; DNS, VPN and storage are independent of each other after milestone 1 and may be built in any order or in parallel branches.

## 5. Files touched

Shared hotspots are marked **[HOTSPOT]**.

Milestone 1
- Creates `src/sim/60-infra/netsvc.ts`, `src/i18n/ui-netsvc.ts`, `src/i18n/{de,es,fr,it,pt}/ui-netsvc.ts`, `tests/netsvc-state.test.ts`.
- Edits **[HOTSPOT]** `src/sim/50-state.ts` (`GameState.netsvc`, `newGame`), **[HOTSPOT]** `src/sim/91-save/save.ts` (the one `netsvc` spread), **[HOTSPOT]** `src/sim/88-tick/tick.ts` (one `netsvcTick` line), **[HOTSPOT]** `src/i18n/en.ts` (import and spread line), `src/sim/40-support/status.ts` (`serviceOnline` clause).

Milestone 2
- Creates `src/sim/60-infra/netsvc-mail.ts`, `src/sim/90-actions/netsvc-mail.ts`, `tests/netsvc-mail-queue.test.ts`.
- Edits `src/sim/60-infra/addresses.ts` (queue hook in the daily run, bounce multiplier), `src/sim/60-infra/netsvc.ts` (tick call), **[HOTSPOT]** `src/sim/90-actions/index.ts` (export line), `src/ui/apps/browser/consoles/mailpig/Mailpig.tsx` and `mailpig.css`, `src/ui/apps/browser/consoles/hostcli/HostCli.tsx`, the `netsvc` i18n files.

Milestone 3
- Creates `tests/netsvc-blacklist.test.ts`.
- Edits `src/sim/60-infra/addresses.ts` (suspension filter, relay in `mailAddress`, happiness loss, listing history), `src/sim/90-actions/addresses.ts` (`requestDelist`), `src/sim/90-actions/netsvc-mail.ts` (`setMailRelay`), `Mailpig.tsx`, `mailpig.css`, `HostCli.tsx`, the `netsvc` i18n files.

Milestone 4
- Creates `src/sim/60-infra/netsvc-quota.ts`, `src/sim/90-actions/netsvc-quota.ts`, `tests/netsvc-quota.test.ts`.
- Edits `src/sim/60-infra/netsvc.ts`, **[HOTSPOT]** `src/sim/40-support/tickets.ts` (topic action, around `:100`), `src/sim/90-actions/index.ts`, `Mailpig.tsx`, the `netsvc` i18n files.

Milestone 5
- Creates `src/sim/60-infra/netsvc-dns.ts`, `src/sim/90-actions/netsvc-dns.ts`, `src/ui/apps/browser/consoles/powerdnz/ZoneEditor.tsx`, `tests/netsvc-dns.test.ts`.
- Edits `src/sim/60-infra/netsvc.ts`, `src/sim/90-actions/index.ts`, `src/sim/40-support/tickets.ts` (topic `dnsChange`), `PowerDnz.tsx`, `powerdnz.css`, the `netsvc` i18n files.

Milestone 6
- Creates `tests/netsvc-dns-secondary.test.ts`.
- Edits `src/sim/60-infra/netsvc-dns.ts`, `src/sim/90-actions/netsvc-dns.ts`, `src/sim/40-support/status.ts`, `ZoneEditor.tsx`, `PowerDnz.tsx`, the `netsvc` i18n files.

Milestone 7
- Creates `src/sim/60-infra/netsvc-vpn.ts`, `src/sim/90-actions/netsvc-vpn.ts`, `src/ui/apps/browser/consoles/openveepeen/Certificates.tsx`, `src/ui/apps/browser/consoles/anyconnekt/IdentityCerts.tsx`, `tests/netsvc-vpn-certs.test.ts`.
- Edits `src/sim/60-infra/netsvc.ts`, `src/sim/90-actions/index.ts`, `src/sim/40-support/tickets.ts` (topic `certLost`), `OpenVeePeeN.tsx`, `AnyConnekt.tsx`, both console css files, the `netsvc` i18n files.

Milestone 8
- Creates `tests/netsvc-vpn-expiry.test.ts`.
- Edits `src/sim/60-infra/netsvc-vpn.ts`, `src/sim/90-actions/netsvc-vpn.ts`, `Certificates.tsx`, `IdentityCerts.tsx`, the ledger category list if needed (verify), the `netsvc` i18n files.

Milestone 9
- Creates `src/sim/60-infra/netsvc-storage.ts`, `src/sim/90-actions/netsvc-storage.ts`, `src/ui/apps/browser/consoles/minnio/BucketPage.tsx`, `tests/netsvc-buckets.test.ts`.
- Edits `src/sim/60-infra/netsvc.ts`, `src/sim/90-actions/index.ts`, `src/sim/40-support/tickets.ts` (topic `bucketPublic`), `MinnIO.tsx`, `minnio.css`, the `netsvc` i18n files.

Milestone 10
- Creates `src/ui/apps/browser/consoles/minnio/Drives.tsx`, `tests/netsvc-erasure.test.ts`.
- Edits `src/sim/60-infra/netsvc-storage.ts`, `src/sim/90-actions/netsvc-storage.ts`, **[HOTSPOT]** `src/sim/85-products/products.ts` (usable-disk factor near `:159`), `MinnIO.tsx`, the `netsvc` i18n files.

Milestone 11
- Creates `src/ui/apps/browser/consoles/ownclod/Shares.tsx`, `src/ui/apps/browser/consoles/ownclod/Users.tsx`, `tests/netsvc-shares.test.ts`.
- Edits `src/sim/60-infra/netsvc-storage.ts`, `src/sim/90-actions/netsvc-storage.ts`, `src/sim/90-actions/netsvc-quota.ts`, `src/sim/40-support/tickets.ts` (topic `linkExpired`), `OwnClod.tsx`, `ownclod.css`, the `netsvc` i18n files.

Not touched by any milestone: `PanelBase.tsx`, `HypervisorBase.tsx`, `src/sim/80-business/consoles.ts`, `src/sim/80-business/products.ts`. The three tickets.ts edits are small additions to the topic table and conflict only with another lane adding topics at the same lines.

## 6. Dependencies

- Must land first: none strictly. Milestone 1 stands alone on current origin/main.
- Soft: `panel-host-sim` adds the shared Suspend control and oversell on panel rows. Milestone 3 calls the existing `suspendCustomer` itself, so it does not wait; once the lane lands, both buttons call the same action. If `panel-host-sim` changes `suspendCustomer`'s signature, milestone 3 follows it.
- Soft: `packages-provisioning` introduces packages holding mailboxes. Milestone 4 reads the mailbox quota default from the era curve; if a package carries a mailbox quota later, `setQuota`'s default source switches to it in a one-line change inside `netsvc-quota.ts`.
- Soft: `readouts` draws SPF and DKIM, query stats, sessions, throughput and usage charts. This lane reserves the top of each tab for them and exports derived values (`spamSenders`, `ecHealth`, `defaultRecords`) they can reuse.
- Soft: `shop-portal`, `game-servers`, `web-services` and `hypervisors-backups` do not depend on this lane. `hypervisors-backups` plans "Mail alerts for failed jobs"; if it sends through the company mail server it may reuse the queue from milestone 2 (a job-failure mail enters `deferred` while the address is listed), which is optional.
- Blocks: no lane needs this lane first. `web-services` should not add its own `serviceOnline` clause without going through `netsvcBroken`, to keep that function one line per cause.

## 7. Open questions

1. Should the mail console get its own customers through a relay setting (this plan, `netsvc.relay`) or should the blacklist stay on the panel host's address only? Recommendation: the relay, because without it a Mailpig or Postfixit server has nothing to show and the signature mechanic in `panel-features.md` ("a shady customer on a mail host") has no host.
2. Are monthly customer requests (`dnsChange`, `certLost`, `bucketPublic`, `linkExpired`) acceptable as the way decisions reach the player? Without them the records editor and certificate screens have nothing to do. Recommendation: yes, at the low rates stated (0.10, 0.015 per ten users, 0.06 and 0.10), since they use the existing ticket machinery.
3. When more drives fail than the parity allows, should MinnIO storage customers lose data (like a lost RAID array through `dataLost`) or only go offline until a drive is back? Recommendation: offline only in this lane, because data loss across nodes needs the loss-report path in `lossReports` and belongs with the `hypervisors-backups` restore work.
4. Should the CLI-only products (Postfixit here, and Bound, Knut and WireGuarded for the same pattern) get buttons labelled with their commands, or stay read-only listings? Recommendation: buttons labelled with the command, since a real admin would type it and the page has no terminal.
