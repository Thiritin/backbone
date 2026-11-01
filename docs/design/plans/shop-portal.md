# Plan: shop portal lane

> Critic note (i18n): `src/i18n/en.ts` loads every `ui-*.ts` by glob and `lang.ts` loads every `<lang>/*.ts` by glob, so this lane's new English file is `src/i18n/ui-<topic>.ts` with mirrors `src/i18n/<lang>/ui-<topic>.ts`, and no `en.ts` or `lang.ts` registration edit is needed anywhere below that says otherwise.

Lane id: `shop-portal`. Source of scope: `docs/design/panel-features.md` (Plan, Packages and products, Manual customer accounts, Build order step 5), `docs/design/shop.md` (built shop systems) and the lane decisions listed under Scope.

Topic file for new English keys: `src/i18n/ui-shop-portal.ts`, with mirrors in `src/i18n/<lang>/ui-shop-portal.ts` for de, es, fr, it and pt. `src/i18n/en.ts` loads every `ui-*.ts` file through `import.meta.glob` (en.ts:35), so this lane needs no registration line. Sim keys (ledger, events, errors) go into the same file.

## 1. Scope

Decisions from the user that define this lane:

- The order form has no monthly fee. The hand-rolled order form becomes a shop variant, bought once. The `orderForm` marketing channel and its upkeep are removed, and saves that own it move to the hand-rolled variant.
- Product administration moves into the shop system, at `portal.<company domain>/admin`, imitating each variant's real admin.
- Prices and durations move there. Marketing > Rates becomes the admin's configurable options. Billing cycles have sim effects.
- The website splits into a marketing site and a styled store at `portal.<company domain>`.

Features, each tagged and traced:

| # | Feature | Tag | Traces to |
| --- | --- | --- | --- |
| 1 | Hand-rolled order form as a once-bought shop variant; `orderForm` channel removed; save migration | [Sim] | shop.md 2.1 and 2.3 (row "Hand-rolled order form"); panel-features.md "Before a shop system" |
| 2 | Billing cycles: monthly, quarterly, annual, biennial; per variant support; prepaid invoice, term commitment, cycle discount weighting | [Sim] | panel-features.md Plan (products carry a price); economy.md "Happiness and churn" (yearly contracts, never built, see tick.ts:151) |
| 3 | Product groups and products: package + price per cycle + server group; stock per product | [Sim] | panel-features.md "Packages and products"; shop.md sections 3 and 4 |
| 4 | Configurable options: the per-unit rates (today Marketing > Rates) for lines or sizes without a fixed product; cycle discounts for them | [Sim] [UI] | `src/sim/90-actions/rates.ts`, `src/ui/apps/marketing/Rates.tsx` |
| 5 | Custom email quote default price before any shop exists | [Sim] | panel-features.md "Before a shop system"; manual.ts quote step |
| 6 | Portal host, paths and shell per variant | [Sim] [UI] | panel-features.md Build order step 5; shop.md section 7 milestone 4 ("styled admin console per variant") |
| 7 | Admin area per variant: product groups, Pricing tab, Module Settings tab, orders, clients, "Login as client" | [UI] | same |
| 8 | Store front per variant: product groups, configure, cart, checkout | [UI] | same |
| 9 | Client area per variant, opened from the admin | [UI] | same |
| 10 | Marketing site pages: pricing (from shop products), data centers and network, status, legal and imprint, contact; order buttons link to the portal | [Sim] [UI] | `src/ui/apps/browser/sites/CompanySite.tsx` |
| 11 | Daily status record feeding the status page | [Sim] | feature 10 |

Out of scope for this lane: package screens in the panels and the create forms (lane `packages-provisioning`), suspend (lane `panel-host-sim`), game titles (lane `game-servers`), the Customers app New customer form.

## 2. Current state

Order form and shop:

- `OwnedChannel` includes `"orderForm"` with setup 900, upkeep 10, needs website (`src/sim/80-business/marketing.ts:18-25`). Upkeep is billed in `marketing.ts:148` and `marketing.ts:193`. `hasOrderForm` is `owns(orderForm) || shopActive` (`marketing.ts:91`).
- The balance model hard-codes the form: `src/sim/balance/model.ts:213` and `:421`.
- `chooseShop` strips `orderForm` from `owned` (`src/sim/90-actions/shop.ts:33`) and requires the "shops" unlock (`shop.ts:25`, `error.needsShopSkill`). `setUpChannel` refuses the form while a shop is chosen (`src/sim/90-actions/marketing.ts:17`).
- `ShopState` holds variant, owned, since, readyAt, modules, stock per `Product` line, soldOut per line, groups (`src/sim/80-business/shop.ts:18-32`). Stock is per line (`stockOf`, `shop.ts:38`). Server groups exist (`ServerGroup`, `shop.ts:16`).
- Variants live in `src/sim/10-catalog/shops.ts` (`SHOPS`, `ShopVariant`). There is no hand-rolled entry; the hand-rolled form is the `orderForm` channel.
- Marketing > Shop (`src/ui/apps/marketing/Shop.tsx`) chooses the variant, buys modules and sets stock. Marketing > Website offers the form (`src/ui/apps/marketing/Website.tsx:109-124`).

Prices:

- `s.rates` holds the player's per-unit rate per line plus a setup fee (`src/sim/90-actions/rates.ts`, state `rates` at `src/sim/50-state.ts:228`, default `{}` at `:336`). `offerPrice` charges a spec at those rates (`src/sim/30-market/spec.ts:65`), `setupFee` the line setup fee (`spec.ts:69`).
- The editor is Marketing > Pricing (`src/ui/apps/marketing/MarketingApp.tsx:89` renders `Rates.tsx`).
- A form order is priced by `offerPrice` and counts as an accepted quote (`src/sim/30-market/orders.ts:62`, `:98`). `formInvoice` bills setup fee plus one month and sets `prepaidUntil = hour + 730` (`orders.ts:113-121`).
- Lead conversion for form orders adds `setupPremium` to the price level (`src/sim/30-market/sales.ts:107`); the base level is `priceIndex`, the average ratio of existing services' prices to market (`src/sim/30-market/market.ts:123-133`). A changed rate therefore reaches new leads only through services already sold.
- An email order's quote field starts at `r.counter ?? r.quote ?? r.reference` (`src/ui/apps/support/CustomOrder.tsx:124`), where `reference` is the market price (`market.ts:206`). Automation quotes at `offerPrice` (`orders.ts:102`).

Terms and churn:

- `Service.commitMonths` is only displayed (`src/ui/apps/customers/CustomerPage.tsx:269`). `Service.prepaidUntil` makes monthly arrears billing skip hours (`src/sim/45-billing/billing.ts:294`). Domains and SSL are billed yearly in advance (`period: "year"`).
- The monthly churn roll runs every month for every customer, with a note that yearly contracts rolling 12 times the base is not built (`src/sim/40-support/tick.ts:151`, roll at `:162-166`). economy.md "Happiness and churn" already specifies it.

Website and browser:

- `resolve()` maps the company domain to `{ kind: "company" }` (`src/sim/80-business/browser.ts:134-137`) and any `<name>.<company domain>` to a machine (`browser.ts:172`). There is no portal host.
- `CompanySite` has pages home, products, kb, helpdesk, about, support (`src/sim/80-business/website.ts:52-58`, `src/ui/apps/browser/sites/CompanySite.tsx:34-58`). The product card's "Order" is a plain span, not a link (`CompanySite.tsx:88`). "From" prices come from `offerPrice` at the smallest size (`website.ts:45-48`).
- `src/ui/apps/shop/` is the hardware shop (Pear Store parts), unrelated; the new code must not live there.

Saves:

- `deserialize` spreads defaults for `shop` (`src/sim/91-save/save.ts:105`) and `rates` (`src/sim/91-save/specs.ts:42`), and chains `fill*` helpers for the website (`save.ts:111`).

## 3. Design

### 3.1 Hand-rolled variant and order form removal (feature 1)

Catalog (`src/sim/10-catalog/shops.ts`): add `"handRolled"` to `ShopId` and to `SHOPS`: from 2005, `setup: 900`, `monthly: 0`, `yearly: 0`, no `own`, `includes: []`, `extra: 400` (the existing custom script price, `CUSTOM_SCRIPT`), `autoStock: false`. The shop.md row loses "€10 a month".

State: `OwnedChannel` loses `"orderForm"`. `hasOrderForm` becomes `shopActive`. `OWNED.orderForm` is deleted; the two balance model lines use `SHOPS` handRolled setup and zero upkeep.

Actions (`src/sim/90-actions/shop.ts`):

- `chooseShop(s, "handRolled")` needs the website but not the "shops" research, so the game starts as today. Its `readyAt` is `s.hour` when no shop is chosen yet (the old form was instant). Switching away from or to a variant keeps the 3 day setup rule from shop.md 2.1.
- `setUpChannel("orderForm")` returns `error.unknownChannel`. The UI offer in `Website.tsx:124` calls `chooseShop(s, "handRolled")`.

Save migration: `deserialize` runs `fillShop(s, savedOwnedHadOrderForm)`: when the saved `marketing.owned` contains `orderForm` and `shop.variant` is null, set `shop.variant = "handRolled"`, `since = 0`, `readyAt = 0`, and drop `orderForm` from `owned`. A saved shop variant stays. Old saves carry no `handRolled` upkeep from then on.

Economy: extends economy.md "Marketing and reviews" (owned channel table: remove the orderForm row and its €10 upkeep) and "Shop systems" (add the handRolled row).

### 3.2 Billing cycles (feature 2)

Catalog `src/sim/10-catalog/cycles.ts` (new, no imports of state):

```ts
export type Cycle = "monthly" | "quarterly" | "annual" | "biennial";
export const CYCLE_MONTHS: Record<Cycle, number> = { monthly: 1, quarterly: 3, annual: 12, biennial: 24 };
// Market discount off N times the monthly price. A cycle priced at these discounts is "near the market".
export const MARKET_DISCOUNT: Record<Cycle, number> = { monthly: 0, quarterly: 0.03, annual: 0.10, biennial: 0.15 };
```

Cycles per variant (a `cycles: Cycle[]` field on `ShopVariant`, so `shops.ts` is edited once):

| Variant | Cycles | Real counterpart |
| --- | --- | --- |
| Hand-rolled order form | monthly, annual | two price columns in a home-made table |
| ModemBill | monthly, quarterly, annual | ModernBill package billing cycles |
| ClientExit | monthly, quarterly, annual, biennial | ClientExec price per term |
| WHMCache | all four | WHMCS Pricing tab rows Monthly to Biennially (semi-annual and triennial are not modelled) |
| Blessta | all four | Blesta term and period |
| HostBull | all four | HostBill cycles |
| Ubersmyth | monthly, quarterly, annual, biennial | contract terms; dedicated and colocation default to annual |
| OrderBocks | monthly, annual, biennial | ResellerClub registration years |
| BoxBillin' | all four | BoxBilling periods 1M, 3M, 1Y, 2Y |

Service state (`src/sim/30-customers/customers.ts`, interface `Service`): add `termEnd?: number` (hour the paid term ends) and `cycle?: Cycle`. Both are optional, so old saves load as month-to-month with no change to `newGame` or `deserialize` beyond the existing service map (the `services` map in `save.ts:101` is left alone). `commitMonths` is set to `CYCLE_MONTHS[cycle]` for shop orders, so the Customer page shows the term already. The service's hourly `price` is the cycle price divided by months and by 730, so every existing readout (price tolerance, `priceIndex`, revenue) works on the effective monthly price.

