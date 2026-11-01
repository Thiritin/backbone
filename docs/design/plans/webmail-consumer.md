# Consumer webmail: GMix and Goggle Workspace

Status: planned. Lane ids: `provider-terms`, `provider-tenants`, `company-zone`, `gmix-site`, `gmix-webmail`, `goggle-site`, `goggle-admin`, `gmial-webmail`, `switching`, `shell-swap`, `gmial-consumer`.

Related design: `docs/design/gdd.md` (Company email) and `docs/design/economy.md` (Company email) for today's rules, `docs/design/software.md` section 8.3 (site records and eras), [colo-portals](colo-portals.md) (provider websites with sign-in and account pages), [web-presence](web-presence.md) (Strateaux mail and moving between hosts), [software-licences](software-licences.md) (the vendor shop that needs an address to send the order to), [mail-dns-vpn-storage](mail-dns-vpn-storage.md) (the self-hosted mail server, which this lane leaves alone). The other four mail lanes are planned in parallel: mail-core (accounts, folders, messages, filters, delivery), mail-client (Pear Mail), support-desk (tickets) and webmail-server (Ionose, Lookout 365 and the webmail of a self-hosted server). Names used below for their objects are the shared contract: `MailAccount`, `Folder`, `Message`, `ServerFilter`, `ClientAccount`, `DeskChannel`. What this lane needs beyond that contract is in section 9.

## What changes

Today the company's email is one radio group in a sheet inside the Email app (`src/ui/apps/EmailSettings.tsx`): free GMix, one of three external providers per seat, or a self-hosted server. Goggle Workspace and GMix exist only as brand marks and a price per seat. After this plan both are websites in the in-game Browser, each with the product the real company sold in that year:

- **GMix** (pun on GMX) is the German freemail portal every game starts on. It has a portal home, a sign-up form that creates a free address, FreeMix, ProMix and TopMix tiers with the quotas, prices and limits of their time, and a webmail in three looks (2005 frame layout with banners, the 2012 Navigator hub, the flat 2018 redesign). Free users see ads, an upsell tile and a signature on outgoing mail. POP3 is free, IMAP is a paid feature until the year it became free for everyone. No tier gives an own domain.
- **Goggle** (pun on Google) is the hosted mail, calendar and documents suite for the company domain. Its name follows the real history: Goggle Apps for Your Domain (2006), Goggle Apps (2007), G Swoot (2016), Goggle Workspace (2020). The site sells it, verifies the domain through a record in the player's DNS, and runs an Admin console where the player creates users, aliases and groups and sees the bill per seat.
- **Gmial** (the common misspelling of Gmail) is Goggle's webmail, drawn in five looks: the 2005 classic, the 2011 redesign, the 2013 inbox tabs, the 2018 Material look and the 2022 pill look. Labels are its core idea: several labels per message, colours, nesting, Archive that removes the Inbox label, stars, importance markers, conversations, search operators and filters made from a message.
- **Switching providers** is a walk through websites: sign up at the new provider, verify and point the domain, create the addresses, import the old mail, move the MX record, cancel the old provider. Every step has a sim rule, so a forgotten info@ bounces and a cancelled provider takes its mailboxes with it.
- `EmailSettings.tsx`, its sheet, the "Change provider" menu item and the `mailSetup` Support route are removed once both sites can book, change and cancel everything the sheet could.

Out of scope: Goggle Calendar, Drive, Meet and Chat as working products (the Gmial side panel shows them as decoration), two-step verification, mobile apps, offline mode, and the webmail of Hosted Exchange by Ionose, Lookout 365 and self-hosted servers (the webmail-server lane). Pear Mail is the client lane; this lane gives it server-side rules and the provider settings it reads.

## 1. Boundaries and conventions

- Sites follow the colo-portals pattern: one shared site component per provider, looks as CSS plus a small set of structural switches, the era chosen by the existing `eraOf`. One new helper `eraAtHour(eras, hour)` next to it takes `from: "YYYY-MM"` strings and uses `hourOfMonth`, because the real redesigns landed in a named month (Gmial in November 2011, tabs in May 2013, Material in April 2018).
- One new browser page kind, `{ kind: "mailProvider"; id: MailSiteId }`, resolved in `src/sim/80-business/browser.ts` from a host table in `src/sim/10-catalog/mail-providers.ts`. The webmail-server lane adds its ids to the same kind; whichever lane lands first creates the kind, the second only adds ids. `providerDomain` in `browser.ts` and the site index in `src/sim/80-business/index.ts` list the new hosts, in a new category "Email providers" (the existing Mail category stays the list of mail server software).
- Webmail and the admin console are real routes, so back, forward, bookmarks and deep links from Pear Mail work: `/mail/inbox`, `/mail/read/<id>`, `/mail/compose?to=` on GMix, `/mail/u/0/inbox`, `/mail/u/0/label/<name>`, `/mail/u/0/search?q=` on Gmial. A hash would be dropped by `split` in the Browser, so Gmial's `#inbox` routes are plain paths.
- Sign-in uses `readSession` and `writeSession` for the tab session and `savedLogin` and `offerLogin` from `src/ui/vault.ts` for KeePassive, with the site key `mail:<accountId>`. Passwords are stored on the `MailAccount`, so a wrong password in Pear Mail and in the webmail fail the same way.
- Every action the pages call lives in `src/sim/90-actions/mail-provider.ts` and is reached through `usePageAct`, so errors land on the page. Tests call the actions directly.
- Site marketing copy is parody content and may be long. Settings, admin forms and webmail chrome follow the repository rule: labels, values and errors, no filler hints.
- Prices come from the `price` function of the provider in the catalog, which this lane does not change (`economy.md`: Goggle Workspace €4, €5 from 2020). New tiers (ProMix, TopMix) get their own rows in the same table.

## 2. Hosts, looks and puns

| Site | Hosts | Looks (from) |
| --- | --- | --- |
| GMix portal and webmail | `gmix.net`; addresses end in `gmix.com` (the existing sales address), `gmix.net` or `gmix.de`, chosen at sign-up | `frames` 2005, `navigator` 2012-03, `flat` 2018-09 |
| Goggle product and sign-up | `goggle.com`, sign-in at `accounts.goggle.com` | `apps-domain` 2006-08, `apps` 2007-02, `swoot` 2016-09, `workspace` 2020-10 |
| Goggle Admin console | `www.goggle.com/a/<domain>` until 2012, `admin.goggle.com` from 2013 | `control` 2006-08, `console` 2013-01 |
| Gmial webmail | `mail.goggle.com`, front page `gmial.com` for personal accounts | `classic` 2005, `redesign` 2011-11, `tabs` 2013-05, `material` 2018-04, `pill` 2022-07 |

