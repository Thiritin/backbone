# Plan: shop and books split

Lane id: `shop-books-split`. Status: decisions settled in section 10; milestones 1 to 3 built.

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

Decision A (section 10):

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
- Each shop product gets `autoCycles: boolean`, default true. When on, the product's monthly price is the only input and every other offered cycle is `monthly × months × (1 - discount of that cycle)`. The discounts sit once in the shop settings, one percentage per cycle, default 0 (decision D). Changing a discount reprices every product with `autoCycles` on; running services keep their price until renewal. The cycle fields show the computed value read-only, and a checkbox "Preise manuell verwalten" turns them editable. The quarterly to triennial toggles (which cycles are offered) stay.
- A product without a monthly cycle cannot use `autoCycles`; the checkbox is forced on manual.

## 4. Leads and quotes

- One quote flow. Before a shop every Books program writes quotes the same way through the Books quote document. `QuoteFields` and `quoteOrder` go away, and the order ticket always links a quote document.
- GnuCache (decision B) follows real GnuCash, which has no quote module: a quote is an unposted invoice, and posting it is the convert step. The sim object is the same quote; GnuCache labels it "Rechnung (nicht gebucht)" and the convert button "Buchen". GnuCache gains the `quotes` feature.
- With an active shop, quotes are written only in the shop admin (WHMCS: Billing > Quotes) with the same steps: draft, send, accepted or declined, convert to invoice (decision C). Books > Quotes turns read-only and lists shop quotes; its New button is gone. The sim reuses `src/sim/30-market/quotes.ts`; the quote gets an `origin: "books" | "shop"`. Quotes still open in Books when the shop goes live stay editable there until they are accepted, declined or expire.
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

Today's Servers page in the shop admin is too much: each group has a software kind, members with their nodes and node actions (cordon, drain, maintenance), a sell switch per product line and a deploy switch for the whole group. The sell switches repeat what the product's server group already says, and node actions belong in the console. The page is cut down to what WHMCS shows.

A server group is a name, a list of servers and a fill mode. Nothing else.

