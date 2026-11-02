# Webmail and mail administration

Lane id `webmail-server`. Built on [mail-core](mail-core.md) (accounts, folders, messages, filters), next to [mail-client](mail-client.md) (Pear Mail and the shared mail kit), [support-desk](support-desk.md) (tickets) and [webmail-consumer](webmail-consumer.md) (GMix and Goggle Workspace in the Browser). Cross-lane rulings are in [mail-suite](mail-suite.md); where this file and `mail-core.md` use different names, the `mail-core.md` names win. Related: `docs/design/plans/mail-dns-vpn-storage.md` (queue, blacklist and quotas of the mail servers, already built), `docs/design/plans/software-licences.md` (versions and console looks by installed version), `docs/design/software-versions.md`, `docs/design/software.md` (sections 2, 8 and 10).

## What changes

Today the company's mail server cannot be used to read or manage mail. Postfixit is a terminal page (`HostCli`), the Mailboxes tab of the Mailpig console lists names invented by `mailboxes()` in `consoles/services.ts`, the provider is chosen in the `EmailSettings.tsx` sheet, and Hosted Exchange by Ionose and Lookout 365 have no websites. After this plan:

- SquirrelMeal and, from 2008, Squarecube are the webmail of the player's own mail server. Each is software the player installs like any other, with its own website, version list and console, reached in the Browser at `webmail.<company domain>`. Each looks and behaves like the real webmail of the installed version: SquirrelMeal as plain HTML in frames, Squarecube from the Classic skin in 2008 to Plastic today.
- The player manages mailboxes, aliases, forwarders, the catch-all, quotas and passwords of the own server in a web admin: Postfixit Admin for Postfixit, real tabs in the Mailpig console, and terminal commands for both. This is where the separate `info@` box is created.
- SOGoat is the groupware webmail with calendar and contacts. Mailpig ships with it, as the real counterpart does, and it can be installed on its own from 2009.
- Hosted Exchange by Ionose and Lookout 365 get websites in the Browser: sign-up, plans, a control page for mailboxes and addresses, password resets by letter, the steps for switching away, and their web mail in the look of its era.
- Every mailbox login takes the account's password. KeePassive offers to save it and fills it in.
- The screens are drawn over the tenants, accounts, folders, messages and filters that `mail-core` owns. This lane owns the software catalog entries, the version data, the screens, the hooks `installedWebmail` and `selfHostCaps`, and the small state that belongs to a web front end itself (identities, address books, preferences).

The GMix and Goggle Workspace web interfaces belong to `webmail-consumer`, and the desktop client Pear Mail to `mail-client`. The non-visual mail kit at `src/ui/apps/mail-kit/` belongs to `mail-client` milestone 2, and this lane imports it.

## Decided

The user settled these; they are not reopened here.

1. SquirrelMeal, the SquirrelMail pun, is the webmail on the own mail server from 2005. Squarecube arrives in 2008 and SquirrelMeal stays installable beside it. SquirrelMeal's install milestone comes before Squarecube's.
2. Mailbox logins take the password set when the account is created. KeePassive (the store upgrade `keepassive`, `src/ui/vault.tsx`) offers to save it after a sign-in and fills it in. On the own server the player resets passwords directly in Postfixit Admin or Mailpig. At Ionose and Lookout 365 a reset sends a code by paper post, which arrives 2 to 3 working days later through the Post app (`post()` in `src/sim/40-support/letters.ts`).
3. Billing is per mailbox. Employee mailboxes are created on hire, and hiring needs a free mailbox slot on the active host.
4. Mistakes hurt. Deleting a mailbox loses its mail. Uninstalling the mail server software, or losing the server's data without a backup, loses all mail with no recovery. An out-of-office reply goes out only while the vacation is enabled, and on a host without loop protection (Postfixit, Hosted Exchange by Ionose) two mailboxes that answer each other with it enabled loop.
5. The pun names are approved.

## 1. Names

| Real counterpart | Pun | Role in the game | Host |
|---|---|---|---|
| SquirrelMail | SquirrelMeal | frame-based webmail, 2005 on | `squirrelmeal.org` |
| SquirrelMail plugins avelsieve, squirrelspell | Havelsieve, SquirrelSpelt | server-side Sieve filters, spell check | named in the plugin list |
| Roundcube Webmail | Squarecube | webmail for a mail server, 2008 on | `squarecube.net` |
| Roundcube skins classic, Larry, Elastic | Classic, Barry, Plastic | the three skins | none |
| SOGo | SOGoat | groupware webmail | `sogoat.org` |
| Postfix Admin | Postfixit Admin | web admin for Postfixit | `postfixitadmin.org` |
| Dovecot | Dovecoat | IMAP, POP and Sieve daemon that comes with Postfixit | named in package lists, message headers and the Postfixit Admin footer |
| SpamAssassin, Rspamd | Spamsassin, Rspamed | spam filter of Postfixit (optional) and of Mailpig (always on) | named in message headers and server pages |
| Outlook Web Access, Web App, on the web | Lookout Web Access, Lookout Web App, Lookout on the web | the web mail of Ionose and Lookout 365 | `owa.ionose.com`, `mail.lookout365.macrosoft.com` |

Sieve, ManageSieve, IMAP, POP, SMTP, MX and PHP are protocol and language names and stay as they are. The Message Filters and Change Password plugins of SquirrelMeal carry plain descriptive names. The Lookout 365 admin page is the Lookout 365 admin center at `admin.lookout365.macrosoft.com`; the Ionose provider site is `ionose.com` with its customer area under `/control`; the Lookout 365 sign-up site is `lookout365.macrosoft.com`.

## 2. Install, hosting and routing

### 2.1 Catalog

The front ends are new software of a new kind `mailweb`. `kind: "mail"` stays the mail server, because `selectMailServer`, `mailChecks`, `breach.ts` and `exposure.ts` read `c.kind === "mail"` to find it. Each front end gets its own cluster on the machine, like every other software.

| Id | Name | From | OS | Ports | Install | Control plane | Licence |
|---|---|---|---|---|---|---|---|
| `squirrelmeal` | SquirrelMeal | 2005 | lunix | 80, 443 | `apt-get install -y squirrelmeal` | 0.25 vCPU, 0.5 GB, 1 GB | free |
| `postfixitadmin` | Postfixit Admin | 2005 | lunix | 80, 443 | `apt-get install -y postfixitadmin` | 0.25 vCPU, 0.5 GB, 2 GB | free |
| `squarecube` | Squarecube | 2008 | lunix | 80, 443 | `apt-get install -y squarecube` | 0.25 vCPU, 0.5 GB, 2 GB | free |
| `sogoat` | SOGoat | 2009 | lunix | 80, 443, 20000 | repo line, `apt-get update`, `apt-get install -y sogoat` | 1 vCPU, 2 GB, 10 GB | free |

