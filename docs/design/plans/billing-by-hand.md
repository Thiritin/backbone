# Plan: billing by hand

Lane ids: `books`, `walk`, `bank`, `order-steps`, `vendor-sites`, `registrar-form`, `shop-link`, `payment-methods`. Mockup: `docs/design/mockups/bookkeeping.html`. Related design: `docs/design/gdd.md` (Custom orders, the five order steps), `docs/design/economy.md` (Billing and payment habits), `docs/design/shop.md` (shop systems, modules, variants), `docs/design/plans/shop-portal.md`.

## 1. Decisions

- The game starts with every billing step done by hand in one bookkeeping program, Lexwear Office (pun on Lexware), bought from the Pear Store as the app "Books". Lexware, WISO Mein Büro and Sage sold exactly this to one-person firms in 2005: customer master data, quotes, invoices, open items, bank matching, dunning levels.
- Invoices go out as PDF by email. No paper, no postage.
- Customers have a postal address. It arrives in the order email, is entered once by click-to-fill, and is printed on quotes, invoices and used as domain owner data.
- Quotes exist. A quote is a document in Books, A4, with the default price prefilled. Without the Helpdesk link module the player drags it from Books onto the order ticket; with the module the ticket has a Create quote button and acceptance converts the quote to the first invoice on its own.
- Payments arrive as bank transfers in Books. The player matches each transfer to its invoice. Odd amounts and missing references are the player's judgement.
- Domains are registered on the registrar's site in the Browser, a form with owner data filled by click from the customer record. A shop system with a registrar module does this itself.
- Automation has two routes. The shop system takes the whole intake (customer, first invoice, domain, placement) for orders through the shop, and email orders can be switched off later, as designed. The back office (monthly run, bank matching, reminders) is automated by Lexwear modules or by a hired bookkeeper, and realistically both.
- Modules are bought on the vendor's own site in the Browser, with a licence key by email that the player pastes into the app. The Pear Store sells apps only.
- The shop and Books are separate systems until the Shop link module is bought. Before it, shop customers and invoices reach Books only through an Import button, and gateway payouts land as one bundled transfer.
- Payment methods are shop modules with a year, a fee, a profile preference and a side effect: PayPal disputes, card chargebacks and fraud, paysafecard churn, crypto abuse.
- The first hour shrinks: fewer apps in the dock, each app arrives when its problem does.

## 2. Lanes and order

| Lane | Scope | Depends on |
| --- | --- | --- |
| `books` | The Books app: Customers with addresses, Invoices as drafts with A4 preview and manual Send, Bank with transfers and manual matching, Reminders moved from Billing; Billing app removed | none |
| `walk` | Starter dock trimmed, trigger-based app unlocks, Getting started extended | none |
| `bank` | Banks to choose from, the bank's website with PIN and TAN, payables paid by hand, credit card and overdraft, mandates and standing orders, HBCI | `books` for payables and the statement, earlier milestones none |
| `order-steps` | Address on order emails and customers, order ticket steps 2 and 3 move into Books, quotes with drag onto the ticket, Helpdesk link module | `books` |
| `vendor-sites` | Vendor pages in the Browser, licence key email and Register dialog, Lexwear modules (Monthly run, Match by reference, Automatic reminders, Helpdesk link), bookkeeper staff role | `books` |
| `registrar-form` | Register and Transfer domain as a Browser form on the registrar's site, click-fill from the customer record; shop registrar module skips it | `order-steps` |
| `shop-link` | Source and synced flags, Import from shop, Shop link module, bundled gateway payouts | `books`, `vendor-sites`, shop systems in code |
| `payment-methods` | Method catalog, profile preference, lost sales by method, fees, chargebacks and returns as negative transfers, crypto abuse | `shop-link` |

Build `books` and `walk` first, in parallel, with `bank` starting on its first three milestones at the same time. Then `order-steps` and `vendor-sites` in parallel. Then `registrar-form` and `shop-link`. Then `payment-methods`.

## 3. Lane `books`

App id `Books`, shown as "Lexwear Office" in the window title and "Books" in the dock. Topic file `src/i18n/ui-books.ts` with mirrors in every `src/i18n/<lang>/`. Window 900 by 560, four toolbar tabs with a count badge each: Customers, Invoices, Bank, Reminders.

