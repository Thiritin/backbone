# Mail core

Lane ids: `mail-model`, `mail-providers`, `mail-accounts`, `mail-delivery`, `mail-messages`, `mail-client-data`, `mail-cutover`, `mail-lifecycle`, `mail-contacts`, `mail-stale`, `mail-cleanup`, `mail-outgoing`, `mail-staff`. This lane owns the data model, the routing and the sim actions of company email. The other four lanes of the email feature build screens on top of it: [mail-client](mail-client.md) (the Pear Mail desktop client), [webmail-consumer](webmail-consumer.md) (GMix and Goggle Workspace sites and webmail), [webmail-server](webmail-server.md) (webmail on the player's own mail server, Lookout 365 and Hosted Exchange web access) and [support-desk](support-desk.md) (the desk website at `support.<company domain>`). Related code and design: `src/sim/80-business/mail.ts`, `src/sim/90-actions/mail.ts`, `docs/design/gdd.md` (Company email, Support), `docs/design/economy.md` (Company email), [mail-dns-vpn-storage](mail-dns-vpn-storage.md) (own mail server software, mailbox quotas), [software-licences](software-licences.md) (vendor shops and order emails).

## What changes

Today the company has one email service (`Company.mail`: GMix, an external provider or a mail server of its own) and one inbox that is really the ticket list: every customer request, every bank notice and every licence order is a `Ticket` (system mails are tickets of kind `mail`), the Support app shows them, and `EmailSettings.tsx` is the only place to switch provider. After this plan email works the way it does in real life:

- The company owns mailboxes. A mailbox is an account on a provider with an address, a quota, folders and messages. The player creates, renames and deletes mailboxes, adds aliases, sets a catch-all and a forwarder, in the admin page of the provider's website in the Browser (for the player's own mail server, in the mail panel or the host console).
- A new game starts with one free GMix mailbox that receives everything, including customer requests and licence keys. The player is meant to add `info@`, `support@`, `sales@` and a personal `owner@` mailbox and sort the traffic.
- Real mail and support requests are separate things. Mail lives in mailboxes. A customer request is still a ticket in the sim (the work item with status, due time and reply templates), and it reaches the player as an email in a mailbox. A support desk imports a mailbox as a channel and shows its mail as desk tickets.
- Mailboxes behave like IMAP accounts. Webmail in the Browser and the Pear Mail client show the same server state. A POP account in Pear Mail downloads mail off the server, so webmail no longer shows it.
- Every mailbox has the system folders Inbox, Sent, Drafts, Junk, Trash and Archive and any custom folders the player makes. Deleting moves a message to Trash, and emptying Trash deletes for good. Goggle Workspace adds labels on top of that.
- Server filters (Gmail-style filters, Sieve, inbox rules) run on delivery for every client. Client rules run in Pear Mail.
- Licence orders on vendor sites ask which of the player's addresses gets the order, and the key email arrives there.
- Provider choice and switching leave the Email app. They live on the provider sites. `EmailSettings.tsx` is deleted.
- The Support app is retired in two steps: its ticket pane moves into the other lanes, and its dock icon is replaced by Pear Mail.

## Decisions

- One new top-level state key, `s.mail` (type `MailState`), and one new sim folder, `src/sim/42-mail/`, which holds the model, routing, filters and retention and never imports React. Provider facts live in `src/sim/10-catalog/mail-providers.ts`, the file webmail-consumer also plans. A company's relationship with a provider is a tenant (`MailTenant`): a billing relationship that holds mailboxes. `Company.mail` stays as the summary of the tenant that the company domain's MX record points at (`free`, `external`, `self`), kept in step by the tenant actions, so the existing readers (`mailImpaired`, `mailShare`, the Guide check) keep working. New code reads it through `mailService(s)` and never by field. Pear Mail keeps its own state in `s.pearMail`, which mail-client plans.
- A ticket stays a ticket. The customer's request is an envelope message in a mailbox that points at the ticket (`Message.ticket`). The text, the replies and the actions stay on the ticket, so no customer prose is stored twice. For ticket threads the unread state is `Ticket.unread`, so a mailbox and a desk can never disagree.
- System mail (bank, supplier, vendor, registrar, office) becomes plain messages with an i18n topic and params, never text. The i18n keys keep their current names (`ticket.mail.<topic>.subject` and `.text`) so no translation moves.
- Messages are stored per mailbox, `msgs[accountId]`, newest last. A move between mailboxes is a copy plus a delete. This keeps every update small and lets a UI selector re-render only for the mailbox that changed.
- Names of mailboxes follow RFC 2142 roles (`info`, `sales`, `support`, `abuse`, `postmaster`). Traffic is routed by role, not by a settings screen: the role `support` goes to the mailbox that serves it, which is the mailbox the player flagged, else the one named `support@`, else the primary mailbox.
- Keys, invoices and documents are references. A licence key email carries the order id and renders the keys from `s.licenses`; a Sent copy of a ticket reply carries the ticket id and the reply number. Pruning old mail therefore never loses a key.
- Passwords do not exist. Signing in to webmail and adding an account to Pear Mail ask for an address and accept any password.
- The desktop app id is `Pear Mail`, the name mail-client registers, so notifications, the dock and saved windows all use one id.
- Delivery happens at the moment a message is created. The hourly tick does not scan mail; it only flushes a short queue, and daily and monthly passes do retention, junk and billing.

## State