Puns, all new: **GMix** (GMX, already in the game), tiers **FreeMix, ProMix, TopMix** (FreeMail, ProMail, TopMail), **GMix Navigator** (the hub), **Goggle** and every Goggle product by prefix (Goggle Groups, Goggle Drive, Goggle Ads exists already), **G Swoot** (G Suite), **Gmial**, **Gmial Labs**, **Mail Goggles** (the real Labs feature of that name, already a pun), **Hangups** (Hangouts), **Goggle Minus** (Google+), **YouTub** (spelled as the existing `youtub.com`), **Goggle Apps Status Dashboard**. Feature names that are plain words (Mail Collector, Priority Inbox, Smart Reply, Undo Send, Archive) stay as they are. Other companies on the pages are the existing puns: GoDuddy, NameCheep, Lexwear, Yahoy!. Ads on the free tiers are new puns written for the game and never carry a real brand.

## 3. GMix

### 3.1 Tiers

Starting numbers, shaped like the real FreeMail, ProMail and TopMail of each time. The catalog milestone checks every figure against a dated source where one exists; the table stands where none is found. Prices are euros a month, quotas gigabytes.

| | FreeMix | ProMix | TopMix |
| --- | --- | --- | --- |
| Sold | 2005 | 2005 | 2008 |
| Price | 0 | 2.99, 3.99 from 2015 | 4.99, 6.49 from 2015 |
| Mailbox | 1 | 2, 5 from 2010 | 5, 10 from 2010 |
| Attachment per mail (MB) | 5, 20 from 2012 | 20, 50 from 2012 | 50, 100 from 2012 |
| Ads | banner, text block, signature on sent mail | none | none |
| POP3 and SMTP | yes, one poll per 15 minutes until 2012 | yes | yes |
| IMAP | from 2012 | yes | yes |
| Alias addresses | 0 | 5 | 10 |
| Mail Collector accounts | 1 | 3 | 5 |
| Folders and filter rules | 5 and 5 | 20 and 20 | unlimited |
| Forwarding and absence note | no | yes | yes |
| Support | forum | email | phone line |
| Own domain | no | no | no |

Other fixed terms live in the same catalog record: the Junk folder is called Spam, the trash folder Trash, both emptied after 30 days, and every company may hold at most three FreeMix mailboxes (`FREE_BOXES`). The year IMAP opened to free users is one constant (`IMAP_FREE_FROM = 2012`) so the data check can move it.

### 3.2 Sign-up and the address

- The form asks for the wanted address, a domain from the three, a password with a strength bar, a recovery address and a tier (FreeMix preselected, ProMix and TopMix shown beside it). A taken name returns suggestions the way the real portal does (`name.1987`, `name2005`, `name-hosting`). A second mailbox for the same company is a second sign-up; the third free one is refused with `error.mailFreeBoxes`.
- The sign-up creates a `MailAccount` through the mail-core action, a tenant record (section 9) and a welcome message. A paid tier books the first month from the bank account on sign-up.
- The start box that every game begins with is created by `newGame` as a FreeMix account on `gmix.com`, so the login page works from the first minute and a bookmark to the webmail is in the default bookmarks. Its password is the one the Getting started guide shows until the player changes it.
- The home page of a company that has no own domain says so where the player can see it: the address row of the tier table has no domain field on any tier. A business that sells to businesses from a freemail address keeps the existing share penalty (`FREEMAIL_BUSINESS_SHARE`); the rule now reads the provider flag `freemail` of the account that holds the sales address, not `kind === "free"`.

### 3.3 Portal home

A 2005 portal: a banner ad row, a login box top left, a news box fed by the game's own headlines (`feed(s)` in `src/sim/80-business/news.ts`), a weather box for the company city (`sky` and `temperature` in `src/sim/20-world/weather.ts`), a small horoscope, a hit counter in the footer, and "Best viewed at 1024x768". The Navigator look drops the horoscope for tiles (Mail, Cloud, Contacts, Calendar, the last two decorative). The flat look is a white page with a single login card and a ProMix banner. The tier pages (`/plans`, `/freemix`, `/promix`, `/topmix`) carry the table above and a Compare view.

### 3.4 Webmail

One component with three looks.

