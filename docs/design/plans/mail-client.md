# Pear Mail: the desktop mail client

Lane id `mail-client`, milestones `M1` to `M12`. Planned in parallel with [mail-core](mail-core.md) (mailboxes, folders, messages, delivery, filters, the shared contract), [support-desk](support-desk.md), [webmail-consumer](webmail-consumer.md) and [webmail-server](webmail-server.md). Related design: `docs/design/gdd.md` (Company email, Support), `DESIGN.md` (visual system), `src/ui/apps/shop/shop.css` (the `--ar-*` era tokens that follow the installed Pear OS), `src/sim/10-catalog/os.ts` (Pear OS releases), `docs/design/plans/README.md` (hotspots).

This plan builds on what `mail-core` publishes: `MailState` at `s.mail`, `MailAccount`, `Folder`, `Message`, `Attachment`, `MailRule`, `MailCond`, `MailAct`, `ServerFilter`, `DeskChannel`, `MailCaps`; the reads `capsOf`, `serverStatus`, `mailServersOf`, `findMailbox`, `providerOfDomain`, `accountByAddress`, `addressesOf`, `foldersOf`, `listFolder`, `threadsOf`, `unread`, `view`, `ticketOf`, `channelOf`, `quotaMbOf`, `matchesConditions`; the actions `moveMessages`, `deleteMessages`, `expungeMessages`, `restoreMessages`, `emptyFolder`, `markMessages`, `labelMessages`, `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, `saveDraft`, `discardDraft`, `sendMessage`, `saveAttachment`, `purgeOlder`, `reportJunk`. This lane defines `ClientAccount` and `ClientRule` and stores them in `s.pearMail`; `MailState` carries no client field. The ids are the ones `mail-core` fixes: the desktop app is `Pear Mail`, the event is `event.newMail`, and client-held folders use the reserved account id `pear`. This lane's own names are `src/ui/apps/pear-mail/`, `src/ui/apps/mail-kit/`, `src/sim/43-pear-mail/`, `fillPearMail`, `pearMailTick` and `src/i18n/ui-pear-mail.ts`. Section 13 lists what this plan still asks `mail-core` for.

## 1. What changes

Today the game has no mail client. The Support app wears an "Email" skin per provider (`src/ui/apps/support/desk.ts`), and self-hosted mail shows a plain skin called Pear Mail. After this plan Pear Mail is a real desktop client that ships with Pear OS:

- The player adds mail accounts to it the way people add IMAP and POP accounts: name, address, incoming server type, server host names, outgoing server. Pear Mail starts empty: the first launch shows a welcome with an "Add your first account" step that opens the assistant, and the assistant asks for a password like every real client does (section 14).
- One window shows every added account: a unified Inbox, per-account Inbox, Sent, Drafts, Junk and Trash, the custom folders the player made on the provider, local folders under On My Pear, and Smart Mailboxes with saved criteria.
- It looks and behaves like Apple Mail of the installed Pear OS release: brushed metal and a mailbox drawer on Panthera, the unified Leopard look with notes, to-dos and data detectors on Leapard (and Lion's three columns and conversations from 2011), flat on Yosemighty, rounded on Big Sir, glass on Tahoo. The release is the existing `s.os`, so the look changes when the player installs a Pear OS update.
- It checks mail on a schedule whenever it has accounts, with its window open or closed. It shows an unread count on the Dock icon, plays a sound, shows banners in later eras, and keeps a Mail Activity log of what it did.
- It runs client rules (like Apple Mail Rules) on the mail it fetches. Server filters from `mail-core` run before that, at delivery.
- It sends mail from a chosen account, with signatures and attachments, and it shows customer requests with the ticket pane, so a request can be answered before the support desk exists.
- It does not choose providers. Provider choice, switching and mailbox creation live on the provider websites in the Browser; Pear Mail connects to what exists.
- It owns the shared non-visual mail UI kit that the webmail lanes and the desk site also use (section 10).

## 2. What the player can do with it

Most of Pear Mail is immersion. The rows marked Game change what the player can do and are the reason to build the client in the order of section 12.

| Player goal | What Pear Mail gives | Weight |
| --- | --- | --- |
| Find a licence key | The vendor's order mail lands in the mailbox the player picked at checkout, with the keys on a licence attachment. From Pear Mail 3 the key in the text is highlighted with a Copy popup, the attachment previews in Quick Peek, and a Smart Mailbox or the search field finds every key across accounts. My account on the vendor site keeps listing the keys, so deleted mail never blocks progress. | Game |
| Notice that orders land in a box the player is not reading | Each added account shows its own unread count and the Dock badge adds them up. A mailbox that is not added to Pear Mail is invisible there, which is the lesson behind adding info@ as its own account. | Game |
| Answer a customer before a support desk exists | A message that carries a ticket shows the ticket pane under the text: the short reply list and the resolve actions. The reply runs the existing ticket work, and the answer appears in Sent. Once the desk imports the mailbox the pane says so and offers Open in the Browser. | Game |
| Route mail on purpose | Server filters (provider websites) and client Rules (here) both move, flag and forward mail. The player feels the difference: server filters work without a client and show in webmail at once, client rules run when Pear Mail checks mail and can colour and play sounds. | Game |
| Send a filled form to the trade office or the notary | Compose with an attachment from the Desktop, as `sendMail` does today. The answer comes back to the account the form was sent from. Other recipients answer with a Mailer-Daemon message. | Game |
| Understand POP against IMAP | A POP account downloads mail and, depending on its setting, removes the server copy, so webmail no longer shows it. An IMAP account is a live view, so reading in Pear Mail marks the message read in webmail. | Game lesson |
| Rescue mail from a closing mailbox | When a provider is cancelled the mailboxes stay readable for 30 days. Dragging messages into On My Pear keeps them. | Game |
| Read the provider's server names | The manual assistant of Pear Mail 2 asks for host names that the provider's Help page lists, which sends the player to the provider website. | Game |
| Keep passwords straight | The assistant needs the mailbox's password. KeePassive autofills it and offers to save it after the account works; without KeePassive the player types it from the Getting started guide or the webmail sign-up. A password changed on the provider site stops the account until the player enters the new one. | Game |
| Flags, colours, folders, Junk training, conversations, Notes, To Dos, Mail Activity, stationery | Triage tools with small effects that make the app believable. | Immersion |

Orders, licence keys, bank credentials and registrar logins are also visible on the website of the party that sent them, so mail the player loses never ends the game.

## 3. Eras

### 3.1 Pear Mail builds

Pear Mail has no update of its own. Its look is the installed Pear OS release (`s.os`) and its feature set is the newest build that both the installed release and the game date allow. This ties it to the existing `OsUpdateSheet` and `updateOs`: a player who never updates Pear OS keeps an old Pear Mail, as in real life.

`src/sim/10-catalog/pear-mail.ts` holds the table and two pure functions, `mailBuild(osId, hour)` and `mailHas(build, feature)`. A build is available when its release is the installed one or older (by the order of `OS_RELEASES`) and its month has come (`monthIndexOf`, as `latestOs` does).

| Build | Release it needs | From | Real counterpart | New in this build |
| --- | --- | --- | --- | --- |
| Pear Mail 2 | Panthera | game start | Mail on Panther and Tiger | Brushed metal drawer look, split list and preview, Smart Mailboxes, Rules, Junk training, threads, signatures, Activity, manual Add Account for POP and IMAP, On My Pear folders, single flag, Dock badge |
| Pear Mail 3 | Leapard | 2007-10 | Mail on Leopard | Unified toolbar and source list, Notes and To Dos, Stationery, data detectors, Quick Peek, automatic account setup, "Automatically" check interval |
| Pear Mail 5 | Leapard | 2011-07 | Mail on Lion | Three columns, Conversations, favourites bar, seven flag colours, Archive, search tokens |
| Pear Mail 6 | Leapard | 2012-07 | Mail on Mountain Lion | Provider tiles in Add Account, notification banners, VIPs |
| Pear Mail 8 | Yosemighty | 2014-10 | Mail on Yosemite | Flat chrome and preview lines in the list |
| Pear Mail 14 | Big Sir | 2020-11 | Mail on Big Sur | Rounded chrome, account detection from the domain |
| Pear Mail 16 | Big Sir | 2022-10 | Mail on Ventura | Undo Send, Send Later, Remind Me (open decision 5) |
| Pear Mail 26 | Tahoo | 2025-09 | Mail on Tahoe | Glass chrome, Categories above the list |

The release names are the existing puns in `os.ts`. The real releases between Leopard and Yosemite that the game has no release for (Snow Leopard, Lion, Mountain Lion, Mavericks) are covered by dated builds on Leapard, and Mavericks has no build of its own because nothing in it changes what the player can do. Version strings are catalog decoration.

`MailFeature` is a string union with one entry per item of the last column (`smartMailboxes`, `rules`, `junk`, `threads`, `notes`, `todos`, `stationery`, `detectors`, `quickPeek`, `autoSetup`, `autoCheck`, `columns`, `conversations`, `favourites`, `flagColours`, `archive`, `tokens`, `providerTiles`, `banners`, `vip`, `previewLines`, `domainDetect`, `undoSend`, `sendLater`, `remindMe`, `categories`). Every client action that needs a feature checks `mailHas` and fails with `error.mailFeature`, so tests can call actions directly and the UI is never the only guard.

A build with new features shows a short "What's new in Pear Mail" sheet once, tracked by `pearMail.seenBuild`.

### 3.2 What each release looks like

All five looks use the existing tokens (`--ar-pane`, `--ar-head`, `--ar-sel`, `--ar-bw`, `--ar-lift`, `--ar-glow`, `--gel`, `--bar-top`, `--bar-bottom`) and the shell classes `.sidebar`, `.side-h`, `.side-item`, `.table`, `.field`, `.btn`. `pear-mail.css` keys on `:root[data-os=...]` the way `os.css` and `support.css` do, and the app draws its own toolbar inside `.win-body`.

| Release | Window | Sidebar | List and preview | Toolbar | Marks |
| --- | --- | --- | --- | --- | --- |
| Panthera | Brushed metal title bar and toolbar, drawn in code with layered gradients and a noise tile over the shell pinstripe. `.window:has(.pm)` selects it, so `AppWindow` needs no change. | Mailboxes drawer: pinstripe list with disclosure triangles | List above, preview below, column headers with a gel sort arrow | Large icons with labels: Get Mail, Delete, Junk, Reply, Reply All, Forward, New, then the search field with its scope popup | Glossy blue ball for unread, red flag, brown text for suspected junk in training mode |
| Leapard | Unified gradient title bar and toolbar | Blue-grey source list, small uppercase section headers, rounded count pills | Same split; from Pear Mail 5 three columns with a favourites bar | Icon and label, smaller | Blue ball; from Pear Mail 5 seven flag colours |
| Yosemighty | Flat translucent bar, thin 0.5px rules | Light source list | Three columns, rows with preview lines | Icons without labels | Flat blue dot, flag glyphs |
| Big Sir | Taller toolbar, rounded selection rows | Source list with coloured icons | Rows with up to five preview lines, conversation counts | Grouped icon buttons | Blue dot |
| Tahoo | Glass toolbar segments, capsule search field | Floating rounded sidebar | Larger radii, Categories tabs above the list | Glass capsules | Dot |

A player who stays on Panthera past 2011 gets none of the Lion features. The Pear OS update sheet is the way out, as it is for every other app.

## 4. Client state and sync

### 4.1 State

One new top-level key, `pearMail`, with its default in `newGame` (`newPearMail`) and a `fillPearMail` call in `deserialize` (`src/sim/91-save/pear-mail.ts`), running after `fillMail`. It holds everything that belongs to the client:

```
pearMail: {
  accounts: ClientAccount[]      // sidebar order
  rules: ClientRule[]            // run top to bottom
  local: { folders: Folder[]; messages: Message[] }   // On My Pear and POP downloads
  smart: SmartMailbox[]          // name, match all or any, conditions, include Trash and Sent
  signatures: Signature[]        // id, name, text
  notes: PearNote[]              // Notes and To Dos (Pear Mail 3)
  junk: { on: boolean; mode: "training" | "automatic" }
  prefs: PearMailPrefs           // new mail sound, Dock count, sort, organise, preview lines, default From, undo delay
  activity: ActivityLine[]       // newest 30 lines of the Mail Activity window
  replied: Record<string, number>   // "<rule id>:<sender>" to the minute an auto reply went out, so each sender is answered once
  welcomed: boolean              // the first-launch welcome has been dismissed
  seenBuild: string
}