Request state (`SalesRequest`, `src/sim/30-market/market.ts`): add `cycle?: Cycle` and `productId?: string`, both optional.

Order flow (`orderLead`, `orders.ts:55-110`): for a form order the customer draws a cycle from the weights below, then:

- `r.quote` is the effective monthly price of the cycle.
- `formInvoice` (`orders.ts:113`) bills the setup fee plus `N` months at the cycle price in one invoice, sets `prepaidUntil = termEnd = hour + 730 * N`, `commitMonths = N`.
- Hourly arrears billing already skips prepaid hours (`billing.ts:294`), so no billing change is needed for the first term.

Cycle choice weights (base shares by profile, monthly / quarterly / annual / biennial):

| Profile | Monthly | Quarterly | Annual | Biennial |
| --- | --- | --- | --- | --- |
| private | 0.78 | 0.10 | 0.11 | 0.01 |
| gamer | 0.90 | 0.07 | 0.03 | 0 |
| hobbyDev | 0.70 | 0.12 | 0.17 | 0.01 |
| soleProp | 0.55 | 0.15 | 0.28 | 0.02 |
| smallBiz | 0.42 | 0.15 | 0.38 | 0.05 |
| agency | 0.30 | 0.15 | 0.47 | 0.08 |
| office | 0.25 | 0.12 | 0.50 | 0.13 |
| onlineShop | 0.38 | 0.15 | 0.42 | 0.05 |
| enterprise | 0.20 | 0.10 | 0.50 | 0.20 |

The discount shifts these: for each offered non-monthly cycle `c` with the player's discount `d`, its weight is `base * exp(8 * (d - MARKET_DISCOUNT[c]))`. At market discount the base shares hold, 10 points above doubles a share (e^0.8 = 2.2), 10 points below roughly halves it (0.45). Weights are normalised over the cycles the variant supports and the product has a price for; an unpriced cycle gives its share to monthly. A cycle priced above the monthly total (negative discount) is allowed and simply loses customers.

Cycle discount and lead conversion: lead conversion today uses only `priceIndex`, which reacts after services are sold. For lines that have a product or configurable options, `share()` takes the advertised level instead: `shopPriceLevel(s, product)`, the weight-averaged effective monthly price of the line's cheapest fitting offers divided by their market price, replacing `priceIndex(s)` in `values()` for form leads (`market.ts:143-149`). `setupPremium` stays added on top. A line with no offers keeps `priceIndex`.

Churn commitment (`tick.ts` `monthly`, `:150-176`): a customer with an active service whose `termEnd > s.hour` is skipped by the monthly churn roll unless `happiness < 15`. At `termEnd` the customer rolls once with `P = min(0.9, N * base) + 0.5 * max(0, (50 - H) / 50)`, where `base` is the profile churn (`p.churn`) and `N` the term months. This is the formula economy.md already states for yearly contracts. The ponytail note at `tick.ts:151` is removed. The effect: the happiness term is rolled once per term instead of every month, which is the benefit of a commitment, while the base churn per month stays the same.

A customer below happiness 15 who cancels mid-term gets the unused whole months refunded in cash as a ledger entry `ledger.refundUnused` (category "billing"). The player can see that bad service burns prepaid cash.

Renewal: on a month start (`billing.ts` monthly block, `:289-300`), a service with `cycle` and `termEnd` inside the coming month receives a renewal invoice for the next term: `N` months at the product's current cycle price (or the configurable option price), line key `invoice.line.renewal`. When paid, `termEnd += 730 * N`, `prepaidUntil` follows. A list price raise therefore reaches the customer at renewal and goes through the existing price raise logic (`before`, `held`). An unpaid renewal follows the existing overdue, suspend and collections steps.

Prepaid cash: an annual order of a €10 a month plan at the market discount pays 12 x 10 x 0.90 = €108 when the invoice is paid, instead of €10 a month. Revenue recognition stays in the invoice date, which is how the ledger works today.

Numbers extend economy.md "Shop systems" with a new subsection "Billing cycles" holding the two tables above, the weight formula (steepness 8), the churn formula and the refund rule. `npm run balance` (`src/sim/balance/model.ts`) gets the annual share as a revenue and cash input in milestone 2; the model's collected share (`model.ts:398`) is the place to change.

Domains and SSL (`period: "year"`) do not show a cycle choice; they are always annual.

### 3.3 Product groups and products (feature 3)

Feature 1 is superseded by [product-catalog](product-catalog.md) milestone 1. The shop keeps its own products on `ShopState`; the Books catalog (`s.catalog`) is a separate list that email orders choose from.

State on `ShopState` (`src/sim/80-business/shop.ts`):

```ts
export type SetupMode = "payment" | "accept" | "off"; // WHMCS "Automatically setup the product ..."
export interface ProductGroup { id: string; name: string; hidden: boolean }
export interface ShopProduct {
  id: string; groupId: string; name: string; line: Product;
  // The server group the product is provisioned onto, and the package name on that group's installations.
  serverGroupId: string | null; packageName: string | null;
  // Snapshot spec used until a package is bound, and for lines whose software has no packages.
  spec: Spec;
  // Snapshot of the game title and slots (game-servers lane) used until packageName binds; the bound package's own `title`/`slots` win. Absent for non-game lines.
  title?: string; slots?: number;
  prices: Partial<Record<Cycle, number>>; // total price of one term, null or absent = not offered
  setup: number;
  stock: Stock; hidden: boolean; setupMode: SetupMode;
}
// added to ShopState:
products: ShopProduct[];
productGroups: ProductGroup[];
// Discount off N x monthly per cycle for lines sold through configurable options (feature 4).
optionDiscount: Partial<Record<Cycle, number>>;
```