- **Folders:** Inbox, Drafts, Sent, Spam, Trash plus custom folders up to the tier limit, with unread counters. Create, rename and delete a custom folder under Settings, Folders. Deleting a message moves it to Trash; Delete in Trash and Empty Trash remove it for good after a confirm; messages in Trash and Spam older than 30 days are purged by the daily tick.
- **List:** a table with check boxes, a read mark, attachment clip, sender, subject, date and size, sortable by column, 20 rows a page with page links in the `frames` look; cards with a preview line in `navigator`; a single column with swipe-style hover actions in `flat`. Actions on the selection: Delete, Move to, Mark as read or unread, Flag, Mark as spam (offers Block sender), Not spam.
- **Reader:** headers, body (from the message's i18n key and params), attachments, Reply, Reply all, Forward, and an address-book shortcut that saves the sender.
- **Composer:** To, Cc, Bcc with address-book completion, subject, body, an attachment picker that enforces the tier's size limit (`error.mailAttachmentSize` with the limit), signature, save draft, send. On FreeMix the sent message carries a footer line the recipient sees. Sending from a second address of the same account is a "From" select (aliases on ProMix and TopMix).
- **Address book:** contacts with name, addresses, a group and a note; import from a message; delete. Backed by the contact object requested in section 9.
- **Settings:** Spam protection (level Off, Normal, Strict; action Move to Spam or Delete; allowed senders; blocked senders), Filters (the `ServerFilter` form: if sender or subject contains, then move, mark read, flag or delete), Folders, Signature, POP3 and IMAP access, Mail Collector, Forwarding and absence note (locked on FreeMix with an upsell button), Account (tier, password, delete mailbox).
- **POP3 and IMAP access:** a single switch, "Allow external programs to fetch mail", off by default. While it is off, Pear Mail's login fails with the provider's real message. On FreeMix before `IMAP_FREE_FROM` the page shows POP3 as available and IMAP as a ProMix feature, and an IMAP account in Pear Mail is refused with the same wording.
- **Mail Collector:** the player adds an external account (one of the company's other accounts, chosen from a list, with its protocol and password) and GMix fetches its mail into a folder every poll interval, optionally leaving a copy. A wrong password, a disabled POP or IMAP switch on the source, or the tier limit each give their own error. It uses the fetch rule object of section 9.
- **Spam:** the daily tick drops a seeded number of junk messages into the account, more when the address is published on the company website. The level sets how many are caught and how often a real message (a customer, a vendor) is caught by mistake: Normal catches 85 percent with 0.2 percent false positives, Strict 97 and 2, Off 0 and 0. A false positive sits in Spam, readable, and has no effect on revenue in this lane.
- **Storage:** a meter in the list footer from the account's used size and quota. At 90 percent a banner offers ProMix; at 100 percent incoming mail bounces (mail-core rule) and the banner turns red.
- **Ads and upsell (FreeMix only):** a banner at the top, a skyscraper in `frames`, a text block, and from 2018 an interstitial after login with a primary "Go ad-free" and a smaller "Continue with ads". The ads are a rotating list in i18n, picked by hour and account id, never random per render. Clicking the banner "You are visitor 1,000,000" opens `youtub.com/watch?v=uptime`.

### 3.5 Account and leaving

- Account page: tier, next charge, address list, password change, access and collector summary.
- Downgrading to FreeMix is a multi-page cancellation in the `frames` look (confirm, reason, a retention offer of three months at €0.99, final confirm). It takes effect at the end of the paid month. The real portal's cancellation was famously hard, and the copy says so with a straight face.
- Delete mailbox asks for the password and the address typed again. The mailbox goes at once, the address stays reserved, and mail to it bounces. It is refused while the mailbox holds a role the company still uses (sales or support), with `error.mailRoleInUse`.
- Cancelling or deleting a mailbox never touches mail already copied into another account.

## 4. Goggle

### 4.1 Names, editions and prices

The product name is a function of the date, `brandAt(hour)`; the same record gives the logo variant, the sign-up headline and the admin console title.

| From | Name | Editions and notes |
| --- | --- | --- |
| 2006-08 | Goggle Apps for Your Domain | free, 2 GB a user, up to 200 users, ads in webmail, beta badge |
| 2007-02 | Goggle Apps | Standard Edition (free, 7 GB from 2008, 50 users, 10 from 2011-12, ads) and Premier Edition (catalog price per user and month, 10 GB, no ads, 30-day trial); named for Business from 2011 and for Work from 2014 in the plan label |
| 2012-01 | Goggle Apps | storage 25 GB a user, 30 GB pooled with documents from 2014 |
| 2012-12 | Goggle Apps | Standard Edition is closed to new domains; existing free domains keep running |
| 2016-09 | G Swoot | Basic edition at the catalog price, 30 GB, 30-day trial |
| 2020-10 | Goggle Workspace | Business Starter at the catalog price, 14-day trial |
| 2022-05 | Goggle Workspace | free legacy domains convert to Starter, billed from the conversion |

Larger real editions (Business, Enterprise, Plus, Vault) are shown on the pricing page as "Contact sales" cards with no action, so the page looks complete and the game has one priced edition. Free editions are a real part of this history and a large one for the game's economy, see decision 1.

### 4.2 Product page and sign-up

- Product page per name era, with the pitch of that year, a "customers" strip of the game's own competitors as puns, the edition table and the 2007 to 2012 line "Free for up to 50 users", which changes to 10 and then disappears with the closing of the free edition.
- Sign-up is a wizard in the console's look: the company domain (preselected with the registered one; a domain that is not the company's is refused), the administrator's name, address and password, the edition, the seat count, a summary and the trial notice. It creates a Goggle tenant (section 9) in the state "domain not verified" and one admin user whose address is `<chosen>@<domain>`.
- A domain that is not verified runs no mail. The tenant's mailboxes exist, but nothing is delivered until the MX record points at Goggle.

### 4.3 Domain verification and the MX record

- The wizard's second step shows the verification record for the year: before 2012 a CNAME `goggle<token>` pointing at `goggle.com`, from 2012 a TXT `goggle-site-verification=<token>`. The token is seeded from the game seed and the domain.
- The third step shows the MX set for the year, in capitals as the real console printed them: five records `ASPMX.L.GOGGLE.COM` and `ALT1` to `ALT4` with priorities 10, 20, 20, 30, 30 until 2012, 1, 5, 5, 10, 10 from 2013, and one record `SMTP.GOGGLE.COM` priority 1 from 2023, with the line "You needed five records. You needed one."
- Both steps end in a Verify button that reads the company zone (section 9, `company-zone`). A record that exists but has not propagated answers with the wording of the real console ("We couldn't find the record yet. DNS changes can take up to 48 hours"). Propagation is the zone's rule: a changed or new record becomes visible after the TTL of what it replaces, the zone default of 3600 seconds for a new one.
- The wizard has an Open registrar button that opens the registrar's DNS page in the Browser, and from 2019 on, when the registrar under contract is GoDuddy, a "Sign in to GoDuddy to add the records automatically" button that writes the records after a sign-in step (the real Domain Connect flow, in one click).
- A verified tenant whose MX points elsewhere shows "Mail is not being delivered to Goggle" with the missing record. A tenant whose MX points at Goggle and whose domain is not verified is refused, as the real console did.

### 4.4 Admin console

Two looks: `control` (a grey and blue tabbed control panel, 2006 to 2012) and `console` (a card grid on a left rail, 2013 on, with the Workspace colours from 2020).

- **Users:** list with name, address, last sign-in, storage used, status. Add user (first name, last name, username, password, "change password at next sign-in"), Suspend, Restore, Reset password, Make admin, Delete. Seats are the number of users that are not deleted, suspended users count (billed, as in the real console), and the seat cap of the edition is enforced with `error.mailSeatCap`. Deleting a user shows a data-transfer step from 2010 on (move the mail to another user) and otherwise deletes the mailbox for good.
- **Aliases:** each user has a list of alias addresses (up to 30). An alias delivers to the user's mailbox and costs nothing.
- **Groups (Goggle Groups):** a group is an address with members and a posting policy; mail to it is copied into each member's mailbox, labelled with the group name. From 2012 a group can be a collaborative inbox. A group costs nothing. Creating info@ as a user (a seat, its own login and inbox), as an alias on the owner (no seat, same inbox) or as a group (no seat, copies to its members) are three real choices with three different costs, and the licence shop's address list shows all of them.
- **Email settings:** default routing for unknown addresses: Reject, or Catch-all to a chosen user (from 2008); the catch-all collects typos and spam, and the spam rate of that mailbox rises with it.
- **Domains:** the verified domain, its two records and their status, with the same Verify button; adding a second domain or a domain alias is out of scope.
- **Billing:** edition, seats, price per seat, next invoice date, the ledger lines of the tenant (`ledger.companyMail`), Upgrade to paid for a free edition, Change seats, Cancel subscription. Cancelling takes effect at the end of the billing month; the users and their mail are deleted 20 days later and can be restored by resubscribing until then.
- **Data migration (from 2008):** pick a source account from the company's accounts or type a host, pick the destination user, start. It runs as an import job (section 9) that moves the source's mail in hours that follow the message count. It needs IMAP (or POP from 2011) enabled on the source, so migrating from a FreeMix box before `IMAP_FREE_FROM` fails with "Authentication failed" until the player enables POP3 on it or upgrades it.
- **Reports:** messages sent and received per user and storage per user, from the mail store. A dry line per month fits the joke the page makes.
- **Status (Goggle Apps Status Dashboard):** green dots; red only when the player's datacenter hosts a competitor's incident, which does not happen. The page exists for the joke.
- **Support:** a phone number and a hold time of "estimated wait: not available".
- **Ends of eras:** the closing of free sign-ups in December 2012 sends an email to existing free domains. The legacy free end of 2022 puts a banner on the console from 2022-01, sends a reminder each month and converts the domain on 2022-05-01 to the paid edition (billing starts) unless the player cancelled before; see decision 2.

### 4.5 Gmial

One webmail component with five looks. The look decides chrome (the black Goggle bar of 2011 to 2013, the pill search bar of 2018, the extended Compose button of 2018, the side panel of Calendar, Keep and Tasks); the behaviour is switched by the year and the account's settings.

**Concepts**

- **Labels:** an account has labels (name, colour, parent); a message carries any number of them. A conversation carries the union. The Inbox, Sent, Drafts, Spam and Trash are the contract's system folders, and a message sits in exactly one of them. Archive moves a message from the Inbox location to All Mail (the `archive` folder) and keeps its labels. A label view lists every message with the label except those in Trash and Spam. Labels show as coloured chips in the list (colours from 2009), nest by name path (`Clients/Acme`) with expand and collapse in the left rail (from 2010), and can be hidden or shown in the rail.
- **Conversations:** the list groups messages by `threadId` into one row with the participants' names and a count, Bold when any message is unread. The reader shows the conversation oldest first, collapses read messages to a line, and hides quoted text behind a "..." button.
- **Stars:** a star toggle on every row (a flag in the contract). From 2008, under Labs, Superstars, a click cycles through the 12 star types the player enabled in General settings.
- **Importance:** from 2010 a yellow marker on messages the Priority rule judges important (sender in contacts, a message the user answered, kind personal, order, bank or vendor), toggleable by the user. The Priority Inbox layout (Important and unread, Starred, Everything else) is an Inbox type from 2010 to 2018.
- **Categories:** from 2013 the Inbox splits into Primary, Social, Promotions, Updates and Forums by message kind: personal, order, bank and vendor mail is Primary, social is Social, newsletters and vendor offers are Promotions, invoices and notifications are Updates, group mail is Forums. Dragging a message between tabs teaches the filter. In Promotions the free account's ad appears as a row with a yellow "Ad" chip.
- **Search:** a pure parser in `src/sim/80-business/mail-search.ts` supports `from:`, `to:`, `subject:`, `label:`, `in:` (inbox, sent, drafts, spam, trash, anywhere), `is:` (unread, read, starred, important), `has:attachment`, `before:` and `after:` (YYYY/MM/DD), `larger:` and `smaller:`, quoted phrases, `-word` and `OR`. An empty result says "Your search returned no results. Try removing the quotes. Or the idea."
- **Filters:** Settings, Filters lists them. "Filter messages like these" in the More menu of a message opens the create dialog prefilled with `from:` of the sender; step two offers Skip the Inbox (Archive it), Mark as read, Star it, Apply the label, Forward it to, Delete it, Never send it to Spam, Always mark as important and, from 2013, Categorize as. "Also apply to N matching conversations" runs the filter over existing mail. Filters are `ServerFilter` objects, so Pear Mail sees their effect.
- **Trash and Spam:** a banner at the top of both: "Messages that have been in Trash more than 30 days will be automatically deleted. Empty Trash now." Deleting a message from a list moves it to Trash. Delete forever and Empty Trash ask for a confirm.
- **Storage:** a footer counter. Before 2012 the quota counter climbs while the page is open: the displayed limit is interpolated between the real storage steps (1 GB at launch, 2 GB in 2005, 4 GB in October 2007, 7 GB in 2009, 10 GB in April 2012, 15 GB in May 2013) as a pure function of the game hour, and the front page says "Over 2,814.6 megabytes (and counting)". From 2013 it shows a bar and a Manage link. Workspace users see the edition's quota.
- **Ads:** consumer accounts and the free Standard Edition show a "Sponsored Links" block in the right column in the classic and redesign looks, chosen by keywords in the open message's subject (a small keyword table in i18n, so a licence key email gets a licence-key ad). In 2013 to 2016 the ad moves into the Promotions tab. Premier and later paid editions show none.
- **Keyboard shortcuts:** off by default and switched on in General settings from October 2007: `c` compose, `j` and `k` next and previous, `o` or Enter open, `u` back to the list, `x` select, `e` archive, `#` delete, `!` report spam, `r` reply, `a` reply all, `f` forward, `s` star, `l` label, `/` search, `g` then `i` go to Inbox, `g` then `s` Starred, `?` shows the cheat sheet. The Browser must hand keys to the page only while the webmail has focus.
- **Undo Send:** a Labs feature from 2009 and a setting from June 2015 (cancel period 5, 10, 20 or 30 seconds). The page holds the compose in memory for the period and calls the send action when it ends; closing the tab sends it at once. The period is real seconds, not game time.
- **Settings tabs:** General (language, page size, keyboard shortcuts, stars, signature, vacation responder, undo send period), Labels, Inbox (inbox type, categories), Accounts and Import (change password; Import mail and contacts; Send mail as with a confirmation message that arrives in the inbox; Check mail from other accounts, the fetch rule object), Filters, Forwarding and POP/IMAP (forwarding address that needs a confirmation message, POP download "all mail" or "from now on", the IMAP Enable and Disable switch, off by default, and the IMAP delete behaviour: Archive, Move to Trash or Delete forever), Labs (2008 to 2020), Themes (from November 2008).
- **Labs:** a list with a switch each: Superstars, Preview Pane, Canned Responses, Nested labels (until it graduates in 2010), Mail Goggles, Old Snakey. Mail Goggles asks five sums before a message is sent late at night (game hours 22 to 04), a faithful gag on the real feature. Old Snakey is a playable snake game in a dialog. Labs disappears in 2020 and its graduated features stay.
- **Themes:** Classic, Terminal (black with green text, the real theme the hosting crowd chose) and two or three plain colour sets. Stored in the account's settings.
- **Beta badge:** the classic look wears "BETA" next to the logo until July 2009 and shows "Out of beta after only five years" in the release note that month.
- **Web Clips:** from 2006 to 2011 a one-line news ticker above the inbox, fed by `feed(s)`.
- **Side panel:** in the classic and redesign looks a Chat list from the contacts with presence dots (decorative), from 2013 Hangups, from 2018 the Calendar, Keep and Tasks strip (decorative).
- **Material look extras (2018 on):** Snooze on a conversation (hides it until a chosen hour, back at the top of the Inbox as unread), three Smart Reply chips under a conversation (Thanks!, Got it., Will do.) chosen from a fixed list by the message kind, and grey Smart Compose text offered while typing a greeting or sign-off.
- **Footer:** "Last account activity" with a Details link that lists web sessions and the IMAP clients that signed in, taken from the client accounts of Pear Mail.

**The free personal account** is milestone 12: the invite wall (until February 2007 the sign-up asks for an invitation code, which arrives as a message from a friend once the company has used the start box for a month), the personal `@gmial.com` address and the phone verification joke.

## 5. Switching providers

The player never opens a settings sheet to change provider. The walk, with the rule behind each step:

1. **Sign up.** Goggle: the wizard of 4.2. GMix: the form of 3.2, which creates an address on a GMix domain. Either creates a tenant (a billing relationship) and the mailboxes it includes. A paid tenant's first month, or a trial's end date, is booked here. The old tenant is untouched.
2. **Prove and point the domain (Goggle).** Verify with the record of 4.3. Mail still goes to the old provider because the MX record still names it.
3. **Create the addresses.** In the Admin console the player creates the users, aliases and groups that replace the old addresses: the personal owner@, info@, sales@, support@. Address roles are inferred from the local part (`sales`, `info`, `support`, `owner`), so the Pear Mail and support-desk lanes find them without a setup page.
4. **Import the old mail.** In Gmial, Settings, Accounts and Import, "Import mail and contacts" starts a one-time fetch from the old account; "Check mail from other accounts" starts a continuing one that catches stragglers. In the Admin console, Data migration does the same for a user. Both are fetch rules on the same object; the first reads the source once and stops, the second keeps polling. The source must allow POP or IMAP.
5. **Move the MX record.** The registrar's DNS page edits the record. For the TTL of the old record the world still delivers to the old provider (hours, from the zone's rule), then to the new. Lowering the TTL a day before is the professional move and works as in real life. Mail sent during the overlap lands in the old mailbox.
6. **Point the company at the new addresses.** The sales address, the support address and the address a licence order is sent to are chosen on their own pages (the Marketing website, the Support desk channel, the vendor checkout). A vendor's checkout lists every deliverable address of the company (mailboxes, aliases and groups), so after a switch the player picks again among the new ones.
7. **Cancel the old provider.** On the old provider's own site: GMix, Delete mailbox or Cancel ProMix; Goggle, Billing, Cancel subscription; Ionose and Lookout on their sites (the webmail-server lane). The tenant ends at the end of the month, its mailboxes are removed after the grace period (Goggle 20 days, GMix at once on delete) and mail to a removed mailbox bounces.

