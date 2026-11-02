# Plan: shop and books split

Lane id: `shop-books-split`. Status: planned, open decisions in section 9.

The bookkeeping program and the shop system both write quotes, both hold a product catalog and both reach invoices. Players see two ways to do the same thing, and with a shop installed and email orders off, quote requests still arrive by email. This plan gives each program one job, makes the shop automate the customer side the way WHMCS does, and gives every program the same setup flow.

## 1. Current state

- Books programs: `src/sim/10-catalog/bookkeeping.ts` (Lexwear Office, WIZO Mein Büro, Saga Office Line, orgaMIN, Collmix, sevDeck, lexoffize, GnuCache). Shops: `src/sim/10-catalog/shops.ts` (ModemBill, ClientExit, WHMCache, Blessta, HostBull, Ubersmyth, OrderBocks, BoxBillin').
- Quotes, two flows. Programs with the `quotes` feature use Books > Quotes (`QuotesTab.tsx`, `createQuote` to `convertQuote` in `src/sim/90-actions/orders.ts:111-185`). GnuCache has no `quotes` feature, so the order ticket falls back to inline price fields (`CustomOrder.tsx:228`, `quoteOrder` at `orders.ts:96`).
- Two catalogs. Books > Products (`state.catalog`, `src/sim/90-actions/catalog.ts`) feeds email orders and has no gate. The shop has its own `shop.products` with prices per cycle, setup fee, server group and package (`src/sim/80-business/shop.ts:30`).
- Lead routing in `newLeads` (`src/sim/30-market/sales.ts:114-160`). `marketing.emailOrders` only affects standard orders. Non-standard leads (higher SLA, high budget) and unlisted products with `customRequests` on always go to email.
- Server groups: `ServerGroup` holds software installations (panel hosts, hypervisor clusters) and one `deploy` flag for the whole group. `targetFor` (`sales.ts:211-230`) picks the best host by its own ranking. There is no fill mode and no per-member switch.
- Orders are `SalesRequest` rows plus a ticket. Services are `Service` rows on the customer (`src/sim/30-customers/customers.ts:30`). Suspend, unsuspend and terminate exist in `src/sim/90-actions/holds.ts`. There is no order or service detail page.
- Invoices, bank matching, dunning and tax live in Books. Shop invoices reach Books through `importFromShop` or the paid `shop-link` module.
- Setup differs. Books: buy on the vendor site, download, install. Shop: install from a panel host's software page, 72 hours of setup, then everything is configured by hand.

## 2. Target split

Recommended (decision A in section 9):

| | Books program | Shop system |
| --- | --- | --- |
| Customers see it | no | yes: storefront, client area, invoices by email |
| Products and prices | no (removed) | yes, the only catalog |
| Quotes | before a shop: yes. With a shop: no | yes, from the first shop on |
| Customer invoices, payment gateways, reminders | before a shop: yes, by hand. With a shop: read-only copies | yes, automated |
| Orders and services, provisioning | no | yes, automated through modules |
| Bank account, matching, payables, tax, reports | yes | no |

This mirrors reality: a hoster runs WHMCS for customers and exports to the accounting program for the books. The shop is the system of record for everything a customer touches. Books keeps the ledger. Shop-link becomes the export that keeps the ledger current; without it the player imports by hand (as today).

Before the first shop, the company works by email: a request arrives, the player writes a quote in Books, converts it to an invoice and provisions by hand. When the shop finishes setup, Books' Quotes and Invoices tabs show a read-only list of shop-made documents, and new quotes are written in the shop.

## 3. Products and prices

- Fixed products exist only in the shop. Books > Products, `state.catalog`, `publishCatalog` and `offeredProducts` are removed. Before a shop every email request is priced in its own quote.
- `deserialize` drops `state.catalog`. Open email requests that referenced a catalog product keep their price in the request.
- Each shop product gets `autoCycles: boolean`, default true. When on, the product's monthly price is the only input and every other offered cycle is `monthly × months` (decision D: optional cycle discount). The cycle fields show the computed value read-only, and a checkbox "Preise manuell verwalten" turns them editable. The quarterly to triennial toggles (which cycles are offered) stay.
- A product without a monthly cycle cannot use `autoCycles`; the checkbox is forced on manual.

## 4. Leads and quotes

- One quote flow. Before a shop every Books program writes quotes the same way through the Books quote document (GnuCache included, under its own label). `QuoteFields` and `quoteOrder` go away, and the order ticket always links a quote document (decision B).
- With an active shop, quotes are written in the shop admin (WHMCS: Billing > Quotes) with the same steps: draft, send, accepted or declined, convert to invoice. The sim reuses `src/sim/30-market/quotes.ts`; the quote gets an `origin: "books" | "shop"`.
- Routing with an active shop:
  - Standard orders go through the storefront, as today.
  - Non-standard leads and unlisted products arrive as a quote request in the shop (WHMCS: a ticket in the "Sales" department, answered with a quote) instead of an email.
  - `emailOrders` on keeps the 25 percent email share for both kinds. `emailOrders` off sends nothing by email.
  - `customRequests` off still refuses unlisted products, as today.
- During the 72 setup hours, leads still arrive by email.

## 5. Orders and services

Orders become their own entity in the shop and services get a detail page, following WHMCS:

- `ShopOrder { id, customerId, items: serviceId[], invoiceId, status: pending | active | fraud | cancelled, placedAt }`. A storefront purchase creates one order with one or more pending services.
- Shop admin > Orders: list with status filter, detail page with items, invoice, payment state and buttons Accept, Cancel, Mark as fraud, Delete.
- Accept runs the module command Create for every item in the order, then sets the order active. A product's `setupMode` decides when this runs on its own: on first payment, on accept, or never (by hand).
- Shop admin > Services (WHMCS: Products/Services, per client): detail page with product, cycle, next due date, server, package, username, status `pending | active | suspended | terminated | cancelled`, and module buttons Create, Suspend, Unsuspend, Terminate, Change package, Change password. Each button calls the existing actions in `src/sim/90-actions/orders.ts`, `holds.ts` and `packages.ts`; a failed command shows the error from `stepError`.
- Button labels and status words follow the active shop variant (section 8 table). The sim stores the English ids above.
- Without the provisioning module for a service's panel, Create, Suspend and Terminate are disabled and the player provisions on the panel by hand, then sets the service active.

## 6. Server groups and placement

- Members stay software installations (a panel host or a hypervisor cluster), which is what WHMCS calls a server.
- `ServerGroup` gains `fill: "spread" | "fill"` (WHMCS: "Add to the least full server" / "Fill active server until full then switch to next least used"; Blesta: round robin / first non-full) and `disabled: string[]`.
- `targetFor` with a product's server group: drop disabled members, then with `spread` take the least full member, with `fill` take the first member in list order that still has room. Groups without a fill mode keep today's ranking. Placement inside a cluster (`pack | spread`) is unchanged.
- A disabled member only stops automatic placement from shop orders. Services on it keep running, and Create from a service page can still pick it by hand.
- The group page gets an order to members (up/down) because `fill` depends on it.
- Fill support per variant: variants without it show only the default (section 8).

## 7. Marketplace and modules

- Shop admin gets a Marketplace page (WHMCS: Apps & Integrations). It lists provisioning modules (cPanic, Pleskit, DirectAdmin, each hypervisor), payment gateways (debit, PayPail, card, paysafe, instantly, crypto) and shop-link.
- Each variant marks each module as included, buyable (price) or unavailable. WHMCache includes cPanic, Pleskit and DirectAdmin, for example; BoxBillin' includes fewer and lacks some entirely. This replaces the buttons on the vendor browser sites; purchases still post to the ledger as today.
- A product can only be bound to a server group whose kind has an installed provisioning module; otherwise the product is "manual" and orders wait for the player.

## 8. One setup flow

Every Books program and every shop variant uses the same steps, styled like the product:

1. Buy (or start trial) on the vendor site.
2. Install: desktop programs download for `setupHours`, browser programs start at once, shops install on a panel host and take `SHOP_SETUP_HOURS`.
3. First-run wizard in the app: company details (from `company`), tax settings, bank account. A shop adds: currency and cycles, first product group, first server group (from `firstGroups`), payment gateway.
4. Done screen with links to the main tabs.

The wizard is one shared component with per-program labels; steps a program lacks (GnuCache tax) are skipped.

Terminology per shop variant (filled from research, `docs/design/shop.md` keeps the canonical table):

| Variant (real) | Order statuses | Approve | Service name | Service buttons | Server group, fill options | Quotes |
| --- | --- | --- | --- | --- | --- | --- |
| WHMCache (WHMCS) | Pending, Active, Fraud, Cancelled | Accept Order (runs Create for every item) | Products/Services | Create, Suspend, Unsuspend, Terminate, Change Package, Change Password | Server Groups: "Add to the least full server", "Fill active server until full then switch to next least used server"; per server Disable | Quotes |
| Blessta (Blesta) | Pending, Accepted, Canceled, Fraud | Accept | Services | Activate, Suspend, Unsuspend, Cancel, Change Package | Module Groups: "First non-full server", round robin | none |
| HostBull (HostBill) | Pending, Active, Cancelled, Fraud | Accept Order | Accounts | Create, Suspend, Unsuspend, Terminate, Change Package, Change Password | Server Groups, fill type | Estimates |
| BoxBillin' (BoxBilling) | pending setup, active, suspended, canceled (order and service are one object) | Activate | Orders | Activate, Renew, Suspend, Unsuspend, Cancel | none | none |
| ClientExit (ClientExec) | Pending, Active, Cancelled | Activate | Packages | Activate, Suspend, Unsuspend, Cancel | none | none |
| ModemBill (ModernBill) | Pending, Active | Approve | Client Packages | Activate, Suspend, Cancel | none | none |
| Ubersmyth (Ubersmith) | Pending, Active | Approve | Services | Activate, Suspend, Cancel | Device groups, no fill choice | Quotes |
| OrderBocks (OrderBox) | Active, InActive, Suspended | none (orders run on payment) | Orders | Suspend, Unsuspend, Delete | none | none |

Sources: WHMCS order statuses and Accept Order (docs.whmcs.com orders/order-statuses, developers.whmcs.com acceptorder), module functions (developers.whmcs.com core-module-functions), server groups (docs.whmcs.com servers/server-groups); Blesta add-order options (dev.blesta.com CORE-2139, blesta.com forums 10777); HostBill account statuses (hostbill.atlassian.net); FOSSBilling statuses (FOSSBilling src/modules/Order/Service.php). Rows for ClientExec, ModernBill, Ubersmith and OrderBox and the service statuses of Blesta and HostBill are unverified and need a check against screenshots before the labels ship. No product auto-calculates longer cycles from the monthly price; `autoCycles` is a game convenience.

Variants without server groups place by today's ranking and show no fill option. Variants without quotes get the quote page anyway, because every shop must answer quote requests; it is labelled after the variant's ticket or estimate wording.

## 9. Open decisions

- A. Where the split sits: shop owns customer billing and Books keeps the ledger (recommended, section 2), or the shop replaces Books entirely, or Books keeps invoices and the shop only takes orders and provisions.
- B. GnuCache quotes: same quote document as every other program (recommended), or GnuCache stays without quotes.
- C. With a shop, does Books still allow a hand-written quote for a one-off deal, or is the shop the only place?
- D. Auto cycle prices: plain `monthly × months`, or with a discount per cycle set once in the shop settings.

## 10. Milestones

Each milestone is one pull request with a seeded test.

1. Remove the Books catalog; quotes priced per request; save migration. (`catalog.ts`, `ProductsTab.tsx`, `sales.ts`, `91-save`)
2. One quote flow in Books for every program; remove `QuoteFields`.
3. Shop quotes: quote origin, shop admin Quotes page, Books shows shop quotes read-only.
4. Lead routing with a shop: non-standard and unlisted leads become shop quote requests; `emailOrders` off means no email.
5. `autoCycles` on shop products with the manual checkbox.
6. Server group fill mode, disabled members, member order; `targetFor`.
7. `ShopOrder` entity and Orders list and detail page with Accept running Create per item.
8. Service detail page with module buttons and per-variant labels.
9. Marketplace page with included, buyable and unavailable modules per variant; manual products without a module.
10. Shared setup wizard for Books programs and shops.

Milestones 1 to 4 are one chain. 5 and 6 are independent of everything. 7 and 8 depend on each other; 9 depends on 8.
