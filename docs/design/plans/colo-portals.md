# Colocation provider sites and customer portals

Every datacenter provider in `src/sim/20-world/datacenters.ts` gets a website in the browser: a public part that sells space, and a customer portal where the player sees contracts and invoices, orders services and cancels. The Locations app keeps the map, the filters and everything live (racks, power, cabling). Ordering and cancelling move to the provider site. Mockup: `docs/design/mockups/colo-portal.html`.

## 1. Decisions

- The map stays the place to compare. The add-location sheet loses its order buttons and shows "Visit site" per datacenter, which opens the browser at the provider's order page with the datacenter preselected. Comparing 19 sites one by one is the failure mode this avoids.
- Every provider has its own site, one component and stylesheet per provider under `src/ui/apps/browser/sites/providers/<id>.tsx` and `.css`, the way the hardware vendors have theirs. Each copies the look of the real company it puns (layout, nav, colours, logo, tone). Shared pieces live in `ProviderSite.tsx`: routing, the sites list and detail data, the order form logic, the account area. A provider's component chooses how they are laid out. The `early` and `late` era looks from `src/ui/apps/browser/sites/era.ts` apply on top.
- Contracts are new state. Today a location is created directly by `addLocation`; the portal needs a `Contract` with term, notice and status so cancelling can take effect at the end of the notice period instead of at once.
- Cancelling has a notice period: one month for a share, three for a cage, six for a suite. The portal shows the end date before the player confirms. `closeLocation` keeps its checks (storage empty, provided racks empty) and runs at the end date, not on click.
- Services live in the portal, each one a line on the contract: remote hands (already priced in `handwork.ts`), cross-connects, extra power (already on `Rack.extraKw`), feed B (already on `Rack.feedB`). Existing actions are called from the portal pages; no second sim path.
- Invoices from providers are a list on the portal's billing page, drawn from the existing monthly rent charges in `src/sim/88-tick/tick.ts`. Payment stays automatic as today; the page is read-only in the first version.

## 2. Lanes and order

1. `contracts` (sim): contract state, notice periods, cancel at term end. No UI. Done in #101.
2. `provider-site` (UI): first the shared core (hosts, routing, shared pages, order flow, map hand-off) with two providers, then the remaining providers in parallel batches.
3. `portal` (UI): sign-in, contracts, cancel, invoices, services.
4. `services` (sim and UI): cross-connects as a new service; everything else wires existing actions.

Lane 2's core comes first. After it is merged the portal and the provider batches run in parallel. Lane 4 is last.

## 3. Lane `contracts`

Milestones:

1. **Contract state.** `Contract { id; provider: string; dc: string; locationId: string; space: RentedSpace; positions: number; since: number; monthly: number; notice: number; endsAt: number | null }` in `src/sim/50-state.ts`, `s.contracts: Contract[]`. `newGame` starts empty; `deserialize` builds one contract per existing rented location (`since` from `readyAt` minus the lead time, `endsAt` null) so old saves open with a filled portal. `addLocation` creates the contract alongside the location. Test: `tests/contracts.test.ts`, seeded, asserts one contract per rented location after `addLocation` and after loading a save without the field.
2. **Notice periods.** `NOTICE_MONTHS: Record<RentedSpace, number> = { share: 1, cage: 3, suite: 6 }` in `datacenters.ts`. New action `cancelContract(s, contractId)` in `src/sim/90-actions/hardware.ts` sets `endsAt` to the next month boundary plus the notice; `revokeCancel(s, contractId)` clears it while `endsAt` is still ahead. Both fail with the existing `closeLocation` errors when the space is not empty at call time, so the player learns early. Test: cancel at hour h, `endsAt` matches, revoke clears it.
3. **Term end.** `tick.ts` runs `closeLocation` for every contract whose `endsAt` has passed. If the location is not empty by then (devices moved in after the cancel), the contract rolls one more month and the player gets an email `mail.contractRolled`. Test: cancelled location closes at `endsAt`; one with a device inside rolls and emails.
4. **Rent from contracts.** The monthly rent charge in `tick.ts` reads `contract.monthly` instead of recomputing from the datacenter, so a price change on the provider's site only affects new contracts. Test: rent unchanged after `positionPrice` edit for an existing contract.

## 4. Lane `provider-site`

Milestones:

1. **Hosts and routing.** Every `Provider` gets `host` (`equinox.com`, `hetzler.de`, `tellyhouse.co.uk`, ...). `src/sim/10-catalog/sites.ts` lists them so `resolve` in `src/sim/80-business/browser.ts` reaches `ProviderSite` in `src/ui/apps/browser/sites/providers/`. Pages: `/`, `/sites`, `/sites/<dcId>`, `/order?dc=<id>&space=<kind>&size=<n>`, `/account/*` (lane `portal`). Routes under `/account` show the sign-in page until lane 3 lands.
2. **Provider sites.** `ProviderSite.tsx` supplies the shared pages as building blocks; each `providers/<id>.tsx` with its own `.css` lays out header, nav, home, footer in the style of the real company. Copy per provider in `src/i18n/ui-providers.ts`. Favicons through the existing `Favicon.tsx`. The `early` look follows the registrar sites. The core lane ships Equinox and Hetzler; the other 18 follow in batches.
3. **Sites page.** `/sites` lists the provider's datacenters with city, carriers, exchange, feeds, backup, green and certified, from `DATACENTERS`. `/sites/<dcId>` shows the detail and a price table from `spacePrice` and `SPACE_SIZES`, with lead time from `LEAD_DAYS` and availability from `dcAvailability`. Full rows show "Join waitlist" and call `joinWaitlist`.
4. **Order flow.** `/order` is a three-step form: space and size, contact details (prefilled from the company), summary with monthly price, setup fee and ready date. Confirm calls `addLocation`. Success page says the welcome email is on its way; the existing ready email covers the rest. Prefilled from query parameters so the map can deep-link.
5. **Map hand-off.** `AddLocation.tsx` drops its order and waitlist buttons for a "Visit site" link that opens the browser at `/sites/<dcId>` on the provider's host. The filters, sorting and availability column stay. `Overview.tsx` location cards get a "Manage" link to `/account/contracts` on the provider's host. The Visit site link is the only new string in `ui-locations`.

