# Mail and support desk

Five lane plans turn company email into real mailboxes and move support requests into a web-based desk. This page lists the lanes, the order they are built in across lanes, the rulings that settle where the lane files disagreed, and the decisions that are the user's.

## What the player gets

- Personal correspondence and support requests are separate. Mail from the bank, vendors, registrars, partners and staff lands in mailboxes; customer requests become tickets.
- Mailboxes behave like IMAP accounts on a provider. The player creates addresses such as `owner@`, `info@`, `sales@` and `support@`, and gives each a role so traffic routes to it. A separate `info@` keeps licence orders out of the support inbox, because every vendor checkout asks which address receives the order.
- Every mailbox has Inbox, Sent, Drafts, Junk and Trash, plus folders the player creates, nests, renames and deletes. Deleting moves mail to Trash, and emptying Trash removes it. Server filters and client rules sort mail automatically.
- Providers are websites in the Browser. The player signs up, picks a plan, manages accounts and switches providers there; the mail settings sheet in the shell goes away.
- Mail is read in the provider's webmail or in Pear Mail on the desktop, where the player adds accounts over IMAP or POP. POP downloads mail and removes it from the server, so webmail no longer shows it.
- Once a desk exists, it runs at `support.<company domain>` in the Browser, imports the mailboxes the player adds as channels, and turns their mail into tickets that staff are assigned to.

## Lanes

- [mail-core](mail-core.md): state at `s.mail`, engine in `src/sim/42-mail/`, provider catalog, tenants, accounts and roles, the delivery pipeline with filters, junk, quotas and bounces, folder and message actions, ticket envelopes, routing of every mail source, the cutover from the Support inbox, and old saves.
- [mail-client](mail-client.md): Pear Mail, the Apple Mail pun, in five looks tied to Pear OS releases from Tiger to Tahoo, with the Add Account assistant, IMAP and POP sync, Smart Mailboxes, Rules, Junk training, signatures, and the shared non-visual mail kit.
- [webmail-consumer](webmail-consumer.md): GMix (FreeMix, ProMix, TopMix) with its portal and webmail, Goggle Workspace through its eras (Goggle Apps for Your Domain, Goggle Apps, G Swoot) with the Admin console, Gmial with labels, stars, conversations, search operators and filters, the company DNS zone, and provider switching.
- [webmail-server](webmail-server.md): SquirrelMeal (SquirrelMail pun) from 2005, Squarecube (Roundcube pun, skins Classic, Barry and Plastic) from 2008 and later SOGoat (SOGo pun) on the player's own mail server, Postfixit Admin and Mailpig administration with Dovecoat, Spamsassin and Rspamed, Sieve filters and vacation, and the corporate providers Ionose (Lookout Web Access) and Lookout 365 (Lookout Web App, Lookout on the web).
- [support-desk](support-desk.md): the desk website at `support.<company domain>` as separate web software per desk, each with its own pages and era looks (OsTickit, Zendusk, Freshdusk, FreeScoot), installing or subscribing, mailbox channels and fetch, assignment to staff, departments, notes, merge, spam, admin screens, a customer portal with knowledge base, reports and SLA, and AI features on the hosted desks that replace ChadGPT.

## Build order

Lane milestones are numbered inside each file. Across lanes the order is:

1. Foundation, one after another: mail-core 1 to 5 (model, provider catalog, tenants and accounts, delivery, folders and message actions). webmail-consumer 1 adds the GMix and Goggle terms to the catalog file mail-core 2 creates.
2. Reading surfaces, in parallel: support-desk 1 (extract `ReplyPanel` and `TicketPane` from the Support app), mail-client 1 to 3 (shell, mailbox views with the shared kit, actions and compose), webmail-consumer 2 (company DNS zone and registrar DNS page), webmail-server 1 (webmail front ends as installable software).
3. Cutover: mail-core 6 and 7. Ticket envelopes land in mailboxes and the Support inbox is replaced. This needs support-desk 1 and mail-client 1 to 3, so the reply loop is playable in Pear Mail on the day the inbox goes.
4. Everything else, in parallel by lane in each file's own order. Cross-lane dependencies inside this step: support-desk 5 needs webmail-consumer 2; support-desk 6 needs mail-core 4; webmail-consumer 11 needs every provider site that replaces a row of the old settings sheet (webmail-consumer 4 and 6, webmail-server 7 and 8).

