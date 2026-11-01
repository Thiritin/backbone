# Webmail and mail administration

Lane id `webmail-server`. Planned in parallel with `mail-core` (accounts, folders, messages, filters), `mail-client` (Pear Mail), `support-desk` (tickets) and `webmail-consumer` (GMix and Goggle Workspace in the Browser). Related: `docs/design/plans/mail-dns-vpn-storage.md` (queue, blacklist and quotas of the mail servers, already built), `docs/design/plans/software-licences.md` (versions and console looks by installed version), `docs/design/software-versions.md`, `docs/design/software.md` (sections 2, 8 and 10).

## What changes

Today the company's mail server cannot be used to read or manage mail. Postfixit is a terminal page (`HostCli`), the Mailboxes tab of the Mailpig console lists names invented by `mailboxes()` in `consoles/services.ts`, the provider is chosen in the `EmailSettings.tsx` sheet, and Hosted Exchange by Ionose and Lookout 365 have no websites. After this plan:

- Squarecube is the webmail of the player's own mail server. It is software the player installs like any other, with its own website, version list and console, reached in the Browser at `webmail.<company domain>`. It looks and behaves like the real webmail of the installed version, from the Classic skin in 2007 to Plastic today.
- The player manages domains, mailboxes, aliases, forwarders, a catch-all and quotas of the own server in a web admin: Postfixit Admin for Postfixit, real tabs in the Mailpig console, and terminal commands for both. This is where the separate `info@` box is created.
- SOGoat is the groupware webmail with calendar and contacts. Mailpig ships with it, as the real counterpart does, and it can be installed on its own from 2009.
- Hosted Exchange by Ionose and Lookout 365 get websites in the Browser: sign-up, a control page for mailboxes and addresses, the steps for switching away, and their web mail in the look of its era.
- The screens are drawn over the account, folder, message and filter state that `mail-core` owns. This lane owns the software catalog entries, the version data, the screens, and the small state that belongs to a web front end itself (identities, address books, preferences).

The GMix and Goggle Workspace web interfaces belong to `webmail-consumer`, and the desktop client Pear Mail to `mail-client`. The mail view (folder tree, message list, reader, composer) is a shared component kit; section 7 says who builds it.

## 1. Names

| Real counterpart | Pun | Role in the game | Host |
|---|---|---|---|
| Roundcube Webmail | Squarecube | webmail for a mail server | `squarecube.net` |
| Roundcube skins classic, Larry, Elastic | Classic, Barry, Plastic | the three skins | none |
| SOGo | SOGoat | groupware webmail | `sogoat.org` |
| Postfix Admin | Postfixit Admin | web admin for Postfixit | `postfixitadmin.org` |
| Dovecot | Dovecoat | IMAP, POP and Sieve daemon that comes with Postfixit | named in package lists, message headers and the Postfixit Admin footer |
| SpamAssassin, Rspamd | Spamsassin, Rspamed | spam filter of Postfixit (optional) and of Mailpig (always on) | named in message headers and server pages |
| Outlook Web Access, Web App, on the web | Lookout Web Access, Lookout Web App, Lookout on the web | web mail of Ionose and Lookout 365 | `owa.ionose.com`, `mail.lookout365.macrosoft.com` |

Sieve, ManageSieve, IMAP, POP, SMTP, MX and PHP are protocol and language names and stay as they are. The Lookout 365 admin page is called the Lookout 365 admin center and lives at `admin.lookout365.macrosoft.com`; the Ionose provider site is `ionose.com`, with its customer area under `/control`; the Lookout 365 sign-up site is `lookout365.macrosoft.com`.

## 2. Install, hosting and routing

### 2.1 Catalog

The three front ends are new software of a new kind `mailweb`. `kind: "mail"` stays the mail server, because `selectMailServer`, `mailChecks`, `breach.ts` and `exposure.ts` all read `c.kind === "mail"` to find it. Each front end gets its own cluster on the machine, like every other software.

| Id | Name | From | OS | Ports | Install | Control plane | Licence |
|---|---|---|---|---|---|---|---|
| `squarecube` | Squarecube | 2007 | lunix | 80, 443 | `apt-get install -y squarecube` | 0.25 vCPU, 0.5 GB, 2 GB | free |
| `postfixitadmin` | Postfixit Admin | 2005 | lunix | 80, 443 | `apt-get install -y postfixitadmin` | 0.25 vCPU, 0.5 GB, 2 GB | free |
| `sogoat` | SOGoat | 2009 | lunix | 80, 443, 20000 | repo line, `apt-get update`, `apt-get install -y sogoat` | 1 vCPU, 2 GB, 10 GB | free |