## 5. Lane `portal`

Milestones:

1. **Sign-in and account shell.** `/account` shows a sign-in page with the company email prefilled and a password field that accepts anything; the session lasts while the tab is open. Inside: left nav Contracts, Invoices, Services, Tickets, Account. The portal has each provider's own customer-area look, copied from the real company's portal.
2. **Contracts.** One row per contract at this provider: datacenter, space, since, monthly, next invoice, status (`active`, `ends <date>`, `provisioning` while `readyAt` is ahead). Detail page lists the racks and their feeds, power contract and extra kW, cross-connects from lane 4.
3. **Cancel.** The detail page's Cancel button opens a confirm sheet with the end date from `NOTICE_MONTHS`, what must be empty by then, and a retention offer on the large carrier-neutral providers (Equinox, Digital Reality, Interaction, NTD, Telex, CoreSpite) (one free month if the player keeps the space, accepted by `revokeCancel`). Confirm calls `cancelContract`. A cancelled contract shows Revoke until `endsAt`. Built: the offer shows on the cancelled contract, `revokeCancel(s, id, true)` takes it once per contract (`Contract.retainedAt`) and the next month's space line is free. Rent and remote-hands ledger lines carry `dc` so the portal files them by provider. Cross-connects on the detail page wait for lane 4.
4. **Invoices.** List of the provider's monthly charges from the ledger, filtered by provider, with a view page per invoice using the same PDF frame as customer invoices. Read-only.
5. **Services.** Per contract: extra power (`setExtraKw`), feed B (`setFeedB`), flat-rate power (`setFlatKw`), remote hands job list from `handwork.ts`. Each one shows price and the month it starts billing. Existing actions only.
6. **Tickets.** Remote-hands requests the player already books appear as tickets with the provider's response time and status. Read-only in this lane; booking stays in the Locations app.

## 6. Lane `services`

Milestones:

1. **Cross-connects.** `CrossConnect { id; contractId; to: string; monthly: number; since: number }` on the contract. `orderCrossConnect(s, contractId, carrierOrExchange)` and `cancelCrossConnect`. Price per datacenter in `datacenters.ts` (`crossConnect: { setup, monthly }`), exchange cross-connects only where `exchange.onSite`. The network app treats a cross-connect like an uplink port that can be ordered an uplink on. Test: order, bill, cancel.
2. **Portal page.** Cross-connects on the contract detail and on Services, with the setup fee shown before confirm.
3. **Price changes.** Once a game year, a provider raises `positionPrice` by a few percent and emails existing customers that the new price applies to new contracts only. Cheap flavour, uses the lane 1 contract price. Test: seeded raise, existing `monthly` unchanged.

Built: `s.crossConnects` with `contractId`; setup fee `crossConnectSetup` is two months of `dc.crossConnect` (kept a number, so no `{ setup, monthly }` object). Targets are `carriersAt(dc)` plus the exchange when on site. The network hook is billing only: an ordered cross-connect to an uplink's partner in that zone covers one of its links in `crossConnects()`, so nothing is billed twice; ordering an uplink does not require one. The raise is `s.providerPrices[provider]`, passed to `spacePrice` by `addLocation` and the order pages.

## 7. Shared files

- `src/sim/50-state.ts`: `Contract`, `s.contracts`, `CrossConnect`. Lanes 1 and 4.
- `src/sim/20-world/datacenters.ts`: `Provider.host`, `NOTICE_MONTHS`, `crossConnect` prices. Lanes 1, 2, 4.
- `src/sim/90-actions/hardware.ts`: `addLocation` creates the contract; `cancelContract`, `revokeCancel`. Lane 1.
- `src/sim/88-tick/tick.ts`: term end, rent from contract. Lane 1.
- `src/sim/10-catalog/sites.ts` and `src/sim/80-business/browser.ts`: provider hosts. Lane 2.
- `src/ui/apps/locations/AddLocation.tsx`, `Overview.tsx`: links out. Lane 2.
- `src/i18n/ui-providers.ts` with mirrors in every `src/i18n/<lang>/`: site copy, portal labels. Lanes 2 and 3 share the file; lane 2 creates it.

## 8. Open questions, with recommendations

- Should the basement get a fake "provider" so the portal pattern is uniform? No. The basement has no contract and nothing to cancel.
- Should the Locations app keep a fallback order button for players who never open the browser? No. The browser is already required for domains and software; the Visit site link is one click.
- Should cancelling be allowed with hardware still inside, closing only when empty? Yes, that is what the roll in lane 1 milestone 3 does: cancel first, move out during the notice period.
- Should every provider get its own site? Yes, decided 2026-11-02: one component and stylesheet per provider, like the hardware vendors.