- The four share one web server, so `conflict(a, b)` ignores a shared port when both are of kind `mailweb`, and they answer under different paths. Mailpig and every web panel bind 80 and 443 for themselves, so the existing rule refuses a front end beside them. Mailpig does not need one, since it carries its own admin and SOGoat.
- The `apt-get install` output lists the dependencies by year: the web server, the PHP package named by `phpAt(year)` for the PHP front ends, the database driver and `dbconfig-common`. SOGoat lists its database and cache.
- Postfixit's install pulls in Dovecoat. Its ports gain 110, 143, 993 and 995, and the install output lists the Dovecoat packages. This is what makes a Postfixit server an IMAP host for `mail-core`, whose provider table says Postfixit offers IMAP and POP "once the server runs Dovecoat".
- A cluster of kind `mailweb` carries `backend: string | null`, the id of the own-server mail cluster it talks to. The install takes the mail cluster on the same machine; without one, the setup page asks. When the backend is gone or its control plane is down, login shows the connection error of the product.
- A front end serves the accounts of the own-server tenant and never fronts GMix, Goggle or the hosted providers.
- Versions come from the lists in sections 3, 4 and 6. The development line of SquirrelMeal (rows named `devel`) is taken only by the Edge channel of the existing `channel` command; Stable and Release skip it.
- Adding the kind touches `SERVES` in `platforms.ts`, `EXTRAS` in `vendor-cli.ts` (an empty command list), `VULN_RATE` in `vulns.ts` (rate 2, like panels), `needs()` in `exposure.ts` (the web macro), the kind labels in `products/parts.tsx` and `consoleLook`.
- Free software still ages: every front end gets a version line, end of updates and end of security updates, and its console shows an unsupported badge when out of support.
- Removing a front end deletes its own data (identities, address book, local filters) and loses no mail, since the mail lives on the server. The uninstall dialog says so. Uninstalling the mail server software is different and is stated in section 5.5.

### 2.2 Hooks for `mail-core`

`mail-core` defaults two hooks that this lane fills at load, in `src/sim/80-business/webmail.ts`, so core imports none of this code.

- `installedWebmail(s)` returns the id (`squirrelmeal`, `squarecube` or `sogoat`) of the front end that answers at `webmail.<company domain>`, or null. It is the first one installed unless the player picks another with `setWebmailDefault`. It feeds `MailCaps.webmail`.
- `selfHostCaps(s)` returns what the own server offers: IMAP and POP (Dovecoat installed), Sieve (Dovecoat from 2010 for Postfixit, always for Mailpig; unverified for the year), and the spam filter bonus to the junk catch rate that `mail-core` adds to its base of 0.5 for an own server: +0.25 for Spamsassin switched on in Postfixit, +0.4 for Rspamed, which is always on in Mailpig.
- The catalog rows `WEBMAIL` in `src/sim/10-catalog/webmail.ts` (id, name, from, until, features `threads`, `sieve`, `labels`) list the four front ends; `until` is null for all.

### 2.3 Reaching them in the Browser

- `resolve` in `80-business/browser.ts` gains `webmail.<domain>`, next to `portal.<domain>`. It answers as the default front end's page, or is not found without one.
- Every front end also answers on its machine's address. `CONSOLE_AT` in `80-business/consoles.ts` handles `/admin` for Mailpig by path today; it becomes a table of path prefixes: SquirrelMeal on `/squirrelmeal`, Squarecube on `/squarecube`, its wizard on `/squarecube/installer/`, Postfixit Admin on `/postfixadmin`, SOGoat on `/SOGo`, Mailpig on `/admin` and its bundled SOGoat on `/SOGo`.
- Mailpig's root page is a sign-in. Domain admins go on to `/admin`, mailbox users reach their webmail by a button, as the real start page works.
- `consoleBookmarks` iterates clusters, so each front end gets a bookmark once its path is in the table. `providerDomain` gains the new software and provider hosts so a customer cannot register them.
- The provider sites of section 7 use the page kind `{ kind: "mailProvider"; id: MailSiteId }` that `webmail-consumer` creates; this lane adds the ids `ionose`, `ionose-control`, `ionose-owa`, `lookout`, `lookout-admin` and `lookout-owa`, with their hosts in the host table of `mail-providers.ts`. The pages are real routes, so back, forward and bookmarks work.

## 3. SquirrelMeal

### 3.1 Versions

Dates are from the project's file index and its news page (verified) unless marked. The stable line is 1.4. The last numbered release was 1.4.22 in July 2011; maintenance after that came as snapshots, which is why the later rows are snapshots.

| Version | Released | Line | Notes |
|---|---|---|---|
| 1.4.4 | 2005-01 | stable | the release out at the start (month unverified) |
| 1.4.5 | 2005-07 | stable | |
| 1.4.6 | 2006-02 | stable | |
| 1.4.10 | 2007-05 | stable | 1.4.7 to 1.4.9 are filled between by `versions-catalog` |
| 1.4.13 | 2007-12 | stable | replaces the tarballs of 1.4.11 and 1.4.12, which a break-in on the download server had swapped for backdoored copies; the game announces it in its news |
| 1.4.15 | 2008-05 | stable | 1.4.14 was skipped |
| 1.4.16 | 2008-09 | stable | |
| 1.4.17 | 2008-12 | stable | |
| 1.4.19 | 2009-05 | stable | |
| 1.4.20 | 2010-03 | stable | |
| 1.4.21 | 2010-07 | stable | |
| 1.4.22 | 2011-07 | stable | the last numbered release |
| 1.4.23 | 2013-05 | snapshot | runs on PHP 5.4 and 5.5 |
| 1.4.23 (2021) | 2021-10 | snapshot | runs on PHP 8 |
| 1.5.1 | 2005-02 | `devel` | the development line; snapshots from 2004 to 2006 (unverified; one month after 1.4.4, since a version list is in strict release order) |
| 1.5.2 | 2021-11 | `devel` | development snapshot (one month after the 2021 snapshot, for the same reason) |

Edge takes the newest `devel` row once one is out and steps to the next one as a major upgrade; before the first one is out, and on Stable and Release, the `devel` rows are skipped. The install itself takes the newest stable row, since a cluster gets its channel after it is installed.

End dates are a game rule, because the project never published any: updates end with the next stable release, and security fixes a year later; 1.4.22 gets security fixes until 2014-07, the snapshots until a year after the next one. The version a player installs in 2015 is therefore out of security support, which is true to life, and a vulnerable SquirrelMeal on the web is an easy way to lose a mailbox (milestone 11). A PHP range per row (from `phpAt`) makes a host whose PHP moved past the row show the PHP error page until the player moves to a snapshot.

### 3.2 Look and behavior

The interface is plain HTML in a frameset, with no scripts in the browser. A left frame holds the folder tree and a right frame holds everything else. There is one look and several colour themes in Options. The 1.5 line draws the same frames with refreshed icons (unverified).

What follows from that:

- SquirrelMeal has no drag and drop, no preview pane and no automatic refresh. The player ticks messages, picks a folder in "Move Selected To" and presses Move, or clicks Check mail. This is the era-correct clumsiness that makes Squarecube feel like progress.
- There is no quota bar. A full mailbox shows up as the bounce.
- The Message Filters plugin sorts mail only when the player opens the mailbox in SquirrelMeal. Mail that arrives while nobody logs in stays unsorted. The server-side Havelsieve plugin sorts on delivery.

### 3.3 Screens and calls