Defaults: `newShop()` returns `products: []`, `productGroups: []`, `optionDiscount: {}`; `deserialize` already does `{ ...base.shop, ...data.shop }` (`save.ts:105`), which fills missing keys. `soldOut` widens from per-line to `Record<string, number>`; saved line keys stay valid because a line key is the configurable-options key (`line:<Product>` is not needed, the plain `Product` name is kept).

Old `stock` per line: kept as the stock of the configurable-options offer of that line. Products carry their own `stock`.

Resolution of a package: `packageSpec(s, product, clusterId)` calls the lane `packages-provisioning` function `packageByName(s, clusterId, name)` and falls back to `product.spec`. A target installation without a package of that name is not a target for the product (WHMCS shows "package not found" in that case); the admin lists the members that lack it.

Order placement: for a form order, `chooseProduct(s, req)` in `src/sim/80-business/portal.ts`:

1. Candidate products: not hidden, line equal, stock not off or zero, server group has a member with room (`targetFor` with the group filter), and a price for at least one supported cycle.
2. The smallest candidate whose spec covers the request's spec in vCPU, RAM, disk (and traffic and mailboxes for web hosting).
3. When none covers it, the largest candidate if its monthly price is at most 1.35 x the request's `reference`; otherwise the visit counts as `soldOut["<line>"]` ("no fitting plan") and the lead is not an order, never a lost sale. The 1.35 is a proposal in line with `BUDGET_RANGE` (`sales.ts:80`) so a bit more than the market is tolerated.
4. The order's `spec` is the product's spec, so provisioning books the product's resources.
5. A line with products but none candidate behaves as sold out for that line. A line with no products at all is sold through configurable options (3.4).

`targetFor` (`sales.ts`) gets a `groupId` filter instead of "any for-sale group" when a product is given; stock "auto" means the product's server group has room. `takeStock` and `soldOutVisit` take the product id.

Automation: `product.setupMode` gives WHMCS's three choices. "payment" provisions on the first payment when `canAutomate` and the module exist (today's `s.autoOrders` path, `orders.ts:75-92`), "accept" leaves the order in the pending queue until the admin accepts it (the existing order ticket flow in Support), "off" leaves it to the player. The global `s.autoOrders` switch stays as the master; default `setupMode` is `"payment"` so existing behaviour holds.

Actions (`src/sim/90-actions/portal.ts`, new; all return `ActionResult`, all validate and fail with an `error.*` key):

- `createProductGroup(s, name)`, `renameProductGroup(s, id, name)`, `setProductGroupHidden(s, id, hidden)`, `deleteProductGroup(s, id)` (fails with products in it).
- `createProduct(s, groupId, name, line)` creates a product with the line's smallest size spec, market prices for every supported cycle and the market setup fee.
- `updateProduct(s, id, patch)` for name, group, server group, package name, spec, setup fee, stock, hidden, setup mode.
- `setProductPrice(s, id, cycle, price | null)`: 0 to 100000, cycle must be supported by the variant (`error.cycleNotSupported`).
- `deleteProduct(s, id)`: services keep their label and price; the order thread keeps its text.
- `setOptionDiscount(s, cycle, discount | null)`: 0 to 0.5.

Every action requires an active shop variant (`error.noShop`).

### 3.4 Configurable options (feature 4)

The per-unit rates stay in `s.rates` unchanged (state, `setRate`, `resetRates`, `offerPrice`). What moves is the screen: Marketing > Pricing (`Rates.tsx`) is removed from `MarketingApp.tsx` (the `pricing` section at `:89`) and the same per-line cards become the admin's Configurable Options page, one group per line with the unit rows ("vCPU", "RAM GB", "Disk GB", mailbox and so on) and their market reference beside each. The setup fee row stays.

Lines that have no visible product are sold through their configurable options as "Custom configuration" (WHMCS configurable options on a base product; Hetzner-style build your own). The request spec is the customer's drawn spec priced at `offerPrice`, as today, plus the cycle: price per term is `monthly * N * (1 - optionDiscount[cycle] ?? MARKET_DISCOUNT[cycle])`. This keeps the starting game working before the player has defined a product, and keeps every old save selling.

The admin shows the cycle discounts in a Configurable Options group "Billing cycles" (one percent field per supported cycle with the market discount beside it).

### 3.5 Custom email quotes before a shop exists (feature 5)

Decision: until a shop is active, the quote field starts at the market reference, which is what `CustomOrder.tsx:124` already does, and the automation quote uses market rates because `s.rates` can no longer be edited without a shop. With a shop active the quote field starts at `offerPrice(s, ...)` (the configurable option rates, equal to the market until edited) so the admin's rates and the quotes agree. The change is `orders.ts:102` and `CustomOrder.tsx:124`: use `shopActive(s) ? offerPrice(...) : reference`. Existing `s.rates` of old saves are kept in state and apply as soon as a shop is active. Email orders stay monthly (no cycle) in this lane; quote terms are in the last milestone.

### 3.6 Portal host, paths, shell (feature 6)

Routing (`src/sim/80-business/browser.ts`): before the machine lookup at `:172`, add `if (host === "portal." + domain) return shopActive(s) ? out({ kind: "shop" }, load) : out({ kind: "notfound" })` with `load` from `siteStatus` (the shop runs on the website host per shop.md 2.1; `STATUS_FACTOR` already drives leads). `Page` gets `{ kind: "shop" }`. `titleOf` and `Viewport` in `BrowserApp.tsx` (`:44-105`) get a case that renders `PortalSite` and marks it `paper`.

Paths per variant live in `src/sim/80-business/portal.ts` as `portalPath(variant, area, ids)` and `parsePortal(variant, path)`:

| Variant | Store | Configure | Cart | Client area | Admin |
| --- | --- | --- | --- | --- | --- |
| WHMCache | `/cart.php?gid=1` | `/cart.php?a=add&pid=3` | `/cart.php?a=view` | `/clientarea.php` | `/admin/` |
| Blessta | `/order/main/packages/<group>` | `/order/config/index/<group>?pricing_id=3` | `/order/cart` | `/client/` | `/admin/` |
| HostBull | `/cart/<group>/` | `/cart/<group>/<product>/` | `/cart/` | `/clientarea/` | `/admin/` |
| BoxBillin' | `/order` | `/order/<slug>` | `/order/<slug>` (single page) | `/client` | `/bb-admin/` |
| ClientExit | `/order.php?gid=1` | `/order.php?pid=3` | `/order.php?step=cart` | `/index.php?fuse=home` | `/admin/` |
| ModemBill | `/order.php?group=1` | `/order.php?pkg=3` | `/order.php?step=review` | `/modernbill/` | `/admin/` |
| Hand-rolled | `/bestellen.php` | `/bestellen.php?plan=3` | same page | none | `/admin.php` |
| Ubersmyth | `/order/` | `/order/<product>` | `/order/cart` | `/client/` | `/admin/` |
| OrderBocks | `/store/` | `/store/<product>` | `/store/cart` | `/account/` | `/admin/` |

The admin path defaults to `/admin` for the lane's stated address; `/admin` always redirects to the variant's own admin path. The page shows an admin login screen first (prefilled `admin` user, masked password, "Login" button) the first time per browser session; the flag is kept with `useSessionState` (`src/ui/session`), never in the sim.

Shell (`src/ui/apps/browser/sites/portal/PortalSite.tsx`): picks admin vs store vs client by `parsePortal`, loads the variant's skin component and CSS. One skin = one folder `portal/<variant>/` with `Admin.tsx`, `Store.tsx`, `Client.tsx`, `skin.css`. The shared parts (product table model, pricing form model, order list) live in `portal/shared/` as headless hooks so skins differ only in markup.

Era looks, which follow the real products by game year:

| Variant | 2005 to 2011 | 2012 to 2019 | 2020 on |
| --- | --- | --- | --- |
| WHMCache | WHMCS 3 and 4 admin: light grey header, blue links, boxed tables, small tabs; store is the "ajax" cart | WHMCS 5 and 6: "Blend" admin, Six client theme in bootstrap blue | WHMCS 8: flat admin with left nav, Twenty-One theme |
| Blessta | not sold | Blesta 3 and 4: dark blue sidebar, white content | Blesta 5: same, rounded buttons |
| HostBull | not sold before 2009; HostBill 3 gradients | HostBill 4 and 5 | HostBill 2020 flat UI |
| BoxBillin' | not sold before 2011 | BoxBilling 2: bootstrap 2 white and blue admin; abandoned look until 2022 | FOSSBilling: flat Tabler admin |
| ClientExit | ClientExec 3: Ext JS grey panel admin, tabbed grids | ClientExec 4 and 5: lighter Ext JS | ClientExec 6: modern but plain |
| ModemBill | ModernBill 4: black on white tables, red headings, PHP-style frames | gone after 2010 | gone |
| Hand-rolled | bare HTML table, Times, grey buttons | bootstrap 2 defaults | bootstrap 5 defaults |

### 3.7 Admin screens (feature 7)

Every skin offers the same functions under its own navigation. The WHMCache skin is the reference and the first built; each real screen it imitates:

| Screen | Imitates | Content |
| --- | --- | --- |
| Setup > Products/Services > Products/Services | WHMCS `configproducts.php` | Product groups as headed tables, rows with product name, type, pay type, stock, "Duplicate" and "Delete" icons, buttons "Create a New Group" and "Create a New Product" |
| Edit product, tab Details | WHMCS product Details | Product type, group, name, description, "Stock control" with quantity, hidden checkbox |
| Edit product, tab Pricing | WHMCS Pricing tab | Payment type (Free, One Time, Recurring), a table of rows Setup Fee and Price per cycle columns Monthly, Quarterly, Annually, Biennially; the market price beside each field; the discount against 12 x monthly shown as the "save" percent |
| Edit product, tab Module Settings | WHMCS Module Settings | Module name (the panel software of the chosen server group), server group dropdown, package name dropdown from the panel's packages, "Automatically setup" radios mapped to `setupMode` |
| Setup > Products/Services > Configurable Options | WHMCS `configproductoptions.php` | One group per line with the per-unit rates (replaces Marketing > Pricing), the Billing cycles group (3.4) |
| Setup > Products/Services > Servers | WHMCS Servers and Server Groups | Server groups from shop.md section 4 (state exists; the Marketing > Shop group editor moves here) |
| Orders > Pending Orders | WHMCS `orders.php` | Pending form orders with "Accept Order" and "Cancel Order"; mirrors Support's order tickets |
| Clients > View/Search Clients | WHMCS `clients.php` | Customers list; the Summary page has "Login as Client" (opens the client area, 3.9) and the service list with Suspend and Terminate links into the panel actions of lane `packages-provisioning` and `panel-host-sim` |
| Billing > Invoices | WHMCS `invoices.php` | Read-only invoice list from `s.invoices` |

The other skins keep the same functions with their own names:

| Variant | Product screen | Pricing screen | Module/provisioning screen |
| --- | --- | --- | --- |
| Blessta | Packages > Package Groups, Add Package | Package tab "Pricing": Term and Period rows, price, setup fee, cancel fee | Package tab "Module": module, group, package |
| HostBull | Settings > Products & Services > Order pages | Product Pricing tab with cycles | "Connect with app" and "Automation" tabs |
| BoxBillin' | Products > Product categories, Add product | Pricing: type (Free, Once, Recurrent), period rows 1M 3M 1Y 2Y, setup price | Configuration: server, hosting plan |
| ClientExit | Products > Product Groups, Package Types | Product "Pricing" tab with terms | "Plugin" tab: plugin and package |
| ModemBill | Package Manager: Package Groups and Packages | Package form price fields per billing cycle | "Control panel" section of the package form |
| Hand-rolled | one flat table `admin.php` with name, monthly, yearly fields | the same two fields | a single "server" text and "panel package" field |
| Ubersmyth | Products > Packages | Pricing with contract term | Provisioning tab |
| OrderBocks | Products > Set Pricing | per-year price columns | none (fixed products) |

The product group concept does not exist in ModemBill (flat list) or in the hand-rolled admin (flat). There the single hidden group "default" holds the products and the UI never shows it.

UI copy rule: labels and values only. Where a real product shows help text, the skin omits it.

### 3.8 Store front (feature 8)