## Rulings across lanes

Where a lane file says otherwise, these win.

- Names come from mail-core: mail state `s.mail`, Pear Mail state `s.pearMail`, app id `Pear Mail`, UI folder `src/ui/apps/pear-mail/`, server verbs `moveMessages`, `markMessages`, `deleteMessages`, `expungeMessages`, `sendMessage`, `listFolder` and `matchesConditions`, and password checks through `checkMailLogin`. Lanes add no field to `MailState`, except the `DeskChannel` extras support-desk owns.
- Pear Mail syncs in the background. `pearMailTick` checks each account on its interval whenever Pear Mail has accounts, with the window open or closed, so POP downloads, rules and the dock badge keep working.
- Provider terms (tiers, quotas, prices, protocols by year) come from the provider lane that owns the site: GMix and Goggle from webmail-consumer, so IMAP becomes free on GMix FreeMix in 2012.
- The company DNS zone (MX, SPF, TXT verification, TTL propagation) is built once, in webmail-consumer 2. `mxTarget(s)` reads it, and support-desk adds its `support.` records to it.
- The shared non-visual mail kit at `src/ui/apps/mail-kit/` (folder listing, selection, drag and drop, drafts, mounting the ticket reply panel) belongs to mail-client 2. Webmail lanes import it and draw their own visuals.
- A ticket stays a ticket. Its email is an envelope message in the mailbox of its role, and before a desk exists the player answers it from that message with the existing reply templates, scoring and work minutes.
- The Support app becomes a launcher. It is hidden until a desk exists and then opens the desk site in the Browser.
- webmail-consumer 11 removes `EmailSettings.tsx`. mail-core 11 removes the `mail` ticket kind.

## Puns

Pear Mail and its looks Yosemighty, Big Sir and Tahoo; GMix with FreeMix, ProMix, TopMix and GMix Navigator; Goggle Apps, G Swoot, Goggle Workspace, Gmial, Gmial Labs, Mail Goggles, Hangups, Goggle Minus and YouTub; Squarecube with Classic, Barry and Plastic; SOGoat; Postfixit Admin; Dovecoat; Spamsassin; Rspamed; Ionose with Lookout Web Access; Lookout 365 with Lookout Web App and Lookout on the web; SquirrelMeal; the junk senders `hotmeal.com`, Maple Meds, Rolecks and Bitcorn; and the desks OsTickit, Zendusk, Freshdusk and FreeScoot.

## Decisions

The user settled these. Each lane file lists smaller open points of its own with a recommendation.

1. Every mail account has a password, set when the account is created. KeePassive, the password manager upgrade, offers to save it after a sign-in and fills it in on webmail logins and in the Pear Mail assistant; without KeePassive the player types it. Forgot password on a provider sends a verification code by post, which arrives after two to three days. On an own mail server the player is the admin and resets the password directly.
2. Pear Mail starts empty, with a welcome that walks the player through adding a first account.
3. Billing is per mailbox. Every hire gets a mailbox automatically, and a hire needs one: a company on freemail alone, or on a plan with no mailbox left, cannot hire until it has a free mailbox under its own domain.
4. The free Goggle Standard Edition exists from 2006 to 2012, and the 2022 conversion happens. Each affected account gets the notice by email, the player accepts the upgrade in the Admin console, and if nobody accepts by the deadline the tenant locks: sign-in stops and incoming mail bounces until a paid edition is chosen.
5. SquirrelMeal, the SquirrelMail pun, is the webmail on an own mail server from 2005, and stays available after Squarecube arrives in 2008.
6. Desks follow the real products with their real differences. Each desk is its own web software with its own pages, navigation and admin screens, and `economy.md` is updated to match. The hosted desks, Zendusk and Freshdusk, gain AI features in their real years, up to auto-answering from 2023, and that replaces the ChadGPT Support bot, which leaves the shop.
7. Spam arrives in realistic amounts. Out-of-office loops happen only when an autoresponder is enabled on a mailbox or a desk.
8. Mistakes cost mail. Deleting an address loses its mail, and requests sent to it bounce unless a catch-all exists. Uninstalling a mail server or losing its data without a backup loses its mail for good.
9. The pun names are approved.