| Screen | What the player sees | Calls |
|---|---|---|
| Login | the logo, "Name:" and "Password:", Login; "SquirrelMeal version 1.4.22 By the SquirrelMeal Project Team"; the errors "Unknown user or password incorrect." and "Error connecting to IMAP server: localhost. 111 : Connection refused." | `checkMailLogin`, `serverStatus`; KeePassive fills the form under the site key `mail:<address>` |
| Folder frame | "Folders", the last refresh time and Check mail; the tree with unread counts in bold and subfolders that expand and collapse | `foldersOf`, `unread` |
| Message list | checkbox, From, Date, Subject; "Viewing Messages: 1 to 15 (234 total)"; Toggle All; "Move Selected To" with Move and Copy; Transform Selected Messages: Read, Unread, Flag, Unflag, Delete; sort by clicking a column, a thread sort when the server supports it | `listFolder`, `moveMessages`, `markMessages`, `deleteMessages`, `threadsOf` |
| Message | links Message List, Delete, Previous, Next, Forward, Forward as Attachment, Reply, Reply All; the headers; View Full Header; attachments as links; HTML mail shown as text with a View as HTML link | `view`, `markMessages`, `messageSource` |
| Compose | To, Cc, Bcc, Subject, a plain text body, Add an attachment, signature, Send, Save Draft | `sendMessage`, `saveDraft` |
| Options | Personal Information (name, address, reply-to, signature, multiple identities), Display Preferences (theme, language, messages per page), Folder Preferences (Trash, Sent, Drafts, and "Do not use Trash"), Message Filters, Change Password | `setWebmailPref`, `saveIdentity` |
| Folders | create a folder as a subfolder of another, rename, delete, subscribe and unsubscribe | `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, the subscription list |
| Addresses | nickname, name, e-mail, info; a popup in Compose | `saveContact`, `removeContact` |
| Search | text in From, To, Subject or Body, in the current folder | selectors over `listFolder` and `view` |

### 3.4 Plugins

| Plugin | Version of the era | What it does in the game | Calls |
|---|---|---|---|
| Message Filters | bundled | rules (From, To or Subject contains, move to a folder) kept in the front end and run when the Inbox is opened, over the mail that arrived since the last run | `saveLocalFilter`, `runLocalFilters` |
| Change Password | third party | the player changes the account password with the old one | `changePassword` |
| Havelsieve | third party, offered when the server has Sieve | server-side filters in the same form as Squarecube's, so they run on delivery | `saveFilter` |
| SquirrelSpelt | bundled | a spell check button in Compose; cosmetic | none |

The Plugins list is an administrator choice in the setup menu. A plugin that is switched off has no entry in Options.

### 3.5 Setup menu and configuration test

A fresh install opens the setup menu, drawn as the numbered text menu of the real configuration tool inside a monospace page: Organization Preferences (name, logo), Server Settings (domain, IMAP server and port, SMTP server and port), Folder Defaults (Trash, Sent, Drafts), General Options, Themes, Address Books, Plugins, Language. Every value is prefilled with the local mail server, so the player can leave with a few keystrokes. A wrong IMAP server gives the login error above. The configuration test page lists PHP, the paths and "Checking IMAP service.. OK" or the failure, and is the diagnostic for a front end that cannot sign in. The setup menu calls `configureWebmail`.

## 4. Squarecube

### 4.1 Versions and dates

Dates come from the vendor's news archive and release table (verified) or its changelog (marked). Squarecube is installable from its first stable release in March 2008. The `versions-catalog` lane takes this table into `software-versions.ts` and `software-versions.md`. Installed Squarecube keeps its version until the player upgrades it; the console look follows the version, not the year.

| Version | Released | Default skin | What the game adds at this version |
|---|---|---|---|
| 0.1 | 2008-03 | Classic | folders with subscriptions and nesting, compose with the HTML editor, personal address book, identities, drag and drop of messages |
| 0.2 | 2008-12 | Classic | vCard import and export |
| 0.3 | 2009-09 | Classic | the plugin interface |
| 0.4 | 2010-08 | Classic | threaded list, contact groups, copy by drag and drop, and the plugins the game ships from here: Filters (Sieve), Mark as junk, Change password |
| 0.5 | 2011-01 | Classic | maintenance |
| 0.6 | 2011-09 | Classic | maintenance |
| 0.7 | 2011-12 | Classic | maintenance |
| 0.8 | 2012-08 | Barry | the new default skin; Classic stays bundled |
| 0.9 | 2013-04 | Barry | thumbnails for image attachments, CSV contact import |
| 1.0 | 2014-04 | Barry | the vacation form (unverified); Classic is no longer bundled |
| 1.1 | 2015-02 | Barry | search in several folders |
| 1.2 | 2016-05 | Barry | PHP 7 support |
| 1.3 | 2017-06 | Barry | Barry is flattened |
| 1.4 | 2019-11 | Plastic | the new default skin with a layout for small screens; Barry stays bundled |
| 1.5 | 2021-10 | Plastic | long-term support release; the Collected recipients address book (unverified) |
| 1.6 | 2022-07 | Plastic | Barry is deprecated |
| 1.7 | 2026-05 | Plastic | latest; Barry is no longer bundled (unverified) |

End dates: from the release table where it has them (1.2 until 2021-10, 1.3 until 2022-07, 1.4 until 2023-12, 1.5 updates until 2022-07 and security until 2026-05, 1.6 updates until 2026-05), 1.0 and 1.1 security until their last patches (2017-11 and 2018-04), and for every other line updates until the next release and security a year later, the pattern the catalog uses for OwnClod. A dark theme for Plastic appeared in July 2020 and is switched on by the player in Preferences.

The skin eras follow the real releases: the original skin to 0.7 (2011), the Larry successor from 0.8 (August 2012), Plastic from 1.4 (November 2019). Feature gates live in one table, `squarecubeFeatures(version)` in `src/sim/10-catalog/squarecube.ts`: `threads`, `groups`, `filters`, `vacation`, `multiFolderSearch`, `collected`, `darkTheme`, `skins`. The screens ask it and never compare versions. A PHP range per row works as for SquirrelMeal.

### 4.2 Skins

| Skin | Real counterpart | Default | Look |
|---|---|---|---|
| Classic | the original default skin | 0.1 to 0.7 | light grey and blue; a top bar with the logo and the Mail, Address Book and Settings tabs; a toolbar of icons with text labels; a folder list with counts in brackets and the quota bar at its foot; message list with the preview pane below |
| Barry | Larry | 0.8 to 1.3 | a dark slate header with round tab icons, a light toolbar, count badges in the folder list, message list left and preview right in the widescreen layout |
| Plastic | Elastic | 1.4 on | flat and responsive; a narrow icon rail at the left with Mail, Contacts, Settings, Help and Logout; a cyan accent; switches for folder subscriptions; a dark theme from 2020 |

A skin is a CSS file, a logo and a layout component, chosen with `eraAtHour`-style structural switches from the version. The skins Preferences offers follow the bundled column in 4.1. The login page of every skin shows the product name from the setup page, so a player who renames it to the company name gets "Hosttoast Mail" in the title bar and the heading.

### 4.3 What the player sees and what each screen calls

| Screen | What the player sees | Calls |
|---|---|---|
| Installer, `/squarecube/installer/` | one page in the style of the real wizard: product name, IMAP server, SMTP server, database; every field prefilled with the local mail server; Continue, then "Disable the installer" | `configureWebmail`; clears `setupPending` |
| Login | product name as title and heading; Username, Password, Login; the errors "Login failed" and "Connection to storage server failed"; KeePassive fills the form under the site key `mail:<address>` | `checkMailLogin`, `serverStatus` |
| Folder pane | Inbox, Drafts, Sent, Junk, Trash, then custom folders nested; unread count in bold; unsubscribed folders hidden; a menu with Mark all as read and, on Trash and Junk, Empty | `foldersOf`, `unread`, `markMessages`, `emptyFolder` |
| Message list | flag, attachment, subject, from (to in Sent and Drafts), date, size; unread bold, starred red; thread rows from 0.4; Select menu; drag onto a folder, Ctrl or Alt to copy from 0.4; Delete key | `listFolder`, `moveMessages`, `deleteMessages`, `markMessages`, `threadsOf` |
| Reader | From, To, Date; "All headers"; a banner when HTML mail has remote content blocked; attachments; Reply, Reply all, Forward, Delete, Mark, and More with print, show source, move to, mark as junk | `markMessages` after the preview delay, `moveMessages`, `reportJunk`, `messageSource` |
| Deleting | Delete moves the message to the folder set as Trash in Preferences; inside Trash it asks before removing; Empty on Trash asks once and removes everything | `deleteMessages`, `expungeMessages`, `emptyFolder` |
| Search | a box with scope (subject, from, to, entire message), from 1.1 also this folder, subfolders or all folders, and a filter menu (All, Unread, Flagged, Unanswered, With attachment) | selectors over `listFolder` and `view` |
| Compose | From (identity), To, Cc, Bcc with completion from the address book, Subject, plain text or the HTML editor toggle, attachments, signature, priority, return receipt, Save, a leave warning for unsaved text | `saveDraft`, `discardDraft`, `sendMessage` |
| Quota bar | under the folder list, a percentage in Classic and "Storage 12 MB of 100 MB" in Barry and Plastic | `quotaMbOf`, the account's `usedKb` |
| Settings, Preferences | User Interface (skin, layout, list mode from 0.4, dark theme), Mailbox View, Displaying Messages, Composing Messages, Special Folders (Drafts, Sent, Junk, Trash) | `setWebmailPref` |
| Settings, Folders | a list with a subscription checkbox (a switch in Plastic), Create with name and parent, rename and move, Delete with confirmation, properties with message count and size | `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, the subscription list |
| Settings, Filters (from 0.4) | the filter list, a form with rules and actions, and Edit filter set for the raw Sieve script | `saveFilter`, `deleteFilter`, `moveFilter`, `setFilterOn`, `saveSieveScript` |
| Settings, Vacation (from 1.0) | the managesieve vacation responder: On, Subject, Message, an until date, and on a host with loop protection a reply interval of 7 days; the raw script view shows it as a `vacation` command at the top of the script | `setVacation` |
| Settings, Identities | the list; display name, email, organization, reply-to, bcc, signature, Set default | `saveIdentity`, `removeIdentity` |
| Settings, Password | the plugin form with the current and the new password; a wrong current password shows `error.mailLogin` | `changePassword` |
| Contacts | the personal address book, groups from 0.4, search, vCard import and export, CSV import from 0.9 | `saveContact`, `removeContact` |
| About | version, PHP version, plugins with versions | none |