- Squarecube and Postfixit Admin share a machine with Postfixit, because they share no port with it. Mailpig and every web panel bind 80 and 443, so the existing conflict rule refuses a front end beside them. Mailpig does not need one, since it carries its own admin and SOGoat.
- The `apt-get install` output of a front end lists its dependencies by year: the web server, the PHP package named by `phpAt(year)` for Squarecube and Postfixit Admin, the database driver, and `dbconfig-common`. SOGoat lists its database and cache.
- Postfixit's install pulls in Dovecoat. Its ports gain 110, 143, 993 and 995, and the install output lists the Dovecoat packages. This is what makes a Postfixit server an IMAP host for `mail-core`.
- A cluster of kind `mailweb` carries `backend: string | null`, the id of the mail cluster it talks to. The install takes the mail cluster on the same machine; without one, the installer page asks. When the backend is gone or its control plane is down, login shows the connection error of section 3.3.
- Adding the kind touches `SERVES` in `platforms.ts`, `EXTRAS` in `vendor-cli.ts` (an empty command list), `VULN_RATE` in `vulns.ts` (rate 2, like panels), `needs()` in `exposure.ts` (the web macro), the kind labels in `products/parts.tsx` and `consoleLook`.
- Free software still ages: every front end gets a version line, end of updates and end of security updates like the rest of the catalog, and shows as unsupported on its console when out of support.

### 2.2 Reaching them in the Browser

- `resolve` in `80-business/browser.ts` gains `webmail.<domain>`, next to `portal.<domain>`. It names the first Squarecube or SOGoat the company runs, in install order, and answers as the page of that cluster. Without one it is not found.
- Every front end also answers on its machine's address, as the consoles do. `CONSOLE_AT` in `80-business/consoles.ts` handles `/admin` for Mailpig by path today; it becomes a table of path prefixes: Squarecube on `/` and `/webmail`, its wizard on `/installer/`, Postfixit Admin on `/postfixadmin`, SOGoat on `/SOGo`, Mailpig on `/admin` and, new, its bundled SOGoat on `/SOGo`.
- Mailpig's root page is a sign-in. Domain admins go on to `/admin`, mailbox users reach their webmail by a button, which is how the real counterpart's start page works.
- `consoleBookmarks` already iterates clusters, so each front end gets a bookmark with no new code. `providerDomain` gains the new site and provider hosts so a customer cannot register them.
- The provider hosts of section 6 are three more Page kinds in `resolve`: `mailProvider` with an area (`site`, `control`, `web`), found by host like banks and registrars are.

## 3. Squarecube

### 3.1 Versions and dates

Dates come from the vendor's news archive and its release table (verified) and the changelog (marked). The game's `versions-catalog` lane takes the table below into `software-versions.ts` and `software-versions.md`. Installed Squarecube keeps its version until the player upgrades it; the console look follows the version, not the year.

| Version | Released | Default skin | What the game adds at this version |
|---|---|---|---|
| 0.1-rc1 | 2007-05 | Classic | first installable; folders with subscriptions, compose with the HTML editor, personal address book, identities, drag and drop of messages |
| 0.1-rc2 | 2007-10 | Classic | folders can be dragged to a new parent |
| 0.1 | 2008-03 | Classic | first stable release |
| 0.2 | 2008-12 | Classic | vCard import and export |
| 0.3 | 2009-09 | Classic | the plugin interface |
| 0.4 | 2010-08 | Classic | threaded list, contact groups, copy by drag and drop, and the plugins the game ships from here: Filters (Sieve), Mark as junk, Change password |
| 0.5 | 2011-01 | Classic | none beyond maintenance |
| 0.6 | 2011-09 | Classic | none beyond maintenance |
| 0.7 | 2011-12 | Classic | none beyond maintenance |
| 0.8 | 2012-08 | Barry | the new default skin; Classic stays bundled |
| 0.9 | 2013-04 | Barry | thumbnails for image attachments, CSV contact import |
| 1.0 | 2014-04 | Barry | the vacation form in Filters (unverified); Classic is no longer bundled |
| 1.1 | 2015-02 | Barry | search in several folders |
| 1.2 | 2016-05 | Barry | PHP 7 support |
| 1.3 | 2017-06 | Barry | Barry is flattened |
| 1.4 | 2019-11 | Plastic | the new default skin with a layout for small screens; Barry stays bundled |
| 1.5 | 2021-10 | Plastic | long-term support release; the Collected recipients address book (unverified) |
| 1.6 | 2022-07 | Plastic | Barry is deprecated |
| 1.7 | 2026-05 | Plastic | latest; Barry is no longer bundled (unverified) |

End dates: from the release table where it has them (1.2 until 2021-10, 1.3 until 2022-07, 1.4 until 2023-12, 1.5 updates until 2022-07 and security until 2026-05, 1.6 updates until 2026-05), 1.0 and 1.1 security until their last patches (2017-11 and 2018-04), and for every other line updates until the next release and security a year later, the pattern the catalog already uses for OwnClod. A dark theme for Plastic appeared in July 2020 and is switched on by the player in Preferences.

The brief gave the skin eras as 2008 to 2013, 2013 to 2019 and 2019 on. The real boundaries are the releases above: the original skin to 0.7 (2011), the Larry successor from 0.8 (August 2012), Plastic from 1.4 (November 2019). The plan follows the real ones.

Feature gates live in one table, `squarecubeFeatures(version)` in `src/sim/10-catalog/squarecube.ts`: `threads`, `groups`, `filters`, `vacation`, `multiFolderSearch`, `collected`, `darkTheme`, `skins`. Everything in the UI asks it instead of comparing versions.

### 3.2 Skins