Milestones:

1. **Addresses.** `Customer` gets `address: { contact: string; company?: string; street: string; zip: string; city: string; email: string }`. `newGame` and `deserialize` fill it for old saves from a per-country generator in `src/sim/30-customers/addresses.ts` (street, postcode and city lists per country of the profile, contact from the existing name). Shown on the customer page and the invoice.
2. **Drafts.** `billingTick` issues each month's invoices with the new status `draft` instead of `open`. A draft has no `dueAt` and no `payStep` roll. The new action `sendInvoice(s, invoiceId)` in `src/sim/90-actions/billing.ts` sets `issuedAt` to now, `dueAt` to now plus 14 days, rolls `payStep` and emails the PDF. Old saves keep their open invoices as they are. A draft left unsent costs nothing but the money never comes.
3. **Transfers.** New state `s.transfers: Transfer[]` with `{ id, hour, from, reference, amount, invoiceId: string | null, matchedAt: number | null }`. When an invoice's `payAt` arrives, the tick appends a transfer instead of marking the invoice paid. Reference is `Rechnung <number>` for most, bare words like `Hosting` or the customer's name for a share by profile (private and gamer more often), and the amount is short by a few cents or a round number for a small share of low-budget payers. Action `matchTransfer(s, transferId, invoiceId)`: equal amounts mark the invoice paid; a smaller amount books a partial payment and leaves the rest open; a larger amount books the invoice paid and the rest as customer credit. A reminder sent on an invoice whose matching transfer sits unmatched for the same customer opens a short billing ticket ("already paid on <date>") and costs 5 happiness.
4. **App.** Books app in `src/ui/apps/books/` with the four tabs as in the mockup. Invoices shows a table and an A4 preview (210 by 297 scaled to the pane) with company header, address block, lines, total and due date; Send as PDF on drafts. Bank shows transfers left and open invoices right, a click on each matches, with the differing-amount sheet. Reminders is the existing Billing flow moved here (steps, suspend, write off). Customers lists every customer with address and services.
5. **Billing app removed.** Remove `Billing` from `STARTER_APPS` and from the dock on load, add `Books` in its place; saves with Billing in their dock or windows get Books. Finance keeps the statement.
6. **Tests.** `tests/books.test.ts`: drafts are issued and unsent drafts never pay; `sendInvoice` sets due and rolls the step; a transfer appears at `payAt` and matching pays; partial and overpaid matching; reminder on an unmatched paid invoice opens the ticket; old save with open invoices and no transfers loads and pays as before. `tests/i18n.test.ts` passes.

## 4. Lane `walk`

1. `STARTER_APPS` shrinks to Applications, Locations, Shop, Browser, Terminal, Support, Books, Settings. The trade office registration installs these.
2. New `s.unlocks: string[]` of app ids installed by trigger, checked daily in `src/sim/80-business/office.ts` or a new `walk.ts`: Finance at the first month end, Customers at five customers, Research when the Shop lists a locked item, Marketing when a server has free room for seven days with no order, Market at the first lost sale, Staff when open tickets pass ten or a draft invoice is a week old, Security at the first abuse report, Bank when cash is below two months of costs. Each unlock sends a Pear email and a News line and adds the app to the dock. Old saves with these apps installed keep them.
3. The Getting started document gains one step per unlock, shown only once the app exists.
4. `tests/walk.test.ts`: each trigger installs its app once; a save with everything installed changes nothing.

## 5. Lane `order-steps`