Rules that hold across SquirrelMeal and Squarecube:

- Sending as an address goes through `sendMessage`, whose `from` must be an address of the mailbox (`ownsAddress`). An identity with a foreign address fails at send with the host's wording ("SMTP Error (553): Failed to set sender" in Squarecube, the sender rejection text of the server in SquirrelMeal). An identity never creates an inbound route: mail for `info@` arrives when a mailbox or alias with that address exists. The player learns the difference between an identity and an address by trying it.
- Delete follows the Special Folders preference. A player who points Trash at a custom folder sends deletions there, and "Do not use Trash" makes Delete permanent through `expungeMessages`. The mapping defaults to the account's system Trash.
- Every message the player writes is stored by `mail-core` as `own` text, at most 2000 characters. The HTML editor is a toolbar over that text; formatting is dropped on send until `mail-core` allows an HTML flag.
- Filters and the vacation reply are the account's server-side state in `mail-core`. The Filters screen is a front end to `ServerFilter`, so Pear Mail and the delivery code see the same rules. A rule can use From, To, Subject, Size and Has attachment. The `kind` condition is never offered, as `mail-core` states.
- A mail that carries a ticket link opens the shared `ReplyPanel`/`TicketPane` from `support-desk`, not the compose form.
- Unread counts shown in the tab title come from `unread(s, accountId)`.

### 4.4 State owned here

```
s.webmail: {
  installs: Record<clusterId, {
    productName: string; smtpHost: string | null; installerOpen: boolean; plugins: string[];
    users: Record<accountId, { identities: Identity[]; contacts: Contact[]; groups: ContactGroup[]; prefs: WebmailPrefs; localFilters: MailRule[]; filteredAt: number }>;
  }>;
  servers: Record<mailClusterId, { spamFilter: boolean }>;   // Spamsassin on a Postfixit server
  subs: Record<accountId, string[]>;                          // folder ids the account unsubscribed
  default: string | null;                                     // the cluster that answers at webmail.<domain>
}
```

Milestone 1 builds `installs` and `default` only. An install holds what the setup menu sets: `productName`, `domain`, `imapHost`, `imapPort`, `smtpHost`, `smtpPort` and `plugins`; the IMAP server it names decides `Cluster.backend`. `installerOpen`, `users`, `servers` and `subs` come with the milestones that use them.

`newGame` sets `webmail` to empty records and `deserialize` spreads it, so old saves load with no installs and no data. A user's entry is created on first sign-in with one identity from the account (title, address) and the defaults of the installed version. The backend id sits on the cluster (2.1). SOGoat keeps its calendar and address books under a `groupware` key per user, added in milestone 10. `Identity`, `Contact`, `ContactGroup` and `WebmailPrefs` are defined in `src/sim/80-business/webmail.ts`.

## 5. Administration of the own mail server

### 5.1 What each host supports

The own-server and provider columns follow the provider table of `mail-core` (`MailCaps`), which this lane's catalog rows fill for `ionose` and `lookout`.