Rules that make the walk matter, all pure functions the mail-core delivery calls:

- Delivery of a message to `x@domain` looks up the domain's MX target at the current hour, finds the tenant behind it, and then the mailbox, alias or group with that local part. A missing local part is a bounce unless the tenant has a catch-all.
- A bounce to a customer, vendor or bank counts as undelivered. The sales address that bounces gives `mailShare` zero for that stream, and the Getting started guide shows the warning "Mail to your sales address is bouncing". The sender of a message the player writes to a missing address gets a "Mail Delivery Subsystem" message in the player's own inbox, with the real 550 wording.
- Cancelling the tenant that holds the sales mailbox is refused while the company still names that address as sales (`error.mailRoleInUse`), on every provider site.
- A suspended Goggle domain (unpaid or cancelled) delivers nothing; mail bounces with the real "domain not configured" wording.
- Downgrading and cancelling never delete messages already copied into another account.

## 6. What replaces EmailSettings.tsx

- `src/ui/apps/EmailSettings.tsx`, `email.css` if nothing else imports it, the `mailSetup` focus in `src/ui/apps/guide.ts` and `SupportApp.tsx`, the "Change provider" item in `src/ui/desktop/MenuBar.tsx`, and the `apps.mail.*` strings that only the sheet used are deleted in `shell-swap`, together with their keys in every language folder.
- `bookMail`, `cancelMail` and `selectMailServer` in `src/sim/90-actions/mail.ts` are replaced by the provider actions (`signUpGmix`, `signUpGoggle`, `setGmixTier`, `cancelTenant` and the console actions). `selectMailServer` moves to the self-hosting lane as "add the own server as a provider".
- The Getting started step "set up company email" now opens the Browser at the provider list (the new Email providers category) and checks off when a mailbox on the company domain exists and the sales role is assigned to it.
- Pear Mail's Add Account sheet (mail-client lane) has two paths: add an existing address (it asks for the address and password and reads the provider's access settings from the catalog) and "Get a new address", which opens the Browser at the Email providers category. The old Settings button of the Email app is gone.
- A bookmark "Webmail" for the provider of the sales mailbox is part of the default bookmarks and follows the switch.
- The status line "Mail delivery impaired" of the self-hosted case moves to the own server's account in Pear Mail and to the server's console. External providers have no such status.
- The `style` field of the Support app (`goggle`, `gmix`, `pear`, `ionose`, `lookout`) in `src/ui/apps/support/desk.ts` and the matching rules in `mail-styles.css` become unused for these two providers and are removed when the Support app is split by the other lanes. Their art (`GoggleMark`, `GMixMark` in `src/ui/art/mailmarks.tsx`) is reused as the favicons and header marks of the new sites.

