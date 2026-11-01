# Plan: billing by hand

Lane ids: `books`, `walk`, `order-steps`, `vendor-sites`, `registrar-form`, `shop-link`, `payment-methods`, `registrar-panel`, `teardown`. Mockup: `docs/design/mockups/bookkeeping.html`. Related design: `docs/design/gdd.md` (Custom orders, the five order steps), `docs/design/economy.md` (Billing and payment habits), `docs/design/shop.md` (shop systems, modules, variants), `docs/design/plans/shop-portal.md`.

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
- The registrar partner's site has a reseller login, reached from the first registration's confirmation email. Its domain list shows every domain the player holds there with owner, expiry and renewal status; per domain the player can generate an auth code to transfer it out, or cancel it so it lapses at expiry. The partner bills each renewal to the player whether or not the customer still pays.
- Nothing is terminated on its own while billing is by hand. A customer who cancels or is written off stops being invoiced, but their services keep running on the server, their domains keep renewing and both keep costing until the player terminates them. A suspended customer stays suspended until paid or terminated.
- Termination is automated by a shop system's automation settings (auto-suspend after a number of days overdue, auto-terminate after a number of days suspended or at the end of a cancelled term, cancel or release each domain) for customers the shop knows, and by the bookkeeper staff role for every customer, at the bookkeeper's rate.

## 2. Lanes and order

| Lane | Scope | Depends on |
| --- | --- | --- |
| `books` | The Books app: Customers with addresses, Invoices as drafts with A4 preview and manual Send, Bank with transfers and manual matching, Reminders moved from Billing; Billing app removed | none |
| `walk` | Starter dock trimmed, trigger-based app unlocks, Getting started extended | none |
| `order-steps` | Address on order emails and customers, order ticket steps 2 and 3 move into Books, quotes with drag onto the ticket, Helpdesk link module | `books` |
| `vendor-sites` | Vendor pages in the Browser, licence key email and Register dialog, Lexwear modules (Monthly run, Match by reference, Automatic reminders, Helpdesk link), bookkeeper staff role | `books` |
| `registrar-form` | Register and Transfer domain as a Browser form on the registrar's site, click-fill from the customer record; shop registrar module skips it | `order-steps` |
| `shop-link` | Source and synced flags, Import from shop, Shop link module, bundled gateway payouts | `books`, `vendor-sites`, shop systems in code |
| `payment-methods` | Method catalog, profile preference, lost sales by method, fees, chargebacks and returns as negative transfers, crypto abuse | `shop-link` |
| `registrar-panel` | Reseller login on the registrar's site, domain list, auth code for transfer out, cancel at expiry, yearly renewals charged to the player, transfer-out requests from customers | `registrar-form` |
| `teardown` | Cancelled and written-off customers keep their services until terminated, Terminate in Books, suspended stays suspended, shop automation settings, bookkeeper terminates | `books`, `registrar-panel`, `vendor-sites` |

Build `books` and `walk` first, in parallel. Then `order-steps` and `vendor-sites` in parallel. Then `registrar-form` and `shop-link`. Then `registrar-panel` and `payment-methods`. Then `teardown`.

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

## 10. Lane `registrar-panel`

1. The registrar partner's site gains a Login page, unlocked by the first registration and announced by its confirmation email. Domains lists every `Domain` the player registered or transferred in: name, owner, expiry, renewal on or off, status (active, transfer pending, cancelled, gone).
2. Renewals: each domain renews at the partner a year after registration and books the registry cost to the player, independent of the customer's invoices. A cancelled domain does not renew and is gone at expiry.
3. Transfer out: a leaving customer may open a "transfer my domain" ticket. Generate auth code in the panel shows the code; the player pastes it into the reply. The domain leaves the list two days later and stops renewing. A ticket left unanswered for three days costs happiness like any ticket, and a refusal costs more and can end in a complaint.
4. Moving domains to another registrar (a cheaper partner, later the player's own accreditation) is a transfer per domain: the new registrar books one year on arrival, so each moved domain is paid a year early and its expiry no longer lines up with the customer's billing term.
5. `tests/registrar-panel.test.ts`: renewals charge the player after the customer left; a cancelled domain lapses at expiry; the auth code ticket resolves and the domain leaves; a moved domain books a year and shifts its expiry.

## 11. Lane `teardown`

1. A cancellation or write-off sets `churnedAt` and stops invoicing as today, but the customer's services stay on the server and keep their slot, power and licence costs, and their domains keep renewing. Services gain the status `orphaned`, shown in Books, Customers and the server's service list.
2. Terminate in Books on the customer page: one action `terminateCustomer(s, customerId)` in `src/sim/90-actions/customers.ts` removes every service, frees the slots and cancels each domain at the partner. Terminating a domain is a separate click in the registrar panel until the shop or bookkeeper does both.
3. A suspended customer stays suspended. Today's churn after `SUSPEND_CHURN_DAYS` writes the invoice off but leaves the services suspended until terminated.
4. Orphaned services that run for 30 days raise the abuse report rate for their server, since nobody patches an abandoned site.
5. Shop automation settings: auto-suspend after N days overdue, auto-terminate after N days suspended, terminate at the end of a cancelled term, domain on termination cancel or release. They act only on customers the shop knows (lane `shop-link`).
6. The bookkeeper role terminates orphaned and long-suspended customers at a rate per hour, for every customer, with the same settings as the shop.
7. `tests/teardown.test.ts`: a cancelled customer's services keep running and costing; terminate frees the slot and cancels the domain; a suspended customer stays suspended after churn; shop settings and the bookkeeper each terminate on their day; an old save loads with every churned customer's services already gone.

## 12. Shared files

| File | Lanes | Rule |
| --- | --- | --- |
| `src/sim/50-state.ts` and `newGame` | books (`transfers`), order-steps (`quotes`), vendor-sites (`modules`), walk (`unlocks`) | One field per lane on its own line, default in `newGame`, filled in `deserialize` |
| `src/sim/88-tick/tick.ts` | books, vendor-sites, walk | One call per lane on its own line |
| `src/sim/10-catalog/store.ts` (`STARTER_APPS`) | books, walk | books swaps Billing for Books; walk trims the list afterwards |
| `src/sim/90-actions/orders.ts` | order-steps, registrar-form | order-steps lands first |
| `src/sim/80-business/browser.ts` | vendor-sites, registrar-form, registrar-panel | vendor-sites adds the page frame first |
| `src/sim/45-billing/billing.ts` | books, teardown | books lands first |
| `src/sim/47-staff/staff.ts` | vendor-sites, teardown | vendor-sites adds the bookkeeper first |

## 13. Open questions, with recommendations

1. Does the existing Customers app fold into Books? Recommendation: not yet. Books holds master data and money, Customers keeps happiness, contracts and the activity log. Fold later if players look for addresses in the wrong place.
2. Does a reminder on an invoice with an unmatched payment cost happiness? Recommendation: yes, 5, plus the ticket. It is the reason to match.
3. Do email orders without an address exist? Recommendation: not in the first lanes. Add a missing-postcode share with a reply round trip once the base flow plays well.
4. Is the Books app free or a Pear Store subscription? Recommendation: free starter app. The money goes to Lexwear modules.
