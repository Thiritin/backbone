# Plan: product catalog

Lane id: `product-catalog`. Related design: `docs/design/plans/billing-by-hand.md` (Books, quotes), `docs/design/plans/shop-portal.md` (3.3 Product groups and products, which this plan reshapes), `docs/design/shop.md` (shop variants), `docs/design/gdd.md` (Custom orders).

## 1. Decisions

- The hand-rolled order form is removed. Publishing products already gives an email order a fixed price, and scripted provisioning belongs to the shop systems, which are cheaper than the form plus scripts from 2005 on. Orders arrive by email until a shop system is active.
- A product is a fixed package the player sells: a name, a line, a spec, an SLA, a price per billing cycle and a setup fee. Panels and shop systems all work with a fixed set of packages, so the game does too.
- There is one catalog, `s.catalog`. Before a shop system it is edited in Books (Products tab), like the item list of a desktop invoicing program. Once a shop system is chosen it is edited in the shop admin, and Books shows it read-only. Shop-portal 3.3 extends these records instead of keeping its own list on `ShopState`.
- Products are optional. A line without a product keeps today's behaviour: the customer writes in, the player quotes freely from the line's rates.
- A lead picks the cheapest offered product of its line whose spec covers its need and whose price fits its budget. A bigger package than needed is fine for the customer. When the line has products but none fits, the lead is lost as "no fitting package" and counted, so the player can tune the range.
- The website lists products by line. Before a shop system the site is hand-made: Books has a Publish to website button and the site shows the last published snapshot. Leads decide on the published snapshot. A quote above the published price is declined; at or below it is accepted.
- With a shop system active the site links to the shop's pages and always shows the live catalog; publishing is not needed.
- An email order for a product names it. The quote in Books is prefilled from the product, and the customer draws a billing cycle from the cycles the product offers, as shop orders do today.

## 2. Milestones

| # | Milestone | Kind |
| --- | --- | --- |
| 1 | Remove the hand-rolled form | [Sim] [UI] |
| 2 | Catalog state, actions and the Books Products tab | [Sim] [UI] |
| 3 | Product-based demand and quotes | [Sim] |
| 4 | Publish to website and the products page | [Sim] [UI] |
| 5 | Lost demand readout in Marketing | [UI] |

Order: 1 and 2 in parallel, then 3, then 4 and 5 in parallel. Shop-portal M3 waits for milestone 2 of this lane.

## 3. Milestones in detail

### 3.1 Remove the hand-rolled form

- `src/sim/10-catalog/shops.ts`: drop `handRolled` from `ShopId` and `SHOPS`, drop `HAND_ROLLED`. Drop `CUSTOM_SCRIPT` and the no-variant branch of `buyModule` (`src/sim/90-actions/shop.ts`); modules are only bought for a shop variant.
- `hasOrderForm` callers use `shopActive`. `emailFor` keeps `EMAIL_SHARE` for a shop that runs alongside email orders. `chooseShop` needs the "shops" research for every variant.
- `src/sim/30-market/orders.ts`: orders that are not email orders are shop orders. The `form` flag and the manual form ticket path go; `formInvoice` stays for shop orders.
- Save: `src/sim/91-save/shop.ts` maps a saved `handRolled` variant to no shop and drops `s.shop.modules` bought as custom scripts. Email orders are switched on for such saves.
- UI: `src/ui/apps/marketing/Website.tsx` and `Shop.tsx` lose the order form offer and the hand-rolled label. The balance model (`src/sim/balance/model.ts`) buys the cheapest shop instead.
- Paperwork, letters, bank and FormDoc references to the hand-rolled form are checked one by one; text that names it is reworded or removed in every language.
- Test: `tests/product-catalog.test.ts` (or the existing shop test): a save with `handRolled` loads with no shop and email orders on; `buyModule` without a variant fails.

### 3.2 Catalog state, actions and the Books Products tab

State (`src/sim/80-business/catalog.ts`, new):

```ts
export interface CatalogProduct {
  id: string; name: string; line: Product; spec: Spec; sla: Sla;
  prices: Partial<Record<Cycle, number>>; // total of one term; absent = not offered
  setup: number; hidden: boolean;
}
```

- `s.catalog: CatalogProduct[]`, default `[]` in `newGame`, filled by `deserialize`.
- Actions in `src/sim/90-actions/catalog.ts`: `addProduct(s, line)` (defaults: the line's middle size, the player's rate as the monthly price, the market setup fee), `updateProduct(s, id, patch)`, `removeProduct(s, id)`. Names unique per line, 1 to 24 characters. Editing in Books fails with `error.catalogInShop` once a shop variant is chosen.
- Books gets a Products tab: list by line, columns name, spec, monthly price, cycles, setup, hidden. A row opens an edit form like the customer form.
- Test: add, update, remove; duplicate name fails; editing in Books fails once a shop is chosen.

### 3.3 Product-based demand and quotes

- `SalesRequest.productId?: string`.
- In `orderLead`, when the lead's line has offered products: take the needed spec from `need` (`sizeSpec(product, need.size, year)`) and the budget as today, then pick the cheapest offered product whose spec covers the need, whose SLA is at least the need's, and whose monthly equivalent fits the budget. Set `productId`, `spec` and the quoted price from it and draw the cycle from its offered cycles. No fit: `loseRequest(..., "lost.noFittingProduct")` and count it on `s.marketing.unmet[line]` for the month.
- Before a shop system the lead decides on the published snapshot (milestone 4); until that lands it reads `s.catalog` directly.
- Books quote for an order with `productId` is prefilled with that product's price and cycle. The customer accepts a quote at or below the published price and declines one above it.
- Automation's auto-quote uses the product's price.
- Test: a seeded lead picks the cheapest fitting product; a bigger product is accepted; no fit is lost and counted; a quote above the published price is declined.

### 3.4 Publish to website and the products page

- `s.marketing.published: CatalogProduct[] | null`, default `null`.
- Action `publishCatalog(s)` copies the offered, visible products. Books shows a Publish to website button and marks the tab when the catalog differs from the published one.
- `src/sim/80-business/website.ts`: each listed line shows its published products (name, spec, price per cycle) instead of the "from" price; a line without products keeps the "from" price. With a shop active the site uses `s.catalog`.
- Test: publish snapshots; a price change after publishing leaves the site and lead decisions on the old price until the next publish.

### 3.5 Lost demand readout

- Marketing shows per line the leads lost as "no fitting package" this month and last month, next to the leads won.

## 4. Changes to other plans

- `shop-portal.md` 3.3: `ShopProduct` becomes `CatalogProduct` plus its shop fields (`groupId`, `serverGroupId`, `packageName`, `title`, `slots`, `stock`, `setupMode`), stored in `s.catalog` instead of `s.shop.products`. Product groups stay on `ShopState`. Choosing a shop moves editing from Books to the shop admin.
- `shop-portal.md` feature 1 (hand-rolled variant) is superseded by milestone 1 here.