## 7. Jokes and era copy

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
| Goggle sign-up 2006 | "Beta. We are not sorry about the bugs." |
| Goggle pricing 2007 | "Premier Edition: no ads. Yes, the others have ads." |
| Goggle MX step | "ASPMX.L.GOGGLE.COM. We shout because it carries." |
| Goggle verify failure | "We couldn't find the record yet. DNS changes can take up to 48 hours. Or four minutes. Nobody knows." |
| Admin console 2013 | A Reports page whose headline is "Your users sent 3 messages. All to themselves." when that is true |
| Admin Support | "Estimated wait: not available" |
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

## 8. Milestones

Build order. Every milestone ships in its own pull request with a seeded test, English keys with the same keys in every `src/i18n/<lang>/` file (new files `ui-mail-gmix.ts`, `ui-mail-goggle.ts`, `ui-mail-gmial.ts`, picked up by the existing globs), and one or two player-facing CHANGELOG bullets.

Milestones 1 to 3 need the mail-core accounts and addresses to have landed, or the rows of section 9 to be added by this lane. After 3, GMix (4 and 5) and Goggle (6 and 7) run in parallel. Milestones 8 and 9 follow 7 and the mail-core label rows, 10 needs 5 and 8, 11 comes after 10 and the self-hosting replacement for `selectMailServer`, and 12 is last.