```ts
// src/sim/42-mail/types.ts
export type SysFolder = "inbox" | "sent" | "drafts" | "junk" | "trash" | "archive";
export type MailRole = "owner" | "sales" | "support" | "abuse";
export type MailKind = "support" | "order" | "notice" | "licence" | "invoice" | "bank" | "registrar" | "authority" | "host" | "staff"
  | "newsletter" | "promotion" | "spam" | "bounce" | "system" | "reply" | "alert";
export type MailParams = Record<string, string | number>;

// One billing relationship with a provider, and the mailboxes it holds.
export interface MailTenant {
  id: string;                  // "tn1"
  host: string;                // id in MAIL_HOSTS: "gmix", "goggle", "ionose", "lookout" or "self"
  domain: string;              // "gmix.com" for a GMix tenant, else the company domain
  plan: string;                // tier or edition id of the provider
  since: number;
  verified: boolean;           // the domain was proven; GMix tenants always are
  endsAt: number | null;       // cancelled: billing stops here, the boxes go after the provider's grace
  clusterId?: string;          // the mail server of a "self" tenant
}

export interface MailAccount {
  id: string;                  // "mb12"
  tenant: string;              // MailTenant.id; the host and the plan come from it
  local: string;               // lower case, before the @
  domain: string;              // copied from the tenant
  title: string;              // sender name shown on outgoing mail, "Support"
  roles: MailRole[];           // roles the player assigned; the name adds more
  aliases: string[];           // extra local parts on the same domain
  quotaMb: number | null;      // null follows the plan; own servers store the player's value
  usedKb: number;              // stored messages plus the folded bucket
  older: { n: number; kb: number }; // mail the retention cap folded away
  forward: { to: string; keep: boolean } | null;
  vacation: { on: boolean; subject: string; text: string; until: number | null } | null;
  trained: number;             // junk reports, raises the filter catch rate on own servers
  dropped: number;             // inbound messages rejected for this box (full, closed)
  createdAt: number;
  closedAt: number | null;     // set while a box waits for deletion after its tenant ended
}

// accountId is a MailAccount.id, or the reserved "pear" for the client-held folders mail-client stores.
export interface Folder { id: string; accountId: string; name: string; parent: string | null; label?: true }

export type Attachment = { k: "key"; order: string } | { k: "doc"; id: string } | { k: "invoice"; id: string } | { k: "file"; name: string; kb: number };

export interface Message {
  id: string;                  // "msg204"
  thread: string;              // the ticket id for a ticket thread, else the id of the first message
  folder: string;              // a SysFolder or a Folder.id
  from: string;                // sender ref: "n:<display name>", "cust:<customer id>", "acct:<account id>", "ext:<address>", "daemon"
  to: string;                  // recipient address as written, so aliases and catch-all stay visible
  cc?: string[];
  kind: MailKind;
  topic: string;               // template tail for ticket.mail.<topic>.subject/.text; "" for tickets and own text
  p?: MailParams;
  own?: { subject: string; text: string };  // written by the player, at most 2000 characters
  ticket?: string;             // this message is the envelope of that ticket
  att?: Attachment[];
  at: number;                  // arrival in game minutes, so a client's check delay is real
  kb: number;
  read?: true; star?: true; ans?: true; fwd?: true;  // absent means false, which keeps the save small
  flag?: number;               // colour flag 1 to 7, which Pear Mail sets and webmail may ignore
  draft?: true;
  labels?: string[];           // Folder ids with label set, on label hosts only
  prev?: string;               // folder before Trash, used by Restore
  re?: string;                 // id of the message answered
  late?: true;                 // delivered after waiting in the queue
  origin?: string;             // set on client-held copies: the Pear Mail account whose POP download produced it
}

export interface MailCond { field: "from" | "to" | "subject" | "kind" | "size" | "attachment"; op: "contains" | "is" | "starts" | "ends" | "over"; value: string | number }
export type MailAct = { do: "move"; folder: string } | { do: "label"; label: string } | { do: "star" } | { do: "read" } | { do: "forward"; to: string }
  | { do: "trash" } | { do: "junk" } | { do: "notJunk" } | { do: "stop" };
export interface MailRule { id: string; name: string; on: boolean; match: "all" | "any"; conds: MailCond[]; acts: MailAct[] }
export interface ServerFilter extends MailRule { accountId: string }
// ClientAccount and ClientRule are defined by mail-client (ClientRule extends MailRule with its own actions) and stored in s.pearMail.

export interface DeskChannel {
  id: string; accountId: string; desk: string;
  after: "keep" | "read" | "move" | "delete"; folder: string | null;  // what the desk does with an imported message
  since: number;
  // support-desk adds its own fields (department, mode, fetch interval) beside these.
}

export interface Queued { accountId: string; msg: Message; until: number; why: "down" | "full" }

export interface MailState {
  tenants: MailTenant[];
  accounts: MailAccount[];
  primary: string;                          // account id: owner mail and the last fallback of every role
  catchAll: string | null;                  // account id that takes unknown local parts of the company domain
  contacts: Record<string, string>;         // source id to the address that source writes to, see Routing
  folders: Folder[];                        // custom folders and labels
  msgs: Record<string, Message[]>;          // by account id, newest last
  filters: ServerFilter[];
  queue: Queued[];                          // inbound mail waiting for a down host or a full box
  channels: DeskChannel[];
  retired: { address: string; until: number }[];  // addresses removed recently, still written to by old contacts
  seen: number;                             // highest ticket number that has an envelope
}
```

### Why the save stays small

Saves are plain JSON in `localStorage`, and every `act` runs `structuredClone` on the whole state, so mail must stay cheap to copy.

