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

- [mail-core](mail-core.md): state at `s.mail`, engine in `src/sim/42-mail/`, provider catalog, tenants, accounts and roles, the delivery pipeline with filters, junk, quotas and bounces, folder and message actions, ticket envelopes, routing of every mail source, the cutover from the Support inbox, and old saves. 13 milestones.
- [mail-client](mail-client.md): Pear Mail, the Apple Mail pun, in five looks tied to Pear OS releases from Tiger to Tahoo, with the Add Account assistant, IMAP and POP sync, Smart Mailboxes, Rules, Junk training, signatures, and the shared non-visual mail kit. 12 milestones.
- [webmail-consumer](webmail-consumer.md): GMix (FreeMix, ProMix, TopMix) with its portal and webmail, Goggle Workspace through its eras (Goggle Apps for Your Domain, Goggle Apps, G Swoot) with the Admin console, Gmial with labels, stars, conversations, search operators and filters, the company DNS zone, and provider switching. 12 milestones.
- [webmail-server](webmail-server.md): Squarecube (Roundcube pun, skins Classic, Barry and Plastic) and later SOGoat (SOGo pun) on the player's own mail server, Postfixit Admin and Mailpig administration with Dovecoat, Spamsassin and Rspamed, Sieve filters and vacation, and the corporate providers Ionose (Lookout Web Access) and Lookout 365 (Lookout Web App, Lookout on the web). 11 milestones.
- [support-desk](support-desk.md): the desk website at `support.<company domain>` in a look per desk software and era (OsTickit, Zendusk, Freshdusk, FreeScoot), installing or subscribing, mailbox channels and fetch, assignment to staff, departments, notes, merge, spam, admin screens, a customer portal with knowledge base, reports and SLA. 16 milestones.

## Build order

Lane milestones are numbered inside each file. Across lanes the order is:

1. Foundation, one after another: mail-core 1 to 5 (model, provider catalog, tenants and accounts, delivery, folders and message actions). webmail-consumer 1 adds the GMix and Goggle terms to the catalog file mail-core 2 creates.
2. Reading surfaces, in parallel: support-desk 1 (extract `ReplyPanel` and `TicketPane` from the Support app), mail-client 1 to 3 (shell, mailbox views with the shared kit, actions and compose), webmail-consumer 2 (company DNS zone and registrar DNS page), webmail-server 1 (webmail front ends as installable software).
3. Cutover: mail-core 6 and 7. Ticket envelopes land in mailboxes and the Support inbox is replaced. This needs support-desk 1 and mail-client 1 to 3, so the reply loop is playable in Pear Mail on the day the inbox goes.
4. Everything else, in parallel by lane in each file's own order. Cross-lane dependencies inside this step: support-desk 5 needs webmail-consumer 2; support-desk 6 needs mail-core 4; webmail-consumer 11 needs every provider site that replaces a row of the old settings sheet (webmail-consumer 4 and 6, webmail-server 7 and 8).

## Rulings across lanes

Where a lane file says otherwise, these win.

- Names come from mail-core: mail state `s.mail`, Pear Mail state `s.pearMail`, app id `Pear Mail`, UI folder `src/ui/apps/pear-mail/`, server verbs `moveMessages`, `markMessages`, `deleteMessages`, `expungeMessages`, `sendMessage`, `listFolder` and `matchesConditions`. Lanes add no field to `MailState`, except the `DeskChannel` extras support-desk owns.
- Pear Mail syncs in the background. `pearMailTick` checks each account on its interval whenever Pear Mail has accounts, with the window open or closed, so POP downloads, rules and the dock badge keep working.
- The company DNS zone (MX, SPF, TXT verification, TTL propagation) is built once, in webmail-consumer 2. `mxTarget(s)` reads it, and support-desk adds its `support.` records to it.
- The shared non-visual mail kit at `src/ui/apps/mail-kit/` (folder listing, selection, drag and drop, drafts, mounting the ticket reply panel) belongs to mail-client 2. Webmail lanes import it and draw their own visuals.
- A ticket stays a ticket. Its email is an envelope message in the mailbox of its role, and before a desk exists the player answers it from that message with the existing reply templates, scoring and work minutes.
- The Support app becomes a launcher. It is hidden until a desk exists and then opens the desk site in the Browser.
- webmail-consumer 11 removes `EmailSettings.tsx`. mail-core 11 removes the `mail` ticket kind.

## Puns

Pear Mail and its looks Yosemighty, Big Sir and Tahoo; GMix with FreeMix, ProMix, TopMix and GMix Navigator; Goggle Apps, G Swoot, Goggle Workspace, Gmial, Gmial Labs, Mail Goggles, Hangups, Goggle Minus and YouTub; Squarecube with Classic, Barry and Plastic; SOGoat; Postfixit Admin; Dovecoat; Spamsassin; Rspamed; Ionose with Lookout Web Access; Lookout 365 with Lookout Web App and Lookout on the web; the junk senders `hotmeal.com`, Maple Meds, Rolecks and Bitcorn; and the desks OsTickit, Zendusk, Freshdusk and FreeScoot.

## Open questions

These are the user's. Each lane file lists smaller ones of its own with a recommendation.

1. Passwords: does a mail account have one that the player types in Pear Mail and webmail, or does any login succeed? Recommended: the password is set when the account is created, the Browser and Pear Mail remember it, and a login fails only after the password changes.
2. Does Pear Mail start empty with the Add Account assistant, or with the GMix account already added? Recommended: empty, since GMix webmail works from the first minute and adding the account is a good first-hour step.
3. Does billing move from one seat per person to one per mailbox, and are employee mailboxes made automatically on hire or by the player?
4. Does the free Goggle Standard Edition from 2006 to 2012 exist, making own-domain mail free in those years, and does the forced 2022 conversion of legacy free accounts happen? Recommended: yes to both.
5. Self-hosted mail has no webmail until Squarecube in 2008. Accept the gap, or add an early webmail pun in the style of SquirrelMail?
6. Do desk features follow the real products, which gives OsTickit far more than kind filters today? Recommended: yes, with `economy.md` updated.
7. How much noise do mail and the desk add: spam false positives, customers reopening tickets with "thanks", chasers, out-of-office loops, and later phishing?
8. What does a mistake cost: requests lost after deleting an address without a catch-all, and self-hosted mail lost on uninstall without a backup?
9. Are the pun names above right?