1. **Provider terms catalog (`provider-terms`).**
   - Sim: `src/sim/10-catalog/mail-providers.ts` with ids `gmix`, `goggle`, `gmial`; the tier and edition tables of 3.1 and 4.1 as data with `from` and `until` months; hosts; server names and ports for Pear Mail (`imap.gmix.net`, `pop.gmix.net`, `smtp.gmix.net`, `imap.goggle.com`, `smtp.goggle.com`); system folder names per provider; `termsAt(provider, plan, hour)` (quota, attachment limit, ads, POP and IMAP, alias, collector, folder and rule limits, trash and junk days, footer, poll gap, seat cap); `brandAt(hour)`; `mxSetAt(hour)`; `verificationAt(hour, token)`; `storageStep(hour)` for the Gmial counter; `categoryOf(kind)` and `importantOf(message, contacts)`. `MailProviderId` in `mail.ts` gains `gmix` and the Goggle record gains `editions`; the existing `price` stays the source of the seat price.
   - UI: none.
   - i18n: plan names, edition labels, system folder names (`ui-mail-gmix.ts`, `ui-mail-goggle.ts`).
   - Test: `tests/mail-providers.test.ts`: IMAP free from `IMAP_FREE_FROM`, Standard closes in 2012-12, seat cap 50 then 10, names by year, MX set by year (5, 5, 1), storage steps monotonic, categories and importance for each message kind.
2. **Company zone and registrar DNS page (`company-zone`).** Done by mail-core if it already has the zone (section 9); otherwise by this lane.
   - Sim: today only customer zones on PowerDNZ services have records (`ZoneEdit` in `netsvc-dns.ts`); the company domain has none, so mail cannot yet be routed by MX. `s.company.zone: DnsRecord[]` reuses the type in `netsvc-dns.ts`, defaulted in `newGame` to the registrar's parking records and filled by `deserialize`; actions `setCompanyRecord` and `removeCompanyRecord` in `src/sim/90-actions/domains.ts`; a pure `recordAt(s, type, name, hour)` that returns the old value until the replaced record's TTL has passed; `mxTarget(s, hour)`.
   - UI: a DNS page in the registrar panel (`RegistrarPanel.tsx`, `/login`, then DNS): a table of records with Add, Edit, Delete, a TTL select from `TTLS`, and the registrar's own look per partner.
   - i18n: `ui-registrar-dns.ts`.
   - Test: `tests/company-zone.test.ts`: edit at hour h, old value until h plus TTL, new after; old saves load with the default zone.
3. **Tenants and provider actions (`provider-tenants`).**
   - Sim: the tenant record of section 9; `src/sim/90-actions/mail-provider.ts` with `signUpGmix`, `setGmixTier`, `deleteGmixMailbox`, `signUpGoggle`, `verifyDomain`, `addUser`, `suspendUser`, `restoreUser`, `deleteUser`, `addAlias`, `removeAlias`, `addGroup`, `setGroupMembers`, `setCatchAll`, `setSeats`, `cancelTenant`, `resubscribe`; the monthly `providerTick` replaces `mailTick` and books `ledger.companyMail` per tenant at its seats, trial end, cancellation end and the 20-day removal; welcome, trial-ending and cancellation messages through mail-core. `deserialize` maps old `company.mail` (`free` to a GMix tenant and the start box, `external` goggle to a verified Goggle tenant with one user per old seat) and leaves `hostedExchange` and `lookout365` to the webmail-server lane.
   - UI: none.
   - i18n: errors and message bodies.
   - Test: `tests/mail-tenants.test.ts`: sign-up books the first month, seat cap, trial end bills once, cancel ends at month end and removes after 20 days, an old save with external Goggle loads as a tenant, a sales mailbox cannot be cancelled.
4. **GMix site (`gmix-site`).**
   - Sim: `{ kind: "mailProvider"; id: "gmix" }` in `browser.ts`, the host table, `providerDomain`, the index category, the default bookmark.
   - UI: `src/ui/apps/browser/sites/mail/gmix/GmixSite.tsx` with the three looks, the portal home with the news and weather boxes, the tier pages and compare table, sign-up, login with KeePassive, the account page (tier, password, delete mailbox, the multi-page cancellation). Browser tab title and favicon from the existing mark.
   - i18n: `ui-mail-gmix.ts`.
   - Test: `tests/gmix-site.test.tsx` renders the portal in 2005, 2012 and 2019 and asserts the look class, the tier table rows by year and the 2018 interstitial.
5. **GMix webmail (`gmix-webmail`).**
   - Sim: ad rotation by hour and account (pure), the daily junk inflow and the spam level function in the provider file, the FreeMix footer added by `sendMail`, the quota bounce rule call, purge of Trash and Spam after 30 days.
   - UI: folders, list, reader, composer with the attachment limit, contacts, spam settings, filters, folders, signature, POP and IMAP access, Mail Collector, forwarding, storage meter, ads and upsell, in the `frames` look first and the `navigator` and `flat` looks afterwards.
   - i18n: the rest of `ui-mail-gmix.ts`, including the ad list.
   - Test: `tests/gmix-webmail.test.tsx` and a sim suite: delete moves to Trash, empty Trash removes, a 21 MB attachment is refused on FreeMix before 2012, IMAP login is refused with the switch off, Mail Collector fetches once and leaves a copy, spam level Strict catches more than Normal in a seeded run, 31-day-old Trash mail is purged.
6. **Goggle site and sign-up (`goggle-site`).**
   - Sim: host table entries for `goggle.com` and `accounts.goggle.com`; sign-up wizard state in the page only; the actions of milestone 3 are the only writers.
   - UI: `src/ui/apps/browser/sites/mail/goggle/GoggleSite.tsx` with the four product looks, pricing page, the wizard with domain, admin, edition and seats, the verification and MX steps with the Verify and Open registrar buttons, the shared Goggle sign-in page.
   - i18n: `ui-mail-goggle.ts`.
   - Test: `tests/goggle-site.test.tsx`: the page title and edition table in 2006, 2008, 2017 and 2021; the wizard refuses a domain that is not the company's; Verify fails before the record and passes after it and its propagation.