| Skin | Real counterpart | Default | Look |
|---|---|---|---|
| Classic | the original default skin | 0.1 to 0.7 | light grey and blue; a top bar with the logo and the Mail, Address Book and Settings tabs; a toolbar of icons with text labels; a folder list with counts in brackets and the quota bar at its foot; message list with the preview pane below |
| Barry | Larry | 0.8 to 1.3 | a dark slate header with round tab icons, a light toolbar, count badges in the folder list, message list left and preview right in the widescreen layout |
| Plastic | Elastic | 1.4 on | flat and responsive; a narrow icon rail at the left with Mail, Contacts, Settings, Help and Logout; a cyan accent; switches for folder subscriptions; a dark theme from 2020 |

A skin is a CSS file, a logo and a layout component. Which skins the Preferences list offers follows the bundled column in 3.1, and the chosen skin is a preference. The login page of every skin shows the product name from the installer, so a player who renames it to the company name gets "Hosttoast Mail" in the title bar and the heading.

### 3.3 What the player sees and what each screen calls

All mailbox and folder changes are `mail-core` actions; the table names the call so the milestones can check against them.

| Screen | What the player sees | Calls |
|---|---|---|
| Installer, `/installer/` | one page in the style of the real wizard: product name, IMAP server, SMTP server, database; every field prefilled with the local mail server; Continue, then "Disable the installer" | `configureWebmail`; clears `setupPending` |
| Login | product name as title and heading; Username, Password, Login; the errors "Login failed" and "Connection to storage server failed" | keeps the signed-in account in the Browser session; checks that the backend is up and the address belongs to an active account that has web access |
| Folder pane | Inbox, Drafts, Sent, Junk, Trash, then custom folders nested; unread count in bold; unsubscribed folders are hidden; a menu with Mark all as read and, on Trash and Junk, Empty | `foldersOf`, `countsOf`, `markAllRead`, `emptyFolder` |
| Message list | flag, attachment, subject, from (to in Sent and Drafts), date, size; unread bold, flagged red; thread rows from 0.4; Select menu; drag onto a folder, Ctrl or Alt to copy from 0.4; Delete key | `moveMessages`, `copyMessages`, `deleteMessages`, `setFlags` |
| Reader | From, To, Date; "All headers"; a banner when HTML mail has remote content blocked; attachments; Reply, Reply all, Forward, Delete, Mark, and More with print, show source, move to, mark as junk | `setFlags` after the preview delay, `moveMessages`, `messageSource` |
| Deleting | Delete moves the message to the folder set as Trash in Preferences; inside Trash it asks before removing; Empty on Trash asks once and removes everything | `deleteMessages`, `emptyFolder` |
| Search | a box with scope (subject, from, to, entire message), from 1.1 also this folder, subfolders or all folders, and a filter menu (All, Unread, Flagged, Unanswered, With attachment) | selectors over `mail-core` messages |
| Compose | From (identity), To, Cc, Bcc with completion from the address book, Subject, plain text or HTML, attachments, signature, priority, return receipt, Save, a leave warning for unsaved text | `saveDraft`, `discardDraft`, `sendMail` |
| Quota bar | under the folder list, a percentage in Classic and "Storage 12 MB of 100 MB" in Barry and Plastic; absent when the mailbox has no quota | `quotaUsed` |
| Settings, Preferences | User Interface (skin, layout, list mode from 0.4, dark theme), Mailbox View, Displaying Messages, Composing Messages, Special Folders (Drafts, Sent, Junk, Trash) | `setWebmailPref` |
| Settings, Folders | a list with a subscription checkbox (a switch in Plastic), Create with name and parent, rename and move, Delete with confirmation, properties with message count and size | `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, `subscribeFolder` |
| Settings, Filters (from 0.4) | filter sets, the filter list, a form with rules and actions, and Edit filter set for the raw Sieve script | `setServerFilters` through `sieve.ts` |
| Settings, Vacation (from 1.0) | subject, text, days between replies, from and until dates | the vacation rule of the active filter set |
| Settings, Identities | the list; display name, email, organization, reply-to, bcc, signature, Set default | `saveIdentity`, `removeIdentity` |
| Contacts | the personal address book, groups from 0.4, search, vCard import and export, CSV import from 0.9 | `saveContact`, `removeContact` |
| About | version, PHP version, plugins with versions | none |

Rules worth stating once:

- Sending as an address uses `ownsAddress(account, address)` from `mail-core`. On a server with the sender check on (Mailpig always, Postfixit when switched on) a message from an identity the account does not own fails with "SMTP Error (553): Failed to set sender", the real wording. Without the check the message goes out, and the identity receives nothing, since mail for `info@` arrives when a mailbox or alias with that address exists. The player learns the difference between an identity and an address by trying it.
- Delete follows the Special Folders preference, so a player who points Trash at a custom folder sends deletions there. The mapping defaults to the account's system Trash.
- A mail that carries a ticket link, when the desk sends one, answers through the desk's reply action, whichever UI sends it.
- Filters, vacation and Junk are the account's server-side state in `mail-core`. The Filters screen is a front end to `ServerFilter`, so Pear Mail and the delivery code see the same rules.

### 3.4 State owned here

```
s.webmail: Record<clusterId, {
  productName: string; smtpHost: string | null; installerOpen: boolean;
  users: Record<accountId, { identities: Identity[]; contacts: Contact[]; groups: ContactGroup[]; prefs: WebmailPrefs }>;
}>
```

`newGame` sets `webmail: {}` and `deserialize` spreads it, so old saves load with no installs and no data. A user's entry is created on first sign-in with one identity from the account (display name, address) and the preferences of the installed version's defaults. The backend id sits on the cluster (2.1). SOGoat keeps its calendar and address books in the same record under a `groupware` key added in milestone 10.

## 4. Administration of the own mail server

### 4.1 What each server supports

| Capability | Postfixit | Postfixit with Postfixit Admin | Mailpig | Hosted Exchange by Ionose | Lookout 365 |
|---|---|---|---|---|---|
| Several domains | terminal | yes | yes | one domain | yes, each verified by a DNS record |
| Mailboxes | terminal | yes | yes | yes, billed per mailbox | yes, billed per user |
| Aliases | terminal | yes | yes | yes, free | yes, free |
| Forwarders to outside addresses | terminal | yes | yes | yes | yes |
| Distribution lists | alias with several targets | yes | yes | yes | yes, as groups |
| Catch-all | yes, an alias for the whole domain | yes | yes | no | no |
| Quota per mailbox | terminal | yes; 0 means unlimited | yes | fixed by year | fixed by year |
| Server filters | Sieve from 2010 (unverified) | none of its own | always | rules in the web mail from 2009 | rules and mail flow rules |
| Vacation reply | Sieve vacation | none of its own | yes | Out of Office | Automatic replies |
| Spam filter | Spamsassin, off until switched on | switch on the server page | Rspamed, always on | provider filter, always on | provider filter, always on |
| Shared mailboxes | no | no | no | no | yes, free, from 2011 |
| Pull mail from another server | no | no | Sync jobs from 2017 | no | migration page from 2011 |
| Settings found by Pear Mail on its own | no | no | yes | from the 2009 generation | yes |
| Sender check | off, switchable | switchable | on | on | on |
| Web access | Squarecube or SOGoat | same | SOGoat built in | Lookout Web Access | Lookout Web App, Lookout on the web |

The own-server rows live in one table, `MAIL_SOFTWARE`, in `src/sim/80-business/mail-software.ts` (`catchAll`, `quota`, `sieveFrom`, `spam`, `autoconfig`, `senderCheck`), next to `MAIL_PROVIDERS`. Screens and actions ask the table; a `Lookout 365` admin page that offers no catch-all is the table saying so.

### 4.2 Postfixit Admin

The real counterpart is a PHP page of plain tables. It has two looks, `early` for the 2.x line (2005 to 2015) and `late` for 3.x (2016 on), both unverified as to the exact years.

- First visit shows its setup page: a setup password and the first admin account, prefilled so Continue twice is enough, like the Squarecube installer.
- Overview and Domain List: domain, aliases and mailboxes in use of the maximum, quota, active. New domain takes name, description, maximums, default quota and the box "Add default mail aliases", which creates `postmaster@`, `abuse@`, `hostmaster@` and `webmaster@` pointing at the admin mailbox.
- Virtual List per domain: addresses with name, quota, modified and active; Create mailbox (local part, password twice, name, quota, active, "Send welcome mail" ticked by default); Create alias (address and a list of targets, which is how forwarders and distribution lists are made; `*` is the catch-all).
- The welcome mail is a real message in the new mailbox, so the first sign-in finds one unread mail.
- The footer names Dovecoat and the server page has the Spamsassin switch and the sender check switch. They call `setMailSoftwareOption`.

### 4.3 The Mailpig console

The tabs that exist stay (Queue, Blacklist, Configuration, and the domain checks). The invented Mailboxes tab is replaced and new tabs are added, all in the existing dark pink look:

- Mailboxes: real accounts from `mail-core`, with quota, messages, active, Add mailbox (name, local part, domain, password, quota, access to IMAP, POP and SMTP), Edit and Delete.
- Aliases: address, goes to, active; a catch-all is the alias `@domain`.
- Domains: the existing checks plus Add domain (default quota, maximum mailboxes) and a DKIM key action in Configuration that turns the `dkim` readout in `mailChecks` from "missing" to "pass" once the record exists.
- Filters: the server-wide Sieve scripts that run before and after the user's own.
- Sync jobs: source host, user, target mailbox, folders to copy; each job copies mail over hours into the target mailbox. This is the migration path from a provider the player leaves.
- Quarantine: mails the spam filter held, with Release and Delete.

### 4.4 Terminal commands

The vendor CLI in `vendor-cli.ts` gets, for the `mail` kind: `domain add|del|list`, `mailbox add|del|list|quota`, `alias add|del|list`, `spam on|off` (Postfixit) and `sendercheck on|off`. They call the same `mail-core` actions as the admin pages, so a bare Postfixit is fully manageable from the terminal and the admin is the comfortable way. The vendor's docs page describes each command by id, as it does for the existing ones.

## 5. SOGoat

### 5.1 What it is

The groupware webmail: the Squarecube mail view plus a calendar, address books, sharing of folders and delegation of mailboxes, and Sieve filters and vacation in its own Preferences. Mailpig carries it, so a Mailpig player has groupware from the first release in 2016. A Postfixit server can install it from 2009 as the heavier alternative to Squarecube.

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

The dates are from the vendor's yearly news pages. Releases between these (1.2, 2.1, 2.2 and the 3.x to 5.x steps) are filled by `versions-catalog` from the same pages. A version 6 alpha appeared in July 2026 and is announced in the game's news, and installs stay on 5.x until a stable 6 exists. The brief placed the Material redesign in version 5. The vendor's pages and the encyclopedia tie the responsive Angular Material interface to 3.0 in January 2016, so the plan switches the look there and treats 5.0 as a colour refresh behind a CSS variable set (unverified). The copy bundled in Mailpig takes its version from a lookup of Mailpig release month to the SOGoat version it shipped with.

### 5.2 What it adds over Squarecube

- Calendar. It holds the player's own events and a read-only feed of the game's dates through `deadlines(s)`: hardware deliveries, contract notice dates, tax and paperwork deadlines, licence renewals. Opening the calendar before a deadline is the use.
- Address books with CardDAV-style sharing between mailboxes of the same server, and vCard export that Pear Mail can import.
- Sharing and delegation. A mailbox owner shares `info@` with a staff mailbox; Squarecube has no such screen. This is cosmetic unless `mail-core` models who reads which mailbox (open decision 9).
- Filters and vacation in its Preferences, the same `ServerFilter` records Squarecube edits.
- A mobile sync badge in Preferences from 2.0 (cosmetic).

## 6. Corporate providers

Both providers get a public site, a customer area and web mail, each in the look of its era. Provider choice and switching happen here and nowhere else; `EmailSettings.tsx` stays until Ionose, Lookout 365, the consumer providers and the own-server install flow all exist, and the lane that lands last deletes it.

### 6.1 Hosted Exchange by Ionose

- `ionose.com`: home, the Hosted Exchange page with the price per mailbox now (`MAIL_PROVIDERS.price`), and an Order page. The order asks for the company domain (the domain must exist), the number of mailboxes, and shows the monthly total before it books. It calls `bookMail` and creates the owner's mailbox. Looks: `early` until 2013, `late` from 2014.
- `ionose.com/control`: Mailboxes (name, address, size of the limit, price, Add), Addresses (aliases per mailbox, free), Lists (distribution lists), Forwarding, Domain setup (the MX, SPF and autodiscover records it needs, each with a "Check" showing the `mailChecks` result), a link to web mail, Cancel the contract, and a Switching page with the steps in order: create the new mailboxes, change the MX, move the mail, cancel here.
- Protocols. Until 2008 Ionose sells IMAP and POP access as a paid add-on per mailbox; from 2009 it is included. This is a game rule (unverified) and gives Pear Mail a reason to use the web mail early.
- Mailbox size by year (game numbers, unverified): 1 GB in 2005, 2 GB in 2008, 5 GB in 2010, 25 GB from 2013.

Web mail at `owa.ionose.com`. Ionose upgrades its platform two to four years after the real release, which is a game rule:

| Years | Web mail | Experience in the Browser |
|---|---|---|
| 2005 to 2008 | Lookout Web Access 2003 | login offers Premium, which needs Internet Explorer 6 or later, and Basic. The Browser is not Internet Explorer, so Basic runs. Premium is greyed with its requirement, and clicking it shows the "not supported" page. |
| 2009 to 2012 | Lookout Web Access 2007 | Premium and Light on the same terms. Light lacks the preview pane, drag and drop, spell check and rules; Options holds Out of Office. |
| 2013 to 2016 | Lookout Web App 2010 | full experience in every browser; a "light version" box stays for slow connections |
| 2017 to 2020 | Lookout Web App 2013 | flat tiles, an app launcher, conversation view |
| 2021 on | Lookout on the web | the modern look |

The login page of the first two generations also has the "Public or shared computer" and "Private computer" choice, which sets how long the sign-in lasts (cosmetic).

### 6.2 Lookout 365

- `lookout365.macrosoft.com`: home, plans and pricing, and a sign-up flow. The sign-up asks for the company domain and shows the domain verification step with the DNS record to add; it calls `bookMail` once the check passes.
- `admin.lookout365.macrosoft.com`, the admin center, with an `early` look until 2016 and a `late` look from 2017: Active users (Add user = a mailbox with a licence and a seat), Groups (distribution groups and, from 2011, shared mailboxes, which cost nothing), Domains (verification record, MX, SPF, autodiscover, DKIM from 2013), Mail flow (organisation-wide rules; the same `ServerFilter` model with a different form), Message trace, Migration (an IMAP migration that creates a sync job like Mailpig's), Billing.
- Message trace lists the delivery log of the account: delivered, bounced, over quota, rejected, junked, each with the reason. It is the diagnostic for "the order mail never arrived", and the Mailpig Queue tab and the Postfixit `mailq` page get the same data in their own words.
- Mailbox size by year (game numbers, unverified): 25 GB in 2011, 50 GB from 2013, 100 GB from 2016.

Web mail at `mail.lookout365.macrosoft.com`, always the current generation: Lookout Web App 2010 look from 2011, 2013 look from 2013, Lookout on the web from 2016.

### 6.3 Billing and switching

- Both providers bill per mailbox. Aliases and lists are free; Lookout shared mailboxes are free; Ionose has none. This replaces the present rule that the seat count is one plus the employees. The monthly line in `mailTick` is computed from the provider's mailbox count, which is `mail-core`'s change; the pages here show the total before and after every addition.
- Several hosts can hold accounts at once. The control pages for an old provider keep working until the contract is cancelled; the MX decides where new mail goes, and a Domain setup page shows which host the domain currently points at.
- Cancelling keeps the old mailboxes readable until the end of the month and then removes them. Lookout keeps a deleted tenant for 30 days (unverified). The Switching steps make the order matter: a player who cancels before moving the mail loses it.

## 7. Gameplay and immersion

Gameplay, because it changes delivery, money, risk or what the player can do:

- Installing, upgrading and removing a front end: resources, port conflicts, version age, vulnerabilities.
- Pointing the front end at the right backend in the installer. A wrong IMAP server makes login fail.
- Creating and removing domains, mailboxes, aliases, forwarders, lists and the catch-all, including the seat bill at the providers and the booked disk at the own server. A separate `info@` decides where licence orders land.
- Quotas, because a full mailbox bounces mail.
- Server filters, vacation replies and the spam filter, because they decide which mail the player sees and which lands in Junk. A false positive hides a real order.
- Deleting, Trash, Empty and the Special Folders mapping, because emptying removes the data.
- Identities and the sender check.
- Sync jobs and the order of a provider switch.
- Web mail unreachable while its host is down; an old version collecting vulnerabilities.

Immersion, because it changes what the player sees and reads and nothing else in the simulation:

- The three Squarecube skins and SOGoat's two looks, the wizard, the About dialog, the product name on the login page, keyboard shortcuts and the "Checking for new messages" bubble.
- The Premium and Light joke, the Public or Private choice, the Postfixit Admin setup page, the welcome mail, the apt output with its dependency lists.
- Preferences that change the view, address-book import, print view, "All headers" and the raw message source (a text derived from the message, the server's hostnames and the `mailChecks` readouts, so the SPF and DKIM lines match what the player set up).
- The SOGoat calendar feed and the Squarecube plugin list.

## 8. Milestones

Each milestone is one pull request with its seeded tests and one or two changelog bullets. Milestones 1 to 6 build Squarecube in order. Milestone 2 can start as soon as the account actions of `mail-core` exist. Milestones 7 and 8 start once milestone 3 has delivered the shared mail view and run in parallel with 4 to 6. Milestone 10 follows 6 and 2.

### Milestone 1: front ends as installable software

- Sim: the `mailweb` kind and the files listed in 2.1; catalog entries `squarecube` and `postfixitadmin`; Postfixit's new ports and the Dovecoat package lines; `Cluster.backend`; the Squarecube version line and `squarecubeFeatures` in `10-catalog/squarecube.ts`; `site()` entries; the routing of 2.2 (`webmail.<domain>`, the path table, `providerDomain`); `s.webmail` default and fill in `deserialize`; `configureWebmail` in `90-actions/webmail.ts`; `setupPending` on the new cluster.
- UI: the Squarecube and Postfixit Admin software sites on the existing `SoftwareSite` frame (home, download with the install lines, versions, news); the console entries for both, showing the installer page and, after it, a login page with the product name.
- i18n: `src/i18n/ui-webmail.ts` (site copy `sim.site.squarecube.*` and `sim.site.postfixitadmin.*`, `swnews.squarecube.<version>` for every version, installer and login strings) and the mirrors in each `src/i18n/<lang>/`.
- Tests: `tests/webmail-install.test.ts`. A seeded game installs Squarecube on a Postfixit machine; it is refused beside Mailpig; the newest version for a given month is installed; `webmail.<domain>` resolves; an old save loads with an empty `webmail`.

### Milestone 2: administration of the own server

- Sim: `MAIL_SOFTWARE` and the capability checks; the terminal commands of 4.4; default aliases and the welcome mail on creating a domain and a mailbox; the Spamsassin and sender check options (`setMailSoftwareOption`); DKIM key generation moving `mailChecks.dkim`.
- UI: Postfixit Admin with both looks, its setup page, domain list, virtual list, create mailbox and alias; the Mailpig Mailboxes, Aliases and Domains tabs on real data, replacing `mailboxes()` in `consoles/services.ts`, and the Sync jobs and Quarantine tabs once `mail-core` has the data.
- i18n: admin and Mailpig strings, `error.*` keys for the capability refusals (no catch-all, quota not supported, domain exists).
- Tests: `tests/mail-admin.test.ts`. Creating `info@` through Postfixit Admin routes a licence order mail to `info@` and not to `support@`; the catch-all catches an unknown local part; quota 0 is unlimited and a full box bounces; each capability refuses where the matrix says it does.

### Milestone 3: Squarecube mailbox view in the Classic skin

- Sim: view-model helpers in `80-business/webmail-view.ts` (folder tree order and nesting, list rows, thread rows by `threadId`, selection, date text inputs, quota text). The helpers hold no state of their own.
- UI: the shared mail view if no other lane has built it (folder pane, list, reader, search, drag and drop, selection, context actions), the Classic skin, login against real accounts, the quota bar, the reader and the delete rules. Version gates are read from `squarecubeFeatures`.
- i18n: the mailbox strings; folder and system names go through `t()` while stored folder names stay English.
- Tests: `tests/webmail-view.test.ts` for the helpers and, with the real actions, Delete moves to Trash, Delete in Trash removes, Empty clears, drag moves and Ctrl copies from 0.4, unread counts follow flags.

### Milestone 4: compose, identities, address book, preferences

- Sim: `saveIdentity`, `removeIdentity`, `saveContact`, `removeContact`, `setWebmailPref`; the send path with the ownership rule and the bounce wording by software (Postfixit, Mailpig, Ionose, Lookout); drafts.
- UI: compose with the HTML editor toggle and the leave warning, the Identities, Contacts and Preferences screens, the final "Disable the installer" step.
- i18n: compose and settings strings; the bounce texts per software.
- Tests: `tests/webmail-identity.test.ts`. A sender check refuses a foreign identity with the 553 text; Postfixit without the check sends; a draft survives a reload; the installer left open sets the exposure flag.

### Milestone 5: folder management

- Sim: the Special Folders preference and its effect on Delete and Sent.
- UI: Settings, Folders with create, rename, move, subscribe, delete and properties; the folder pane menu; dragging a folder onto a new parent from 0.1-rc2.
- i18n: folder settings strings.
- Tests: create, rename, nest and delete a folder moves its mail as `mail-core` defines; an unsubscribed folder disappears from the pane and keeps its mail; Trash pointed at a custom folder receives deletions.

### Milestone 6: filters and vacation

- Sim: `80-business/sieve.ts` with `toSieve(filters)` and `parseSieve(text)` over a bounded grammar: `require`, `if`, `elsif`, `else`, `header`, `address`, `size`, `allof`, `anyof`, `not`, `true`, and the actions `fileinto`, `redirect`, `keep`, `discard`, `reject`, `stop`, `addflag`, `setflag`, `vacation`. A `ServerFilter` condition of kind `spam` renders as a test on `X-Spam-Flag`, so `kind` never appears as a game word. A parse error returns the line and the message in the real server's wording.
- UI: the Filters screen with sets, the rule form, Edit filter set (raw script with the error list) and the Vacation form.
- i18n: filter strings and the parse error texts.
- Tests: `tests/sieve.test.ts`. A round trip keeps every filter; a script outside the grammar fails with a line number; delivery applies filters in order and honours `stop`; a vacation reply goes once per sender within its days.

### Milestone 7: Ionose

- Sim: `MAIL_PROVIDERS` gains the per-mailbox price, free aliases and lists, a refused catch-all, the size by year and the protocol rule; the three Page kinds for the provider hosts; the generation table for Lookout Web Access by year. `economy.md` gains the size table.
- UI: `ionose.com`, the Control area, and `owa.ionose.com` with the 2003, 2007, 2010, 2013 and modern looks on the shared mail view, the Premium and Light login choice and the Basic and Light feature limits.
- i18n: site, control and web mail strings.
- Tests: `tests/providers-ionose.test.ts`. Ordering books the provider and one mailbox; adding a mailbox raises the monthly bill by the seat price; an alias does not; catch-all is refused; Basic cannot use drag and drop; the generation follows the year.

### Milestone 8: Lookout 365

- Sim: Lookout rows of the matrix (shared mailboxes free from 2011, groups, mail flow rules, domain verification, migration job); the delivery log read by Message trace; the generation table.
- UI: `lookout365.macrosoft.com`, the admin center in both looks, `mail.lookout365.macrosoft.com` with three looks.
- i18n: site, admin and web mail strings.
- Tests: `tests/providers-lookout.test.ts`. Sign-up needs a passing verification; a shared mailbox costs nothing and a user does; Message trace explains a bounce for a full mailbox; a migration copies mail into the target.

### Milestone 9: Squarecube skins and later versions

- Sim: nothing beyond `messageSource(s, messageId)` in `80-business/mailsource.ts`, which writes the received lines, authentication results and spam headers from the message, the hosts and `mailChecks`.
- UI: Barry (0.8) and Plastic (1.4) with the dark theme, the widescreen, desktop and list layouts, thread arrows, search across folders from 1.1, and the show-source and All headers views.
- i18n: skin names and the new strings.
- Tests: the skin offered follows the installed version; the source of a message contains a passing SPF line exactly when `mailChecks` passes; upgrading across 1.3 to 1.4 switches the default skin and keeps a chosen Barry.

### Milestone 10: SOGoat

- Sim: the `sogoat` catalog entry and version line; the Mailpig release to SOGoat version lookup; `s.webmail[...].groupware` with events and shared address books; `deadlines(s)`; sharing and delegation calls (or the cosmetic fallback).
- UI: `sogoat.org`, the classic and material looks on the mail view with calendar and contacts, `/SOGo` on Mailpig.
- i18n: SOGoat site, calendar and sharing strings.
- Tests: `tests/sogoat.test.ts`. A Mailpig host answers on `/SOGo` without an install; the look follows the version (2.3 classic, 3.0 material); the calendar lists a hardware delivery on its date.

### Milestone 11: exposure and finishing

- Sim: Squarecube and SOGoat vulnerabilities through `vulnsFor`; a compromised front-end host exposes the mailboxes of its backend to the breach code; each Squarecube version's PHP range, so an in-place OS upgrade that moves the host's PHP beyond it turns the login page into a PHP error until the software is upgraded; the removal of `EmailSettings.tsx` when it is the last lane to land.
- UI: the PHP error page and the unsupported badge on the console.
- i18n: the error page strings.
- Tests: an old Squarecube with an open vulnerability raises the compromise risk of its host; the PHP range check fires after an OS upgrade.

## 9. What this lane needs from mail-core beyond the contract

1. Addresses and routing: `MailAlias { id, host, address, goto[], active }`, `MailDomain { name, host, active, catchAll, defaultQuotaMb }`, and `mailRouting(s, domain)` returning the host that receives the domain's mail. Account fields `active`, `displayName`, `quotaMb` (0 is unlimited), `access { imap, pop, smtp, web }`, `shared`, and `ownsAddress(account, address)`.
2. Actions: `createMailDomain`, `removeMailDomain`, `createMailAccount`, `updateMailAccount`, `deleteMailAccount`, `createAlias`, `updateAlias`, `deleteAlias`, `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, `subscribeFolder`, `moveMessages`, `copyMessages`, `deleteMessages`, `emptyFolder`, `markAllRead`, `setFlags`, `saveDraft`, `discardDraft`, `sendMail`, `setServerFilters(accountId, filters)`, and `startMailSync(source, target)` with a job that copies messages over hours.
3. Folder fields `subscribed`, `specialUse` and `parentId`, and derived `countsOf(folderId)` (total, unread) and `quotaUsed(accountId)` in megabytes summed from message sizes.
4. Message fields `size`, `html` (a flag), `text` (the literal body the player wrote, next to the key and params of generated mail), `inReplyTo`, `spamScore` and a spam verdict, and attachments as name and size.
5. `ServerFilter` additions: a `reply` action for vacation (subject, text, days, from, until), `stop`, `copy` next to `move`, operators `contains`, `is`, `matches`, tests on `cc`, `size` and any header, `enabled`, `order`, a name, and filter sets with one active set.
6. Delivery behavior: filters run in order per account; a full mailbox bounces; sender ownership is checked at send time when the server has the check on; bounce texts come in three flavors (Postfixit, Exchange-style for Ionose and Lookout, Mailpig); a `deliveryLog(s, host)` with outcome and reason per message, which Message trace, the Mailpig Queue tab and `mailq` read.
7. Provider data on `MAIL_PROVIDERS`: price per mailbox, alias, list and shared mailbox rules, quota by year, protocols by year, required DNS records, and the web mail host and generations. The monthly bill computed from the mailbox count.
8. The company may hold accounts on several hosts at once, so `company.mail` becomes a list of hosts, with `bookMail`, `cancelMail` and `selectMailServer` kept for the provider and server pages to call.
9. A decision on who owns the shared mail view kit. This lane builds it in milestone 3 unless `webmail-consumer` or `mail-client` lands one first; whoever builds it exposes `useMailbox(accountId)` and the folder, list, reader and composer components, and the others adopt it.
10. From `support-desk`: the reply action to call when a mail carries a ticket link.
11. From the DNS and web-presence side: the `webmail` host appearing in the company's zone when a front end is installed, if zones are modeled.