1. Order emails carry the address block (orders.ts). Customers created from them get it.
2. Step 2 "Create customer" opens Books at New customer with the email pinned: a click on a line fills the focused field, a postcode line fills postcode and city. Save creates the customer with no service and the ticket ticks the step. No `createAccount` without an address.
3. Quotes: `s.quotes: Quote[]` with `{ id, number, customerId, ticketId: string | null, lines, monthly, setup, status: draft | sent | accepted | countered | declined, sentAt }`. Customers tab has Create quote, lines and prices prefilled from the request and the player's Products rates. A4 preview like the invoice. The quote row is draggable (HTML5 drag) and the order ticket's attachment strip is the drop target; the drop calls `quoteOrder` with the quote's numbers. The customer answers as today; the answer updates the quote's status. Convert to invoice on an accepted quote creates the first invoice draft (setup, first month, domain fee); step 3 of the ticket is that draft being sent.
4. Helpdesk link module (owned flag in `s.modules`, sold by lane `vendor-sites`): Create quote button on the ticket that opens Books with the quote ready, Send attaches it, acceptance converts and sends the first invoice itself.
5. `tests/order-steps.test.ts`: order email carries an address; customer created with it; a quote dropped on the ticket quotes it; acceptance and convert produce the first invoice; with the module the whole chain runs from one Send.

## 6. Lane `vendor-sites`

1. `src/sim/10-catalog/modules.ts`: one list of modules with vendor, price, year and effect id: Lexwear Helpdesk link, Monthly run, Match by reference, Automatic reminders; shop vendors get Shop link and payment methods later. `s.modules: string[]` owned.
2. Browser pages per vendor in `src/sim/80-business/browser.ts` and `src/ui/apps/browser/sites/`: Lexwear's site lists modules with Buy. Buying debits the price and emails a licence key a minute later. The Register dialog in Books takes the key and turns the module on. Greyed buttons in Books open the vendor page. One newsletter email per module when its trigger count is reached (three domains by hand, ten matches, ten customers, first suspension).
3. Module effects: Monthly run sends every draft on the first of the month; Match by reference books transfers whose reference names an invoice and whose amount is exact, the rest stay; Automatic reminders send each step on its day.
4. Bookkeeper role in Staff: salary by year, works through drafts, matches (including odd amounts) and reminders at a rate per hour, scales with a second hire.
5. `tests/vendor-sites.test.ts`: buy sends a key, the key activates, each effect does its chore, a bookkeeper clears the queues.

## 7. Lane `registrar-form`

1. Step 4 opens the registrar partner's site in the Browser with a form: domain, owner block (click-fill from the customer record), nameservers prefilled with the player's two, auth code for a transfer (carried in the order email). Submit books the registry cost and the registry answers two minutes later as today.
2. A shop system whose variant includes the registrar module registers without the form for shop orders; Place orders automatically covers email orders as designed.
3. `tests/registrar-form.test.ts`: the form registers and transfers; the shop with the module skips it.

## 8. Lane `shop-link`

1. `Customer.source` and `Invoice.source` (`manual | shop`) and `synced: boolean`. Books shows synced records only; the shop admin lists its own. Shop-created records start unsynced.
2. Import from shop in Books flips every unsynced record. Without it, transfers from shop customers cannot be matched and reminders never fire for them.
3. Shop link module on the shop vendor's site syncs at creation and marks shop invoices paid when Books matches them.
4. Gateway payouts arrive as one transfer per week per gateway listing the invoices it covers; Import or Shop link resolves it into its invoices.
5. `tests/shop-link.test.ts`.

## 9. Lane `payment-methods`

Methods in `src/sim/10-catalog/payments.ts`, each a shop module with year, fee and effect: bank transfer (2005, none), direct debit (2005, returns with fee), PayPlus (2005, instant, disputes), card (2006, chargebacks, fraud orders), paysafecard (2007, prepaid, no dunning, churn), Instantly (2008, instant, clean reference), crypto (2012, prepaid, abuse). Each profile has a preference; a lead whose method is missing converts less or not at all, shown as a lost sale reason in Market. Prepaid methods skip dunning. Chargebacks and returns are negative transfers the player matches, reopening the invoice. Crypto share raises the abuse ticket rate. Economy numbers go into `docs/design/economy.md` under a new "Payment methods" heading when the lane starts. `tests/payment-methods.test.ts`.

## 9b. Lane `bank`

Money leaves by hand too. Supplier invoices are payables the player pays on the bank's website, and every chore has an automation that history offered.

Banks are a catalog in `src/sim/10-catalog/banks.ts`, each a row of numbers and a site skin:

| Bank (pun on) | From | Account a month (sole / partnership / limited) | Transfer | TAN | Card a year | Overdraft | Loans | Character |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sparklasse (Sparkasse) | 2005 | 8 / 12 / 16 + 0.30 a booking | next day | iTAN list, mTAN 2009, pushTAN 2014 | 30, easy | 11% | big, slow | local, orange, branch look |
| Volksbunk (Volksbank) | 2005 | 6 / 9 / 12 + 0.25 a booking | next day | iTAN, card reader 2007 | 25 | 10% | fair, likes small firms | blue and orange frames |
| Deutsche Bunk (Deutsche Bank) | 2005 | 12 / 18 / 24 + 0.15 a booking | same day | iTAN, photoTAN 2012 | 60, higher limit | 13% | large sums only | corporate |
| Postbunk (Postbank) | 2005 | 4 / 6 / 8 + 0.40 a booking | next day | iTAN, mTAN 2008 | 20 | 12% | small, quick | yellow, cheap |
| netbunk (direct banks) | 2005 | 0 / 5 / none | next day | iTAN, mTAN | 0 first year | 9% | none | web only, HBCI from day one |
| Fidorr (Fidor) | 2009 | 0 / 6 / 12 | instant | mTAN | 0 | 14% | small | startup crowd, API 2013 |
| Quonto (Qonto, Holvi) | 2016 | 9 / 15 / 25 | instant | app | included, virtual cards | none | none | fintech, API, no HBCI |

A limited company (GmbH) must keep a business account, and business accounts cost more than a sole trader's, so the account fee a month depends on the legal form. Branch banks charge a limited company about twice the sole trader's fee and add a fee for every booking on a partnership's or limited company's account; the fintechs sell flat plans, the limited one at two to three times the sole trader's. A partnership pays between the two. Each month start books the fee for the month and, at a branch bank, one line for the bookings of the month before: every ledger line of that month except the bank's own fees. netbunk, like the direct banks that long opened no GmbH accounts, opens none for a limited company: the registration refuses that pair, and the trade office form greys netbunk out while the limited form is chosen. The legal form is fixed once registered, so an open account never needs to move.

Milestones:

1. **Catalog and account.** `banks.ts` with the table. `s.bank: { id, number, opened, tan: "itan" | "mtan" | "push" | "app", card: Card | null, overdraft: number, mandates: string[], standingOrders: StandingOrder[] }`. Cash stays `s.cash`, the one account's balance. Old saves get Sparklasse. The account fee is a monthly cost line.
2. **Choice.** The trade office registration asks for the bank (the walk lane edits `office.ts` for the dock only; add the bank step beside it). Banks available by year only.
3. **Bank site.** A page per bank in the Browser from one shared frame that swaps colours, logo and TAN flow: login with account number and PIN, statement from the ledger, transfer form (account number and bank code until 2008, IBAN after), standing orders, cards, overdraft, loans (the loan offers move here from Finance, Finance keeps the list of running loans). iTAN: a transfer asks for TAN number n, the TAN list is a document on the desktop next to Getting started, the player types it. mTAN: the code arrives as an email a minute later. pushTAN and app: a confirm click.
4. **Payables.** Supplier invoices arrive by email and land in Books under a Payables tab: `s.payables: Payable[]` with `{ id, supplier, number, amount, issuedAt, dueAt, paidAt, consequence }`. Pay opens the bank's transfer form prefilled, TAN still needed. Consequences past due: the upstream line throttles after 7 days and cuts after 14, power cuts after 30, a licence expires, a domain lapses, an unpaid hardware shop does not ship the next order. Costs the tick deducts today move to payables one supplier at a time: upstream, electricity, rent, registrar, Pear subscriptions, hardware orders. Old saves keep the direct deduction for a supplier until its first new invoice. Needs the `books` lane merged; merge main before this milestone.
5. **Card and overdraft.** Apply on the bank site, approved after a few days, limit from account history, yearly fee. Hardware shop checkout gets a payment choice: prepay by transfer (ships when the money arrives, one to two days), invoice after three paid orders, card ships now. SuperMacro and other foreign vendors take card only. The card bill is a monthly payable. Overdraft up to the bank's limit at its rate.
6. **Automation.** A direct debit mandate per supplier, set up once on the supplier's site, after which that supplier debits itself. Standing orders on the bank site. HBCI module (sold by `vendor-sites` on Lexwear's site, effect built here): Books pulls the statement, pays every due payable with one click, later automatically. Fintech API from 2013 is the same effect without the module.
7. **Switching banks**, last and optional: a second account, customers keep paying to the old one until told, both statements in Books, the old account closes when empty for a month.
8. `tests/bank.test.ts`: fee charged, TAN flow accepts the right TAN and refuses a wrong one, a payable paid on time and one past due with its consequence, card approval and prepay shipping delay, mandate stops the manual payable, HBCI pays all due, old save loads with Sparklasse and keeps paying.

