# Consumer webmail: GMix and Goggle Workspace

Status: planned. Lane ids: `provider-terms`, `company-zone`, `provider-actions`, `gmix-site`, `gmix-webmail`, `goggle-site`, `goggle-admin`, `gmial-webmail`, `switching`, `shell-swap`, `gmial-consumer`.

Related design: [mail-suite](mail-suite.md) (build order and rulings across the five mail lanes), [mail-core](mail-core.md) (the model, tenants, accounts, delivery, filters and the contract this lane builds on), [mail-client](mail-client.md) (Pear Mail and the shared mail kit), [webmail-server](webmail-server.md) (Ionose, Lookout 365 and own-server webmail), [support-desk](support-desk.md) (reads the company zone this lane builds), `docs/design/gdd.md` and `docs/design/economy.md` (Company email), `docs/design/software.md` section 8.3 (site records and eras), [colo-portals](colo-portals.md) (provider websites with sign-in and account pages), [software-licences](software-licences.md) (vendor checkout). Names for mail objects are mail-core's: `s.mail`, `MailTenant`, `MailAccount`, `Folder`, `Message`, `ServerFilter`, `MailCaps`, `capsOf`, `mxTarget`, and the verbs `moveMessages`, `markMessages`, `deleteMessages`, `expungeMessages`, `sendMessage`, `listFolder`. The desktop app id is `Pear Mail` and its state is `s.pearMail`. What this lane needs beyond mail-core's contract is in section 10.

## What changes

Today the company's email is one radio group in a sheet inside the Email app (`src/ui/apps/EmailSettings.tsx`): free GMix, one of three external providers per seat, or a self-hosted server. Goggle Workspace and GMix exist only as brand marks and a price per seat. After this plan both are websites in the in-game Browser, each with the product the real company sold in that year:

- **GMix** (pun on GMX) is the German freemail portal every game starts on. It has a portal home, a sign-up form that creates a free address, FreeMix, ProMix and TopMix tiers with the quotas, prices and limits of their time, and a webmail in three looks (the 2005 frame layout with banners, the 2012 Navigator hub, the flat 2018 redesign). Free users see ads, an upsell tile and a signature on outgoing mail. POP3 is free, IMAP is a paid feature until the year it became free for everyone. No tier gives an own domain.
- **Goggle** (pun on Google) is the hosted mail, calendar and documents suite for the company domain. Its name follows the real history: Goggle Apps for Your Domain (2006), Goggle Apps (2007), G Swoot (2016), Goggle Workspace (2020). The free Standard Edition of 2006 to 2012 exists. The site sells the suite, verifies the domain through a record in the player's DNS, and runs an Admin console where the player creates users, aliases and groups and sees the bill per mailbox.
- **Gmial** (the common misspelling of Gmail) is Goggle's webmail, drawn in five looks: the 2005 classic, the 2011 redesign, the 2013 inbox tabs, the 2018 Material look and the 2022 pill look. Labels are its core idea: several labels per message, colours, nesting, Archive that leaves the Inbox, stars, importance markers, conversations, search operators and filters made from a message.
- **Passwords matter.** Every mailbox has a password. Webmail, the Admin console and Pear Mail check it through mail-core's `checkMailLogin`, KeePassive offers to save it and fills it in later, and Forgot password sends a code by paper post that takes two to three working days to arrive.
- **Switching providers** is a walk through websites: sign up at the new provider, verify and point the domain, create the addresses, import the old mail, move the MX record, cancel the old provider. Every step has a sim rule, so a forgotten info@ loses mail and a cancelled provider takes its mailboxes with it.
- **Hiring needs a mailbox.** Billing is per mailbox and a hire gets one under the company domain (mail-core's `hire`). A company that has only GMix cannot hire until it has domain mail, and a Goggle edition with no mailbox left refuses the hire (`error.hireNoMailbox`) until the plan is upgraded.
- `EmailSettings.tsx`, its sheet, the "Change provider" menu item and the `mailSetup` Support route are removed once both sites can book, change and cancel everything the sheet could.

Out of scope: Goggle Calendar, Drive, Meet and Chat as working products (the Gmial side panel shows them as decoration), two-step verification, mobile apps, offline mode, an editable address book, and the webmail of Hosted Exchange by Ionose, Lookout 365 and own servers (the webmail-server lane).

## 1. Boundaries and conventions

- Sites follow the colo-portals pattern: one shared site component per provider, looks as CSS plus a small set of structural switches, the era chosen by the existing `eraOf`. One new helper `eraAtHour(eras, hour)` next to it takes `from: "YYYY-MM"` strings and uses `hourOfMonth`, because the real redesigns landed in a named month (Gmial in November 2011, tabs in May 2013, Material in April 2018).
- One new browser page kind, `{ kind: "mailProvider"; id: MailSiteId }`, resolved in `src/sim/80-business/browser.ts` from the hosts in the catalog rows. The webmail-server lane adds its ids to the same kind; whichever lane lands first creates the kind, the second only adds ids. Webmail ids are mail-core's: `gmix` and `gmial` here, plus `goggle` for the product and Admin console pages. `providerDomain` in `browser.ts` and the site index in `src/sim/80-business/index.ts` list the new hosts, in a new category "Email providers" (the existing Mail category stays the list of mail server software).
- Webmail and the Admin console are real routes, so back, forward, bookmarks and deep links from Pear Mail work: `/mail/inbox`, `/mail/read/<id>`, `/mail/compose?to=` on GMix, `/mail/u/0/inbox`, `/mail/u/0/label/<name>`, `/mail/u/0/search?q=` on Gmial. A hash would be dropped by `split` in the Browser, so Gmial's `#inbox` routes are plain paths.
- The mail views are built on the shared kit at `src/ui/apps/mail-kit/` (mail-client milestone 2): folder listing, selection, drafts, compose and the ticket reply panel on envelope messages. This lane draws its own visuals over it, and every read goes through `listFolder`, `view`, `threadsOf` and `unread`. The tab title shows the unread count, as a webmail-only player's only notification.
- Every player action is a function in `src/sim/90-actions/mail-provider.ts` that calls mail-core's primitives (`createTenant`, `verifyTenant`, `endTenant`, `importMail`, `createMailAccount`, `setAccountRoles`, `addAlias`, `setCatchAll`, `setForward`, `setVacation`, `saveFilter`, and the message verbs). Pages reach them through `usePageAct`, so errors land on the page, and tests call them directly. Errors reuse mail-core's keys (`error.mailLimit`, `error.mailTaken`, `error.mailRoleInUse`, `error.mailInUse`, `error.mailNoService`, `error.mailLogin`, `error.hireNoMailbox`) and add few of their own.
- Billing is mail-core's monthly pass per tenant (paid mailboxes times the provider's price for the year). The price functions stay as they are (`economy.md`: Goggle Workspace €4, €5 from 2020); GMix tiers get their own rows. The first charge falls on the next month start, so a sign-up followed by a cancel inside that window costs nothing, which is the trial.
- Site marketing copy is parody content and may be long. Settings, admin forms and webmail chrome follow the repository rule: labels, values and errors, no filler hints.

## 2. Hosts, looks and puns

| Site | Hosts | Looks (from) |
| --- | --- | --- |
| GMix portal and webmail | `gmix.net`, also `gmix.com` (the domain of every GMix address) | `frames` 2005, `navigator` 2012-03, `flat` 2018-09 |
| Goggle product and sign-up | `goggle.com`, sign-in at `accounts.goggle.com` | `apps-domain` 2006-08, `apps` 2007-02, `swoot` 2016-09, `workspace` 2020-10 |
| Goggle Admin console | `www.goggle.com/a/<domain>` until 2012, `admin.goggle.com` from 2013 | `control` 2006-08, `console` 2013-01 |
| Gmial webmail | `mail.goggle.com`, front page `gmial.com` for personal accounts | `classic` 2005, `redesign` 2011-11, `tabs` 2013-05, `material` 2018-04, `pill` 2022-07 |