## 10. Open decisions

1. Names. Squarecube, SOGoat, Postfixit Admin, Dovecoat, Spamsassin, Rspamed, the skins Classic, Barry and Plastic, and Lookout Web Access, Web App and on the web. Recommendation: accept as written.
2. Skin eras. The brief gave 2008, 2013 and 2019; the real releases give the original skin to 2011, Larry's successor from August 2012 and Plastic from November 2019. Recommendation: follow the real releases.
3. Webmail before 2007. Squarecube starts at its first usable release in May 2007, so a 2005 or 2006 player on an own server has no webmail; Hosted Exchange by Ionose and Pear Mail cover those years. The alternative is a pun on an older webmail, for example SquirrelMail, for 2005 to 2011. Recommendation: accept the gap.
4. SOGoat. Bundled with Mailpig as in real life and also installable from 2009, with the look change in 2016 (the version 3 release) instead of the brief's 2020. Recommendation: both, as written.
5. Passwords. Mailboxes can have a password the player sets and webmail asks for, with the Browser remembering it, or any password is accepted as in the existing consoles. Recommendation: any password, and an unknown address fails.
6. Billing per mailbox. It replaces seats equal to one plus the employees at both providers, and makes `info@` as a separate mailbox cost a seat while an alias costs nothing. Recommendation: yes, because it gives the alias versus mailbox choice a price.
7. How hard the Premium and Light joke bites. Either the joke is a cosmetic login page, or Basic and Light really lack the preview pane, drag and drop, spell check and rules from 2005 to 2012 while the Browser is not Internet Explorer. Recommendation: the second, with folders still creatable.
8. The Squarecube installer. A required first-visit wizard with prefilled values, and an installer left enabled raising the exposure of the host. Recommendation: yes to both.
9. Who reads shared mailboxes. Whether staff mailboxes read `info@` through delegation and that changes ticket and order handling, or sharing in SOGoat and Lookout stays cosmetic. This depends on `support-desk` and `mail-core`.
10. Customers' webmail. Whether panel consoles also offer Squarecube to hosting customers for their own mailboxes, with read-only invented mail, as the real panels do. Recommendation: later, if the milestones above land cleanly.