7. **Goggle Admin console (`goggle-admin`).**
   - Sim: aliases, groups and catch-all delivery rules as pure functions the delivery calls; seat count and cap; the data transfer on delete; reports from the message store.
   - UI: `control` and `console` looks with Users, Groups, Email settings, Domains, Billing, Data migration, Reports, Status, Support. Create-user form, bulk suggestions chips (info, sales, support) on the wizard's last step.
   - i18n: the rest of `ui-mail-goggle.ts`.
   - Test: `tests/goggle-admin.test.ts`: alias delivers to the user's box, group copies to every member, catch-all catches an unknown local part, a deleted user's mail is gone without a transfer and present after one, seat price follows the catalog, suspended users still bill.
8. **Gmial core (`gmial-webmail`, part 1).**
   - Sim: `src/sim/80-business/mail-search.ts` (the parser and a matcher over a mailbox), the conversation grouping selector, label and archive semantics on top of the mail-core actions, `applyFilterNow`, the Trash and Spam banners' 30-day rule, the Labs flags and their defaults in `MailAccount.settings`.
   - UI: `src/ui/apps/browser/sites/mail/gmial/Gmial.tsx` in the `classic` look: rail with system locations and labels, conversation list, reader, composer, search box, toolbar (Archive, Report spam, Delete, Move to, Labels, More), stars, the storage counter, Sponsored Links, the Settings tabs General, Labels, Accounts and Import, Filters, Forwarding and POP/IMAP, and the Beta badge.
   - i18n: `ui-mail-gmial.ts`.
   - Test: `tests/mail-search.test.ts` covering every operator and their combinations; `tests/gmial-labels.test.ts`: a message with two labels shows in both views, Archive removes it from the Inbox view and keeps both labels, Trash hides it from label views, a filter from a message labels and archives the next matching message, the IMAP delete setting decides whether a Pear Mail delete frees quota.
9. **Gmial looks and features by year (`gmial-webmail`, part 2).**
   - Sim: `importantOf` wired to the Priority rule, categories for the tabs, snooze, the Smart Reply table by message kind, the Mail Goggles quiz generator (seeded by hour), Undo Send period as a setting.
   - UI: the `redesign`, `tabs`, `material` and `pill` looks, Priority Inbox, label colours, nested labels, Superstars, categories and the Promotions ad row, keyboard shortcuts with the cheat sheet, Labs and Themes, Old Snakey, Undo Send, Snooze, Smart Reply, Web Clips, the side panel.
   - i18n: the rest of `ui-mail-gmial.ts`.
   - Test: `tests/gmial-eras.test.tsx`: look class and available features for 2005, 2008, 2011-12, 2014, 2019 and 2023; shortcuts do nothing until switched on; Undo Send within the period cancels the send and after it does not.
10. **Switching (`switching`).**
    - Sim: fetch rules and import jobs surfaced through Import mail and contacts, Check mail from other accounts, the GMix Mail Collector and Data migration (using the mail-core object); MX-driven delivery and bounces as in section 5; the guide warning; the legacy free end of 2022 and the Standard closing mail; the cancel-and-remove sequence.
    - UI: the Import wizard in Gmial, the Data migration page in the console, a banner on the old provider's account page that lists what is still unmigrated (the number of messages in the box, the fetch rules running).
    - i18n: bounce and notice texts.
    - Test: `tests/mail-switch.test.ts`: the full walk from the GMix start box to Goggle with a seeded customer stream: mail before the MX change lands in GMix, mail after it in Goggle, a forgotten info@ bounces, a premature cancel loses the straggler, the straggler fetch rule saves it.
11. **Shell swap (`shell-swap`).**
    - Sim: remove `bookMail`, `cancelMail`, `selectMailServer` after the self-hosting lane has its replacement; point the Getting started checker at the new rule.
    - UI: delete `EmailSettings.tsx`, the menu item, the Support route and the unused strings; link Pear Mail's "Get a new address" to the provider category; update the default bookmarks.
    - i18n: remove the dead `apps.mail.*` keys from every language folder.
    - Test: update `tests/i18n.test.ts` keys, a guide test for the new step, and a menu test that "Change provider" is gone.
12. **Personal Gmial accounts (`gmial-consumer`).**
    - Sim: the free `@gmial.com` provider row from 2005 with the invite wall until February 2007, an invitation message from a friend after the start box has been used for a month, 2 GB then the growing quota, IMAP from October 2007, text ads, no custom domain.
    - UI: the `gmial.com` front page with the counter, the invite form, the phone verification joke, sign-up that creates the account.
    - i18n: the front page and the invite message.
    - Test: `tests/gmial-consumer.test.ts`: sign-up before 2007-02 needs a valid invite, after it does not; the invite message arrives once.

## 9. What this lane needs from mail-core beyond the contract