- Members stay software installations (a panel host or a hypervisor cluster), which is what WHMCS calls a server. The group's kind is taken from its first member; the add list only offers matching servers. The kind selector on "New group" goes away.
- Each server row shows name, accounts on it and fill level, and one switch "Aktiv". Off means new shop orders are not placed there; services on it keep running, and Create from a service page can still pick it by hand.
- One choice per group, "Verteilung": "Gleichmäßig verteilen" (WHMCS: "Add to the least full server") or "Erst einen Server füllen" (WHMCS: "Fill active server until full then switch to next least used server"). Rows can be moved up and down, which sets the fill order.
- Removed: the per-line sell switches (`sale`, `setGroupSale`), the group deploy switch (`deploy`, `setGroupDeploy`), node rows and node actions. `deserialize` drops `sale` and turns `deploy: false` into every member inactive.
- Products choose their server group in the product editor, as today. A product without a group is manual: orders wait for the player.
- On shop install one group per installed software kind is created with every matching server active (today's `firstGroups`), and new products default to it. A player with one panel host never has to open the page.
- `ServerGroup` becomes `{ id, name, members: string[], inactive: string[], fill: "spread" | "fill" }`.
- `targetFor` with a product's group: drop inactive members, then `spread` takes the least full member and `fill` takes the first member in list order with room. Placement inside a cluster (`pack | spread`) is unchanged.
- Variants without server groups in the real product (section 8 table) show no Verteilung choice and always spread.

### 6.1 Configurable options page removed

The shop admin page "Konfigurierbare Optionen" mixes three unrelated things: cycle discounts, per-unit rates for lines without a product (`src/sim/90-actions/rates.ts`, the former Marketing > Rates), and stock per line. None of them is what WHMCS calls configurable options, and the name explains nothing. The page goes away:

- Cycle discounts (`optionDiscount`, `setOptionDiscount`) move to the shop settings under "Laufzeitrabatte" and drive `autoCycles` (section 3).
- Per-unit rates are removed. Everything the storefront sells is a product with a price; anything else is a quote request (section 4). Leads that today price from rates go to the quote path. `deserialize` drops the rates.
- Stock per line is removed; stock per product (`ShopProduct.stock`) stays in the product editor.

## 7. Marketplace and modules

- Shop admin gets a Marketplace page (WHMCS: Apps & Integrations). It lists provisioning modules (cPanic, Pleskit, DirectAdmin, each hypervisor), payment gateways (debit, PayPail, card, paysafe, instantly, crypto) and shop-link.
- Each variant marks each module as included, buyable (price) or unavailable. WHMCache includes cPanic, Pleskit and DirectAdmin, for example; BoxBillin' includes fewer and lacks some entirely. This replaces the buttons on the vendor browser sites; purchases still post to the ledger as today.
- A product can only be bound to a server group whose kind has an installed provisioning module; otherwise the product is "manual" and orders wait for the player.

## 8. One setup flow

### 8.1 What differs today

- Books: bought on the vendor site, then a desktop program downloads for `setupHours` and is installed, or a browser program starts at once. No setup steps after that; locked tabs link to the vendor site.
- Shop: installed from a panel host's console software page with a key or the trial, then 72 hours of setup. Server groups are seeded by `firstGroups`, everything else (products, modules, payment methods) is found and configured by hand.
- Nothing tells the player what changes for running customers when the shop goes live.

### 8.2 Same steps for every program

Every Books program and every shop variant goes through the same four steps, styled like the product:

1. Buy or start the trial on the vendor site. Shops additionally pick the panel host they run on.
2. Install. Desktop programs download for `setupHours`, browser programs start at once, shops install for `SHOP_SETUP_HOURS`. The desktop shows a progress item in both cases.
3. First-run wizard when the app is first opened after install. One shared component, labels and look per program; steps a program lacks are skipped (GnuCache has no tax step).
   - Books: company details (prefilled from `company`), tax settings (Kleinunternehmer or regular VAT, filing interval), bank account (picked from the bank accounts the company has), invoice number format.
   - Shop: company details and the invoice number format (taken from Books when set), currency, cycle discounts (section 3), first product group and product, server groups (prefilled from `firstGroups`, fill mode per group), payment gateways (only those included or bought, section 7), email sender address (section 9), and the go-live step below.
4. Done screen with links to the main pages.

The wizard can be closed and reopened from the program's settings page; closing it keeps what was entered.

### 8.3 Go-live of the shop

The last wizard step moves running business into the shop. It shows what will happen and asks once:

- Existing customers and their services are imported into the shop as active services. A service that matches a product (line, spec, package) is linked to it; the rest become services with a custom price. Recurring invoices move to the shop from each service's next due date.
- Open Books invoices stay in Books until paid or written off. Open Books quotes stay as described in section 4.
- Email order handling switches from email to the storefront, following the `emailOrders` setting.
- Shop-link, when bought, syncs from go-live on; without it, the Books Invoices tab offers the manual import as today.

Skipping go-live keeps billing for existing customers in Books; the step stays available in the shop settings as "Bestandskunden übernehmen".

## 9. Customer communication and access data

### 9.1 Shop emails

The shop sends emails to customers on its own, the way WHMCS does. Each email is a template in the shop:

| Template (WHMCS name) | Sent when |
| --- | --- |
| Order Confirmation | an order is placed |
| Hosting Account Welcome Email | Create succeeds for a service; carries username, password, panel or server address and name servers |
| Invoice Created | a recurring or order invoice is issued |
| Invoice Payment Confirmation | a payment is matched |
| Invoice Payment Reminder, First/Second/Third Overdue Notice | dunning steps |
| Service Suspension Notification, Service Unsuspension Notification | Suspend or Unsuspend |
| Cancellation Request Confirmation, Service Termination | Terminate |
| Quote Delivery | a quote is sent |
| Password Changed | Change Password |

- The shop admin gets an email log (WHMCS: System Logs > Email Message Log, plus the Emails tab per client): date, recipient, subject, and the full message when opened. The customer page shows the same log for that customer.
- Each template can be turned off in the shop settings. A turned-off Welcome Email means the customer gets no access data from the shop (section 9.3).
- A service page has "Resend Welcome Email". An invoice page has "Resend".
- The sim stores a sent email as `{ id, customerId, template, params, at }` and renders it through `t()` when opened, so logs stay small and translate. The log keeps the last 12 months.
- Emails go out through the company's mail setup (`src/sim/90-actions/mail.ts`). Without a working mailbox the shop logs the email as failed and the wizard's sender step warns.

### 9.2 Access data on services

- Every service with a login gets `username` (exists for web hosting) and `password`, generated with `seededPassword` on Create. Change Password generates a new one.
- The service page shows the access data with a reveal button: username, password, panel address, server IP, name servers. Which fields apply depends on the line (web hosting: panel login; VPS and dedicated: root login and IP; mail: mailbox login).

### 9.3 Sending access data by hand

Without a shop, or for a service the shop cannot create:

- The manual order steps (`src/sim/30-market/manual.ts:35`) gain a last step `access`, after `provision`: send the customer the access data.
- The order ticket gets a reply template "Zugangsdaten" next to the existing templates of `replyTicket`. It fills username, password, panel or server address from the provisioned service, and the player sends it as the reply.
- The same template is available on any ticket of a customer with services, for a customer who lost the login.
- A service whose access data was never sent (no Welcome Email, no Zugangsdaten reply) produces a follow-up ticket "Wie komme ich in meinen Account?" within a day and costs happiness, the same way other unanswered orders do. This is the sim effect that makes the step matter.

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

## 10. Decisions

- A. The shop owns everything a customer sees; Books keeps the ledger (bank, matching, payables, tax, reports). Replacing Books would drop that gameplay and make the eight Books programs useless after the first shop.
- B. GnuCache gets the same quote document as every other program, presented as an unposted invoice like real GnuCash.
- C. With an active shop, quotes are written only in the shop. Books shows them read-only.
- D. Automatic cycle prices are `monthly × months` minus a discount per cycle, set once in the shop settings, default 0. Longer cycles lower churn, so the discount is a real lever.

## 11. Milestones

Each milestone is one pull request with a seeded test.

1. Remove the Books catalog; quotes priced per request; save migration. (`catalog.ts`, `ProductsTab.tsx`, `sales.ts`, `91-save`)
2. One quote flow in Books for every program, GnuCache as unposted invoice; remove `QuoteFields`.
3. Shop quotes: quote origin, shop admin Quotes page, Books shows shop quotes read-only.
4. Lead routing with a shop: non-standard and unlisted leads become shop quote requests; `emailOrders` off means no email.
5. `autoCycles` on shop products, cycle discounts in shop settings, manual checkbox.
6. Simpler server groups: name, servers with Aktiv switch, Verteilung, member order; drop sell and deploy switches and node rows; `targetFor`. Remove the configurable options page: cycle discounts to shop settings, rates and line stock removed.
7. Access data: service `password`, manual `access` order step, "Zugangsdaten" ticket template, follow-up ticket when never sent.
8. `ShopOrder` entity and Orders list and detail page with Accept running Create per item.
9. Service detail page with module buttons, per-variant labels and access data.
10. Shop emails: templates, email log in shop admin and on the customer page, resend, Welcome Email on Create.
11. Marketplace page with included, buyable and unavailable modules per variant; manual products without a module.
12. Shared setup wizard for Books programs and shops.
13. Shop go-live step: import customers and services, move recurring billing, "Bestandskunden übernehmen".

Order: 1 to 4 are one chain. 5, 6 and 7 are independent of everything. 8 then 9; 10 needs 7 and 9; 11 needs 9; 12 needs 5 and 11; 13 needs 12.