| Capability | Postfixit | Postfixit with Postfixit Admin | Mailpig | Hosted Exchange by Ionose | Lookout 365 |
|---|---|---|---|---|---|
| Mailboxes (`createMailAccount`) | terminal | yes | yes | yes, billed per mailbox | yes, billed per mailbox |
| Aliases (`addAlias`) | terminal, up to 50 | yes | yes | up to 10, free | up to 50, free |
| Forwarder to an outside address (`setForward`) | terminal | yes | yes | yes | yes |
| Catch-all (`setCatchAll`) | terminal | yes | yes | yes | yes |
| Quota per mailbox | terminal, default 1 GB | yes | yes | by year: 500 MB, 2 GB from 2009, 10 GB from 2013, 50 GB from 2016 | by year: 25 GB, 50 GB from 2013, 100 GB from 2016 |
| Server filters | Sieve once Dovecoat has it | none of its own | Sieve | inbox rules | inbox rules and mail flow rules |
| Vacation reply (`setVacation`) | yes, no loop protection | yes, field on the mailbox form | yes, with loop protection | Out of Office, no loop protection | Automatic replies, with loop protection |
| Spam filter | Spamsassin, off until switched on | switch on the server page | Rspamed, always on | provider filter | provider filter |
| Shared mailbox | no | no | no | no | free, if `mail-core` decides so |
| Pull mail from another tenant (`importMail`) | no | no | Sync jobs | no | Migration page |
| Settings found by Pear Mail on its own | no | no | yes | yes | yes |
| Web access | SquirrelMeal, Squarecube or SOGoat | same | SOGoat built in | Lookout Web Access | Lookout Web App, Lookout on the web |

The own-server rows live in one table, `MAIL_SOFTWARE`, in `src/sim/80-business/mail-software.ts` (`sieveFrom`, `spam`, `autoconfig`), read by `selfHostCaps`. The company has one domain and each tenant serves one domain, so there is no domain list to add to; the domain page shows the company domain with its SPF, DKIM and DMARC checks from `mailChecks`.

### 5.2 Postfixit Admin

The real counterpart is a PHP page of plain tables. It has two looks, `early` for the 2.x line (2005 to 2015) and `late` for 3.x (2016 on), both unverified as to the exact years.

- First visit shows its setup page: a setup password and the first admin account, prefilled so Continue twice is enough.
- Overview and Domain: the company domain with its mailboxes and aliases in use, the default quota and the checks. There is no maximum to set, since an own server holds as many mailboxes as the disk allows.
- Mailboxes: address, name, quota, used, receives (owner mail, sales, support, abuse). Create mailbox takes the local part, the password twice, the name, the quota, the roles and "Send welcome mail", ticked by default. The password is at least 6 characters. Edit changes the name, quota, roles, the vacation (`setVacation`) and, in a Reset password field, the password (`setAccountPassword`). A mailbox created for a new hire shows its seeded password on its Edit page. Delete asks "Delete this mailbox?" and names the number of messages it removes.
- Aliases and forwarders: Create alias takes the address and a mailbox it goes to (`addAlias`); a mailbox form has a Forward to field for an outside address (`setForward`); the alias `*` is the catch-all (`setCatchAll`). "Add default mail aliases" creates `postmaster@`, `abuse@`, `hostmaster@` and `webmaster@` on the admin mailbox; `abuse@` is the role address that receives abuse reports.
- The welcome mail is a real message in the new mailbox, so the first sign-in finds one unread mail.
- The server page has the Spamsassin switch (`setMailSoftwareOption`), the Dovecoat version and a Backup line that shows the last successful backup of the mail server's machine, or "none".

Versions (all unverified as to the month): 2.1 (2005-01), 2.2 (2008-01), 2.3 (2009-07), 3.0 (2016-08), 3.2 (2018-05), 3.3 (2020-11). Updates end with the next release and security fixes a year later, like SquirrelMeal. Milestone 1 ships its site and a sign-in to its software page; the setup page and `setupPending` on its cluster come with milestone 2.

### 5.3 The Mailpig console

The tabs that exist stay (Queue, Blacklist, Configuration and the checks). The invented Mailboxes tab is replaced and new tabs are added, all in the existing dark pink look:

- Mailboxes: real accounts from `mail-core`, with quota, messages and roles, Add mailbox (name, local part, password, quota), Edit (including Reset password through `setAccountPassword`, and the seeded password of a hire's mailbox) and Delete with the number of messages it removes.
- Aliases: address, goes to; a catch-all is the alias `@domain`.
- Filters: the Sieve filters of a chosen mailbox, in the same editor as Squarecube's.
- Sync jobs: pick another tenant of the company and a target; the job is `importMail`, which copies the mail over hours. This is the migration path from a provider the player leaves.
- Quarantine: mails the spam filter held in Junk, with Release (`reportJunk` with `junk: false`) and Delete.
- Configuration: the existing software facts, the Rspamed line and the Backup line.

### 5.4 Terminal commands

The vendor CLI in `vendor-cli.ts` gets, for the `mail` kind: `mailbox add|del|list|quota|passwd` (`passwd` calls `setAccountPassword`), `alias add|del|list`, `catchall <address>|off`, `spam on|off` (Postfixit). They call the same `mail-core` actions as the admin pages, so a bare Postfixit is fully manageable from the terminal and the admin is the comfortable way. The vendor's docs page describes each command by id, as it does for the existing ones.

### 5.5 Passwords and mistakes on the own server

- The player is the admin, so a forgotten password is reset in Postfixit Admin or Mailpig (or `mailbox passwd`) at once through `setAccountPassword`, with no letter. The mailbox keeps its mail, and clients configured with the old password stop working until the player updates them in Pear Mail.
- Deleting a mailbox removes its messages for good and makes its address a stale address for 90 days, as `mail-core` describes. Both admin pages show the message count and the stale warning before they delete.
- Uninstalling the mail server software ends the own-server tenant at once with no grace. The uninstall dialog names the number of mailboxes and messages that go with it. Losing the server's data, for example by a dead disk with no backup, has the same result. A backup of the machine is the only recovery, and the Backup line on both admin pages shows whether one exists.
- A vacation reply goes out only while the vacation is enabled. Mailpig has loop protection (one reply per sender per week, never an answer to an auto-reply). Postfixit has none, so two mailboxes with the vacation on, or a vacation reply to a forwarder that points back, loop until the 10-hop limit of `mail-core` ends it with a Mailer-Daemon message, and every reply costs quota.

## 6. SOGoat

### 6.1 What it is

The groupware webmail: the Squarecube mail view plus a calendar, address books, sharing of folders and delegation of mailboxes, and Sieve filters and an Auto reply screen in its own Preferences. Mailpig carries it, so a Mailpig player has groupware from the first release in 2016. A Postfixit server can install it from 2009 as the heavier alternative to Squarecube.

| Version | Released | Look |
|---|---|---|
| 1.0 | 2009-03 | classic |
| 1.1 | 2009-10 | classic |
| 1.3 | 2010-07 | classic |
| 2.0 | 2012-09 | classic; native Outlook compatibility |
| 2.3 | 2015-06 | classic |
| 3.0 | 2016-01 | material; the responsive interface |
| 3.1 | 2016-05 | material |
| 3.2 | 2016-10 | material |
| 4.0 | 2018-03 | material |
| 5.0 | 2020-08 | material |

The dates are from the vendor's yearly news pages. Releases between these (1.2, 2.1, 2.2 and the 3.x to 5.x steps) are filled by `versions-catalog` from the same pages. A version 6 alpha appeared in July 2026 and is announced in the game's news, and installs stay on 5.x until a stable 6 exists. The vendor's pages and the encyclopedia tie the responsive Angular Material interface to 3.0 in January 2016, so the look changes there and 5.0 is a colour refresh behind a CSS variable set (unverified). The copy bundled in Mailpig takes its version from a lookup of Mailpig release month to the SOGoat version it shipped with.

### 6.2 What it adds over Squarecube

- Calendar. It holds the player's own events and a read-only feed of the game's dates through `deadlines(s)`: hardware deliveries, contract notice dates, tax and paperwork deadlines, licence renewals.
- Address books with sharing between mailboxes of the same server, and vCard export that Pear Mail can import.
- Sharing and delegation. A mailbox owner shares `info@` with a staff mailbox. This is cosmetic unless `mail-core` models who reads which mailbox (open decision 2).
- Filters and vacation in its Preferences. The Auto reply screen (Preferences, Mail) has On, Subject, Message and an until date and calls `setVacation`, the same record the Squarecube Vacation screen and the admin pages edit; Mailpig's loop protection applies, and so would Postfixit's lack of it.
- A mobile sync badge in Preferences from 2.0 (cosmetic).

## 7. Corporate providers

Both providers get a public site, a customer area and web mail, each in the look of its era, on the host table and page kind of `webmail-consumer`. Provider choice and switching happen here and on the other provider sites; `webmail-consumer` milestone 11 deletes `EmailSettings.tsx` after the sites that replace its rows exist.

### 7.1 Hosted Exchange by Ionose

- `ionose.com`: home, the Hosted Exchange page with the plans and the price per mailbox now (the existing curve), and an Order page. The order asks for the company domain, the plan and the number of mailboxes, shows the monthly total, and calls `createTenant`; a verified tenant exists once the domain check passes. Looks: `early` until 2013, `late` from 2014.
- Plans (game numbers, unverified): Basic up to 10 mailboxes, Business up to 100 mailboxes with a euro more per mailbox and double the quota.
- `ionose.com/control`, signed in with the mailbox that holds the owner role: Mailboxes (name, address, quota, used, Add, Delete, Reset password), Addresses (aliases), Forwarding, Vacation (Out of Office, through `setVacation`), Plan (free slots, change plan), Domain setup (the MX and SPF records it needs, each with a Check showing the `mailChecks` result), a link to web mail, Cancel the contract (`endTenant`), and a Switching page with the steps in order: create the new mailboxes, change the MX, import the mail on the new side, cancel here.
- Forgot password and Reset password. Both call `requestPasswordReset(s, address)`, which `mail-core` answers by posting the letter "mailReset" from "Ionose" with a six digit code, landing 2 or 3 working days later through the Post app. The old password keeps working meanwhile. The page `ionose.com/control/reset` (the `link` of the letter) takes the address, the code and the new password and calls `resetPassword`; a second request while one is open shows `error.mailResetOpen`, a wrong code `error.mailCode`, and the third wrong code cancels the request. While a letter has not arrived the page says it is on its way.

Web mail at `owa.ionose.com`. Ionose upgrades its platform two to four years after the real release, which is a game rule:

| Years | Web mail | Experience in the Browser |
|---|---|---|
| 2005 to 2008 | Lookout Web Access 2003 | login offers Premium, which needs Internet Explorer 6 or later, and Basic. The Browser is not Internet Explorer, so Basic runs. Premium is greyed with its requirement, and clicking it shows the "not supported" page. |
| 2009 to 2012 | Lookout Web Access 2007 | Premium and Light on the same terms. Light lacks the preview pane, drag and drop, spell check and rules; Options holds Out of Office. |
| 2013 to 2016 | Lookout Web App 2010 | full experience in every browser; a "light version" box stays for slow connections |
| 2017 to 2020 | Lookout Web App 2013 | flat tiles, an app launcher, conversation view |
| 2021 on | Lookout on the web | the modern look |

The first two generations also have the "Public or shared computer" and "Private computer" choice, which sets how long the sign-in lasts (cosmetic).

### 7.2 Lookout 365

- `lookout365.macrosoft.com`: home, plans and pricing, and a sign-up flow. The sign-up asks for the company domain, shows the verification record to add, and calls `createTenant` and then `verifyTenant` once the check passes.
- Plans (game numbers, unverified): Basic up to 10 mailboxes, Standard up to 100 mailboxes with a euro more per mailbox.
- `admin.lookout365.macrosoft.com`, the admin center, with an `early` look until 2016 and a `late` look from 2017, signed in with the owner mailbox: Active users (Add user is a mailbox with a licence and a seat; Reset password), Shared mailboxes (if `mail-core` makes them free), Domains (verification record, MX, SPF, autodiscover), Mail flow (organisation rules over the same filter model), Message trace, Migration (starts `importMail`), Billing, Cancel subscription.
- Forgot password and Reset password work as at Ionose, with the letter from "Lookout 365" and the reset page of the admin center.
- Message trace lists the delivery of mail for an address: delivered, queued with its reason, bounced, junked. It reads `mail-core`'s delivery pipeline (queue with `why`, `dropped`, `late`) and is the diagnostic for "the order mail never arrived". The Mailpig Queue tab and the Postfixit `mailq` page show the same facts in their own words.

Web mail at `mail.lookout365.macrosoft.com`, always the current generation: the Lookout Web App 2010 look from 2011, the 2013 look from 2013, Lookout on the web from 2016.

### 7.3 Billing, slots and switching

- Both providers bill per mailbox through `mail-core`'s `seatsBilled(tenant)`. Aliases are free. Each page shows the monthly total before and after every addition and the free slots of the plan.
- A hire needs a free slot on the active host. When the plan is full, the hire fails with `error.hireNoMailbox` and the Staff app links to the Plan page of the provider. On an own server the hire fails with `error.hireNoMailbox` when the new mailbox's quota does not fit the disk (`error.quotaNoDisk`), and the Mailpig and Postfixit admin pages show the free disk beside the quota field. The employee's mailbox appears on the admin page with its seeded password.
- Several tenants can exist at once. The old provider's pages keep working until `endTenant` takes effect; the MX decides where new mail goes; the Domain setup page shows which tenant the domain currently points at.
- Cancelling closes the boxes at the end of the billing month, keeps them readable for the grace period of `mail-core` (30 days at Ionose and Lookout) and then deletes them with their mail. The Switching steps make the order matter: a player who cancels before importing the mail loses it.

## 8. Gameplay and immersion

Gameplay, because it changes delivery, money, risk or what the player can do:

- Installing, upgrading and removing a front end: resources, port conflicts, version age, vulnerabilities, and the loss of the front end's own data.
- Pointing the front end at the right backend in the setup page. A wrong IMAP server makes login fail.
- Creating and removing mailboxes, aliases, forwarders and the catch-all, and the seat bill and slots at the providers. A separate `info@` decides where licence orders land.
- Passwords: the saved login in KeePassive, the reset in the admin on the own server and the letter at the providers.
- Quotas, because a full mailbox bounces mail.
- Server filters, vacation replies and the spam filter, because they decide which mail the player sees and which lands in Junk. A false positive hides a real order. SquirrelMeal's Message Filters leave mail unsorted while nobody logs in.
- Deleting, Trash, Empty, "Do not use Trash" and the Special Folders mapping, because emptying removes the data.
- Sender rules at send time.
- Importing mail before cancelling a provider, and the backup of an own server.
- Web mail unreachable while its host is down; an old version collecting vulnerabilities.

Immersion, because it changes what the player sees and reads and nothing else in the simulation:

- The frames of SquirrelMeal, the three Squarecube skins, SOGoat's two looks, the setup menu and the installer, the About dialog, the product name on the login page, keyboard shortcuts and the "Checking for new messages" bubble.
- The Premium and Light joke, the Public or Private choice, the Postfixit Admin setup page, the welcome mail, the apt output with its dependency lists.
- Preferences that change the view, address-book import, print view, "All headers" and the raw message source (a text derived from the message, the server's hostnames and the `mailChecks` readouts, so the SPF and DKIM lines match what the player set up, and the spam header matches whether the message sits in Junk).
- The SOGoat calendar feed and the plugin lists.

## 9. Milestones

Each milestone is one pull request with its seeded tests and one or two changelog bullets. English keys go in `src/i18n/ui-mail-server.ts` (front ends, admin, Mailpig) and `ui-mail-hosted.ts` (Ionose and Lookout 365) with the same keys in every `src/i18n/<lang>/`. Milestone 1 waits for `mail-core` milestones 1 to 3; milestone 2 for 3 and the password change of `mail-core`; milestones 3, 5 and 6 for `mail-client` milestone 2 (the mail kit) and `mail-core` 5. Milestones 7 and 8 need the kit and the `webmail-consumer` host table and run in parallel with 3 to 6.

### Milestone 1: front ends as installable software, SquirrelMeal first

- Sim: the `mailweb` kind and the files in 2.1; the `conflict` exemption; catalog entries `squirrelmeal` and `postfixitadmin`; Postfixit's new ports and the Dovecoat package lines; `Cluster.backend`; the SquirrelMeal version line with its `devel` rows and the Edge rule; `WEBMAIL` rows; `installedWebmail` and `selfHostCaps`; `site()` entries; the routing of 2.3 (`webmail.<domain>`, the path table, `providerDomain`); `s.webmail` default and fill in `deserialize`; `configureWebmail` and `setWebmailDefault` in `90-actions/mail-server.ts`; `setupPending` on the new cluster.
- UI: the SquirrelMeal and Postfixit Admin software sites on the `SoftwareSite` frame (home, download with the install lines, versions, news with the 2007 break-in); the console entries showing the setup menu and the configuration test, and the SquirrelMeal login page.
- i18n: site copy `sim.site.squirrelmeal.*` and `sim.site.postfixitadmin.*`, setup and login strings in `ui-mail-server.ts`; `swnews.squirrelmeal.<version>` and `swnews.postfixitadmin.<version>` for every version in `ui-releases-mail.ts`, next to the other release news.
- Tests: `tests/webmail-install.test.ts`. A seeded game installs SquirrelMeal on a Postfixit machine; it is refused beside Mailpig and a panel; the newest stable version for a given month is installed and Edge takes `devel`; `webmail.<domain>` resolves; `installedWebmail` returns it; an old save loads with an empty `webmail`.

### Milestone 2: administration of the own server

- Sim: `MAIL_SOFTWARE` and `selfHostCaps` on real options (`setMailSoftwareOption`, Spamsassin); the terminal commands of 5.4; default aliases and the welcome mail; `setAccountPassword` and `setVacation` from the admin forms; the delete confirmation data (messages, stale warning); the uninstall dialog data.
- UI: Postfixit Admin with both looks and its setup page; the Mailpig Mailboxes and Aliases tabs on real data replacing `mailboxes()`; Filters, Sync jobs and Quarantine once `mail-core` has the data; the Backup line.
- i18n: admin and Mailpig strings and the `error.*` keys for refusals.
- Tests: `tests/mail-admin.test.ts`. Creating `info@` through Postfixit Admin routes a licence order mail to `info@` and not to `support@`; the catch-all catches an unknown local part; a password reset keeps the mail; deleting a mailbox removes its messages and starts the stale window; a spam filter raises the catch rate; each capability refuses where the matrix says it does.

### Milestone 3: SquirrelMeal mailbox view and plugins

- Sim: the plugin rules of 3.4: `saveLocalFilter` and `runLocalFilters` (rules applied on opening the Inbox over mail newer than `filteredAt`), the Change Password plugin on `changePassword`, the subscription list in `s.webmail.subs`.
- UI: the frameset on the mail kit's hooks: login with KeePassive, folder tree, message list with Move and Transform, reader, compose, Options, Folders, Addresses, Search, the plugin screens, Havelsieve when Sieve is available.
- i18n: the mailbox and Options strings.
- Tests: `tests/squirrelmeal.test.ts`. Delete moves to Trash and "Do not use Trash" removes; Message Filters sort only when the Inbox is opened; Change Password needs the old password; a wrong IMAP server blocks login; a wrong password shows the real error text.

### Milestone 4: Squarecube as installable software

- Sim: the `squarecube` entry and its version line from 0.1 (2008-03), `squarecubeFeatures`, the installer state (`installerOpen`, `setupPending`), `site()` entry; `configureWebmail` shared with SquirrelMeal.
- UI: the Squarecube software site (home, download, versions, news), the installer page and the login page in the Classic skin.
- i18n: `sim.site.squarecube.*`, `swnews.squarecube.<version>` for every version, installer and login strings.
- Tests: `tests/squarecube-install.test.ts`. Not installable before 2008-03; two front ends share one machine; the first installed answers at `webmail.<domain>` until `setWebmailDefault`; the installer left open sets the exposure flag until disabled.

### Milestone 5: Squarecube mailbox view, compose and settings in Classic

- Sim: view-model helpers in `80-business/webmail-view.ts` (folder tree order and nesting, list rows, thread rows, selection, date text inputs, quota text); `saveIdentity`, `removeIdentity`, `saveContact`, `removeContact`, `setWebmailPref`; the Special Folders mapping; the bounce wording by software (Postfixit, Mailpig, Ionose, Lookout) as an i18n choice keyed by the tenant's host.
- UI: folder pane, message list with drag and drop, reader, search, compose with the HTML editor toggle and the leave warning, Identities, Contacts, Preferences and Password screens, the final "Disable the installer" step.
- i18n: mailbox, compose and settings strings; system folder names go through `t()` while stored folder names stay English.
- Tests: `tests/squarecube-view.test.ts`. Delete moves to Trash, Delete in Trash removes, Empty clears, drag moves and Ctrl copies from 0.4, unread counts follow flags, an identity with a foreign address fails at send, a Trash mapped to a custom folder receives deletions.

### Milestone 6: folder management, filters and vacation

- Sim: `80-business/sieve.ts` with `toSieve(filters)` and `parseSieve(text)` over a bounded grammar and `saveSieveScript` in `90-actions/mail-server.ts`, which parses and then calls `saveFilter` and `deleteFilter`, and `setVacation` for the vacation command. `toSieve(filters, vacation)` writes the account's vacation as a leading `vacation :days 7 :subject "..." "text";` with an `until` test from the date extension, and `parseSieve` reads such a command back, so the raw script and the Vacation form never disagree. Mapping to the `mail-core` rule model: `header`, `address` and `size` tests with `:contains`, `:is` and `:matches` carry the conditions `contains`, `is`, `starts`, `ends` and `over`; `allof` and `anyof` carry `all` and `any`; `fileinto`, `redirect`, `addflag` (read and starred), `fileinto "Trash"` and `"Junk"`, `stop` carry the actions. A script outside the grammar fails with the line number and the real server's wording. The 20 filter limit of `mail-core` applies.
- UI: Settings, Folders with create, rename, move, subscribe and delete; the folder pane menu; dragging a folder onto a new parent; the Filters screen with its rule form and the raw script editor with the error list; the Vacation form (the managesieve responder); the Auto reply screen is added with SOGoat in milestone 10.
- i18n: folder and filter strings and the parse error texts.
- Tests: `tests/sieve.test.ts` and `tests/squarecube-folders.test.ts`. A round trip keeps every filter; a script outside the grammar fails with a line number; folders obey the sibling and depth rules of `mail-core`; an unsubscribed folder disappears from the pane and keeps its mail; a vacation in the raw script round-trips through `setVacation`; the vacation reply goes only while enabled.

### Milestone 7: Ionose

- Sim: the `ionose` host row (plans, caps, quota by year, price curve, aliases 10, catch-all) in `mail-providers.ts`; the page ids and hosts; the generation table for Lookout Web Access by year; the actions in `90-actions/mail-hosted.ts`: Ionose sign-up through `createTenant` and plan change. The reset pages call `requestPasswordReset` and `resetPassword` of `mail-core`, which owns the letter. `economy.md` gains the plan and quota table.
- UI: `ionose.com`, the Control area, and `owa.ionose.com` with the 2003, 2007, 2010, 2013 and modern looks on the mail kit, the Premium and Light login choice, the Basic and Light limits, KeePassive on every login.
- i18n: site, control, web mail and letter strings.
- Tests: `tests/providers-ionose.test.ts`. Ordering creates a tenant; adding a mailbox raises the monthly bill by the seat price and an alias does not; a full plan refuses another mailbox with `error.mailLimit` and a hire with `error.hireNoMailbox`; the reset page sends the letter that arrives in 2 or 3 working days and the old password works until `resetPassword` succeeds; a wrong code fails with `error.mailCode`; a vacation loop starts between two Ionose mailboxes and ends at the hop limit; the generation follows the year; Basic cannot drag.

### Milestone 8: Lookout 365

- Sim: the `lookout` host row; shared mailboxes if `mail-core` makes them free; Message trace over the delivery pipeline; the migration call to `importMail`; the generation table; the reset page.
- UI: `lookout365.macrosoft.com`, the admin center in both looks, `mail.lookout365.macrosoft.com` with three looks.
- i18n: site, admin, web mail and letter strings.
- Tests: `tests/providers-lookout.test.ts`. Sign-up needs a passing verification; a shared mailbox costs nothing when decided so and a user does; Message trace explains a bounce for a full mailbox; a migration copies mail into the target; cancelling before importing loses the mail after the grace period.

### Milestone 9: Squarecube skins and later versions

- Sim: `messageSource(s, messageId)` in `80-business/mailsource.ts`, which writes the received lines, authentication results and spam headers from the message, the hosts and `mailChecks`.
- UI: Barry (0.8) and Plastic (1.4) with the dark theme, the widescreen, desktop and list layouts, thread arrows, search across folders from 1.1, and the show-source and All headers views, also reachable from SquirrelMeal.
- i18n: skin names and the new strings.
- Tests: the skin offered follows the installed version; the source of a message contains a passing SPF line exactly when `mailChecks` passes and a spam line that matches the Junk folder; upgrading across 1.3 to 1.4 switches the default skin and keeps a chosen Barry.

### Milestone 10: SOGoat

- Sim: the `sogoat` catalog entry and version line; the Mailpig release to SOGoat version lookup; the `groupware` data with events and shared address books; `deadlines(s)`; sharing and delegation calls (or the cosmetic fallback).
- UI: `sogoat.org`, the classic and material looks on the mail kit with calendar and contacts, `/SOGo` on Mailpig.
- i18n: SOGoat site, calendar and sharing strings.
- Tests: `tests/sogoat.test.ts`. A Mailpig host answers on `/SOGo` without an install; the look follows the version (2.3 classic, 3.0 material); the calendar lists a hardware delivery on its date.

### Milestone 11: exposure and finishing

- Sim: front-end vulnerabilities through `vulnsFor`; a compromised front-end host exposes the mailboxes of its backend to the breach code; the PHP range per version, so an in-place OS upgrade that moves the host's PHP beyond it turns the login page into a PHP error until the software is upgraded.
- UI: the PHP error page and the unsupported badge on the console.
- i18n: the error page strings.
- Tests: an old SquirrelMeal with an open vulnerability raises the compromise risk of its host; the PHP range check fires after an OS upgrade.

## 10. What this lane needs beyond the contract

Passwords, resets, vacation, employee mailboxes and `error.hireNoMailbox` are in the `mail-core` contract and this lane only calls them. `bcc`, the shared-mailbox flag, `deliveryTrace` and the uninstall count have been asked of `mail-core`.

1. `sendMessage` accepts `bcc` (delivered, not shown to recipients) and the `own` text may carry an HTML flag. Without them the Bcc field and HTML formatting are dropped.
2. A shared-mailbox flag on `MailAccount` if the free shared mailbox at Lookout 365 is decided (open decision 2 of `mail-core`).
3. The delivery pipeline's outcomes readable per address, for Message trace: delivered, queued with `why`, bounced, junked. The queue and `dropped` already exist; a short read function `deliveryTrace(s, address)` over them is enough.
4. An uninstall hook that returns the number of mailboxes and messages that go with the own server tenant, for the confirm dialog.
5. The `mail-client` mail kit exposing `useMailbox(accountId)` and the folder, list, reader and composer components; this lane draws its own visuals on them.

## 11. Decisions taken here and open decisions

Taken here, with the reason; each is open to change.

- Skin eras follow the real releases (Classic to 0.7, Barry from August 2012, Plastic from November 2019), and the SOGoat look changes at 3.0 in January 2016, because those are the dates the vendors' pages give.
- The Premium and Light joke has teeth. From 2005 to 2012 the Browser gets Basic or Light with no preview pane, drag and drop, spell check or rules, and folders can still be created. Pear Mail is the answer to the limits.
- The Squarecube installer and the SquirrelMeal setup menu are required first visits with prefilled values, and an installer left enabled raises the exposure of the host.
- Havelsieve and Message Filters differ on purpose: one runs on delivery, the other only when the player logs in.
- Hosted providers have two plans each, with a mailbox cap, so the hire rule has something to bite.

Open for the user:

1. Whether the SquirrelMeal development line (1.5) appears only on the Edge channel, as planned, or is a separate install the player picks.
2. Whether staff mailboxes read `info@` through delegation, which changes ticket and order handling, or sharing in SOGoat and Lookout stays cosmetic. This depends on `support-desk` and `mail-core`.
3. Whether panel consoles also offer SquirrelMeal and Squarecube to hosting customers for their own mailboxes, with read-only invented mail. The real panels bundled SquirrelMail until 2018 and Roundcube after it. Recommendation: later, if the milestones above land cleanly.
4. Whether the provider customer areas sign in with the owner mailbox, as planned, or with a separate customer number and password.