Per variant, the screens a visitor sees; each is read-only for the sim except through the existing lead mechanics (customers order on their own; the player's visit is a preview):

- Store: product groups with products, "from" price per cycle, stock ("Sold out" when stock is 0 or the group has no room; the product is greyed).
- Configure: cycle dropdown with the price per cycle and savings, domain field for web hosting, configurable options for custom-configuration lines (sliders or selects per unit with prices), and add to cart.
- Cart: lines, setup fee, total, promo box omitted.
- Checkout: contact fields prefilled with the player's company data as a preview, "Complete Order" disabled with the preview chrome; the page tells nothing else.

Era store looks follow the table in 3.6. WHMCS: the "standard cart" progress steps (Choose, Configure, Review) are a stepper from 2013.

### 3.9 Client area (feature 9)

Opened from the admin's "Login as Client" for one customer (`customerId` in the URL query `?as=<id>`, resolved in the UI, not saved). It lists that customer's services with product, cycle, next due date (`termEnd` or the next month start), invoices with status and Pay link text, open tickets, and the domain. It mimics `clientarea.php` (WHMCS), `/client` (Blesta), `/client` (BoxBilling) and the others in their skin. A banner states the viewing identity as the real products do ("Logged in as an administrator"). It is read-only. This reads existing state only.

### 3.10 Marketing site pages (feature 10)

The marketing site stays at the company domain. `SitePage` (`website.ts:52`) gains `pricing`, `network`, `status`, `legal`, `contact`; `sitePages(s)` adds them with these conditions so the site grows with the company:

| Page | Appears when | Content | Imitates |
| --- | --- | --- | --- |
| pricing | a shop is active and at least one line has a visible product or option | One table per line: plan, specs, price per cycle (cycle tabs), setup fee, "Order now" link to the portal path of that product | A hoster's pricing page (Hetzner, OVH style comparison grid) |
| network | website owned and at least one location | Data centers by city with tier label, power redundancy, uplink capacity rounded to a typical marketing figure, carriers, IPv6 and DDoS lines when owned | "Data centers and network" pages of regional hosters |
| status | 2009 or later and at least 10 customers | Component list per listed line with Operational, Degraded, Outage; 30 day bars from the status record (3.11); announced maintenance windows | status.<hoster> pages (Statuspage style) |
| legal | website owned | Imprint with owner, legal form and registration number from `s.registration`, company name and address, VAT line when registered; terms and privacy headings with generic text | German "Impressum", terms of service |
| contact | website owned | Sales and support addresses from `salesAddress(s)`, phone placeholder omitted, address of the first location | "Contact us" page |

Order buttons: the span at `CompanySite.tsx:88` becomes an `<a>` to `portal.<domain>` with `portalPath(variant, "configure", ...)`. Lines with no product link to the store root. A company without a shop shows no order button and keeps the email address (`siteContent().email`).

`siteContent` (`website.ts:45`) returns, per line, `from` as the lowest monthly-equivalent cycle price among visible products (or the configurable option price for lines without a product).

New i18n keys: all in `ui-shop-portal.ts`; the existing `browser-sites-1.co.*` keys stay where they are.

### 3.11 Status record (feature 11)

State: `statusDays: { day: number; down: Product[]; slow: Product[] }[]`, at most 90 entries, default `[]` in `newGame`, filled by `deserialize` (`data.statusDays ?? []`). Written once a day in the tick: a line is `down` if any service of that line had a workload offline in the last 24 hours (`workloadOnline`), `slow` if any ran slowed (`slowedAt`). Announced maintenance windows are read from the existing announcement coverage used in `tick.ts:138`; a window shows as "Maintenance" and does not count as down.

### 3.12 Long tail (milestone 12, planned last)

These are optional extensions after the lane is complete:

- Admin and store skins for Ubersmyth and OrderBocks.
- Email order quote with a cycle: the player can offer an annual term in the quote for a discount; the customer accepts more often (`acceptChance` ratio uses the discounted effective price).
- A store checkout the player can complete as a test order (no sim effect).
- Semi-annual and triennial cycles.

## 4. Milestones

Each milestone is one pull request, green on `npm run typecheck`, `npm test` and `npm run build`, with `npm run balance` where noted.

1. **Hand-rolled variant.** Adds `handRolled` to `shops.ts`, removes `orderForm` from `OwnedChannel`, `OWNED`, balance model and the Marketing > Website offer, adds `fillShop` to `deserialize`, updates tests and fixtures that call `setUpChannel(s, "orderForm")`. Tests: `tests/shop-handrolled.test.ts` (variant bought once, no monthly bill in `shopBills`, available without research, `readyAt` immediate, switching rules), `tests/shop-migrate.test.ts` (a saved state with `orderForm` in `owned` loads as `handRolled`, a state with a chosen variant keeps it, a state with neither stays unchanged), plus edits to `shop.test.ts`, `shop-ui.test.tsx`, `orders.test.ts`, `marketing.test.ts`, `manual-orders.test.ts`, `specs.test.ts`, `units-setup.test.ts`, `company-mail.test.ts`, `site-design.test.ts`.
2. **Billing cycles.** `cycles.ts`, `Service.termEnd/cycle`, `SalesRequest.cycle`, cycle draw in `orderLead`, multi-month `formInvoice`, renewal invoice, term churn, mid-term refund, `shopPriceLevel` in `share()`, balance model input. Tests: `tests/shop-cycles.test.ts`: supported cycles per variant; weights equal base at market discount and shift with `exp(8 * d)`; the annual invoice total and `prepaidUntil`; no arrears line in the prepaid term; renewal invoice amount and `termEnd` after payment; the monthly roll skips a committed customer and rolls once at term end with the stated formula; a customer below happiness 15 cancels mid-term and the refund equals the unused months; old saved services without `termEnd` roll monthly as before; advertised price level changes `share()` immediately.
3. **Product groups and products.** `ShopState` fields, `portal.ts` sim helpers (`chooseProduct`, stock per product, group filtering in `targetFor`), the actions in `90-actions/portal.ts`, `setupMode` handling, sold-out "no fitting plan" counters. Tests: `tests/shop-products.test.ts`: create, price validation, unsupported cycle, delete rules, smallest-covering selection, largest-with-cap fallback, no fitting plan counts as sold out and not as lost, stock per product, server group filter, `setupMode` paths, line without product still sells through rates.
4. **Quote default and option discounts.** `optionDiscount` state and action, `orders.ts:102` and `CustomOrder.tsx:124` change, `s.rates` usage unchanged. Tests: `tests/shop-quote.test.ts`: without a shop the automation quote and the field default equal the market reference even with saved rates; with a shop they equal `offerPrice`; option discount sets the custom configuration term price.
5. **Portal host and shell.** `Page` kind `shop`, `resolve()` branch, `portal.ts` path tables, `PortalSite` shell, admin login screen, empty skin registry with a default plain skin. Tests: `tests/portal-routes.test.ts` (host resolves only with an active shop, down when the site is down, path round trips per variant), `tests/portal-ui.test.tsx` (shell renders login, then the admin home).
6. **WHMCache admin.** Reference skin: Products/Services, product Details, Pricing, Module Settings, Configurable Options (Rates moved, `Rates.tsx` removed from Marketing), Servers and server groups (editor moved out of Marketing > Shop), Pending Orders, Clients. Marketing > Shop keeps variant choice and modules and links to the admin for stock and groups. Tests: `tests/portal-admin.test.tsx`: each tab reads and writes through the actions, cycle fields show only supported cycles, the Rates cards appear as options, the group editor works, Marketing no longer lists Pricing.
7. **WHMCache store and client area.** Store, configure, cart, checkout preview, client area, "Login as Client". Tests: `tests/portal-store.test.tsx`: sold-out state, cycle price display, client area lists a customer's services and invoices, the banner shows.
8. **Legacy skins.** Hand-rolled, ModemBill, ClientExit admin, store and client area. Tests: `tests/portal-skins.test.tsx` (each skin renders its pricing screen with its cycles, flat variants hide groups).
9. **Modern skins.** Blessta, BoxBillin', HostBull. Same test file extended.
10. **Site pricing page and order links.** `siteContent`, `pricing` page, order anchors, `from` price from products. Tests: `tests/company-site.test.ts` extended: the link target per variant, the price per cycle, a company without a shop shows no button.
11. **Status record and site pages.** `statusDays` state and tick hook, pages network, status, legal, contact. Tests: `tests/site-pages.test.ts` (page gating by era and customers, imprint fields from `registration`, status bars from a seeded outage, announced window shows as maintenance, save round trip of `statusDays`).
12. **Long tail** (3.12). Tests added with each item.

Each milestone also edits `docs/design/shop.md` (variant table, section 7), `docs/design/economy.md` (Shop systems, Billing cycles, Marketing and reviews) and `docs/design/panel-features.md` ("Before a shop system", Build order step 5) where it changes what they say.

## 5. Files touched

Shared hotspots are marked **HOTSPOT**.

Milestone 1:

- Edit: `src/sim/10-catalog/shops.ts`, `src/sim/80-business/marketing.ts` **HOTSPOT** (shared with lane `web-services` for lines and website), `src/sim/90-actions/marketing.ts`, `src/sim/90-actions/shop.ts`, `src/sim/90-actions/website.ts`, `src/sim/balance/model.ts`, `src/sim/91-save/save.ts` **HOTSPOT**, `src/ui/apps/marketing/Website.tsx`, `src/ui/apps/marketing/MarketingApp.tsx`, `src/ui/apps/marketing/Shop.tsx`, `tests/fixtures.ts`, the nine test files listed above, `src/i18n/ui-marketing.ts` and its five mirrors (remove the orderForm upkeep strings).
- Create: `src/i18n/ui-shop-portal.ts` and `src/i18n/{de,es,fr,it,pt}/ui-shop-portal.ts`, `tests/shop-handrolled.test.ts`, `tests/shop-migrate.test.ts`.

Milestone 2:

- Edit: `src/sim/30-customers/customers.ts` (`Service`), `src/sim/30-market/market.ts` (`SalesRequest`, `values`, `share`), `src/sim/30-market/orders.ts`, `src/sim/30-market/sales.ts`, `src/sim/45-billing/billing.ts` (monthly block) **HOTSPOT** (shared with `panel-host-sim` suspend), `src/sim/40-support/tick.ts` **HOTSPOT** (shared with `game-servers` and `panel-host-sim` tick effects), `src/sim/88-tick/tick.ts` only if a new hook is needed, `src/sim/balance/model.ts`, `src/sim/10-catalog/shops.ts`, `src/ui/apps/customers/CustomerPage.tsx` (term, next due).
- Create: `src/sim/10-catalog/cycles.ts`, `tests/shop-cycles.test.ts`.

Milestone 3:

- Edit: `src/sim/80-business/shop.ts` **HOTSPOT**, `src/sim/50-state.ts` **HOTSPOT** (no new top-level field here; `ShopState` is nested), `src/sim/91-save/save.ts` **HOTSPOT**, `src/sim/30-market/sales.ts` (`targetFor` group filter), `src/sim/30-market/orders.ts`, `src/sim/90-actions/index.ts` (export), `src/ui/apps/marketing/Shop.tsx`.
- Create: `src/sim/80-business/portal.ts`, `src/sim/90-actions/portal.ts`, `tests/shop-products.test.ts`.

Milestone 4:

- Edit: `src/sim/30-market/orders.ts`, `src/sim/80-business/shop.ts` **HOTSPOT**, `src/sim/90-actions/portal.ts`, `src/ui/apps/support/CustomOrder.tsx`.
- Create: `tests/shop-quote.test.ts`.

Milestone 5:

- Edit: `src/sim/80-business/browser.ts` (`Page`, `resolve`), `src/ui/apps/browser/BrowserApp.tsx` (`titleOf`, `Viewport`, `paper` list), `src/sim/80-business/portal.ts`.
- Create: `src/ui/apps/browser/sites/portal/PortalSite.tsx`, `portal/shared/*.ts(x)` (headless models), `portal/portal.css`, `tests/portal-routes.test.ts`, `tests/portal-ui.test.tsx`.

Milestone 6:

- Create: `src/ui/apps/browser/sites/portal/whmcache/{Admin.tsx,skin.css}`, `tests/portal-admin.test.tsx`.
- Edit: `src/ui/apps/marketing/MarketingApp.tsx` (drop the pricing section), `src/ui/apps/marketing/Shop.tsx` (stock and groups removed, link to admin), `src/ui/apps/marketing/Rates.tsx` (moved to `portal/shared/OptionRates.tsx`; delete the old file), `src/sim/80-business/consoles.ts` is not touched.

Milestone 7:

- Create: `portal/whmcache/{Store.tsx,Client.tsx}`, `tests/portal-store.test.tsx`.

Milestones 8 and 9:

- Create: `portal/{handrolled,modembill,clientexit,blessta,boxbillin,hostbull}/{Admin,Store,Client}.tsx` and `skin.css`, extend `tests/portal-skins.test.tsx`.

Milestone 10:

- Edit: `src/sim/80-business/website.ts`, `src/ui/apps/browser/sites/CompanySite.tsx`, `src/ui/apps/browser/sites/companyCopy.ts`, `src/ui/apps/browser/sites/site.css`, `tests/company-site.test.ts`.

Milestone 11:

- Edit: `src/sim/50-state.ts` **HOTSPOT**, `src/sim/91-save/save.ts` **HOTSPOT**, `src/sim/88-tick/tick.ts` **HOTSPOT**, `src/sim/80-business/website.ts`, `src/ui/apps/browser/sites/CompanySite.tsx`.
- Create: `src/sim/80-business/status.ts`, `src/ui/apps/browser/sites/{Network,Status,Legal,Contact}.tsx`, `tests/site-pages.test.ts`.

Hotspots NOT touched by this lane: `PanelBase.tsx`, `HypervisorBase.tsx`, `consoles.ts`, `products.ts` (the catalog `src/sim/10-catalog/products.ts` is read only). This lane reads the package registry that `packages-provisioning` adds.

## 6. Dependencies

Lanes that must land first:

- `packages-provisioning`: milestone 3 can ship with the `spec` snapshot and no package binding, but the Module Settings package dropdown (milestone 6) needs the package store (`packageByName(s, clusterId, name)` and a list of package names per installation) that lane builds as panel-features.md build order step 2. If it is not in main by milestone 6, the dropdown is shown as a spec editor and a follow-up wires the package list.
- `panel-host-sim`: soft. Stock "auto" and group room use `targetFor`, which should respect the oversell ratio once that lane adds it; Suspend and Terminate links in the client summary call its actions. Either order works because the admin links are added in milestone 6 only when the actions exist.

Lanes this one blocks or constrains:

- `game-servers`, `web-services`, `mail-dns-vpn-storage`, `hypervisors-backups`: their packages appear as products with no change to this lane, provided they register packages through `packages-provisioning`'s registry. They must not change `ShopProduct` or `chooseProduct`.
- `readouts`: no dependency either way.
- Conflicts to coordinate: `billing.ts` and `tick.ts` monthly blocks (with `panel-host-sim`), `50-state.ts` and `91-save/save.ts` (every lane adds fields; this lane only adds `statusDays` in milestone 11).

## 7. Open questions

1. Should the hand-rolled variant need the "Shop systems" research? Recommendation: no, so the game starts as today; the other eight variants keep the research.
2. May a mid-term cancellation refund unused cycles in cash (milestone 2), or should prepaid money be kept? Recommendation: refund in cash, only for customers below happiness 15, so bad service has a visible cost.
3. Should the player be able to place a real test order from their own store? Recommendation: no in the first release (checkout is a preview); it is the third item in milestone 12.
4. Is the 1.35 times reference cap for "largest product" orders acceptable, or should a lead that no product covers always count as "no fitting plan"? Recommendation: keep the cap; it keeps oversized plans sellable without hiding that the catalog lacks a size.
5. Should a customer's cycle price follow list price changes at renewal (milestone 2) or stay fixed for the term and the next one? Recommendation: follow at renewal, because the existing price raise logic then applies unchanged.