interface ClientAccount {
  id: string                     // "cl1"
  accountId: string              // the MailAccount it reads
  address: string                // as added, which may be an alias
  description: string; fullName: string
  password: string               // kept by the client the way Mail keeps one in the keychain; compared with the mailbox's password at every check
  protocol: "imap" | "pop"
  server: { host: string; port: number; tls: boolean } | null   // typed in the manual assistant, null when set up automatically
  smtp: string | null
  enabled: boolean
  checkEvery: number             // game minutes: 0 manual, 1 automatic, then 5, 15, 30, 60
  syncedAt: number               // game minutes of the last check
  popRemove: "now" | "day" | "week" | "month" | "never"
  popDue: { id: string; at: number }[]   // server copies whose removal is scheduled
  signature: string | null
  storeSent: boolean
  addedAt: number
}

type ClientAct = MailAct | { do: "color"; color: string } | { do: "sound" } | { do: "copy"; folder: string } | { do: "reply"; subject: string; text: string }
interface ClientRule extends Omit<MailRule, "acts"> { clientId: string | null; acts: ClientAct[] }   // clientId null applies to every account
```

A new game starts with no account and `welcomed` false. `fillPearMail` seeds accounts only for a save that has no `pearMail` key: one account for the primary mailbox with that mailbox's current password, `syncedAt` set to the load minute so nothing floods in, and `welcomed` true. Pear Mail joins the installed apps through the `mail-core` cutover, which swaps `Support` for `Pear Mail` in `STARTER_APPS` and `deserialize`.

Local messages are the same `Message` type as core's, with `Folder.accountId` set to `pear` and `Message.origin` naming the POP account; they are about 180 bytes of JSON each, and a size test in M1 holds 2,000 of them under budget. Window state (selected mailbox and message, column widths, expanded folders) lives in `useSessionState`, as `PostApp` does. Everything the player sees about a message goes through `view(s, message)`, the one place that renders mail text, so lists, search, rules and Smart Mailboxes agree.

### 4.2 IMAP, POP and On My Pear

- **IMAP.** The account is a view of the server mailbox through `listFolder`. A message is visible to the client when its `at` is not after the account's `syncedAt`, so a new message appears at the next check while webmail shows it at once. Reading, flagging, moving and deleting are `mail-core` actions on the server message and are visible in webmail immediately.
- **POP.** A check copies the visible Inbox messages that arrived since the previous `syncedAt` into the local Inbox of that account (`pear:<client id>:inbox`, with `origin` set). The server copy is removed by `expungeMessages` according to `popRemove`: at once for "now", at a scheduled time through `popDue` for a day, a week or a month, never for "never". The cursor keeps anything from downloading twice. With "never" webmail keeps showing the messages unread, because POP reports no reads back. The Sent, Drafts, Trash and custom folders of a POP account are local and webmail never sees them.
- **On My Pear.** Folders the player creates under On My Pear are local for every account. Moving an IMAP message into one copies it into the local store and expunges the server copy.

### 4.3 The check

`pearMailTick(s)` runs once per game minute from `tick` and `tickMinute` (one line in each, beside core's `mailTick`) and compares the clock with each enabled account's `syncedAt` plus `checkEvery`. It runs whenever Pear Mail has accounts, with the window open or closed, so POP downloads, rules and the Dock badge keep working. The intervals are Every minute (from Pear Mail 3 the "Automatically" setting), Every 5, 15, 30 or 60 minutes, and Manually. `getMail` (the Get Mail button and Mailbox > Get All New Mail) runs the same function at once. A check, per account:

1. Fails with the account's error (section 5.3) when `serverStatus` does not answer ok or the stored password no longer matches the mailbox's, and writes an Activity line. A later success clears the warning, which is derived from `serverStatus`, `capsOf` and the password check and not stored. An account whose password failed stops checking until the player enters a new one, so the prompt does not repeat every minute.
2. Collects the Inbox messages newer than `syncedAt`, downloads them for POP, runs the Junk step (section 8.3) and the client rules in list order, and moves `syncedAt`.
3. Expunges the server copies whose `popDue` has come.
4. Writes an Activity line ("Checked mail for X: 3 new").
5. Returns one `event.newMail` per new unread Inbox message that no rule moved, marked read or deleted, up to three per check, then one summary event with the count. The event's app is `Pear Mail` and its params are `{ account, count, messageId }`; `focusOf` in `store.ts` learns `messageId` and turns it into the focus `{ kind: "message", id }`.

The store turns events into banners through the existing `notify`, bounces the Dock tile and plays the new mail sound. Banners show from Pear Mail 6 (the era of Notification Center); before that the bounce and the sound are the whole signal. `notify-types.ts` gets a `Pear Mail` group with "New mail" and "To Dos".

The Dock badge is `unreadBadge(s)`: the unread Inbox messages that are visible to the client, summed over every enabled account (the local Inbox for POP). A preference switches it off. Mail that has reached the server but not yet the client does not count, which is the delay a player learns to shorten with Get Mail or a shorter interval.

### 4.4 Order of things on one message

1. Provider spam handling and `ServerFilter` rules at delivery (`mail-core`).
2. At the next check Pear Mail's Junk step, then its client rules.

A client rule that moves a message of an IMAP account is a server move through `moveMessages`, so webmail shows the new folder. On a POP account a rule touches the local copy. A rule that moves an IMAP message into On My Pear downloads it.

## 5. Add Account assistant

### 5.1 Steps by build

The assistant is a sheet on the Pear Mail window. On the first launch of a new game a welcome sheet explains the window and has one step, "Add your first account", which opens the assistant; `pearMail.welcomed` records that it was dismissed. Afterwards the assistant opens from File > Add Account, from the plus button in Preferences > Accounts and from the Getting started step.

Every build asks for a password. The field autofills from KeePassive (`savedLogin(game, "mail:<account id>", 1)` from `src/ui/vault.tsx`, the same site key the webmail sign-in uses, so a password saved in webmail fills here and the other way round) once the typed address resolves to a mailbox. When the account passes its check, `offerLogin` offers to save the password in KeePassive. Without the `keepassive` upgrade the player types it; the start mailbox's password is the one the Getting started guide shows until the player changes it. A wrong password fails the check with `error.mailPassword`, and the sheet keeps the field so the player can retry.

- **Pear Mail 2 (manual).** Welcome (Full Name, Email Address, Password), Incoming Mail Server (Account Type popup: POP or IMAP, Description, Incoming Mail Server), Outgoing Mail Server (Description, Outgoing Mail Server), Account Summary with "Take account online". A verification runs before the summary and reports a failure from the table in 5.3. Go Back edits the entries. Continue keeps the account with its error, so the player can fix it in Preferences.
- **Pear Mail 3 (automatic).** The Welcome page gets "Automatically set up account". For a host whose `capsOf` row has `autoconfig`, the server pages are skipped and the summary shows the found settings. Other hosts fall back to the manual pages.
- **Pear Mail 6 (tiles).** The first page lists GMix, Goggle Workspace, Lookout 365, Hosted Exchange by Ionose and Other Mail Account. A tile fills the server fields from `mailServersOf`, so only name and address are asked. Other Mail Account runs the automatic or manual path.
- **Pear Mail 14 (domain detection).** Any address on a domain whose provider the sim knows (`providerOfDomain`) finds its servers. A company domain on the player's own server is found when `serverStatus` does not report `unresolved`.

A host without `autoconfig` (Postfixit) needs the manual pages in every build. Pear Mail 2 extends that to every host, which sends the player to the provider's Help page for the names. `setupClientAccount` applies the build rule, validates a typed host against `mailServersOf`, resolves the mailbox with `findMailbox`, stores the account, and runs its first check.

### 5.2 Host names

Host names are catalog data (`mailServersOf` over the provider rows of `webmail-consumer` and `webmail-server`). The values `webmail-consumer` already names are `imap.gmix.net`, `pop.gmix.net` and `smtp.gmix.net` for GMix, and `imap.goggle.com` and `smtp.goggle.com` for Goggle Workspace. IMAP exists on GMix Free from 2008 and from the start on ProMail, as the `mail-core` era table says.

### 5.3 Failures

The same check runs in the assistant and in every scheduled check, so both show the same sentences. The sheet text is `t(error)` of the key; the keys live in `ui-pear-mail.ts`.

| Cause | Key | What fixes it |
| --- | --- | --- |
| Host name no provider owns, or the wrong provider's host | `error.mailServer` | Correct the host name |
| The address is not a mailbox on that host (never created, deleted, moved to another provider) | `error.mailNoBox` | Correct the address or host, create the mailbox on the provider website, or edit the server to the new provider's host |
| The password is wrong, or was changed on the provider site after the account was added | `error.mailPassword`; the account shows a password prompt sheet with a field, OK and Cancel | Enter the current password. A forgotten password is reset on the provider site (a code arrives by post after 2 to 3 days), not in Pear Mail |
| Protocol not offered (`capsOf`: IMAP on GMix FreeMix before 2012) | `error.mailProtocol`, with a Try POP button | Switch the account type |
| The provider's "Allow external programs to fetch mail" switch is off (`webmail-consumer`) | `error.mailExternal` | Turn it on in webmail settings |
| Own mail server `down` or `installing` | `error.mailDown` | Start the server or wait |
| The domain's MX does not reach the tenant (`unresolved`) | `error.mailDns` | Fix the record in the DNS panel |
| Mailbox `closed` after the provider was cancelled | `error.mailClosed`; the account stays readable | Drag mail to On My Pear within the grace period |
| Server address `listed` | `error.mailListed` on sending; checking still works | Wait or clean the address |
| Checking more often than the provider's poll gap | `error.mailPoll`, shown in Activity | Raise the check interval |
| Address already added | `error.mailDuplicate` | None |

Port and Use SSL are advanced fields with the protocol's usual defaults. A provider that stops accepting plain connections in a given year answers `error.mailSsl` until the player ticks Use SSL. This row and its field are immersion and the first thing to cut (open decision 6).

## 6. The window

### 6.1 Sidebar

- **Mailboxes (unified).** Inbox, Drafts, Sent, Junk and Trash, each the union over enabled accounts, each with a disclosure triangle that shows the per-account children from Pear Mail 5. Panthera lists the accounts below instead.
- **Per account.** Group header with the Description and a warning triangle when the check fails. Inbox, Drafts, Sent, Junk, Trash, Archive by role, then custom folders in their nesting from `foldersOf`. On a label host (Goggle Workspace) each label shows as a folder, as `mail-core` defines. For POP accounts the same list shows the local folders.
- **On My Pear.** Local folders the player created, nested.
- **Smart Mailboxes.** A gear button creates and edits them.
- **Reminders (Pear Mail 3).** Notes and To Dos.
- **Counts.** An unread pill on each row, counted over the messages visible to the client; the Junk and Trash pills are grey.

Rows are `.side-item` buttons with the era mark. Section headers collapse. Accounts can be reordered by dragging.

### 6.2 Message list

- Columns in the split layout: flag, unread mark, attachment clip, From (To in Sent and Drafts), Subject, Date Received. A click on a header sorts; View > Sort By repeats it. Panthera and Leapard draw headers with `--ar-head`. The three-column layout draws rows with sender, date, subject and preview lines.
- Threads: View > Organize by Thread groups by `threadsOf` with a count and disclosure triangle. From Pear Mail 5 Conversations replace threads: a conversation includes messages of the same thread from Sent and other folders, dimmed when they are in Trash.
- Unread mark: a bold subject and the era's ball or dot. A message becomes read after the preview has shown it (at once when it opens in its own window), through one `markMessages` per opened thread.
- Flags: a single red flag until Pear Mail 5 (`star`), then seven colours through `Message.flag`, with `star` set whenever a colour is, so webmail shows a starred message. Message > Mark > Flag and a hover target in the list set it.
- Selection supports Shift and Command ranges. Double click opens a message in its own window (a second window of the same app, via `fresh`).

### 6.3 Preview

- Header block: From, Subject, Date, To, Cc, with a Details toggle. A note below the header names the server filter or client rule that handled the message when one did.
- Banner strip above the body for what the sim knows: junk warning with Not Junk, "Handled in the support desk" with Open, key detected.
- Body: `view(s, message).text`. From Pear Mail 3 data detectors underline licence keys (Copy), dates (Create To Do), domain names and addresses (Open in Browser), IP addresses (Open in Locations) and amounts (Open in Books).
- A message with a ticket shows the kit's `TicketSlot` under the text, which mounts support-desk's `ReplyPanel`/`TicketPane` (props `ticketId` and `compact`). Reply on such a message moves focus to the pane's reply list and does not open a compose window.
- Attachment strip below the body: icon, name, size, Save, and Quick Peek from Pear Mail 3 (Pear Mail 2 opens an attachment in a plain viewer window on double click). The attachment kinds of the contract render as follows: `key` lists the keys of the order from `s.licenses` with a Copy button, `invoice` reuses the `Letter` component of `PostApp` with the vendor letterhead, `doc` opens the Desktop document and offers Save to Desktop through `saveAttachment`, `file` shows its name and size.

### 6.4 Toolbar and menus

Toolbar buttons by build: Get Mail, Delete, Junk, Reply, Reply All, Forward, New Message, Move to (a popup), search field. Flag and Mark popups join in Pear Mail 3, Archive in Pear Mail 5. Disabled buttons follow the selection and the folder.

`MenuBar.tsx` today shows an app-name menu and a Window menu. This lane adds an optional `AppDef.menus(game, ctx)` that returns more titled menus, and generalises the menu bar item to the `MenuEntry` type of `src/ui/desktop/menu.ts` (nested items, checkmarks, disabled entries, a shortcut hint). Pear Mail contributes File (New Message, New Mailbox, Add Account, Close), View (Sort By, Organize by Thread, Show Preview, Columns), Mailbox (Get All New Mail, Erase Deleted Messages, Erase Junk Mail, Get Account Info), Message (Reply, Reply All, Forward, Move to, Mark, Apply Rules, Create Rule from Message), and Preferences under the app-name menu. Entries for a feature the build lacks do not appear.

### 6.5 Search

The search field filters the list as the player types over `view(...)` text. The scope popup offers Entire Message, From, To and Subject; a toggle switches between This Mailbox and All Mailboxes. From Pear Mail 5 typed words offer tokens (From: info@, Subject: licence) that become pills. Searchlight, the existing global search, gets a Mail group of the newest messages and opens `{ kind: "message", id }` through `useFocus("Pear Mail", ...)`.

### 6.6 Drag and drop

Messages drag with the HTML5 drag and drop the quote drag already uses, through the kit's drag and drop hooks (section 10). Valid drops are mailbox rows of the same account, On My Pear folders, and Trash and Junk (unified rows resolve per account). A drop onto a mailbox of another account shows the no-drop cursor in this plan (open decision 3). Holding Option copies instead of moving. Dropping a mailbox row onto another row nests it. Smart Mailboxes accept no drops.

### 6.7 Context menus and shortcuts

Context menus use `menuOn` and `openMenu` from `ContextMenu.tsx`: on a message (Reply, Reply All, Forward, Move to, Mark, Delete, Junk, Create Rule), a mailbox (Get Info, New Mailbox, Rename, Delete, Erase Deleted Messages), a Smart Mailbox (Edit, Delete) and the column header.

Shortcuts follow Apple Mail where the browser lets a page take them, and are active while a Pear Mail window is in front. The keys a browser keeps for itself (new window, new tab, close tab, private window) take Option in place of Command, and the menus show the key that works.

| Action | Key |
| --- | --- |
| Reply, Reply All, Forward | Cmd+R, Cmd+Shift+R, Cmd+Shift+F |
| New Message | Cmd+Option+N |
| Get Mail | Cmd+Shift+G |
| Delete, Junk | Delete, Cmd+Shift+J |
| Mark read or unread, flag | Cmd+Shift+U, Cmd+Shift+L |
| Send, Save draft | Cmd+Return, Cmd+S |
| Search, Preferences | Cmd+Option+F, Cmd+, |

Control stands in for Command off macOS. M12 checks the table in a browser.

## 7. Compose

Compose is a separate window, as in Apple Mail. The store gets one optional `Win.draft` (a draft message id, persisted with the window like `doc` and `console`), `openCompose(draftId)`, and a branch in `AppWindow` that renders the compose view for that window. The view is built on the kit's `useDraft`. Opening Compose creates an empty draft at once, so a reload keeps the window and its text; edits are saved on a debounce. Closing with no content discards the draft; closing with content asks Save, Don't Save or Cancel.

- **From.** A popup of the enabled accounts by Description and address, plus the aliases of each mailbox (`addressesOf`). A reply defaults to the address the original was sent to; a new message to the account of the selected mailbox, or the default From preference.
- **Header.** To, Cc and Bcc (the latter two behind View > Cc Header), Subject, Signature popup. The To field completes from Previous Recipients, the addresses seen in any message. Contacts are not part of this plan.
- **Body.** A text area. Pear Mail 3 adds a Stationery picker that styles the message on screen. Replies quote with a localized "On <date>, <name> wrote:" line built from `view`.
- **Signature.** Per account default from the `ClientAccount`; Preferences > Signatures edits them.
- **Attachments.** Attach opens a sheet listing the Desktop documents of kind `form` (as `Compose.tsx` does today), sent as `{ k: "doc", id }`. Forward keeps the original attachments.
- **Drafts.** For an IMAP account `saveDraft` and `discardDraft` act on the server Drafts folder. For a POP account the draft lives in the local Drafts folder and this lane's own save and discard actions handle it.
- **Send.** `sendMessage(s, account, { from, to, cc, subject, text, att, re, draftId })`. `mail-core` delivers to own addresses and staff, answers the trade office and notary through its responders, and returns a Mailer-Daemon message for an unknown address. The Sent copy is core's for an IMAP account; for a POP account this lane moves it into the local Sent folder and expunges the server copy. A failure such as `error.mailDown` keeps the compose window open with the sentence in a sheet and Try Again.
- **Undo Send (Pear Mail 16).** The window waits the preference's delay in real time, with an Undo banner, before it calls `sendMessage`.

The old `src/ui/apps/support/Compose.tsx` and its `paperwork.mail.*` keys are retired in M3.

## 8. Rules, Smart Mailboxes and Junk

### 8.1 Rules

Preferences > Rules lists rules with an enable checkbox and a generated description, with Add Rule, Edit, Duplicate, Remove and Apply Rules. The sheet copies Apple Mail's: Description, "If any or all of the following conditions are met", rows of field, comparison and value with minus and plus buttons, then "Perform the following actions" rows. It edits `ClientRule` through `saveClientRule` and `deleteClientRule` (this lane's actions) and applies a selection through `applyClientRules`.

- **Conditions** are the `MailCond` fields: From, To, Subject, Message Is (the `kind`), Size, Has Attachment, with the comparisons contains, is, begins with, ends with, is over. The rule's `clientId` is the "Account" popup (one account or all).
- **Actions** are `MailAct` plus `ClientAct`: Move Message to Mailbox, Copy Message to Mailbox, Mark as Read, Mark as Flagged, Add Label (label hosts), Forward Message to, Delete Message (to Trash), Move to Junk, Mark Not Junk, Stop Evaluating Rules, then Set Color of Message and Play Sound, which only change how Pear Mail shows the message, and Reply to Message (a subject and a text), which is a vacation-style auto reply.
- **Auto reply.** Reply to Message follows the rule `mail-core` sets for a vacation: it answers a sender once (`pearMail.replied` keeps the rule and sender) and only mail from the company's own mailboxes reaches anything that reads it, so customers, vendors and other sim senders never see it. The reply is sent through `sendMessage` and marked automatic. Pear Mail produces out-of-office loops only through this action: two of the player's own mailboxes that both auto reply, one by a rule here and the other by a server vacation or a rule of their own, answer each other once each. Without an enabled auto reply there is no loop.
- **Evaluator.** `matchesConditions` from `mail-core`, shared with server filters, so a rule behaves the same in both places. The limits are the ones core states: 30 client rules, 5 conditions and 5 actions each.
- **Create Rule from Message** opens the sheet filled with the selected message's sender and subject.

### 8.2 Smart Mailboxes

A Smart Mailbox is a saved search over the messages the client can see (visible server messages of the enabled accounts and the local store), evaluated live and never stored as a list. Its conditions are the `MailCond` fields plus client-only ones: Account, Mailbox, Date Received (within the last N days), Is Unread, Is Flagged, Is Junk, Message Content (a match on `view` text). Options: include Trash, include Sent. It appears in the sidebar with an unread pill and accepts no dropped messages. Pear Mail 3 ships Today and Unread as examples; the player creates the rest, such as a Licence Keys box that matches `kind` licence across accounts.

### 8.3 Junk

`mail-core` decides what is junk (`Message.junk`, the host's catch rate, `falseJunk`, `MailAccount.trained`, `reportJunk`). Pear Mail adds the client filter:

- **Training (Pear Mail 2).** Junk that reached the Inbox (`junk` set) is tinted brown. The Junk and Not Junk buttons call `reportJunk`, which also trains the mailbox. Preferences > Junk Mail switches to Automatic.
- **Automatic.** At each check Pear Mail moves Inbox messages with `junk` set to Junk with `moveMessages`, with a share of `min(0.9, 0.3 + 0.02 * trained)` drawn from a hash of the message id, so a message always gets the same verdict at the same training level.
- **Critical mail.** Core exempts bank, notice and legal mail from junk, and the client step never touches a message that is not marked junk, so a wrong verdict costs a glance at the Junk folder and never a stuck game.
- **Moving out of Junk** calls `reportJunk` with junk false. Erase Junk Mail is `emptyFolder`.

## 9. Preferences and the account lifecycle

Preferences opens as a large sheet with an icon tab strip, in the order General, Accounts, Junk Mail, Viewing, Composing, Signatures, Rules, as the real window does (Cmd+,).

- **General.** Check for new mail (the interval list), New mail sound, Dock count.
- **Accounts.** A list on the left with plus, minus and enable checkboxes. Tabs: Account Information (Description, address, full name, password, incoming type, incoming and outgoing host, Enable this account), Mailbox Behaviors (store Sent on the server) and Advanced (for POP the "Remove copy from server after retrieving a message" list with right away, after a day, after a week, after a month and never; port and Use SSL).
- **Viewing.** Preview lines (Pear Mail 8), organise by thread or conversation, use classic layout (Pear Mail 5).
- **Composing.** Automatically Cc myself, default From, Undo Send delay (Pear Mail 16).

What happens when things change under the account:

| Event | What Pear Mail does |
| --- | --- |
| The player disables the account | It stays in the sidebar greyed, is not checked, and its messages leave the unified mailboxes |
| The player removes an IMAP account | A confirm sheet; `removeClientAccount` runs and the server is untouched, so the mailbox is still in webmail |
| The player removes a POP account | A confirm sheet with "Keep a copy of its mail in On My Pear", ticked by default; unticked, the downloaded mail goes with the account |
| The provider is switched (`migrateMail`) | Mailbox ids stay, so the account keeps working in builds with automatic setup. In Pear Mail 2 the typed host name no longer matches `mailServersOf`, the warning triangle appears with `error.mailServer`, and editing the host to the new provider's name fixes it |
| The password is changed on the provider website | The next check fails with `error.mailPassword`, the sidebar shows the warning triangle and the account stops checking. Opening the account shows the password prompt; the right password clears the triangle, resumes checks and offers to update KeePassive |
| The mailbox is deleted on the provider website | `error.mailNoBox` at the next check, the warning triangle, and the Activity line. Downloaded POP mail stays |
| The provider is cancelled | The mailbox stays readable for 30 days with `error.mailClosed`; the sidebar shows a closed marker, and dragging mail to On My Pear keeps it |
| The provider or the own mail server is down | The same triangle with `error.mailDown`, cleared by the next successful check |
| The mailbox is full | Mailbox > Get Account Info shows the used share (`usedKb` against `quotaMbOf`), the Older mail bucket and a Delete older mail button (`purgeOlder`); core queues and bounces incoming mail while the box is full |

The Mail Activity window (Window > Activity, Cmd+0) lists `pearMail.activity`: checks with their counts and progress bars, sends, and failures with a Try Again button. A line that is a few seconds old draws as a running bar; older lines are plain.

## 10. Shell conventions, the shared kit and files

Pear Mail registers like every app: an `AppDef` in `src/ui/apps/registry.ts` (name `Pear Mail`, `PearMailMark` from `art/mailmarks.tsx`, tile `oklch(0.62 0.15 245)`, `badge: unreadBadge`), a window size in `WINDOW_SIZES` (about 1000 by 640), a body in `src/ui/apps/pear-mail/`, deep links through `openApp("Pear Mail", { kind: "message", id })` and `useFocus`, sheets through `Confirm` and `useDismiss`, menus through `openMenu`, banners through `notify`, strings through `t()`, and dates and numbers through `LOCALE`. The entry is added hidden in M1 and shown by the cutover pull request of `mail-core` (its milestone 7), which also routes `openApp("Support", ticket)`.

### The shared mail UI kit

`src/ui/apps/mail-kit/` is owned by this lane and built in M2. It holds the non-visual hooks that Pear Mail, the webmail lanes and the desk site build their mail views on; those lanes import it and draw their own visuals. The kit renders nothing except one thin mount for the ticket pane. It wraps the `mail-core` reads and actions so every screen shares one selection model, one drag and drop rule and one draft lifecycle:

- `useFolders(accountId)` and `useFolder(accountId, folderId, options)`: the folder tree from `foldersOf` and the rows from `listFolder`, with sort, search over `view` text, optional `threadsOf` grouping and `unread` counts, with a selector that re-renders only the mailbox that changed.
- `useSelection(rows)`: single, range and toggle selection with arrow-key handling, and the rule that a message is marked read once opened, one `markMessages` per opened thread.
- `useMessage(accountId, id)`: `view(s, message)` with the attachments resolved.
- `useMailActions(accountId)`: bound wrappers for `moveMessages`, `deleteMessages`, `restoreMessages`, `markMessages`, `reportJunk`, `labelMessages` and the folder actions, each going through the store's `act` and returning the error key.
- `useMailDrag(ids)` and `useFolderDrop(accountId, folderId)`: the HTML5 drag source for rows and the drop target for folders, with the type `application/x-backbone-mail`, moving within one mailbox.
- `useDraft(accountId, draftId?)`: creates a draft through `saveDraft`, saves edits on a debounce, discards an empty draft on close and exposes `send()` over `sendMessage` with its error.
- `TicketSlot`: mounts support-desk's `ReplyPanel`/`TicketPane` for a message that has a ticket, and shows a note with an Open link when `channelOf` says a desk imported the mailbox.

Pear Mail wraps the same hooks with local-store variants for the `pear` account. M2 mounts the real pane when support-desk M1 has landed and shows the envelope text until then.

### Files

| File | Change | Rule |
| --- | --- | --- |
| `src/ui/apps/registry.ts` | `Pear Mail` entry, `menus` field on `AppDef` | `menus` is optional so other apps are untouched; the cutover flips `hidden` |
| `src/ui/desktop/MenuBar.tsx` | Render `AppDef.menus`, accept `MenuEntry[]` | The Change provider item for Support goes with the cutover |
| `src/ui/store.ts` | `Win.draft`, `openCompose`, `WINDOW_SIZES` entry, `messageId` in `focusOf`, Dock bounce on `event.newMail` | `draft` is persisted with the window like `doc` |
| `src/ui/desktop/AppWindow.tsx` | One branch that renders compose for `win.draft`, with the subject as window title | Same shape as the `doc` and `console` branches |
| `src/ui/desktop/Dock.tsx` | `data-app` on dock buttons so a bounce can find a tile | One attribute |
| `src/ui/notify-types.ts`, `src/ui/sounds.ts` | `Pear Mail` notification group; `mail` and `send` UI sounds in the era voices | Appended entries |
| `src/ui/search/hits.ts` | Mail group for Searchlight | Newest 200 visible messages of enabled accounts |
| `src/sim/checklist.ts` | Goal `pearMail`, done once an account exists | One entry; the order is the first-hour walk's |
| `src/sim/50-state.ts`, `91-save/save.ts` | `pearMail` key and `fillPearMail` | One commented line each, as the README hotspot rule says |
| `src/sim/88-tick/tick.ts` | `pearMailTick` in `tick` and in `tickMinute` | One line each |
| `src/sim/90-actions/index.ts` | One export for `pear-mail.ts` | One line |

Sim code lives in `src/sim/10-catalog/pear-mail.ts` (builds), `src/sim/43-pear-mail/` (`state.ts`, `check.ts` for the tick and the POP and IMAP logic, `view.ts` with the pure unified-mailbox, visibility, conversation and badge functions, `smart.ts`, `junk.ts`, `detect.ts`) and `src/sim/90-actions/pear-mail.ts`. UI lives in `src/ui/apps/pear-mail/` (`PearMailApp.tsx`, `Sidebar.tsx`, `List.tsx`, `Preview.tsx`, `Toolbar.tsx`, `Assistant.tsx`, `Compose.tsx`, `Preferences.tsx`, `Rules.tsx`, `ConditionEditor.tsx`, `Activity.tsx`, `pear-mail.css`) and `src/ui/apps/mail-kit/`. English text goes in `src/i18n/ui-pear-mail.ts` with mirrors in `de`, `es`, `fr`, `it` and `pt`.

### Boundaries with the other lanes

- `EmailSettings.tsx` and the provider choice move to the provider websites and are deleted by `mail-core`. Pear Mail never imports them.
- The `PEAR` constant in `support/desk.ts` and the `data-style="pear"` rules in `support.css` go with the Support app; this lane takes over `PearMailMark` and the name.
- `sendMail` in `90-actions/paperwork.ts` becomes a wrapper over core's `sendMessage` and responders.

## 11. Puns and names

| Real name | In the game | Where |
| --- | --- | --- |
| Apple Mail | Pear Mail | The app, its Dock tile, the menu bar |
| macOS releases | Panthera, Leapard, Yosemighty, Big Sir, Tahoo (existing in `os.ts`) | Chrome and build gates |
| Spotlight | Searchlight (existing) | Mail results in global search |
| Quick Look | Quick Peek | Attachment preview |
| Gmail | GMix | Account tile, host names |
| Google Workspace | Goggle Workspace | Account tile, host names |
| Outlook and Microsoft 365 | Lookout 365 | Account tile, host names |
| IONOS Hosted Exchange | Hosted Exchange by Ionose | Account tile, host names |
| Postfix | Postfixit | Own mail server host |
| Mailcow-style stack | Mailpig | Own mail server host |
| Webmail on the own server | Named by `webmail-server` | Host rows |
| Mail Drop, Markup, iCloud, Keychain | Not in the game | Left out |

Generic feature names (Smart Mailboxes, Rules, Junk, VIPs, Stationery, Notes, To Dos, Activity, Archive, Categories) stay as they are; they are not company names.

## 12. Milestones

Each milestone is one pull request, green on its own, with a seeded Vitest suite in `tests/` that calls the actions directly. Every new English key goes in `ui-pear-mail.ts` with the same key in each `src/i18n/<lang>/` file. M1 to M3 give a usable client in front of the `mail-core` cutover, which waits for "a mailbox list, a reader with `TicketPane`, compose".

1. **State, builds and the check.** Needs `mail-core` M1 and M2 (types, accessors, `capsOf`, `serverStatus`).
   - Sim: `10-catalog/pear-mail.ts` (builds, features, `mailBuild`, `mailHas`), `pearMail` state with `ClientAccount` and `ClientRule`, `newPearMail`, `fillPearMail`, `pearMailTick`, `getMail`, IMAP visibility by `at` and `syncedAt`, POP download with `popRemove` and `popDue`, the event list, Activity lines, `unreadBadge`.
   - UI: a hidden `Pear Mail` registry entry and an empty window frame in the five looks that shows the build name.
   - i18n: app, build, event and activity labels.
   - Tests: `tests/pear-mail-builds.test.ts` (Panthera in 2012 stays on Pear Mail 2, Leapard in 2011-07 gets Pear Mail 5, Yosemighty in 2014-10 gets 8; feature gates reject on an old build; `serialize` and `deserialize` round trip; a new game has no account and `welcomed` false; an old save gets an account for its primary mailbox with its password and `welcomed` true, and does not re-seed after the player removes the account; 2,000 local messages stay under the size budget) and `tests/pear-mail-check.test.ts` (an IMAP message is hidden until the next check; a POP account downloads at its interval and not before, `now` removes the server copy and webmail loses it, `never` keeps it unread on the server, a scheduled removal happens at its time, no message downloads twice; a manual account checks only on Get Mail; the check runs with no window; a down server sets and clears the warning; a password changed on the provider fails the next check, stops the account and is cleared by entering the new one; one event per message up to three, then a summary).
2. **Mail kit, the window and the reader.** Needs `mail-core` M5.
   - Sim: `view.ts` (unified mailboxes, sort, grouping, local-store lists) and `detect.ts` for data detectors.
   - UI: `src/ui/apps/mail-kit/` with the hooks of section 10; full sidebar with counts, list with columns, thread disclosure and unread marks, preview with header, banners, attachment strip and viewer, `TicketSlot`, search with scopes, Panthera and Leapard looks, Dock badge, bounce and new mail sound, Get Mail button.
   - i18n: sidebar, column, header and preview labels.
   - Tests: `tests/pear-mail-view.test.ts` (unified Inbox merges accounts, sort orders, thread grouping, counts follow reads, a POP account lists its local store), `tests/mail-kit.test.tsx` (selection, drag payload, folder rows from `listFolder`) and one render case per release in `tests/pear-mail-ui.test.tsx` (classes and column set).
3. **Message actions and compose.** Needs `mail-core` M5.
   - Sim: local variants for the `pear` account (move, delete, mark, save and discard drafts); everything else calls `deleteMessages`, `moveMessages`, `reportJunk`, `saveDraft`, `discardDraft` and `sendMessage`.
   - UI: toolbar with Delete, Junk, Reply, Reply All, Forward, New Message and Move to; compose window with `Win.draft` and `useDraft`, From popup, signature popup, attach sheet, Cc and Bcc, quoting; `Compose.tsx` retired.
   - i18n: compose and toolbar labels, quoting line.
   - Tests: `tests/pear-mail-compose.test.ts` (a signed form to the trade office files and the answer lands in the sending account; an unknown address bounces into that Inbox; a draft survives `serialize`; a POP account keeps its Sent copy locally; delete moves to Trash and a second delete removes; Junk calls `reportJunk`). This milestone and M2 unlock the `mail-core` cutover.
4. **Accounts and the assistant.**
   - Sim: `setupClientAccount`, `editClientAccount`, `setAccountEnabled`, `removeClientAccount` (with keep-copy), the failure table of section 5.3, a Getting started goal `pearMail` in `checklist.ts` that is done once an account exists.
   - UI: the first-launch welcome with "Add your first account", the assistant for Pear Mail 2 and 3 with its password field, KeePassive autofill and save offer through `savedLogin` and `offerLogin`, the password prompt sheet, warning triangles, the Mail Activity window.
   - i18n: welcome and assistant labels and the `error.mail*` sentences.
   - Tests: `tests/pear-mail-accounts.test.ts` (GMix IMAP fails in 2006 and works in 2009, ProMail works at once; a wrong password fails the check and the right one passes; with KeePassive installed the saved login fills the field, without it the field starts empty; wrong host; address not on the host; external programs off; own server off; DNS unresolved; duplicate; Continue keeps an account in error; remove with and without keep-copy).
5. **Mailbox management.** Needs `mail-core` M5.
   - Sim: local folder actions under On My Pear; the rest calls `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, `emptyFolder`, `restoreMessages`, `purgeOlder`.
   - UI: New Mailbox sheet with location popup (account or On My Pear) and parent, rename and delete with confirm sheets, drag and drop, context menus, Get Account Info, Erase Deleted Messages, `AppDef.menus` and `MenuEntry` support in `MenuBar.tsx`, keyboard shortcuts.
   - i18n: menu, sheet and confirm text.
   - Tests: `tests/pear-mail-folders.test.ts` (a folder made in Pear Mail exists in webmail's list, a folder under On My Pear does not, moving an IMAP message to On My Pear removes the server copy, a cross-account move is refused, Erase Deleted Messages empties Trash).
6. **Rules and Smart Mailboxes.**
   - Sim: `saveClientRule`, `deleteClientRule`, `applyClientRules`, the rule step in the check, `smart.ts` evaluation, `saveSmartMailbox`, `removeSmartMailbox`.
   - UI: Rules pane, rule sheet, `ConditionEditor`, Smart Mailbox sheet, Create Rule from Message, colour and sound actions in the list.
   - i18n: field, comparison and action labels, generated descriptions.
   - Tests: `tests/pear-mail-rules.test.ts` (any and all, each action, order, Stop Evaluating, a rule scoped to one account, apply to a selection, a rule that moves an IMAP message shows in the server folder, a POP rule touches only the local copy, a Licence Keys Smart Mailbox spans two accounts; an auto reply rule answers each own-mailbox sender once, is never read by a customer or vendor, and with no auto reply enabled no loop occurs).
7. **Junk.**
   - Sim: `junk.ts` (client share, hash verdict), `junk` preferences, the check step.
   - UI: brown tint in training, Junk Mail pane, junk banner.
   - i18n: junk labels.
   - Tests: `tests/pear-mail-junk.test.ts` (same message same verdict, the share rises with `trained`, unmarked mail is never moved, automatic moves to Junk, moving out trains).
8. **Preferences, signatures and lifecycle.**
   - Sim: `setPearPref`, `saveSignature`, `removeSignature`, the lifecycle rows of section 9.
   - UI: the Preferences sheet with all tabs, the Advanced tab with port and Use SSL (last, optional), What's new.
   - i18n: preference and lifecycle sentences.
   - Tests: `tests/pear-mail-lifecycle.test.ts` (a provider switch keeps an automatic account working and breaks a manual one until the host is edited, a deleted mailbox keeps POP mail, a cancelled provider leaves the account readable and a dragged message survives, removal with and without keep-copy).
9. **Leopard features (Pear Mail 3).**
   - Sim: `saveNote`, `removeNote`, `setTodoDone`, a To Do due event, detector parsing, `autoSetup` in the assistant, the "Automatically" interval.
   - UI: Notes and To Dos under Reminders, detector popups, Quick Peek, Stationery picker.
   - i18n: notes, detector and stationery text.
   - Tests: `tests/pear-mail-leopard.test.ts` (a key, a date and a domain are detected in a vendor mail; a due To Do raises one event; the gates reject these on Panthera).
10. **Lion and Mountain Lion features (Pear Mail 5 and 6).**
    - Sim: conversation grouping across folders, flag colours through `Message.flag`, Archive through `moveMessages`, search tokens, VIP list, provider tiles in the assistant.
    - UI: three columns, favourites bar, conversation list, colour flag menu, Archive button, token field, VIP star, banners.
    - i18n: new labels.
    - Tests: `tests/pear-mail-lion.test.ts` (a conversation includes Sent and a dimmed Trash message, a flag colour round trip leaves `star` set, a VIP raises a banner when others do not, a tile fills the host).
11. **Later looks and features (Pear Mail 8, 14, 16, 26).**
    - Sim: `domainDetect`, Undo Send and Send Later, Remind Me, Categories as a client grouping of the Inbox by the existing `MailKind` values (order, licence, invoice and bank under Transactions; host, alert and system under Updates; junk under Promotions; everything else Primary).
    - UI: Yosemighty, Big Sir and Tahoo chrome, preview lines, Undo Send banner, Categories tabs.
    - i18n: new labels.
    - Tests: `tests/pear-mail-late.test.ts` (build gates, domain detection of a company domain, Send Later holds until its hour, Categories put order mail under Transactions) and one render case per added release.
12. **Polish.**
    - Sim: fixes only.
    - UI: Searchlight Mail group, the browser pass over the shortcut table, window titles for message and compose windows, sounds per era voice, empty states.
    - i18n: remaining strings.
    - Tests: `tests/pear-mail-search.test.ts` (Searchlight finds a message and opens it) and the existing `tests/i18n.test.ts`.

M2 and M3 can run in parallel after M1. M4, M5 and M6 follow, and M7, M9 and M10 can run in parallel after M5.

## 13. What this lane needs from `mail-core` beyond the contract

1. `sendMessage` returns the id of the Sent copy (so a POP account can move it into the local Sent folder) and accepts `bcc`.
2. Read access to two provider facts: whether the "Allow external programs to fetch mail" switch is on for a mailbox (`webmail-consumer`) and the provider's poll gap, for `error.mailExternal` and `error.mailPoll`. A flag on `MailCaps` or a read in the provider catalog is enough.
3. `mailServersOf` also reports the year a host stops accepting plain connections, if the SSL row of section 5.3 is kept (open decision 6).
4. `serverStatus` and `capsOf` stay constant-time reads, since `pearMailTick` calls them for every enabled account each game minute.
5. `fillMail` runs before `fillPearMail` in the `deserialize` chain, as core already states.
6. A read `checkPassword(s, accountId, password)` over the password stored on the `MailAccount`, which `webmail-consumer` already plans ("Passwords are stored on the `MailAccount`"), and the Getting started guide's start password for the first mailbox. Core's assumption that any password is accepted changes accordingly.
7. `sendMessage` accepts an `auto` flag for the auto reply, and core's vacation rule (once per sender, own mailboxes only) is the one the Reply to Message action follows.

Decisions this plan takes where the contract leaves the client free: the check interval is in game minutes; Pear Mail 2 asks for host names even for hosts with `autoconfig`; a POP account keeps Sent and Drafts locally; Smart Mailboxes and Categories are client views over `MailKind`.

## 14. Decided

The user settled these questions; the sections above already follow them.

1. **Pear Mail starts empty.** A new game has no account in Pear Mail. The first launch shows a welcome with an "Add your first account" step that opens the assistant. Old saves get an account for their primary mailbox from `fillPearMail`.
2. **Passwords exist.** The assistant has a password field. KeePassive (store upgrade `keepassive`, `src/ui/vault.tsx`) autofills it and offers to save it; without KeePassive the player types it. A wrong password fails the account check, and an account whose password was changed on the provider shows the password prompt at its next check. Resetting a forgotten password happens on the provider site, where a code arrives by post after 2 to 3 days, and never in Pear Mail.
3. **Out-of-office loops need an autoresponder.** They happen only when an auto reply is enabled. Pear Mail can start one only through a Reply to Message rule, which follows the vacation rule of `mail-core` (once per sender, own mailboxes only).

## 15. Open decisions

Each recommendation is the planner's; the decision is the user's.

1. **Exchange accounts.** Real Mail added an Exchange account type for Hosted Exchange by Ionose and Lookout 365. Recommendation: leave it out, since every provider also offers IMAP in the game.
2. **Pear OS releases.** Keep five releases with dated Pear Mail builds on Leapard (recommended), or add Snow Leapard and Lyon releases to `OS_RELEASES`, which means touching the several hundred `data-os` selectors across the shell and app stylesheets.
3. **Moving mail between accounts.** Block it in this plan (recommended), or allow it as copy then delete, which would need a core verb.
4. **Compose window.** A separate window with `Win.draft` (recommended), or a sheet over the main window, which avoids the store change and loses reading while composing.
5. **Late features.** Build Undo Send and Categories (recommended, they change small behaviours), and skip Send Later and Remind Me, which have no use in the game.
6. **SSL and ports.** Keep the Advanced fields and the year a provider refuses plain connections, or cut them first if scope tightens. Recommendation: build them late and cut them first.
7. **Notes and To Dos.** Build the small local version in M9 (recommended), or leave them out and keep Reminders hidden.
8. **POP default in the assistant.** Remove the server copy right away (recommended, because it teaches the difference), or leave a copy.
9. **Forms by mail.** Should authorities answer with a form attachment that Save to Desktop (`saveAttachment`) turns into a Desktop document? Recommendation: yes, because it joins the forms flow to mail.