## 9c. Lane `books-vendors`

The bookkeeping program is a choice, like the bank and the shop. The Pear Store gets a Bookkeeping category; installing one of its programs installs the Books app in that vendor's skin and with that vendor's module list and prices. Books leaves the starter set. Getting started gains the step "Install a bookkeeping program" before the first customer step. Old saves keep Lexwear.

| Vendor (pun on) | From | Licence | Modules | Character |
| --- | --- | --- | --- | --- |
| Lexwear Office (Lexware) | 2005 | 249 once, paid yearly updates 99 | all five at the plan's prices | market leader, grey Windows look |
| WIZO Mein Büro (WISO Mein Büro) | 2005 | 149 once | Automatic reminders included, Monthly run 79, Match by reference 129, Helpdesk link 149, HBCI 49 | cheaper, friendlier, blue |
| Saga Office Line (Sage) | 2005 | 599 once | all included except Helpdesk link 199 | business tier, higher support, slow start |
| orgaMIN (orgaMAX) | 2005 | 199 once | Monthly run included, others 99 each | small-firm favourite, orange |
| Collmix (Collmex) | 2005 | 0 once, 15 a month | HBCI and Match by reference included, no Helpdesk link ever | web based, runs in the Browser look inside the app frame |
| sevDeck (sevDesk) | 2013 | 0 once, 19 a month | everything included, bank sync built in | fintech era, no licence keys, instant |
| lexoffize (lexoffice) | 2014 | 0 once, 12 a month | everything included | Lexwear's cloud sibling |

Switching programs keeps every customer, invoice, quote and transfer, since the data is the state, and drops the old program's modules. The new program's monthly fee is a payable like the others. Each vendor has a site in the Browser selling its modules on the Lexwear pattern.

Milestones: catalog in `src/sim/10-catalog/bookkeeping.ts`; `s.books.vendor` with Lexwear as the default for old saves; Pear Store category and install; Books skin per vendor (colours, name in the title, module list); module prices read from the vendor; vendor sites; Getting started step; `tests/books-vendors.test.ts`.

## 10. Shared files

| File | Lanes | Rule |
| --- | --- | --- |
| `src/sim/50-state.ts` and `newGame` | books (`transfers`), order-steps (`quotes`), vendor-sites (`modules`), walk (`unlocks`) | One field per lane on its own line, default in `newGame`, filled in `deserialize` |
| `src/sim/88-tick/tick.ts` | books, vendor-sites, walk, bank | One call per lane on its own line |
| `src/sim/10-catalog/store.ts` (`STARTER_APPS`) | books, walk, books-vendors | books swaps Billing for Books; walk trims the list; books-vendors removes Books from it |
| `src/sim/90-actions/orders.ts` | order-steps, registrar-form | order-steps lands first |
| `src/sim/80-business/browser.ts` | bank, vendor-sites, registrar-form | bank adds the shared site frame first, the others reuse it |
| `src/sim/80-business/office.ts` | walk, bank | walk edits the dock list, bank adds the bank choice |

## 11. Open questions, with recommendations

1. Does the existing Customers app fold into Books? Recommendation: not yet. Books holds master data and money, Customers keeps happiness, contracts and the activity log. Fold later if players look for addresses in the wrong place.
2. Does a reminder on an invoice with an unmatched payment cost happiness? Recommendation: yes, 5, plus the ticket. It is the reason to match.
3. Do email orders without an address exist? Recommendation: not in the first lanes. Add a missing-postcode share with a reply round trip once the base flow plays well.
4. Is the Books app free or a Pear Store subscription? Recommendation: free starter app. The money goes to Lexwear modules.