- A message is about 190 bytes of JSON and never holds prose. Subjects and bodies are an i18n topic plus a few params, or a pointer to a ticket or an order.
- Each mailbox keeps at most `MAIL_KEEP` (300) live messages. Past that, the retention pass folds the oldest read, unflagged messages that are not in a custom folder, not drafts and not part of an open ticket into `account.older` (a count and kilobytes). Folded mail still counts against the quota, so the quota keeps its meaning, and the player frees it with Delete older mail, which is the Gmail "free up space" tool.
- Trash and Junk purge after 30 days. A ticket envelope that is folded or purged leaves the ticket untouched, so the desk and Books lose nothing.
- Sender addresses, display names and customer addresses are derived at render time and never stored. A person who writes in is `firstname.lastname@` on `gmix.com`, `yahoy.com` or `hotmeal.com` (picked by hash of the customer id); a business writes from `info@` on its own domain. A system sender is `no-reply@<ascii name>.com` unless `SENDERS` in the catalog names a better address (the bank's host, the registrar's host, the vendor's host).
- The queue holds at most 200 messages, filters at most 20 per mailbox, custom folders at most 40 per mailbox.
- `kb` comes from `kbOf(kind, year)`: order 60, support 40, notice 80, invoice 120, promotion 45, newsletter 30, spam 25, bank and authority 12 to 15, other system kinds 3 to 10, own text 4, plus the size of attachments, all multiplied by `1 + 0.12 * (year - 2005)` because mail grows heavier over the years. With these sizes a busy company fills a 1 GB GMix box within a year or two, which is the point of the upgrade.
- The budget is checked by a test: 5,000 messages delivered across three mailboxes leave `JSON.stringify(s.mail)` under 400,000 characters.

## Providers by era

One catalog row per host in `src/sim/10-catalog/mail-providers.ts` (`MAIL_HOSTS`), the file webmail-consumer also plans. The provider lanes own the rows of their own products (tiers, editions, quotas, prices, hosts and sign-up pages). Core owns the shape of a row and the capability fields below. Years and sizes are game-tuned approximations of the real products, anchored to the dates in `economy.md`, and are the defaults the provider lanes may change in their rows.

| Host | From | POP3 | IMAP | Quota | Price per mailbox | Aliases | Catch-all | Server filters | Labels |
|---|---|---|---|---|---|---|---|---|---|
| GMix (tiers FreeMix, ProMix, TopMix, from webmail-consumer) | 2005 | every tier from 2005 | paid tiers from 2005, every tier from 2008 | 1 GB on the free tier in 2005, 2 GB from 2009, 5 GB from 2014; more on paid tiers | free to a few euro | none | no | rules (move, mark, forward) | no |
| Hosted Exchange by Ionose | 2005 | 2005 | 2005 | 500 MB, 2 GB from 2009, 10 GB from 2013, 50 GB from 2016 | 10 falling to 6 (the existing curve) | 10 | yes | inbox rules | no |
| Goggle Workspace | 2007 | 2007 | 2007 | the growing counter: 2.8 GB in 2007-01, 6 GB in 2008-01, 7.6 GB in 2010-01, 10 GB in 2012-01, 30 GB from 2014 | 4, 5 from 2020 (existing) | 30 | yes | filters and labels | yes |
| Lookout 365 | 2011 | 2011 | 2011 | 25 GB, 50 GB from 2013, 100 GB from 2016 | 5, 6 from 2022 (existing); shared mailboxes free | 50 | yes | inbox rules | no |
| Own server: Postfixit 2005, Mailpig 2015 | 2005 | once the server runs Dovecoat (installed with Postfixit, bundled with Mailpig) | same | the player's value, default 1 GB | the server's cost | 50 | yes | Sieve when the server offers it | no |

- `quotaMbAt(host, plan, hour)` is a pure function of the hour (linear between the anchors), so the Goggle storage counter can tick up on screen every day without any stored state.
- `capsOf(s, account)` returns the row for the account's tenant at the current year as `MailCaps`: `imap`, `pop`, `webmail` (a webmail id or null), `labels`, `serverFilters` (`none`, `rules`, `filters`, `sieve`), `aliasMax`, `catchAll`, `autoconfig` (true for every external provider and for Mailpig, false for Postfixit), `quotaMb`.
- Three hooks have a default in core and are filled in by another lane, so core never imports their code: `installedWebmail(s)` and `selfHostCaps(s)` (webmail-server: which webmail runs on the own server, whether Dovecoat and Sieve are installed, whether a spam filter raises the catch rate) and `mxTarget(s)` (webmail-consumer milestone 2, which builds the company DNS zone: the tenant the company domain's MX record points at, after TTL propagation; the default returns the one tenant on the domain).
- Webmail ids are `gmix`, `gmial`, `ionose`, `lookout`, `squarecube` and the id of the second own-server webmail. Their display names, sites, hosts and looks belong to the webmail lanes. The Browser `Page` kinds and `resolve` lines for provider and webmail sites are added by those lanes, and they register their hosts in the catalog rows.

## Accounts and addresses

### Addresses and roles

- An address is `<local>@<domain>`, lower case. GMix addresses are on `gmix.com`; every other mailbox is on the company domain and exists only inside a tenant that serves that domain.
- `accountByAddress(s, address)` finds a mailbox by its address or by an alias. `addressesOf(account)` lists the address and its aliases, and `ownsAddress(account, address)` says whether the account may send as an address.
- A role is the kind of mail a mailbox serves. `roleAccount(s, role)` picks, in order: a mailbox the player flagged for the role, a mailbox with the conventional local part (`sales`, `support`, `abuse`; `info` also serves `sales`, and `postmaster` also serves `abuse`), then `primary`. The `owner` role is the primary mailbox. `roleAddress(s, role)` is the address customers are given: it feeds the website, invoices and `salesAddress(s)`.
- Creating `support@pxl-hosting.de` therefore moves support traffic there at once, and deleting it moves the traffic back. The common case needs no settings screen. The account admin page offers Receives: owner mail, sales, support, abuse for the unusual one. On GMix the name never counts and only the flag does, because `pxl-support@gmix.com` is a personal choice of name.
- The old rules keep their numbers and read the sales mailbox. `mailShare` halves business orders while the sales address is on GMix. `mailImpaired` and `mailDelay` look at the host of the sales mailbox, so a self-hosted server that is down or listed impairs the company only when it holds that mailbox.

### Account actions

All live in `src/sim/90-actions/mailbox.ts` and are registered in `ACTIONS`, so replays work. Provider admin pages, the Mailpig panel and the Postfixit host console call the same functions.

| Action | Rule |
|---|---|
| `createMailAccount(s, { tenant, local, title })` | The local part is 1 to 32 characters of letters, digits and `.-_`. The domain comes from the tenant. A GMix address must be free: roles, the 200 most common names and the addresses customers use are taken. A company has at most 3 GMix tenants. A tenant holds at most the mailboxes its plan allows. Fails with `error.mailLocal`, `error.mailTaken`, `error.mailLimit` or `error.mailNoService`. |
| `deleteMailAccount(s, id)` | Fails for `primary`, for the last mailbox, for a mailbox that is the contact of a source (the error names the sources) and for a mailbox a desk channel reads. A deleted company-domain address is added to `retired` for 90 days, and its messages are removed. A deleted GMix address is free to take again. |
| `setAccountRoles(s, id, roles)`, `setAccountTitle(s, id, title)`, `setPrimary(s, id)` | `setPrimary` is how the player moves owner mail off a GMix box. |
| `addAlias(s, id, local)`, `removeAlias(s, id, local)` | Company domain only. At most `aliasMax` of the host. A removed alias goes to `retired`. |
| `setCatchAll(s, id \| null)` | Needs a host with `catchAll`. A catch-all also attracts junk, see Junk. |
| `setForward(s, id, to \| null, keep)` | Server-side forwarding. A target that is another own mailbox is delivered at once, with a hop counter of at most 3. |
| `setVacation(s, id, vacation \| null)` | A vacation auto-reply goes once per sender to mail from the company's own mailboxes. Customers, vendors and other sim senders never read it. |
| `setAccountQuota(s, id, mb)` | Offered on own servers. The sim books the disk the way `mail-dns-vpn-storage` M4 does. |

### Tenants and provider lifecycle

- A tenant is one billing relationship with a provider and the set of mailboxes it holds. A GMix sign-up creates a tenant on `gmix.com` with one mailbox. Booking Goggle Workspace for the company domain creates a tenant that holds the domain's mailboxes. The own server is a tenant of host `self` with a `clusterId` and no bill.
- Core owns the primitives in `src/sim/90-actions/mail.ts`. The provider lanes own the sites and the player-facing actions that call them (`signUpGmix`, `signUpGoggle`, the Ionose and Lookout sign-up, the own-server tenant).
  - `createTenant(s, { host, plan, domain, clusterId? })` creates the record, unverified for a company domain on an external host and verified for GMix and for an own server whose software runs. It books nothing. Billing starts at the next month start, as `bookMail` does today. It fails with `error.needsDomain`, `error.mailProviderLater` or `error.mailHasTenant` (one tenant per company domain).
  - `verifyTenant(s, id)` is called by the provider lane once the verification record exists.
  - `endTenant(s, id)` sets `endsAt` to the end of the billing month. At `endsAt` the boxes get `closedAt`, stay readable for the provider's grace (Goggle 20 days, GMix at once on delete, Ionose and Lookout 30 days) and are then deleted with their mail. Mail to a closed box bounces. It fails with `error.mailRoleInUse` while the tenant holds the primary mailbox or the mailbox of a role and the player has not named another.
  - `importMail(s, fromTenant, toTenant)` copies the messages, custom folders, aliases and server filters of every mailbox whose local part exists at both ends. It takes hours that grow with the stored kilobytes, at least 2. Labels become folders and the first label wins when a message carries several. A filter whose action the new host cannot do is kept and shown as not supported. The source is left untouched, so the player decides when to cancel it.
- Mail for the company domain goes to the tenant that `mxTarget(s)` names. In the first version that is the one tenant on the domain. webmail-consumer's milestone 2 builds the company DNS zone once (MX, SPF, TXT verification, TTL propagation) and replaces the default with a read of that zone, which is how forgetting to move the MX record loses mail. Core builds no zone of its own, and support-desk reuses the same zone for `support.<domain>`. `Company.mail` is re-derived whenever the target changes.
- Uninstalling the mail server software ends the own-server tenant at once with no grace: the mail lived on that server and goes with it. If the primary mailbox was there, core creates a GMix mailbox (`<company>@gmix.com`, numbered when taken) and makes it primary, so every role has a fallback.
- `bookMail`, `cancelMail` and `selectMailServer` stay as thin wrappers over these primitives until the provider lanes replace them, so the existing tests and the Email sheet work in the meantime.
- `mailTick` bills each tenant at the month start: its paid mailboxes times the provider's price for the year (aliases are free), with the same ledger key `ledger.companyMail`. `seatsFor` becomes `seatsBilled(tenant)`.
- The existing Guide check `email` becomes "the company domain has a mailbox".

## Folders, messages and actions

System folders are implied and have no records. Custom folders are `Folder` records. A label host (Goggle Workspace) treats custom folders as labels: a message is in exactly one system folder (`inbox`, `archive`, `sent`, `drafts`, `junk` or `trash`) and carries any number of label ids. On every other host a custom folder is a place and the message sits in it. An IMAP view of a label host shows each label as a folder holding every message with that label, and moving a message to a label folder adds the label and removes it from the Inbox, which is how the real product behaves.

Actions are in `src/sim/90-actions/mailmsg.ts`. Each takes the mailbox id first and batches ids, so the client can mark or move a selection with one `structuredClone`.

| Action | Rule |
|---|---|
| `moveMessages(s, account, ids, folder)` | Any folder of the same mailbox. Moving to Junk marks the sender as reported (`trained`). Moving a ticket envelope never touches the ticket. |
| `deleteMessages(s, account, ids)` | A message outside Trash goes to Trash and remembers `prev`. A message already in Trash is removed and its kilobytes leave the quota. |
| `restoreMessages(s, account, ids)` | Back to `prev`, or the Inbox. |
| `emptyFolder(s, account, "trash" \| "junk")` | Removes everything in it. |
| `markMessages(s, account, ids, { read?, star?, ans? })` | On a ticket thread, `read` sets `Ticket.unread` instead. |
| `labelMessages(s, account, ids, add, remove)` | Label hosts only. |
| `createFolder(s, account, name, parent?)`, `renameFolder`, `moveFolder`, `deleteFolder` | Names are unique among siblings, depth at most 3. Deleting a folder moves its messages to Trash on a folder host and only removes the label on a label host. |
| `saveDraft(s, account, draft)`, `discardDraft` | A draft is a message in Drafts with `draft` set and an `own` body. |
| `sendMessage(s, account, { from, to, cc?, subject, text, att?, re?, draftId? })` | `from` must be an address of the mailbox. Every recipient goes through `deliver`. The Sent copy is created when at least one recipient is valid. A reply sets `ans` on the original, a forward sets `fwd`. |
| `purgeOlder(s, account)` | Frees the folded bucket (the "free up space" tool). |
| `reportJunk(s, account, ids, junk)` | Moves to or from Junk and updates `trained`. |
| `expungeMessages(s, account, ids)` | Removes messages without Trash and frees their quota. Pear Mail uses it when a POP download removes the server copy. |
| `saveAttachment(s, account, id, index)` | Copies a form or document attachment to `s.docs`. |

- Replying to a ticket thread is not `sendMessage`. It is the existing reply and action functions on the ticket (templates, credit, refund, accept). Their effect on the mailbox is a Sent copy: when a reply's work finishes, `finishWork` calls `sentCopy(s, ticket, reply)`, which creates a Sent message pointing at the ticket and the reply number in the mailbox the thread lives in. If the employee who answered has a mailbox, it is that mailbox's Sent.
- Compose to an address the sim knows (the trade office, the notary, any own mailbox) is delivered and answered by the responders in `10-catalog/mail-senders.ts` (`RESPONDERS`), which replace the body of `sendMail` in `90-actions/paperwork.ts`. Any other valid address on a known domain is accepted and nothing comes back. A malformed address, an unknown domain or an unknown user on the company domain returns a Mailer-Daemon message (`daemon`) to the sending mailbox. The old `sendMail(s, to, subject, attachment)` stays as a wrapper that sends from `primary`.

## What Pear Mail uses

Pear Mail is planned in [mail-client](mail-client.md). It stores its own state (accounts, rules, smart mailboxes, signatures, preferences, and the mail it holds locally) in `s.pearMail`, runs its own background check (`pearMailTick`, once per game minute), which fetches each client account on that account's own interval whenever Pear Mail has accounts, whether its window is open or closed. It uses these shared pieces of core and nothing else:

- The server verbs of the previous section. Each takes a mailbox id, so an IMAP account in Pear Mail edits the same records webmail shows. A POP check reads the Inbox through `listFolder`, copies messages into its local store, and removes the server copy later with `expungeMessages` according to its Remove copy from server setting.
- `serverStatus(s, accountId, protocol)` returning `ok`, `down`, `listed`, `installing`, `closed` or `unresolved` (the domain's MX does not reach the tenant), `mailServersOf(hostId, domain, year)` returning the host names, ports and security of IMAP, POP and SMTP that a host offers in a year, `findMailbox(host, address)` and `providerOfDomain(s, domain)` for the Add Account assistant.
- `matchesConditions(s, message, match, conds)`, the evaluator server filters and Pear Mail rules share, so a rule means the same thing in both places.
- `Message.at` in game minutes, which makes the check delay real: a message is visible to a client when its `at` is not after the account's `syncedAt`.
- Client-held mail uses the same `Message` and `Folder` types. `Folder.accountId` is the reserved value `pear` and `Message.origin` names the Pear Mail account whose POP download produced a message. Core never reads that store.
- `fillMail` runs before `fillPearMail`, so the accounts Pear Mail adds for old saves exist.

## Routing

`deliver(s, inbound)` in `src/sim/42-mail/deliver.ts` is the only way a message enters a mailbox. The callers keep using `deliverMail(s, from, topic, params)` from `tickets.ts`, which gains an optional last argument, the source id (`bank`, `supplier:<name>`, `registrar`, `tax`, `office`, `hosttoast`, `vendor`). It looks the source up in `contacts`, falls back to the owner mailbox, and calls `deliver`.

### Who receives what

| Source | Today | Recipient |
|---|---|---|
| Customer requests: outage, how-to, billing, upgrade, cancellation, refund, appeal, migration, maintenance | tickets from `createTicket` | role `support` |
| Order and quote mail from prospects, email leads | `orders.ts` tickets of kind `order` | role `sales` (the address the website shows) |
| Sponsor requests | ticket kind `sponsor` | role `sales` |
| Abuse reports, copyright and phishing notices, legal requests | ticket kinds `abuse`, `notice`, `legal` | role `abuse` |
| Pear mail about the overdraft, extortion mail | ticket kinds `pear` (from `walk.ts`), `extortion` | role `owner` |
| Bank: welcome, TAN list, mTAN code, card, overdraft, failed order | `deliverMail` in `bank.ts` | `contacts.bank`, else `owner` |
| Supplier invoices, debit notices, consequence notices | `deliverMail` in `payables.ts` | `contacts["supplier:<name>"]`, else `owner` |
| Registrar mail (login, transfer complaint) | `registrar.ts`, `manual.ts` | `contacts.registrar`, else `owner` |
| Tax office, trade office, notary | `tax.ts`, `paperwork.ts` | `contacts.tax` and `contacts.office`, else `owner`; a reply to something the player sent goes back to the mailbox it was sent from |
| Host provider notices (HostToast) | `hosttoast.ts` | `contacts.hosttoast`, else `owner` |
| Vendor order, renewal, edition change and lapse mail | `vendor-shop.ts`, `licences.ts`, `products.ts` | the address chosen at checkout, kept on the licence as `mailTo` |
| Software end-of-security notices | `lifecycle.ts` | the `mailTo` of the licence when there is one, else `owner` |
| Bounces (Mailer-Daemon) | `paperwork.ts` | the mailbox that sent the message |
| Junk | new | a random exposed mailbox, see Junk |
| Staff mail (raise requests, resignations; optional last milestone) | none today | `owner`; the employee's own mailbox is the sender when it exists |

`contacts` is the per-source address the player gave when signing up. It is filled with the owner address when the source is first used, and later each source's website gets a Contact email field on its account page that calls `setContact(s, source, address)` (milestone 9). A mailbox that is a contact cannot be deleted, so the bank can never lose the player's mTAN codes.

### Checkout and licence orders

- `checkout(s, host, payment, to)` in `90-actions/vendor-shop.ts` takes the address as a new last parameter. It must be an address of an own mailbox, else `error.mailTo`. The vendor site preselects the last used address, else the mailbox named `info@`, else `primary`.
- The address is kept on the order (`Payable.keys.to` for a transfer that waits for payment) and on each `Licence` as `mailTo`. `sendKeys` creates the order email with `deliver`, with a `{ k: "key", order }` attachment. If the address no longer exists when a transfer is paid, the email bounces to the vendor, the keys remain in My account, and the player sees nothing but the missing mail. That is the real failure mode, and it needs no extra rule.

### Resolution and failure

1. Normalise the address. If it is a retired address, fall to step 3 with the retired reason.
2. Find the mailbox. An address on `gmix.com` belongs to the GMix tenant that holds it. An address on the company domain goes to the tenant that `mxTarget(s)` names, which must be verified, and then to the mailbox or alias with that local part, else to the catch-all if one is set. A mailbox with `closedAt` set is closed.
3. Unknown, closed, or a domain with no verified target: a message from the sim (customer, vendor, bank) is dropped and the player never sees it. The customer pays the usual price for being ignored, because the ticket exists and its clock runs. A message the player sent comes back as a Mailer-Daemon message in the sending mailbox.
4. Host check. A hosted tenant is always up. A mailbox on the own-server tenant is down while `mailImpaired(s)` or the cluster is off; the message waits in `queue` with `why: "down"` and `until = hour + 120`. The queue is flushed by the hourly pass, oldest first, with `late` set.
5. Quota check. `usedKb + kb > quota` puts the message in the queue with `why: "full"`, retried hourly like a real MTA, so freeing space within five days still delivers it. When `until` passes, the message is delivered to `primary` if that has room, else dropped and `dropped` goes up, which the admin page shows as "Rejected messages".
6. Server filters of the mailbox, in order, then the forwarder. Filters never change the quota check that already passed.
7. Junk check unless the kind is critical (bank, notice, authority).
8. Desk channel: if a channel reads this mailbox, apply its `after` rule to the new message at once.
9. Count the kilobytes and run the retention pass if the mailbox is over `MAIL_KEEP`.

Stale addresses matter after a mailbox or alias is removed. For 90 days a decaying share of new customer requests (30 percent on the first day, falling linearly to zero) still goes to the retired address of the role. With a catch-all they arrive. Without one the ticket exists but no envelope is created, so the player never sees it, and the customer's clock runs. The delete confirmation names this and offers Make it an alias.

### Events

Delivery raises no event of its own. Pear Mail's check raises `event.newMail` for the messages it makes visible. The ticket events keep their form (`app: "Support"`, `event.ticket`, `ticketId`) and the store routes them: to the desk when a channel imported the thread, else to Pear Mail at the envelope. A webmail-only player gets no toast, the same as in real life, and webmail shows an unread count in the tab title through `unread(s, account)`.

## Filters and rules

- Server filters run on delivery, inside `deliver`, for every mailbox of a host whose `serverFilters` is not `none`. They run before the player or any client sees the message. They are stored once per mailbox, so webmail, Pear Mail on IMAP and a desk all see the result. The host's `serverFilters` level decides which actions the editor offers: `rules` offers move, mark read, flag, forward and delete; `filters` (Goggle) adds label and Never send to Junk; `sieve` adds any combination and a script view.
- A filter matches `all` or `any` of its conditions. `from` and `to` match the address string; `subject` matches the rendered subject in the active language, as a real filter does, so a rule written in English stops matching if the player switches language; `size` and `attachment` are as named. `kind` (bank, vendor, customer request, and so on) is offered by the Pear Mail rule editor as "Message is" and by no webmail.
- Client rules belong to mail-client and run on its schedule, after server filters, on the mail that reaches the Inbox view of the accounts a rule names. On an IMAP account a client rule's move is an IMAP move, so webmail sees it. On a POP account it touches the local copy only. Both kinds call `matchesConditions`, so a rule behaves the same in both places and the tests cover the evaluator once.
- Limits: 20 server filters per mailbox, 30 client rules, 5 conditions and 5 actions per rule. A filter with `stop` ends the chain.

## Junk

- Each day a mailbox receives junk at `junkPerDay(year)` times an exposure factor: 1 for an address the website, invoices or WHOIS publish, 0.3 for any other mailbox, and a catch-all mailbox adds 4 on top; GMix multiplies the result by 1.2. The curve rises from 5 a day in 2005 to 12 in 2008 to 2010, falls to 6 by 2014 and 2 by 2026, capped at 40 a day. Topics are `ticket.mail.junk.<id>` with invented senders: a pharmacy ("Maple Meds"), a lottery, replica watches by "Rolecks" and, from 2013, a "Bitcorn" giveaway.
- A host catches junk with probability `catch` (GMix free tier 0.85, GMix paid tiers 0.93, Hosted Exchange 0.9, Goggle 0.99, Lookout 0.97, own server 0.5, raised by `trained` up to 0.8 and by whatever spam filter `webmail-server` adds). Caught junk lands in Junk, the rest in the Inbox with kind `spam` so the player can report it.
- A legitimate message of a non-critical kind lands in Junk with probability `falseJunk` of the host (GMix 1.5 percent, Hosted Exchange 1 percent, Goggle 0.1 percent, Lookout 0.3 percent, own server 3 percent). It is a customer request or a licence mail that the player must find in Junk, and `reportJunk` with `junk: false` moves it back to the Inbox.
- Junk is purged 30 days after delivery. Junk costs quota until then.
- Vendors the company bought from send a promotion every month and a newsletter with each release to the address the order used (`Licence.mailTo`). Both are normal mail of kind `promotion` and `newsletter`, can land in Junk through `falseJunk`, and are what Goggle's Promotions tab and Pear Mail's Smart Mailboxes sort.

### Puns introduced here

`hotmeal.com` (the freemail some customers write from, after Hotmail), Maple Meds, Rolecks and Bitcorn (junk senders). Pear Mail, GMix, Goggle Workspace, Hosted Exchange by Ionose, Lookout 365, Postfixit, Mailpig and Mailer-Daemon already exist, and the sibling plans name Gmial, Squarecube, Dovecoat and the GMix tiers FreeMix, ProMix and TopMix. RFC 2142 role names, IMAP, POP3 and Sieve are protocols and standards and are used under their real names.

## Support requests, tickets and the desk

- Every ticket created by the sim gets an envelope message in the mailbox of its role. This is one hook instead of a change at every place that creates a ticket (ten build the object by hand and about thirty call `createTicket`): `syncTicketMail(s)` walks `s.tickets` from the end back to `mail.seen`, creates envelopes through `deliver`, and runs at the end of the hourly tick and after any successful action. A ticket's id order is its creation order, so the walk is cheap.
- The envelope is a normal message. The player can move it, flag it, label it, delete it and file it in a folder. Deleting an open request is allowed and costs the player the customer's patience, because the ticket clock keeps running. The UI confirms before deleting an unresolved request.
- Reading and answering use the ticket machinery unchanged: the opened thread shows the opening text, `Ticket.replies` and the customer's later steps (notice rounds, order counter-offers), and offers the existing templates and actions. Pear Mail mounts one shared component, `ReplyPanel`/`TicketPane`, on ticket envelopes; the support-desk lane extracts it from `SupportApp.tsx` in its milestone 1. Webmail shows the thread through the same component.
- Without a desk the pane shows the same short list of templates as the plain Email app does today (`SHORT_REPLIES`). With a desk installed the full list and every desk feature are in the desk website; the mailbox keeps showing the thread.
- A desk channel reads a mailbox. Adding one (support-desk's `addDeskChannel`) runs `importMailbox(s, channelId)` for the messages already there, and afterwards `deliver` applies the channel's `after` rule to each new message: `keep` leaves it in the Inbox, `read` marks it read, `move` files it in a folder named Imported (created with the channel), `delete` sends it to Trash. A mailbox without a channel keeps its tickets as mail, and the player who forgets to import `info@` will find requests piling up there. The desk lists the tickets of its channels and not those of other mailboxes.
- Replies sent from the desk create the same Sent copy in the channel's mailbox.
- A first request from a customer who writes to a stale address and finds no catch-all is lost to the player, as described under Routing.
- The `mail` ticket kind stops being created at the cutover (milestone 7) and is removed in the cleanup (milestone 11). Its entries in `MINUTES`, `TOPICS`, `TEMPLATES`, `ACTIONS` and the staff `Task` union go. `Ticket.mail` goes. `deliverMail` no longer returns a `Ticket`; the two callers that use the result for an event (`hosttoast.ts`, `licences.ts`) use the message id, and `licences.ts` finds an earlier module licence mail with `findMail` instead of searching `s.tickets`.
- The `Support` app id stays in sim events and alerts (`event.ticket`, `alerts.ts`, Searchlight). `openApp("Support", ticket)` is routed in the store: to the desk site when a channel has imported the thread, else to Pear Mail at the message. The dock icon changes from Support to Pear Mail in `STARTER_APPS` and `deserialize`. `supportApp()` and the Email/desk branding in `src/ui/apps/support/desk.ts` go with the Support app.

## Saves and migration

- `newGame` adds `mail: newMail()`: one GMix tenant, one primary account `<company>@gmix.com` with all roles, no messages and no channels. mail-client's `fillPearMail` adds the Pear Mail account for it. The checklist and the first tutorial mails then arrive in that mailbox.
- `deserialize` calls `fillMail(s)` from `src/sim/91-save/mail.ts`, in the chain beside the other `fill*` calls.
  - A save without `mail` gets a tenant for the existing service (GMix, the external provider, or the own server, verified) and the primary account carrying the existing `salesAddress`: for `free` it is `<ascii(company)>@gmix.com`; for `external` and `self` it is `sales@<domain>` on that tenant, with all roles. The old `seats` count is replaced by the billed mailboxes (one), which makes old external plans cheaper and is accepted.
  - Every ticket of kind `mail` becomes a message in the primary mailbox: `topic` and `mail.params` are copied, `mail.from` becomes `n:<name>`, `createdAt` becomes `at` in game minutes, `unread` becomes `read`, and the ticket is removed from `s.tickets`. A mail that carries an order id keeps a `key` attachment. The 300 newest are kept and the rest are folded into `older`.
  - Tickets that are open, waiting or escalated get an envelope in the primary mailbox so nothing the player had open disappears. Closed tickets get none.
  - `installed` swaps `Support` for `Pear Mail`, with the desk ids untouched. The store's saved window list maps `Support` windows to `Pear Mail`.
  - A saved `company.mail.seats` is kept as the last billed count.
- `Licence.mailTo` is optional, filled by `fillMail` with the primary address for existing keys.
- Every new field has a default in `newMail()` and a fill in `fillMail`, as CLAUDE.md requires. A test loads a save made on main before this plan and checks the sales address, the migrated mails and the open tickets.

## Tick and performance

- `deliver` runs at the moment a message is created and does constant work plus one array copy of the one mailbox (`s.mail.msgs[id] = [...box, m]`, followed by a new `s.mail` object, because the tick mutates a shallow copy of the game and selectors compare references).
- The hourly `mailTick` flushes the queue (empty in the common case), runs `syncTicketMail` after `supportTick` and `ordersTick`, and does nothing else. It adds no scan of messages.
- Once a day (hour 3): junk delivery per mailbox, purge of Trash and Junk older than 30 days, the retention pass for mailboxes over `MAIL_KEEP`, and the retired-address cleanup. The cost is linear in the stored messages, at most a few thousand.
- Once a month: tenant billing, as seat billing is today.
- Client checks are not part of this lane's tick. mail-client's `pearMailTick` reads only mail newer than each account's `syncedAt` and calls `matchesConditions` for rules.
- Action cost: `act` clones the whole state, so mark-read and move are batched by id, the drafts autosave is debounced by the client, and the replay log (`LOG_CAP` 50,000) is not flooded because the client sends one `markMessages` per opened thread rather than one per message.
- A test measures none of this by time. It asserts the size budget and that an hour with no delivery leaves `s.mail` the same object.

## Milestones

Build order. Every milestone ships its seeded tests under `tests/` and the English keys in `src/i18n/ui-mail-core.ts` with the same keys in every `src/i18n/<lang>/` file. Milestones 1 to 3 change no screen and no routing, so the other lanes can start from them.

1. **Model and contract types.** Sim: `src/sim/42-mail/types.ts` as above, `newMail()` (one GMix tenant and the primary account), `s.mail` in `50-state.ts`, `fillMail` in `91-save/mail.ts` (tenant and primary account only; messages and tickets migrate in milestone 7), the pure accessors `boxOf`, `accountByAddress`, `addressesOf`, `ownsAddress`, `foldersOf`, `listFolder`, `unread` and `view(s, message)` (the rendered subject, text, sender name and address). UI: none. i18n: the system folder names. Test: `tests/mail-model.test.ts` loads a pre-plan save, checks the primary account and `salesAddress`, and holds a 5,000-message size budget.
2. **Provider catalog and capabilities.** Sim: `src/sim/10-catalog/mail-providers.ts` (the row shape, `quotaMbAt`, capability fields, webmail ids) and `mail-senders.ts` (`SENDERS`, `RESPONDERS`, junk and catch tables), `capsOf`, `mailServersOf`, and the hooks `installedWebmail`, `selfHostCaps` and `mxTarget` with their defaults. UI: none. i18n: host names. Test: `tests/mail-providers.test.ts` checks the era table (the IMAP years, the Goggle counter anchors, alias limits, price curves equal to the old ones).
3. **Tenants, accounts, roles and billing.** Sim: `createTenant` and `verifyTenant`, `90-actions/mailbox.ts`, role resolution (`roleAccount`, `roleAddress`), `salesAddress`, `mailShare` and `mailImpaired` reading the sales mailbox, `serverStatus`, `findMailbox`, `providerOfDomain`, `seatsBilled`, `mailTick` per tenant, `Company.mail` kept in step, `bookMail`, `cancelMail` and `selectMailServer` as wrappers, the Guide check. UI: the website and invoice address read `roleAddress`; nothing else yet. i18n: error keys. Test: `tests/mail-accounts.test.ts` and the updated `company-mail.test.ts` and `company-mail-delivery.test.ts` (create, limits, aliases, deleting guards, roles by name, billing by mailbox).
4. **Delivery pipeline.** Sim: `42-mail/deliver.ts` with resolution through `mxTarget`, catch-all, quota, queue and retry, retention, `matchesConditions` and server filters, the forwarder, vacation replies, desk-channel `after`, junk and false junk with their daily pass, retired addresses, Mailer-Daemon messages. UI: none. i18n: bounce and junk topics (`ticket.mail.bounceUser`, `bounceFull`, `bounceClosed`, `junk.pharmacy`, `junk.lottery`, `junk.replica`, `junk.bitcorn`). Test: `tests/mail-delivery.test.ts` (each resolution branch, quota queue and expiry, filter order and `stop`, forward loop guard, catch rates over many seeded draws within bounds).
5. **Folders and message actions.** Sim: `90-actions/mailmsg.ts` as in the table, Trash and restore semantics, label hosts versus folder hosts, drafts and `sendMessage`, `setVacation`, responders for office and notary (the paperwork tests move to this path), `purgeOlder`, `reportJunk`, `expungeMessages`, `saveAttachment`. UI: none. i18n: error keys. Test: `tests/mail-messages.test.ts`.
6. **Ticket envelopes.** Sim: `syncTicketMail` (the walk back to `mail.seen`, role routing of every ticket kind, run at the end of the hourly tick and after successful actions), `sentCopy` in `finishWork`, `Ticket.unread` as the thread's unread state, the desk-channel `after` rule applied to envelopes. This milestone is additive: tickets keep appearing in the Support app, and the same tickets also appear as mail in the primary mailbox. UI: none. i18n: none. Test: `tests/mail-tickets.test.ts` (every ticket kind lands in the mailbox of its role, a new `support@` takes over support traffic, `Ticket.unread` is the thread's unread state, replies make Sent copies, a channel's `after` rule runs, an old save keeps its open tickets).
7. **Sources and cutover.** Sim: `deliverMail` routed through `deliver` with the source argument and `contacts`, `checkout` with the address and `Licence.mailTo`, order emails with `key` attachments, renewal, lapse and edition-change mails to `mailTo`, `fillMail` migration of old `mail` tickets and open tickets, the `mail` ticket kind no longer created, store routing for `openApp("Support")`, `STARTER_APPS` and `deserialize` swapping `Support` for `Pear Mail`. UI: the Support app is replaced by Pear Mail in the same pull request. This milestone depends on support-desk M1 (the extracted `ReplyPanel`/`TicketPane`) and on mail-client M1 to M3 (the Pear Mail shell, mailbox list, reader with the ticket pane, compose), and it does not start before they are merged; the vendor shop checkout in `sites/shop/VendorShop.tsx` gets its address picker. i18n: the picker label. Test: `tests/mail-sources.test.ts` (each `deliverMail` caller reaches its recipient, a checkout to `info@` lands there, a deleted address bounces and the key stays in My account, an old save's system mails arrive in the primary mailbox).
8. **Tenant lifecycle.** Sim: `endTenant` with grace and purge, `importMail` with the label and filter conversion, own-server uninstall, the GMix fallback mailbox, retired addresses on every removal, the cancel and import emails from the provider. UI: nothing beyond what the provider lanes call. i18n: provider emails. Test: `tests/mail-lifecycle.test.ts` (an import keeps ids unique and copies filters, a multi-label message lands in its first label folder, ending a tenant closes boxes for the grace period and then removes them, the website address falls back, `error.mailRoleInUse` guards the primary mailbox).
9. **Contact addresses on source sites.** Sim: `setContact` rules and the in-use guard on delete. UI: a Contact email field with an address picker on the account pages of the bank, the registrar, the supplier portals, HostToast and the tax and trade office sites. i18n: the field label. Test: `tests/mail-contacts.test.ts` (bank mail follows the contact, deleting the contact mailbox fails and names the bank).
10. **Stale addresses, newsletters and the junk balance.** Sim: the decaying stale share for removed role addresses, the catch-all effect, monthly promotions and release newsletters to `Licence.mailTo`, and the junk and false-junk numbers in `npm run balance`. UI: none. i18n: the newsletter and promotion topics. Test: `tests/mail-stale.test.ts`.
11. **Cleanup.** Sim and UI: delete `EmailSettings.tsx`, `email.css`, the `apps.mail.*` keys in every language, `supportApp()` and the unused branding in `support/desk.ts`, the `mail` value of `TicketKind` and `Ticket.mail` with their table entries and the staff `Task` union member, and the `bookMail`, `cancelMail` and `selectMailServer` wrappers once the provider lanes replaced them. Update `docs/design/gdd.md` (Company email, Support, the Support rows in the tables), `docs/design/economy.md` (Company email), `docs/design/tutorial.md` and the README of the plans. Test: `tests/i18n.test.ts` passes with the removed keys, and `tests/mail-core-clean.test.ts` confirms nothing reads `kind === "mail"`.
12. **Outgoing business mail.** Sim: Books' invoice, reminder, quote and dunning mail create Sent copies in a configurable mailbox (Books settings, Send invoices from), and customers' replies to them become tickets as today. UI: the Books setting. i18n: the setting label. Test: `tests/mail-outgoing.test.ts`.
13. **Staff mail (optional, last).** Sim: raise requests, resignations and sick notes as mail to `owner`, an employee's mailbox as sender when it exists, monitoring alerts to a contact address. UI: none. Test: `tests/mail-staff.test.ts`.

## Contract for the other lanes

Everything here is stable from milestone 1 and is edited only by this lane. Lanes call it and add no field of their own to `MailState`, except the `DeskChannel` extras that support-desk owns. Where a sibling plan names a function differently, the names below win: `moveMessages` for `serverMove`, `markMessages` for `serverFlags`, `deleteMessages` and `expungeMessages` for `serverDelete`, `sendMessage` for `submit`, `listFolder` for `listMessages`.

**Types.** `MailTenant`, `MailAccount`, `Folder`, `Message`, `Attachment`, `MailKind`, `MailRule`, `MailCond`, `MailAct`, `ServerFilter`, `DeskChannel`, `Queued`, `MailState` exactly as in State, exported from `src/sim/42-mail/types.ts`, and `MailCaps` from `src/sim/10-catalog/mail-providers.ts`. `ClientAccount` and `ClientRule` belong to mail-client; `ClientRule` extends `MailRule`.

**Reads (pure, in `src/sim/42-mail/`).** `mailService(s)`, `capsOf(s, account)`, `quotaMbOf(s, account)`, `serverStatus(s, accountId, protocol)` (`ok`, `down`, `listed`, `installing`, `closed`, `unresolved`), `mailServersOf(hostId, domain, year)`, `findMailbox(host, address)`, `providerOfDomain(s, domain)`, `accountByAddress(s, address)`, `addressesOf(account)`, `ownsAddress(account, address)`, `roleAccount(s, role)`, `roleAddress(s, role)`, `tenantOf(s, account)`, `channelOf(s, accountId)`, `foldersOf(s, accountId)` (system folders then custom, label hosts flagged), `listFolder(s, accountId, folderId)` (newest first; a label folder lists every message with the label), `unread(s, accountId, folderId?)`, `threadsOf(messages)` (groups by `thread`), `matchesConditions(s, message, match, conds)`, `view(s, message)` returning `{ subject, text, fromName, fromAddress, to, cc, att }` in the active language (the only place that renders mail text, so a filter, a search and a screen agree), `ticketOf(s, message)`.

**UI kit.** Every screen lane builds its mail views on the shared non-visual kit at `src/ui/apps/mail-kit/` (owned by mail-client milestone 2), which wraps the reads and actions above, and mounts `ReplyPanel`/`TicketPane` (support-desk milestone 1) on ticket envelopes.

**Hooks with a default in core.** `installedWebmail(s)` and `selfHostCaps(s)` (webmail-server), `mxTarget(s)` (webmail-consumer milestone 2, which owns the company DNS zone). Core imports none of the lanes' code; each lane assigns its implementation in its own module at load.

**Actions (all registered in `ACTIONS`).** Tenant: `createTenant`, `verifyTenant`, `endTenant`, `importMail`, and the wrappers `bookMail`, `cancelMail`, `selectMailServer` until the provider lanes replace them. Mailbox: `createMailAccount`, `deleteMailAccount`, `setAccountRoles`, `setAccountTitle`, `setPrimary`, `addAlias`, `removeAlias`, `setCatchAll`, `setForward`, `setVacation`, `setAccountQuota`, `setContact`. Messages: `moveMessages`, `deleteMessages`, `restoreMessages`, `expungeMessages`, `emptyFolder`, `markMessages`, `labelMessages`, `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, `saveDraft`, `discardDraft`, `sendMessage`, `purgeOlder`, `reportJunk`, `saveAttachment`. Filters: `saveFilter(s, accountId, filter)`, `deleteFilter`, `moveFilter(s, id, to)`, `setFilterOn`. Desk (used by support-desk): `addDeskChannel(s, accountId, desk, after)`, `removeDeskChannel`, `importMailbox`, which core defines as data operations and support-desk wraps with its own checks.

**Errors.** `error.mailLocal`, `error.mailTaken`, `error.mailLimit`, `error.mailNoService`, `error.mailHasTenant`, `error.mailInUse` (params: the sources), `error.mailRoleInUse`, `error.mailTo`, `error.mailFolder`, `error.mailQuotaPlan`.

**Events and ids.** The desktop app id is `Pear Mail`. Core emits no event of its own. The sim keeps emitting `app: "Support"` for ticket events and the store routes them. Webmail ids are `gmix`, `gmial`, `ionose`, `lookout`, `squarecube` and the id of the second own-server webmail. Hosts of provider and webmail sites are catalog fields set by the provider lanes.

**What each lane provides back.**
- `mail-client` builds the shared non-visual mail UI kit at `src/ui/apps/mail-kit/` in its milestone 2 (hooks and helpers over `listFolder`, `view` and the server verbs that Pear Mail, the webmail lanes and the desk site all use), implements `src/ui/apps/pear-mail/`, registers the `Pear Mail` app, owns `s.pearMail`, `fillPearMail` and `pearMailTick`, and builds its views on `listFolder`, `view` and the server verbs. It writes to `MailState` only through actions.
- `webmail-consumer` owns the GMix and Goggle sites, the player-facing sign-up and billing actions that call `createTenant`, `verifyTenant` and `endTenant`, the company DNS zone (its milestone 2) that supplies `mxTarget`, and the Browser `Page` kinds for its sites.
- `webmail-server` owns the own-server webmail products and the Lookout 365 and Hosted Exchange sites, supplies `installedWebmail` and `selfHostCaps`, and the `WEBMAIL` catalog rows (id, name, from, until, features such as `labels`, `threads`, `sieve`).
- `support-desk` extracts `ReplyPanel`/`TicketPane` (props: `ticketId`, `compact`) from `SupportApp.tsx` in its milestone 1, before milestone 7 of this lane, reuses the company DNS zone for `support.<domain>`, owns the `DeskChannel` extra fields and the channel UI, and moves desk subscription state off `installed` if it wishes.
- File names: core keeps `src/sim/42-mail/`, `src/sim/10-catalog/mail-providers.ts`, `mail-senders.ts` and `src/i18n/ui-mail-core.ts`. The other lanes keep the folders and i18n files their own plans name (`src/ui/apps/pear-mail/`, `ui-pear-mail.ts`, the `ui-mail-*.ts` webmail files, the `ui-desk*.ts` files).

## Shared files

| File | Edited by this lane | Rule |
|---|---|---|
| `src/sim/50-state.ts`, `newGame` | adds `mail: MailState` | One line, default `newMail()` beside it. |
| `src/sim/91-save/save.ts` | adds the `fillMail` call | Beside the other `fill*` calls, before `fillPearMail`. |
| `src/sim/88-tick/tick.ts` | replaces the `mailTick(state)` line, adds `syncTicketMail` after `supportTick` | One call each, on its own line. |
| `src/sim/80-business/mail.ts` | `Company.mail` summary, `salesAddress`, `mailShare`, `mailImpaired`, `mailTick` | Milestone 3. webmail-consumer also edits this file for provider terms; its edits go through the catalog rows. |
| `src/sim/40-support/tickets.ts` | `deliverMail`, `TicketKind`, `Ticket.mail` (milestones 7 and 11) | support-desk appends topics here; this lane only removes `mail`. |
| `src/sim/90-actions/index.ts` | one export line per new action file | `mailbox`, `mailmsg`. |
| `src/sim/10-catalog/store.ts`, `src/ui/apps/registry.ts`, `src/ui/store.ts` | `STARTER_APPS`, the `Pear Mail` app, `openApp("Support")` routing | Milestone 7, one pull request with the first Pear Mail build. |
| `src/sim/80-business/vendor-shop.ts`, `src/sim/90-actions/vendor-shop.ts`, `src/ui/apps/browser/sites/shop/VendorShop.tsx` | the order address | Milestone 7. |
| `tests/company-mail*.ts`, `tests/support-desks.test.ts` | rewritten where the rules change | Milestones 3 and 7. |

## Open decisions

Each recommendation is the planner's; the decision is the user's.

1. Do employees get a mailbox automatically (a seat each, as today) or does the player create them? Recommendation: the player creates them, and the bill counts mailboxes. Aliases are free, so the player learns that `sales@` can be an alias of `info@`.
2. Does a shared mailbox such as `support@` cost a seat? Recommendation: follow each provider's real price list: a seat on Goggle Workspace and Hosted Exchange, free on Lookout 365.
3. Retention. Recommendation: the visible Older mail bucket with a Delete older mail button, rather than a silent trim.
4. Lost requests after deleting an address without a catch-all (90 days of stale writers). Recommendation: yes, with the warning on delete and a Make it an alias button.
5. Critical mail never lands in Junk: bank, notices, legal requests and offices. Recommendation: keep that exemption, because a seizure caused by a spam filter feels unfair.
6. Mail on a self-hosted server vanishes when the software is uninstalled unless a backup exists. Recommendation: yes, and add restore from backup in the hypervisors-backups lane later.
7. Does a vacation reply affect customers? Recommendation: no, it is flavor for mail the player sends to themselves.
8. Without a desk, does a ticket thread in Pear Mail offer every template or the short list the plain Email app shows today? Recommendation: the short list, so buying a desk still matters.
9. Sent copies of invoices, reminders and quotes (milestone 12) and staff mail (milestone 13). Recommendation: build 12 after the cutover and drop 13 if earlier milestones run long.
10. Phishing mail in Junk that links to the existing phishing pages and costs the player when opened. Recommendation: later, with the Security app.
