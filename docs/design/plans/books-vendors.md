# Bookkeeping vendors

Related design: `docs/design/gdd/billing-and-books.md`, `docs/design/plans/shop-books-split.md`, `docs/design/plans/software-licences.md`.

## What changes

Today the eight bookkeeping programs differ in look (layout and skin) and in price, but every program shows the same tabs and the same features sorted by edition, so the choice comes down to price. After this plan each program has clear strengths and gaps, so the choice decides how much of the books the player runs by hand. Several names sit too close to the real product and get further-off puns.

## Rules for every program

These keep it a game and hold for every vendor and edition:

- Expenses (supplier invoices, rent, power, transit, salaries) always land in the books by themselves.
- Every program writes and sends invoices; the free one does it by hand, one customer at a time.
- HBCI unlocks Pay all: every open supplier invoice is paid in one step without a TAN. Without HBCI each transfer goes through the bank site with a TAN. A bank or fintech that includes HBCI still unlocks it, as today.
- Browser programs need the internet line and cost a month; desktop programs are bought once and pay for yearly updates, as today.

## Names

Ids stay as they are so saves keep loading; only the shown name and program name change.

| Id | Today | New | Real product |
|---|---|---|---|
| lexwear | Lexwear Office | Taxware Office | Lexware |
| wizo | WIZO Mein Büro | WARUM Mein Büro | WISO Mein Büro |
| saga | Saga | Thyme 50 | Sage 50 |
| orgamin | Orgamin | Orgamin (kept) | orgaMAX |
| collmix | Collmix | Kontomix | Collmex |
| sevdeck | sevDeck | EightDesk | sevDesk |
| lexoffize | lexoffize | Rexoffice | lexoffice |
| gnucache | GnuCache | GnuCache (kept) | GnuCash |

## Programs

| Program | Price | Strength | Gap |
|---|---|---|---|
| GnuCache | Free, desktop, 2005 | Full profit and loss and cash flow from day one. | Invoices one customer at a time, payments matched by hand, no HBCI, no tax filing, no dunning. Quotes stay, since every order needs one. |
| WARUM Mein Büro | Cheap, desktop | Quotes and the monthly invoice run in the smallest edition. | Reports and statistics only in the top edition; no dunning levels. |
| Taxware Office | Mid, desktop | Tax filing from the middle edition, and the accountant handover makes tax office letters rarer. | HBCI is a paid add-on in every edition; the tree layout takes more clicks. |
| Thyme 50 | Expensive, desktop | Everything, with network seats for a bookkeeping team and dunning levels from the middle edition. | Highest price, and a bookkeeper must be trained on it before rules run. |
| Orgamin | Mid, desktop | Helpdesk link and quotes in every edition, so customer questions and offers sit with the invoices. | Tax and statistics only in the top edition. |
| Kontomix | Cheapest monthly, browser, 2005 | HBCI included in every edition. | No automatic matching and no monthly run; everything else is a form filled by hand. |
| EightDesk | Mid monthly, browser, 2013 | Matches payments by reference in every edition. | No dunning levels; tax only in the top edition. |
| Rexoffice | Higher monthly, browser, 2014 | HBCI, matching and tax filing in the smallest edition, so the bank side runs itself. | No helpdesk link. |

## Early game

A 2005 start offers GnuCache (free), WARUM, Taxware, Orgamin and Kontomix. The free start is GnuCache: the player writes each invoice, matches each payment and pays each supplier with a TAN. That manual load is what makes the first paid program, and later HBCI, feel like an upgrade.

## Signature screens

Each program gets one screen only it has, built on shared parts: GnuCache the account tree, Kontomix the booking form, EightDesk the matching list, Rexoffice the bank feed, Thyme the chart of accounts. The rest stays shared.

## Lanes

1. `vendor-names`: new names in the catalog and every language file.
2. `vendor-features`: edition feature lists per the table, the manual invoice and manual matching paths for programs without the feature, HBCI as Taxware add-on.
3. `signature-screens`: one screen per program, after lane 2.