| Need | Why |
| --- | --- |
| `MailTenant`: `id`, provider id, plan, domain or null, owner account, seats, state (`trial`, `active`, `suspended`, `ended`), `since`, `trialUntil`, `endsAt`, `removeAt`, `verified` | One billing relationship per provider; the monthly tick, cancellation and the switching rules all read it. Also needed by the Ionose and Lookout sites. |
| Address model: `MailAddress` rows (address, target kind `mailbox`, `alias` or `group`, target ids), a tenant `catchAll` target, `deliverableAddresses(s)` selector | Aliases, groups and catch-all; the licence vendor's address list and the support desk read the same selector. |
| `Label` (id, account, name, parent, colour) and `Message.labels: string[]` of label ids; `MailAccount.model: "folders" | "labels"` | Gmial needs labels as first-class objects. A label account exposes labels to IMAP as folders under `[Gmial]/` plus `All Mail`, `Starred` and `Important`, as the real server does. |
| `FetchRule` (into account, from account or host, protocol, keep copy, target folder, interval, `once`, progress) | One object serves the GMix Mail Collector, Gmial's two import buttons and the Goggle Data migration. |
| `Contact` (account, name, addresses, group, note) with actions to save and delete, and completion on send | Address book in both webmails; Pear Mail can share it. |
| `MailAccount` extras: `password`, `access: { pop, imap }` switches, `usedMb`, `settings: Record<string, string | number | boolean>`, `sendAs: string[]`, `imapDelete: "archive" | "trash" | "expunge"` | The access switches, the storage meter, the per-account webmail preferences, Send mail as and the IMAP delete behaviour. |
| `Message` extras: `kind` (`personal`, `order`, `invoice`, `bank`, `vendor`, `promo`, `social`, `notification`, `group`, `system`, `support`), `sizeKb`, `starKind?`, `important?`, `snoozeUntil?`, `footerKey?` | Categories, importance, the size column and quota, stars, snooze and the FreeMix signature. |
| `ServerFilter` extra conditions: `hasWords`, `notWords`, `hasAttachment`, `sizeOver`; actions also `skipInbox`; an `applyFilterNow(filterId)` action | Gmial's filter dialog and "Also apply to N matching conversations". |
| Company zone with propagation: `DnsRecord` as in `netsvc-dns.ts` plus the `recordAt` and `mxTarget` functions of milestone 2 | Domain verification and the MX cutover; the self-hosted mail server needs the same MX data. |
| Actions this lane calls: create and delete mailbox, create, rename and delete folder, move, delete, restore and empty Trash, mark read, star and flag, add and remove label, create, rename, recolour and delete label, create, update and delete filter, save and delete contact, send, save draft, start and stop a fetch rule | The webmails are clients of the same actions Pear Mail calls, so a rule is written once. |
| A delivery pipeline with two hooks: the provider's spam policy (`junkChance`, `falsePositive`) and the quota bounce | Provider-specific spam behaviour and the full-mailbox bounce. |
| A daily purge using `termsAt(...).trashDays` and `junkDays` | Trash and Spam emptying after 30 days. |
| Provider-aware system folder names on `Folder` (Spam instead of Junk on GMix, `[Gmial]/Spam` over IMAP) | Immersion and IMAP fidelity. |
| Address roles inferred from the local part (`sales`, `info`, `support`, `owner`) and a rule that a role's mailbox cannot be deleted or cancelled | Switching without a setup page and `error.mailRoleInUse`. |
| `mailShare` reading the routing result of the sales address and the provider flag `freemail` | The freemail penalty follows the account, and a bouncing sales address stops its stream. |
| A `sendMail` option for a footer line from the provider terms | The FreeMix signature. |

If mail-core declines any row, this lane adds it in the milestone that first needs it, with the default in `newGame` and the fill in `deserialize` beside the existing mail fields.

From mail-client: Pear Mail reads `access`, the server names and ports in the catalog, and the poll gap; it shows the provider's real login error text. It also provides the compose helper (recipient parsing, attachments) so the two webmails call the same code. From support-desk: the support@ channel reads the address roles, not the provider.

## 10. Shared files

- `src/sim/80-business/mail.ts`: `MailProviderId`, the Goggle record, `salesAddress`, `mailShare`, `seatsFor` (billing now counts users, so `seatsFor` is no longer used for the bill). Lanes mail-core, webmail-server and this one; this lane edits only the Goggle and GMix records and the freemail flag.
- `src/sim/80-business/browser.ts` and `src/sim/10-catalog/sites.ts`: the `mailProvider` page kind and hosts; first lander creates it.
- `src/sim/80-business/index.ts`: the Email providers category.
- `src/sim/90-actions/mail.ts`: shrinks in `shell-swap`; the provider actions live in a new `mail-provider.ts` with one export line in `index.ts`.
- `src/sim/91-save/save.ts`: one `fillMailProviders` call in the chain, function next to the sim code.
- `src/sim/88-tick/tick.ts`: `providerTick` replaces the `mailTick` call on its own line.
- `src/ui/apps/browser/BrowserApp.tsx`: one branch for the page kind and a title case.
- `src/ui/apps/browser/sites/registrars/RegistrarPanel.tsx`: the DNS page in milestone 2.
- `src/ui/apps/browser/sites/era.ts`: `eraAtHour`.
- `src/ui/art/mailmarks.tsx`: reused marks.
- `src/i18n/ui-mail-gmix.ts`, `ui-mail-goggle.ts`, `ui-mail-gmial.ts` with mirrors in `de`, `es`, `fr`, `it` and `pt`; `ui-apps.ts` loses the `apps.mail.*` sheet keys in milestone 11.

## 11. Decisions

Taken in this plan without the user, easy to change:

- Sign-in, Admin console and webmail are separate routes on separate hosts, as in the real products, and a Goggle login is shared across them.
- Seats are the users that exist, not the staff count. Hiring a person does not add a seat; creating their user does.
- The Goggle price stays the single catalog price; the larger real editions are decorative cards.
- Spam false positives have no revenue effect in this lane.
- Undo Send waits in real seconds.
- Larger or older Goggle services (Calendar, Drive, Meet, Chat, two-step verification, app passwords) are decoration or absent.

Open, the user decides (recommendation first):

1. **Include the real free Goggle Standard Edition (2006 to 2012, 50 users then 10)?** Recommendation: yes. It is real history and gives a good late arc (the 10-user wall, the 2012 closing, the 2022 forced conversion), but it makes own-domain mail free in the years 2006 to 2012 and should be rebalanced after the first `npm run balance` run. The catalog row can be removed without touching anything else.
2. **Force the 2022 conversion of free legacy domains to the paid edition?** Recommendation: yes, with a one-click Cancel in the Billing page before the deadline, so it is an event and not a trap.
3. **Do passwords matter?** Recommendation: yes, with three tries and a recovery-address reset, because Pear Mail and webmail then fail alike and KeePassive earns its place. The alternative is to accept any password.
4. **Is the data-checked GMix table acceptable as starting numbers?** The tier quotas, prices and the year IMAP became free were recalled and could not all be confirmed against dated pages while writing this plan. Recommendation: ship the table, and let the catalog milestone correct a figure whenever a dated source disagrees.
5. **Cap on free GMix mailboxes per company.** Recommendation: 3, so a company cannot use a free mailbox per employee for ever.
6. **Does a deleted GMix mailbox keep its address reserved for ever?** Recommendation: yes, which keeps old vendor mail bouncing instead of reaching a stranger.
7. **Inactive GMix mailboxes deleted after six months, as the real portal did.** Recommendation: no, because it can destroy a mailbox the player forgot about without any way to see it coming.
8. **A personal Gmial account for the owner (milestone 12).** Recommendation: build it last and drop it if earlier milestones run long; it adds an invite wall, a second free provider that beats GMix at nearly everything, and no new mechanics.
9. **Do Pear Mail logins keep a GMix box alive and show up in "Last account activity"?** Recommendation: yes, a single field on the client account.
10. **Show a one-line tip about aliases and groups on the Goggle wizard's last step?** Recommendation: no. The seat column already shows what each choice costs, and the repository rule against hint lines applies.