Puns, approved: **GMix** (GMX, already in the game), tiers **FreeMix, ProMix, TopMix** (FreeMail, ProMail, TopMail), **GMix Navigator** (the hub), **Goggle** and every Goggle product by prefix (Goggle Groups, Goggle Drive, Goggle Ads exists already), **G Swoot** (G Suite), **Gmial**, **Gmial Labs**, **Mail Goggles** (the real Labs feature of that name, already a pun), **Hangups** (Hangouts), **Goggle Minus** (Google+), **YouTub** (spelled as the existing `youtub.com`), **Goggle Apps Status Dashboard**. Feature names that are plain words (Mail Collector, Priority Inbox, Smart Reply, Undo Send, Archive) stay as they are. Other companies on the pages are the existing puns: GoDuddy, NameCheep, Lexwear, Yahoy!. Ads on the free tiers are written for the game and never carry a real brand.

## 3. GMix

### 3.1 Tiers

A GMix tenant is one mailbox on `gmix.com` (mail-core), and its `plan` is the tier id `free`, `pro` or `top`. A company holds at most three GMix tenants (`error.mailLimit`). The numbers are the provider row of `src/sim/10-catalog/mail-providers.ts`, shaped like the real FreeMail, ProMail and TopMail of each time. They are starting numbers: the catalog milestone checks every figure against a dated source where one exists and the table stands where none is found. Prices are euros a month, quotas gigabytes (the free tier follows mail-core's 1 GB in 2005, 2 GB from 2009, 5 GB from 2014).

| | FreeMix | ProMix | TopMix |
| --- | --- | --- | --- |
| Sold | 2005 | 2005 | 2008 |
| Price | 0 | 2.99, 3.99 from 2015 | 4.99, 6.49 from 2015 |
| Mailbox | 1, 2 from 2009, 5 from 2014 | 2, 4, 10 on the same dates | 5, 10, 25 on the same dates |
| Attachment per mail (MB) | 5, 20 from 2012 | 20, 50 from 2012 | 50, 100 from 2012 |
| Ads | banner, text block, signature on sent mail | none | none |
| POP3 and SMTP | yes, one poll per 15 minutes until 2012 | yes | yes |
| IMAP | from 2012 | yes | yes |
| Mail Collector accounts | 1 | 3 | 5 |
| Custom folders and filters | 5 and 5 | 20 and 10 | 40 and 20 |
| Forwarding and absence note | no | yes | yes |
| Alias addresses and catch-all | no | no | no |
| Support | forum | email | phone line |
| Own domain | no | no | no |

The Junk folder is called Spam on GMix and both Spam and Trash empty after 30 days (mail-core's purge). The year IMAP opened to free users is one constant, `IMAP_FREE_FROM = 2012`, in the provider row. Mail-core's era table and mail-client's text name 2008 as a default; the row of this lane replaces it, and decision 1 asks the user which year stands.

### 3.2 Sign-up and the address

- The form asks for the wanted name, a password of at least 6 characters with a strength bar, a title (the sender name) and a tier (FreeMix preselected, ProMix and TopMix shown beside it). The domain is always `gmix.com`. A taken name returns suggestions the way the real portal does (`name.1987`, `name2005`, `name-hosting`), built from mail-core's `error.mailTaken` rule. There is no recovery address; Forgot password uses the post (section 5).
- The sign-up calls `createTenant({ host: "gmix", plan })` and `createMailAccount({ tenant, local, title, password })`, and the provider's welcome message (`mailWelcome`) lands in the new mailbox. A paid tier charges from the next month start, as mail-core bills. The third GMix tenant is the last.
- The start box that every game begins with is made by mail-core's `newMail()` as a FreeMix tenant with the primary mailbox `<company>@gmix.com` and a seeded password, which the welcome message in its first inbox states. Pear Mail starts empty, so the GMix webmail is the first place that mailbox can be read. A bookmark "Webmail" points at the provider of the sales mailbox and follows a switch.
- The home page of a company without an own domain says so where the player can see it: the address row of the tier table has no domain field on any tier. A business that sells to businesses from a freemail address keeps the existing share penalty, which mail-core's `mailShare` reads from the host of the sales mailbox.
- A hire does not get a GMix mailbox. A company that has only GMix cannot hire (`error.hireNoMailbox`, shown on the Staff app's Hire button), and the GMix portal carries a plain "Own domain" row in the tier table that links to the Goggle site.

### 3.3 Portal home

A 2005 portal: a banner ad row, a login box top left, a news box fed by the game's own headlines (`feed(s)` in `src/sim/80-business/news.ts`), a weather box for the company city (`sky` and `temperature` in `src/sim/20-world/weather.ts`), a small horoscope, a hit counter in the footer, and "Best viewed at 1024x768". The Navigator look drops the horoscope for tiles (Mail, Cloud, Contacts, Calendar, the last two decorative). The flat look is a white page with a single login card and a ProMix banner. The tier pages (`/plans`, `/freemix`, `/promix`, `/topmix`) carry the table above and a Compare view.

### 3.4 Webmail

One component with three looks, drawn over the mail kit.

- **Folders:** Inbox, Drafts, Sent, Spam, Trash and Archive are mail-core's system folders under GMix's names, plus custom folders up to the tier limit, with unread counters. Create, rename, move and delete a custom folder under Settings, Folders (`createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`). Deleting a message moves it to Trash; Delete in Trash and Empty Trash remove it for good after a confirm; the daily pass purges Trash and Spam after 30 days.
- **List:** a table with check boxes, a read mark, attachment clip, sender, subject, date and size (`Message.kb`), sortable by column, 20 rows a page with page links in the `frames` look; cards with a preview line in `navigator`; a single column with hover actions in `flat`. Actions on the selection: Delete, Move to, Mark as read or unread, Flag, Mark as spam (`reportJunk`, offering Block sender), Not spam.
- **Reader:** headers, body from `view(s, message)`, attachments, Reply, Reply all, Forward, and on a ticket envelope the shared reply panel.
- **Composer:** To, Cc, Bcc with completion from the addresses seen in the mailbox, subject, body, an attachment picker that enforces the tier's size limit (`error.mailAttachmentSize` with the limit), signature, save draft, send. On FreeMix the sent message carries a footer line the recipient sees.
- **Address book:** a read-only list of the addresses the mailbox has written to or received from, with Compose and Block. Editable contacts are out of scope.
- **Settings:** Spam protection (level Off, Normal, Strict; action Move to Spam or Delete; allowed senders; blocked senders), Filters (`saveFilter`, the form of section 4.5 with fewer actions), Folders, Signature, POP3 and IMAP access, Mail Collector, Forwarding and absence note (`setForward`, `setVacation`; locked on FreeMix with an upsell button), Account (tier, password, receives, delete mailbox).
- **Receives:** the account page offers the roles owner mail, sales, support and abuse (`setAccountRoles`), because on GMix the name never counts and only the flag does.
- **POP3 and IMAP access:** a single switch, "Allow external programs to fetch mail", off by default. While it is off, Pear Mail's login fails with `error.mailExternal`. On FreeMix before `IMAP_FREE_FROM` the page shows POP3 as available and IMAP as a ProMix feature, and an IMAP account in Pear Mail is refused with the same wording. Poll gaps surface as `error.mailPoll`.
- **Mail Collector:** the player adds one of the company's other accounts (chosen from a list, with its protocol and password) and GMix fetches its Inbox into a folder at each poll, optionally leaving a copy. A wrong password, a disabled switch on the source and the tier limit each give their own error. It is the continuing rule of section 10.
- **Spam:** the volume, catch rate and false positives are mail-core's junk numbers per host (GMix free 0.85 caught, paid tiers 0.93, 1.5 percent false positives). The level setting scales them for this mailbox: Normal as the host, Strict raises the catch rate by 0.1 up to 0.99 and triples the false positives, Off catches nothing and loses nothing. A false positive sits in Spam, readable.
- **Storage:** a meter in the list footer from `usedKb` and the quota. At 90 percent a banner offers ProMix, and at 100 percent incoming mail queues (mail-core's `full` branch), and the banner turns red. A "Free up space" page calls `purgeOlder` (Delete older mail).
- **Ads and upsell (FreeMix only):** a banner at the top, a skyscraper in `frames`, a text block, and from 2018 an interstitial after login with a primary "Go ad-free" and a smaller "Continue with ads". The ads are a rotating list in i18n, picked by hour and account id, never random per render. Clicking the banner "You are visitor 1,000,000" opens `youtub.com/watch?v=uptime`.

### 3.5 Account and leaving

- Account page: tier, next charge, address, password change, Receives, access and collector summary.
- Downgrading to FreeMix is a multi-page cancellation in the `frames` look (confirm, reason, a retention offer of three months at €0.99, final confirm). It takes effect at the end of the paid month. The real portal's cancellation was famously hard, and the copy says so with a straight face.
- Delete mailbox asks for the password and the address typed again, then calls `deleteMailAccount` and `endTenant`. It is refused for the primary mailbox, the last mailbox and a mailbox that is a source's contact or a desk channel's input (mail-core's errors name them). A deleted GMix address is free to take again (mail-core), so old vendor mail can reach a stranger.
- Cancelling or deleting a mailbox never touches mail already copied into another account.

## 4. Goggle

### 4.1 Names, editions and prices

The product name is a function of the date, `brandAt(hour)`; the same record gives the logo variant, the sign-up headline and the admin console title. A Goggle tenant has the plan `free` or `paid`, and the display name of each follows the year.

| From | Name | Editions and notes |
| --- | --- | --- |
| 2006-08 | Goggle Apps for Your Domain | free, 2 GB a user, up to 200 users, ads in webmail, beta badge |
| 2007-02 | Goggle Apps | Standard Edition (free, 50 users, 10 from 2011-12, ads) and Premier Edition (catalog price per mailbox and month, no ads, 99.9 percent SLA line); named for Business from 2011 and for Work from 2014 in the plan label |
| 2012-01 | Goggle Apps | paid quota 25 GB a user, 30 GB pooled with documents from 2014 |
| 2012-12 | Goggle Apps | Standard Edition is closed to new domains; existing free domains keep running |
| 2016-09 | G Swoot | Basic edition at the catalog price, 30 GB |
| 2020-10 | Goggle Workspace | Business Starter at the catalog price, 30 GB |
| 2022-01 to 2022-05 | Goggle Workspace | free legacy domains must accept the upgrade (4.4) |

Free accounts and the Standard Edition follow the growing quota counter of mail-core's table (2.8 GB in 2007-01, 6 GB in 2008-01, 7.6 GB in 2010-01, 10 GB in 2012-01, 30 GB from 2014), which `quotaMbAt` computes from the hour so the counter can tick on screen. Larger real editions (Business, Enterprise, Plus, Vault) are shown on the pricing page as "Contact sales" cards with no action, so the page looks complete and the game has one priced edition.

### 4.2 Product page and sign-up

- Product page per name era, with the pitch of that year, a "customers" strip of the game's own competitors as puns, the edition table, and the 2007 to 2012 line "Free for up to 50 users", which changes to 10 and then disappears with the closing of the free edition.
- Sign-up is a wizard in the console's look: the company domain (preselected with the registered one; a domain that is not the company's is refused with `error.needsDomain`), the administrator's name, address and password, the edition, a summary and the first-invoice date. It calls `createTenant({ host: "goggle", plan, domain })`, which also creates a mailbox for every employee at once, and `createMailAccount` for the admin user. The summary lists those mailboxes and the monthly total before the player confirms. The tenant starts as "domain not verified". The last step suggests the usual mailboxes (info, sales, support) as one-click chips, each with its price per month.
- A tenant that is not verified delivers nothing. The mailboxes exist, but mail-core's resolution refuses a tenant that `mxTarget` does not name or that is not verified.

### 4.3 Domain verification and the MX record

- The wizard's second step shows the verification record for the year: before 2012 a CNAME `goggle<token>` pointing at `goggle.com`, from 2012 a TXT `goggle-site-verification=<token>`. The token is seeded from the game seed and the domain.
- The third step shows the MX set for the year, in capitals as the real console printed them: five records `ASPMX.L.GOGGLE.COM` and `ALT1` to `ALT4` with priorities 10, 20, 20, 30, 30 until 2012, 1, 5, 5, 10, 10 from 2013, and one record `SMTP.GOGGLE.COM` priority 1 from 2023, with the line "You needed five records. You needed one."
- Both steps end in a Verify button that reads the company zone (`recordAt`, milestone 2) and, when the record is there, calls `verifyTenant`. A record that exists but has not propagated answers with the wording of the real console ("We couldn't find the record yet. DNS changes can take up to 48 hours"). Propagation is the zone's rule: a changed or new record becomes visible after the TTL of what it replaces, the zone default of 3600 seconds for a new one.
- The wizard has an Open registrar button that opens the registrar's DNS page in the Browser, and from 2019 on, when the registrar under contract is GoDuddy, a "Sign in to GoDuddy to add the records automatically" button that writes the records after a sign-in step (the real Domain Connect flow, in one click).
- A verified tenant whose MX points elsewhere shows "Mail is not being delivered to Goggle" with the missing record; mail-core's `serverStatus` returns `unresolved` for it, which Pear Mail shows too.

### 4.4 Admin console

Two looks: `control` (a grey and blue tabbed control panel, 2006 to 2012) and `console` (a card grid on a left rail, 2013 on, with the Workspace colours from 2020).

- **Users:** a list with name, address, last sign-in, storage used, status. Add user (first name, last name, username, password, "change password at next sign-in"), Suspend, Restore, Reset password (at once, with no letter; see section 10), Make admin, Receives (owner mail, sales, support, abuse), Delete. Billing counts mailboxes (`seatsBilled`), so suspended users still bill, as in the real console. The edition's mailbox cap (50, then 10, on the Standard Edition) is enforced with `error.mailLimit` for users the admin adds and with `error.hireNoMailbox` for a hire. A mailbox created for a hire is listed with the employee's name and cannot be deleted while that person works for the company; firing removes it. Deleting a user confirms the stale-address warning of mail-core and offers "Make it an alias" before it deletes the mailbox and its mail, with a data-transfer step from 2010 on (move the mail to another user).
- **Aliases:** each user has a list of alias addresses up to the host's `aliasMax` (30). An alias delivers to the user's mailbox and costs nothing (`addAlias`, `removeAlias`).
- **Groups (Goggle Groups):** a group is an address with members and no mailbox of its own; mail to it is copied into each member's mailbox and labelled with the group name, which the Forums tab shows. A group costs nothing. Creating info@ as a user (a mailbox, its own login and inbox), as an alias on the owner (same inbox) or as a group (copies to its members) are three real choices with three different costs, and the vendor checkout's address list shows all of them. Groups need the group account of section 10.
- **Email settings:** default routing for unknown addresses: Reject, or Catch-all to a chosen user (`setCatchAll`, from 2008). A catch-all also attracts junk, which mail-core already models.
- **Domains:** the verified domain, its two records and their status, with the same Verify button. Adding a second domain or a domain alias is out of scope.
- **Billing:** edition, mailboxes, price per mailbox, next invoice date, the ledger lines of the tenant (`ledger.companyMail`), Upgrade to paid for a free edition, Cancel subscription (`endTenant`). Cancelling takes effect at the end of the billing month; the boxes close and stay readable for 20 days, then go with their mail. Resubscribing before that restores them.
- **Data migration (from 2008):** pick a source mailbox, pick the destination user, start. It runs as `importMail` with an explicit mailbox pair (section 10) and takes hours that grow with the stored kilobytes. It needs IMAP (or POP from 2011) enabled on the source, so migrating from a FreeMix box before `IMAP_FREE_FROM` fails with "Authentication failed" until the player enables POP3 on it or upgrades it.
- **Reports:** messages sent and received per user and storage per user, from the mail store. A dry line per month fits the joke the page makes.
- **Status (Goggle Apps Status Dashboard):** green dots, always. The page exists for the joke.
- **Support:** a phone number and a hold time of "estimated wait: not available".
- **Ends of eras:** the closing of free sign-ups in December 2012 sends an email to existing free domains. The 2022 conversion is an event with a lock. From 2022-01 every free legacy tenant gets a notice by email in its admin mailbox, a reminder each month, and a banner on the console with a button "Upgrade now" that calls the upgrade (`plan: "paid"`, billing from the next month start). If nobody has accepted by 2022-05-01 the tenant locks: webmail sign-in stops for every user, incoming mail bounces, and the Admin console opens only on a lock page whose single action is to choose a paid edition, which unlocks at once. A tenant that is cancelled before the deadline ends normally.

### 4.5 Gmial

One webmail component with five looks, drawn over the mail kit. The look decides chrome (the black Goggle bar of 2011 to 2013, the pill search bar of 2018, the extended Compose button of 2018, the side panel of Calendar, Keep and Tasks); behaviour is switched by the year and the account's settings.

**Concepts**

- **Labels:** mail-core treats custom folders on a label host as labels (`Folder.label`): a message sits in exactly one system folder (Inbox, Archive, Sent, Drafts, Junk, Trash) and carries any number of label ids in `Message.labels`, set with `labelMessages`. Archive moves a message from the Inbox to the `archive` folder, which Gmial calls All Mail, and keeps its labels. A label view lists every message with the label except those in Trash and Junk. Labels show as coloured chips in the list, nest through `Folder.parent` with expand and collapse in the left rail (from 2010, depth at most 3), and can be hidden or shown in the rail. Colours (from 2009) and hidden state are two optional fields of section 10.
- **Conversations:** the list groups messages with `threadsOf` into one row with the participants' names and a count, bold when any message is unread. The reader shows the conversation oldest first, collapses read messages to a line, and hides quoted text behind a "..." button.
- **Stars:** a star toggle on every row (`Message.star`). From 2008, under Labs, Superstars, a click cycles through the yellow star and the seven colour flags (`Message.flag` 1 to 7) the player enabled in General settings, so Pear Mail's flags show as Gmial's coloured stars.
- **Importance:** from 2010 a yellow marker on messages the Priority rule judges important (kind support, order or staff; a sender the mailbox has written to; a message the user answered), toggled by the user through the system label Important, which exists on Goggle mailboxes and shows over IMAP as `[Gmial]/Important`. The Priority Inbox layout (Important and unread, Starred, Everything else) is an Inbox type from 2010 to 2018.
- **Categories:** from 2013 the Inbox splits into Primary, Social, Promotions, Updates and Forums by `MailKind`: support, order, reply, staff and authority are Primary; notice, licence, invoice, bank, registrar, host, system, alert and bounce are Updates; promotion and newsletter are Promotions; mail delivered through a group is Forums; Social stays empty and says so. Dragging a message between tabs offers a filter. In Promotions the free account's ad appears as a row with a yellow "Ad" chip.
- **Search:** a pure parser in `src/sim/80-business/mail-search.ts` supports `from:`, `to:`, `subject:`, `label:`, `in:` (inbox, sent, drafts, spam, trash, anywhere), `is:` (unread, read, starred, important), `has:attachment`, `before:` and `after:` (YYYY/MM/DD), `larger:` and `smaller:`, quoted phrases, `-word` and `OR`. Text is matched against `view(s, message)`, so a search and a screen agree in the active language. An empty result says "Your search returned no results. Try removing the quotes. Or the idea."
- **Filters:** Settings, Filters lists the mailbox's `ServerFilter`s. "Filter messages like these" in the More menu of a message opens the create dialog prefilled with the sender; step two offers Skip the Inbox (the `move` action to Archive), Mark as read, Star it, Apply the label, Forward it to, Delete it, Never send it to Spam (`notJunk`) and Always mark as important (the Important label). Conditions are From, To, Subject or "Has the words" (both match the subject), Has attachment and Size greater than, which are the matcher's fields; the dialog offers nothing the matcher cannot evaluate. "Also apply to N matching conversations" runs the filter over existing mail with `matchesConditions` and the message verbs. Filters are server filters, so Pear Mail sees their effect, and the limit is mail-core's 20 per mailbox.
- **Trash and Spam:** a banner at the top of both: "Messages that have been in Trash more than 30 days will be automatically deleted. Empty Trash now." Deleting from a list moves a message to Trash. Delete forever and Empty Trash ask for a confirm.
- **Storage:** a footer counter. Before 2013 the displayed limit ticks up while the page is open (the interpolated `quotaMbAt`), and the front page says "Over 2,814.6 megabytes (and counting)". From 2013 it shows a bar and a Manage link to Free up space (`purgeOlder`). Paid editions show their flat quota.
- **Ads:** consumer accounts and the free Standard Edition show a "Sponsored Links" block in the right column in the classic and redesign looks, chosen by keywords in the open message's subject (a small keyword table in i18n, so a licence key email gets a licence-key ad). In 2013 to 2016 the ad moves into the Promotions tab. Paid editions show none.
- **Keyboard shortcuts:** off by default and switched on in General settings from October 2007: `c` compose, `j` and `k` next and previous, `o` or Enter open, `u` back to the list, `x` select, `e` archive, `#` delete, `!` report spam, `r` reply, `a` reply all, `f` forward, `s` star, `l` label, `/` search, `g` then `i` go to Inbox, `g` then `s` Starred, `?` shows the cheat sheet. The Browser hands keys to the page only while the webmail has focus.
- **Undo Send:** a Labs feature from 2009 and a setting from June 2015 (cancel period 5, 10, 20 or 30 seconds). The page holds the compose in memory for the period and calls `sendMessage` when it ends; closing the tab sends it at once. The period is real seconds, not game time.
- **Settings tabs:** General (language, page size, keyboard shortcuts, stars, signature, vacation responder through `setVacation`, undo send period), Labels, Inbox (inbox type, categories), Accounts and Import (change password; Import mail and contacts; Send mail as, any address the mailbox owns; Check mail from other accounts, the continuing rule of section 10), Filters, Forwarding and POP/IMAP (forwarding through `setForward` to an own address, POP download "all mail" or "from now on", the IMAP Enable and Disable switch, off by default, and the IMAP delete behaviour: Archive, Move to Trash or Delete forever), Labs (2008 to 2020), Themes (from November 2008).
- **Labs:** a list with a switch each: Superstars, Preview Pane, Canned Responses, Nested labels (until it graduates in 2010), Mail Goggles, Old Snakey. Mail Goggles asks five sums before a message is sent late at night (game hours 22 to 04), a faithful gag on the real feature. Old Snakey is a playable snake game in a dialog. Labs disappears in 2020 and its graduated features stay.
- **Themes:** Classic, Terminal (black with green text, the real theme the hosting crowd chose) and two or three plain colour sets, kept in the account's settings.
- **Beta badge:** the classic look wears "BETA" next to the logo until July 2009 and shows "Out of beta after only five years" in the release note that month.
- **Web Clips:** from 2006 to 2011 a one-line news ticker above the inbox, fed by `feed(s)`.
- **Side panel:** in the classic and redesign looks a Chat list from the addresses the mailbox has seen, with presence dots (decorative), from 2013 Hangups, from 2018 the Calendar, Keep and Tasks strip (decorative).
- **Material look extras (2018 on):** Snooze on a conversation (hides it until a chosen hour, back at the top of the Inbox as unread), three Smart Reply chips under a conversation (Thanks!, Got it., Will do.) chosen from a fixed list by `MailKind`, and grey Smart Compose text offered while typing a greeting or sign-off. Snooze needs `Message.snooze` (section 10) and is dropped if mail-core declines it.
- **Footer:** "Last account activity" with a Details link that lists web sessions and the IMAP clients that signed in, taken from the accounts of Pear Mail.

**The free personal account** is milestone 12: the invite wall (until February 2007 the sign-up asks for an invitation code, which arrives as a message from a friend once the company has used the start box for a month), the personal `@gmial.com` address and the phone verification joke.

## 5. Sign-in, passwords and reset

Passwords are mail-core's (`MailAccount.password`, `MailAccount.reset`, `checkMailLogin`). This lane draws the pages and calls its actions.

- Every mailbox has a password, set when the account is created: in the GMix form, by the admin when a Goggle user is created, and for the start box by `newMail()`, whose welcome message states it. A mailbox the sim creates for an employee gets a seeded password that the user's row in the Admin console shows.
- The GMix login page, the Gmial sign-in on `accounts.goggle.com` and the Admin console sign-in call `checkMailLogin(s, address, password)`, the one place a password is compared, and show `error.mailLogin` in the provider's own wording on a mismatch. The Pear Mail assistant uses the same call.
- Sign-in forms use `savedLogin(game, "mail:<address>", 2)` and call `offerLogin` after a success (`src/ui/vault.tsx`). The values are the address and the password. With KeePassive installed (the `keepassive` store upgrade) the pair is filled in on later visits and in Pear Mail's assistant, and after a password change the vault offers the new one at the next login; without it the player types them.
- Change password is on the account page and calls `changePassword`, which needs the old one. Clients configured with the old password stop working until the player updates them in Pear Mail.
- **Forgot password** on GMix and on the Goggle admin mailbox calls `requestPasswordReset(s, address)`. Mail-core makes the six-digit code, posts the letter with `post(s, provider, "mailReset", { address, code }, days, { link })` (`days` is 2 or 3 working days, drawn from the seed) and keeps `{ code, letter }` in `account.reset`. The code is visible only in that letter (`letter.mailReset.subject` and `.body`), and `link` is this lane's reset page, which the Post app opens. A second request while one is open fails with `error.mailResetOpen`.
- The reset page asks for the code and a new password and calls `resetPassword(s, address, code, newPassword)`. A wrong code fails with `error.mailCode`, and the third wrong code cancels the request, so the player asks for a new letter. The page before the letter has arrived says that a letter is on its way and when it is due.
- A Goggle user other than the admin has no reset page and asks the admin. On an own mail server the player is the admin and resets the password in the server's panel (webmail-server).

## 6. Switching providers

The player never opens a settings sheet to change provider. The walk, with the rule behind each step:

1. **Sign up.** Goggle: the wizard of 4.2. GMix: the form of 3.2. Either calls `createTenant`. A company domain may be held by two tenants while it moves, so the one-tenant-per-domain check of `createTenant` applies to a host and domain pair, and `mxTarget` names the tenant that receives. The old tenant is untouched.
2. **Prove and point the domain (Goggle).** Verify with the record of 4.3. Mail still goes to the old provider because the MX record still names it.
3. **Create the addresses.** In the Admin console the player creates the users, aliases and groups that replace the old addresses: owner@, info@, sales@, support@. On the company domain the role follows the local part (`sales`, `info`, `support`) through mail-core's `roleAccount`, so creating `support@` moves support traffic there at once, and the console's Receives control covers the unusual cases.
4. **Import the old mail.** In Gmial, Settings, Accounts and Import, "Import mail and contacts" starts a one-time import from the old mailbox; "Check mail from other accounts" starts a continuing rule that catches stragglers. In the Admin console, Data migration does the same for a user. The one-time import is `importMail` with an explicit pair of mailboxes, because a GMix box and a company-domain box never share a local part. Labels become folders when the target host has no labels (mail-core's rule), and a label host imports folders as labels. The source must allow POP or IMAP.
5. **Move the MX record.** The registrar's DNS page edits the record. For the TTL of the old record the world still delivers to the old provider (hours, from the zone's rule), then to the new. Lowering the TTL a day before is the professional move and works as in real life. Mail sent during the overlap lands in the old mailbox.
6. **Point the sources at the new addresses.** Contact addresses of the bank, registrar, supplier portals and the tax and trade offices are mail-core's `setContact` fields on their own sites, and a vendor checkout asks which address receives the order (mail-core). A source whose contact mailbox no longer exists falls back to the primary mailbox.
7. **Cancel the old provider.** On the old provider's own site: GMix, Delete mailbox or Cancel ProMix; Goggle, Billing, Cancel subscription; Ionose and Lookout on their sites (webmail-server). `endTenant` fails with `error.mailRoleInUse` while the tenant holds the primary mailbox or a role's mailbox and the player has not named another. The boxes close at the end of the month and are removed after the provider's grace (Goggle 20 days, GMix at once on delete), and mail to a removed address follows mail-core's retired-address rules.

What this lane adds to mail-core's delivery rules, all pure functions it calls:

- `mxTarget(s)` reads the company zone with `recordAt` and returns the tenant whose MX record is current. A domain with no record, or a record that names no tenant, returns nothing, and mail-core drops sim mail and bounces the player's.
- A Goggle tenant that is not verified, or that is locked after the 2022 deadline, delivers nothing. A locked tenant's mailboxes cannot sign in.
- Downgrading and cancelling never delete messages already copied into another account.

## 7. What replaces EmailSettings.tsx

- `src/ui/apps/EmailSettings.tsx`, `email.css` if nothing else imports it, the `mailSetup` focus in `src/ui/apps/guide.ts` and `SupportApp.tsx`, the "Change provider" item in `src/ui/desktop/MenuBar.tsx`, and the `apps.mail.*` strings that only the sheet used are deleted in `shell-swap`, together with their keys in every language folder. Mail-core's cleanup milestone removes the three wrappers (`bookMail`, `cancelMail`, `selectMailServer`) after this lane and webmail-server have replaced them.
- The provider actions of this lane (`signUpGmix`, `setGmixTier`, `signUpGoggle`, the console actions) replace the wrappers for GMix and Goggle. `selectMailServer` is webmail-server's to replace as "add the own server as a provider".
- The Getting started step "set up company email" opens the Browser at the Email providers category, and mail-core's check "the company domain has a mailbox" checks it off.
- Pear Mail's Add Account assistant (mail-client) reads host names and ports from the provider rows and has a "Get a new address" path that opens the Browser at the Email providers category.
- A bookmark "Webmail" for the provider of the sales mailbox is part of the default bookmarks and follows the switch.
- The status line "Mail delivery impaired" of the self-hosted case belongs to the own server's account in Pear Mail and to the server's console. External providers have no such status.
- The Support app's `style` field (`goggle`, `gmix`, `pear`, `ionose`, `lookout`) in `src/ui/apps/support/desk.ts` and the matching rules in `mail-styles.css` go with the Support app (mail-core). Their art (`GoggleMark`, `GMixMark` in `src/ui/art/mailmarks.tsx`) is reused as the favicons and header marks of the new sites.

## 8. Jokes and era copy

Copy lives in i18n, one key per line, and follows the rule that parody content is allowed on the sites while forms stay plain.

| Where | Line or detail |
| --- | --- |
| GMix portal 2005 | Hit counter, "Best viewed at 1024x768", "You are visitor number 1,000,000. Click here to claim." (opens the uptime video) |
| GMix FreeMix signature | "Sent with FreeMix. Free mail, free ads." |
| GMix cancellation | A sad envelope, a retention page, and a final page in the old look that says the cancellation letter will be read within 6 to 8 weeks, which is immediately |
| GMix empty Spam | "Nothing here. Suspiciously quiet." |
| GMix empty Trash confirm | "Delete forever? The mail will not come back. Unlike the ads." |
| GMix storage 90 percent | "Your mailbox is 90 percent full. This proves you are popular." |
| GMix 2018 interstitial | "Go ad-free" (large) and "Continue with ads" (small, grey) |
| GMix Navigator tile | "Cloud: 2 GB free. The cloud is someone else's rack." |
| GMix reset page | "We sent you a letter. Yes, with a stamp." |
| Goggle sign-up 2006 | "Beta. We are not sorry about the bugs." |
| Goggle pricing 2007 | "Premier Edition: no ads. Yes, the others have ads." |
| Goggle MX step | "ASPMX.L.GOGGLE.COM. We shout because it carries." |
| Goggle verify failure | "We couldn't find the record yet. DNS changes can take up to 48 hours. Or four minutes. Nobody knows." |
| Admin console 2013 | A Reports page whose headline is "Your users sent 3 messages. All to themselves." when that is true |
| Admin Support | "Estimated wait: not available" |
| Admin lock page 2022 | "Your free edition ended. Your mail did not. It is waiting politely outside." |
| G Swoot launch | "Say hello to G Swoot. It sounds like a suit. It is the same suit." |
| Gmial 2005 | "BETA" next to the logo, the ticking storage counter, "Invitation required. Ask a friend." |
| Gmial archive notice | The yellow bar "The conversation has been archived. Learn more. Undo." |
| Gmial loading | The red "Loading..." tab top right |
| Gmial Trash | "Messages that have been in Trash more than 30 days will be automatically deleted." |
| Gmial 2011 bar | "+You Search Images Maps Plays YouTub News Gmial Drive Calendar More" |
| Gmial 2013 | Hangups and Goggle Minus links that open "This service has moved." |
| Gmial Labs | Mail Goggles, Old Snakey, Canned Responses, a Lab that does nothing and says so |
| Gmial 2018 | Smart Reply chips: "Thanks!", "Got it.", "Will do." |
| Gmial IMAP delete setting | "When a message is marked as deleted and expunged from the last visible IMAP folder: Archive the message (default)" so a deleted mail in Pear Mail still uses the quota, like the real thing |
| Gmial ads | "Sponsored Links" matching the open mail: a licence key email shows "Cheap licence keys, 90 percent off, probably legal" |
| Gmial footer | "Last account activity: 2 hours ago. Details" |
| Gmial 2022 | The pill-shaped selected label, bigger Compose, "Welcome to the new look" |

## 9. Milestones

Build order. Every milestone ships in its own pull request with a seeded test, English keys with the same keys in every `src/i18n/<lang>/` file (new files `ui-mail-gmix.ts`, `ui-mail-goggle.ts`, `ui-mail-gmial.ts`, picked up by the existing globs), and one or two player-facing CHANGELOG bullets. Across lanes (mail-suite): milestone 1 follows mail-core 2, which creates the catalog file; milestone 2 runs in parallel with the reading surfaces; milestone 3 needs mail-core 3 and 4; the Gmial milestones need mail-core 5 and mail-client 2 (the kit); milestone 10 needs mail-core 8; milestone 11 needs milestones 4 and 6 here and webmail-server 7 and 8.

After 3, GMix (4 and 5) and Goggle (6 and 7) run in parallel. Milestones 8 and 9 follow 7, 10 needs 5 and 8, 11 comes after 10, and 12 is last.

1. **Provider terms (`provider-terms`).**
   - Sim: rows for `gmix`, `goggle` and `gmial` in `src/sim/10-catalog/mail-providers.ts` (the file mail-core creates), with the tier and edition tables of 3.1 and 4.1 as data with `from` and `until` months, the hosts, the server names and ports for Pear Mail (`imap.gmix.net`, `pop.gmix.net`, `smtp.gmix.net`, `imap.goggle.com`, `smtp.goggle.com`), and the capability fields of `MailCaps`. Helpers in `src/sim/10-catalog/mail-consumer.ts`: `termsAt(host, plan, hour)` for the extras section 10 lists on `MailCaps` (attachment limit, folder and filter limits, collector accounts, footer, poll gap, ads), `brandAt(hour)`, `mxSetAt(hour)`, `verificationAt(hour, token)`, `categoryOf(kind)`, `importantOf(message, seen)`. The Goggle quota anchors are the ones in mail-core's table.
   - UI: none.
   - i18n: plan names, edition labels, system folder names (`ui-mail-gmix.ts`, `ui-mail-goggle.ts`).
   - Test: `tests/mail-consumer-terms.test.ts`: IMAP free from `IMAP_FREE_FROM`, Standard closes in 2012-12, mailbox cap 50 then 10, names by year, MX set by year (5, 5, 1), categories and importance for each `MailKind`.
2. **Company zone and registrar DNS page (`company-zone`).** This lane builds the zone once; support-desk and webmail-server read it.
   - Sim (built): `s.company.zone: CompanyRecord[]` in `src/sim/60-infra/company-zone.ts` extends the `DnsRecord` of `netsvc-dns.ts` with `at` (the hour of the last change), `was` (what the world still resolves until then, null for a new record) and `gone` (a deletion still propagating). `newGame` starts it with the registrar's parking records (`A @` and `CNAME www`, no MX), and `deserialize` fills it through the company spread. Actions `setCompanyRecord(s, draft)` and `removeCompanyRecord(s, id)` in `src/sim/90-actions/domains.ts` validate with the same `cleanRecord` as PowerDNZ zones, which now also requires `<priority> <host>` for MX. Pure `recordAt(s, type, name, hour)` returns every record of that type and name the world sees at the hour: a changed record keeps its old value for the TTL of the old one, a new one appears after `NEW_RECORD_TTL` (3600 seconds), and a deleted one resolves for its own TTL. `mxHostsAt(s, hour)` lists the MX hosts best priority first. `mxTarget(s)` is mail-core's hook and did not exist when this milestone landed: whichever of mail-core 2 and this lane lands second assigns it from `mxHostsAt(s, nowHours(s))` and the providers' MX hosts, and mail-core's migration must add the MX record of a save's existing tenant, since the parking zone has none.
   - UI (built): the registrar login opens once the partner holds any domain, the company's own included, and registering the company domain sends the login mail. The panel has a link column with Domains and DNS; the DNS page sits at `/login/dns`, titled as each partner named its editor (Total DNS Control and DNS Management at GoDuddy, All Host Records and Advanced DNS at NameCheep), with Type, Host, Points to, Priority for MX, a TTL select from `TTLS` and a Pending or Active status per record.
   - i18n: `ui-registrar-dns.ts`.
   - Test: `tests/company-zone.test.ts`: an edit at hour h shows the old value until h plus the TTL and the new one after; old saves load with the default zone; `mxTarget` names the right tenant before and after the change.
3. **Provider actions (`provider-actions`).**
   - Sim: `src/sim/90-actions/mail-provider.ts` with `signUpGmix`, `setGmixTier` (using `setTenantPlan`, section 10), `deleteGmixMailbox`, `signUpGoggle`, `verifyDomain`, `addUser`, `suspendUser`, `restoreUser`, `deleteUser`, `resetUserPassword` (a wrapper over `setAccountPassword`, section 10), `addGroup`, `setGroupMembers`, `upgradeEdition`, `cancelSubscription` and `resubscribe`. The tenant, mailbox, alias, catch-all, forward, vacation and password primitives (`changePassword`, `requestPasswordReset`, `resetPassword`) are mail-core's, and the pages call them directly. A daily `mailProviderTick` on its own line in `tick.ts` runs the era events: the December 2012 closing mail, the 2022 notices, the monthly reminder, the lock on 2022-05-01. The edition's mailbox cap is the plan limit that mail-core's `hire` checks.
   - UI: none.
   - i18n: errors, the provider emails (`mailWelcome`, the era notices) and the reset page text. The `letter.mailReset.*` keys are mail-core's.
   - Test: `tests/mail-provider-actions.test.ts`: sign-up charges from the next month start, the mailbox cap, cancel ends at month end and removes after 20 days, a Goggle sign-up creates a mailbox for every employee, a free Goggle tenant locks on 2022-05-01 and a chosen paid edition unlocks it.
4. **GMix site (`gmix-site`).**
   - Sim: the `mailProvider` page kind and `resolve` lines in `browser.ts`, `providerDomain`, the index category, the default bookmark.
   - UI: `src/ui/apps/browser/sites/mail/gmix/GmixSite.tsx` with the three looks, the portal home with the news and weather boxes, the tier pages and compare table, sign-up with the strength bar, login with KeePassive, Forgot password and the reset page, the account page (tier, password, Receives, delete mailbox, the multi-page cancellation). Browser tab title and favicon from the existing mark.
   - i18n: `ui-mail-gmix.ts`.
   - Test: `tests/gmix-site.test.tsx` renders the portal in 2005, 2012 and 2019 and asserts the look class, the tier table rows by year and the 2018 interstitial; a wrong password shows `error.mailLogin`, the saved login fills the form, and the Forgot password page requests a letter and accepts its code once it has arrived.
5. **GMix webmail (`gmix-webmail`).**
   - Sim: ad rotation by hour and account (pure), the spam level scale on mail-core's junk numbers, the FreeMix footer added through the `MailCaps` footer, the continuing Mail Collector pass.
   - UI: folders, list, reader, composer with the attachment limit, address book, spam settings, filters, folders, signature, POP and IMAP access, Mail Collector, forwarding, storage meter, Free up space, ads and upsell, in the `frames` look first and the `navigator` and `flat` looks afterwards.
   - i18n: the rest of `ui-mail-gmix.ts`, including the ad list.
   - Test: `tests/gmix-webmail.test.tsx` and a sim suite: delete moves to Trash and Empty Trash removes it, a 21 MB attachment is refused on FreeMix before 2012, IMAP login is refused with the switch off, Mail Collector fetches once and leaves a copy, Strict catches more than Normal in a seeded run, the footer is on FreeMix mail only.
6. **Goggle site and sign-up (`goggle-site`).**
   - Sim: host entries for `goggle.com` and `accounts.goggle.com`; the wizard's state stays in the page and the actions of milestone 3 are the only writers.
   - UI: `src/ui/apps/browser/sites/mail/goggle/GoggleSite.tsx` with the four product looks, the pricing page, the wizard with domain, admin, edition and mailboxes, the verification and MX steps with the Verify and Open registrar buttons, the shared Goggle sign-in page with Forgot password.
   - i18n: `ui-mail-goggle.ts`.
   - Test: `tests/goggle-site.test.tsx`: the page title and edition table in 2006, 2008, 2017 and 2021; the wizard refuses a domain that is not the company's; Verify fails before the record and passes after it and its propagation.
7. **Goggle Admin console (`goggle-admin`).**
   - Sim: group delivery and the group account of section 10, the catch-all and Receives settings, the data transfer on delete, reports from the message store, the hire cap on the free edition.
   - UI: `control` and `console` looks with Users, Groups, Email settings, Domains, Billing, Data migration, Reports, Status, Support, and the lock page of 2022.
   - i18n: the rest of `ui-mail-goggle.ts`.
   - Test: `tests/goggle-admin.test.ts`: an alias delivers to the user's box, a group copies to every member and is not billed, a catch-all catches an unknown local part, a deleted user's mail is gone without a transfer and present after one, the price follows the catalog, suspended users still bill, a hire at the Standard Edition cap is refused with `error.hireNoMailbox` and succeeds after the upgrade, and an employee's mailbox cannot be deleted from the console.
8. **Gmial core (`gmial-webmail`, part 1).**
   - Sim: `src/sim/80-business/mail-search.ts` (the parser and a matcher over a mailbox), label and Archive semantics over `labelMessages` and `moveMessages`, `applyFilter` over `matchesConditions`, the Important label, the Labs flags and their defaults in the account settings.
   - UI: `src/ui/apps/browser/sites/mail/gmial/Gmial.tsx` in the `classic` look: rail with system folders and labels, conversation list, reader, composer, search box, toolbar (Archive, Report spam, Delete, Move to, Labels, More), stars, the storage counter, Sponsored Links, the Settings tabs General, Labels, Accounts and Import, Filters, Forwarding and POP/IMAP, and the Beta badge.
   - i18n: `ui-mail-gmial.ts`.
   - Test: `tests/mail-search.test.ts` covering every operator and their combinations; `tests/gmial-labels.test.ts`: a message with two labels shows in both views, Archive removes it from the Inbox view and keeps both labels, Trash hides it from label views, a filter made from a message labels and archives the next matching message, the IMAP delete setting decides whether a Pear Mail delete frees quota.
9. **Gmial looks and features by year (`gmial-webmail`, part 2).**
   - Sim: `importantOf` wired to the Priority rule, categories for the tabs, snooze, the Smart Reply table by `MailKind`, the Mail Goggles quiz generator (seeded by hour), Undo Send period as a setting.
   - UI: the `redesign`, `tabs`, `material` and `pill` looks, Priority Inbox, label colours, nested labels, Superstars, categories and the Promotions ad row, keyboard shortcuts with the cheat sheet, Labs and Themes, Old Snakey, Undo Send, Snooze, Smart Reply, Web Clips, the side panel.
   - i18n: the rest of `ui-mail-gmial.ts`.
   - Test: `tests/gmial-eras.test.tsx`: look class and available features for 2005, 2008, 2011-12, 2014, 2019 and 2023; shortcuts do nothing until switched on; Undo Send within the period cancels the send and after it does not.
10. **Switching (`switching`).**
    - Sim: the continuing rule and the one-time import surfaced through Import mail and contacts, Check mail from other accounts, the GMix Mail Collector and Data migration (on mail-core's `importMail` with a mailbox pair); MX-driven delivery as in section 6; the guide warning when the sales mailbox is unresolved; the cancel-and-remove sequence; the Standard closing mail.
    - UI: the Import wizard in Gmial, the Data migration page in the console, a banner on the old provider's account page that lists what is still unmigrated (the stored message count, the rules running).
    - i18n: notice texts.
    - Test: `tests/mail-switch.test.ts`: the full walk from the GMix start box to Goggle with a seeded customer stream: mail before the MX change lands in GMix, mail after it in Goggle, a forgotten info@ follows mail-core's retired-address share, a premature cancel loses the straggler, the continuing rule saves it.
11. **Shell swap (`shell-swap`).**
    - Sim: point the Getting started checker at mail-core's rule; remove the GMix and Goggle branches of the wrappers.
    - UI: delete `EmailSettings.tsx`, `email.css`, the menu item, the Support route and the unused strings; link Pear Mail's "Get a new address" to the provider category; update the default bookmarks.
    - i18n: remove the dead `apps.mail.*` keys from every language folder.
    - Test: `tests/i18n.test.ts` keys, a guide test for the new step, and a menu test that "Change provider" is gone.
12. **Personal Gmial accounts (`gmial-consumer`).**
    - Sim: the free `@gmial.com` provider row from 2005 with the invite wall until February 2007, an invitation message from a friend after the start box has been used for a month, 2 GB then the growing quota, IMAP from October 2007, text ads, no custom domain. These accounts belong to a GMix-style tenant of host `gmial`, so the limit of three free tenants applies.
    - UI: the `gmial.com` front page with the counter, the invite form, the phone verification joke, sign-up that creates the account.
    - i18n: the front page and the invite message.
    - Test: `tests/gmial-consumer.test.ts`: sign-up before 2007-02 needs a valid invite, after it does not; the invite message arrives once.

## 10. What this lane needs from mail-core beyond the contract

| Need | Why |
| --- | --- |
| `setAccountPassword` accepted for a Goggle tenant's admin, not only on an own server | The Users list resets a user's password at once. Mail-core's text limits it to the own server (`error.mailAdmin`). |
| `MailAccount.external?: boolean` (the "Allow external programs to fetch mail" switch) and `MailCaps` extras: `attachMb`, `folderMax`, `filterMax` (at most mail-core's 20), `collectors`, `footer` (an i18n key appended to sent mail), `pollGapMin` | Pear Mail's `error.mailExternal` and `error.mailPoll`, and the per-tier limits and signature. |
| `MailAccount.prefs?: Record<string, string \| number \| boolean>` | Webmail preferences (spam level, Labs, theme, stars, undo period, IMAP delete behaviour, inbox type, signature). Mail-core's junk step reads `prefs.spam`; the IMAP verbs read `prefs.imapDelete`. |
| `MailAccount.collect?: { from: string; proto: "pop" \| "imap"; keep: boolean; folder: string \| null; since: number }[]` and an hourly pass for accounts that have one | One continuing rule for the GMix Mail Collector and Gmial's Check mail from other accounts. If declined, this lane stores them in the same place under its own fill. |
| `importMail(s, fromTenant, toTenant, pairs?)` with explicit mailbox pairs | A GMix box and a company-domain box never share a local part. |
| `MailTenant.locked?: true` that mail-core's resolution treats as closed and sign-in refuses | The 2022 lock. |
| `setTenantPlan(s, tenantId, plan)` | The GMix tier changes and the Goggle upgrade. |
| `createTenant` allowing two tenants on one company domain while their hosts differ, so the one-tenant check is per host and domain | A move between providers needs both tenants for a while, and `mxTarget` names the receiver. |
| A group account: `MailAccount.members?: string[]` of mailbox ids, no storage of its own, delivery copies into each member's Inbox with the group's label, skipped by `seatsBilled` | Goggle Groups. If declined, groups are dropped and info@ is a user or an alias. |
| `Folder.colour?: number` and `Folder.hidden?: true` | Label colours and the rail's show and hide. |
| `Message.snooze?: number` (hour to return) | Snooze in the Material look; dropped if declined. |
| `deleteMailAccount` refusing an employee's mailbox with `error.mailInUse` (firing removes it) | The Admin console's Delete for a hired person's user. |
| `mxTarget(s)` as the hook with the company zone of milestone 2 | Mail-core already names it. |

If mail-core declines a row, this lane adds it in the milestone that first needs it, with the default in `newMail()` and the fill in `fillMail`. The collect rule, the mailbox-pair `importMail`, two tenants on one domain during a move and group accounts are also asked of mail-core and stay listed until it confirms them.

From mail-client: the shared kit at `src/ui/apps/mail-kit/`, and Pear Mail's use of `external`, the poll gap and `checkMailLogin`. From support-desk: it reads the company zone and mailbox roles, not the provider. From webmail-server: the ids it adds to the `mailProvider` page kind.

## 11. Shared files

- `src/sim/80-business/mail.ts`: `MailProviderId`, the Goggle record and the freemail flag. Mail-core edits the same file; this lane's edits go through the catalog rows.
- `src/sim/10-catalog/mail-providers.ts`: the `gmix`, `goggle` and `gmial` rows (mail-core creates the file).
- `src/sim/80-business/browser.ts`: the `mailProvider` page kind and hosts; first lander creates it.
- `src/sim/80-business/index.ts`: the Email providers category.
- `src/sim/90-actions/mail-provider.ts` is new; `domains.ts` gains the zone actions; one export line each in `index.ts`.
- `src/sim/91-save/save.ts`: the zone default is one line in the existing chain.
- `src/sim/88-tick/tick.ts`: `mailProviderTick` on its own line.
- `src/ui/apps/browser/BrowserApp.tsx`: one branch for the page kind and a title case.
- `src/ui/apps/browser/sites/registrars/RegistrarPanel.tsx`: the DNS page in milestone 2.
- `src/ui/apps/browser/sites/era.ts`: `eraAtHour`.
- `src/ui/art/mailmarks.tsx`: reused marks.
- `src/i18n/ui-mail-gmix.ts`, `ui-mail-goggle.ts`, `ui-mail-gmial.ts`, `ui-registrar-dns.ts` with mirrors in `de`, `es`, `fr`, `it` and `pt`; `ui-apps.ts` loses the `apps.mail.*` sheet keys in milestone 11.

## 12. Decisions

Decided by the user:

- Passwords matter. GMix, Gmial and the Admin console take the account password through `checkMailLogin`, KeePassive offers to save it and autofills it later, and Forgot password sends a code by paper post through the Post app (`post()` in `src/sim/40-support/letters.ts`) that arrives after two to three working days; entering the code sets a new password.
- The Goggle Standard Edition (free, 2006 to 2012) exists. The 2022 conversion happens: every affected account gets the notice by email, the player accepts the upgrade in the Admin console, and a tenant that has not accepted by the deadline locks (sign-in blocked, incoming mail bounces) until a paid edition is chosen.
- Freemail cannot host staff. Hiring needs a mailbox under the company domain, so a company on GMix alone cannot hire until it has domain mail with a free mailbox (`error.hireNoMailbox`). Billing is per mailbox.
- Spam on GMix and Gmial is realistic (mail-core's junk numbers). Out-of-office loops happen only when a vacation responder is enabled.
- The pun names of section 2 are approved.

Taken in this plan, easy to change:

- Sign-in, Admin console and webmail are separate routes on separate hosts, as in the real products, and a Goggle login is shared across them.
- Mail-core's names and limits stand: at most three GMix tenants, GMix addresses only on `gmix.com`, a deleted GMix address free to take again, no aliases on GMix.
- The Goggle price stays the single catalog price; the larger real editions are decorative cards.
- The address book is the derived list of addresses the mailbox has seen. Editable contacts are not built.
- Spam false positives have no revenue effect in this lane.
- Undo Send waits in real seconds.
- The Goggle wizard shows no tip about aliases and groups, since the price column already shows what each choice costs and the repository rule against hint lines applies.
- Larger or older Goggle services (Calendar, Drive, Meet, Chat, two-step verification, app passwords) are decoration or absent.
- After a lock, the Admin console opens only on the page where a paid edition is chosen, because otherwise the tenant could never be unlocked.

Open, the user decides (recommendation first):

1. **The year IMAP became free for GMix FreeMix users.** This plan uses 2012, which was recalled and could not be confirmed against a dated page; mail-core's era table and mail-client's text say 2008. Recommendation: 2012, or whichever year a dated source gives, in one constant.
2. **Are the other GMix numbers acceptable as starting numbers?** Quotas, prices and limits per tier are shaped like the real tiers but not all verifiable here. Recommendation: ship the table, and let the catalog milestone correct a figure whenever a dated source disagrees.
3. **Delete inactive GMix mailboxes after six months, as the real portal did.** Recommendation: no, because it can destroy a mailbox the player forgot about with no way to see it coming.
4. **A personal Gmial account for the owner (milestone 12).** Recommendation: build it last and drop it if earlier milestones run long; it adds an invite wall and a second free provider that beats GMix at nearly everything, with no new mechanics.
5. **Editable contacts in the webmails.** Recommendation: no, until Pear Mail wants a Contacts view of its own, at which point both would share one list.
