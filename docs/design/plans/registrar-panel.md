# Plan: registrar control panel

The registrar partner's site (NameCheep, GoDuddy Reseller, InterNetY, OpenSRSly in the in-game browser) gets a real reseller control panel. Today the signed-in account area only lists the domains under management and the tier. With this lane the player orders further domains of the company's own there, renews them, switches auto-renew on, sets the name servers of every domain under management, and sees where each domain points. A domain parked at the registrar shows the registrar's parking page in the browser; one on the company's name servers reaches the company site or the customer's site as before.

Source of truth for the registrar economics is `docs/design/gdd.md`, "Registrar partners", and `docs/design/economy.md`, Domains. Nothing in the billing changes: the partner keeps invoicing one twelfth of the yearly wholesale of every domain under management at each month start.

## Domain model

`Domain` (`src/sim/30-customers/registry.ts`) gains two fields, both defaulted in `deserialize` and set by `register`:

- `ns: "registrar" | "company" | "custom"`. `registrar` is the partner's parking name servers, `company` is `ns1.<company domain>` and `ns2.<company domain>`, `custom` is two hostnames the player typed. Customer domains and the company domain are registered with `company`; a domain ordered in the panel starts as `registrar`, like at a real registrar. Saves from before the field load with `company`, so nothing that worked keeps working differently.
- `nsHosts?: [string, string]`, only with `custom`.
- `autoRenew: boolean`, false for every domain today. At the daily domain tick a domain with `autoRenew` that reaches its expiry is extended a year as if renewed by hand: a customer's domain invoices the customer the yearly fee, the company's own books nothing extra (the partner already bills the wholesale monthly). The reminder a month before expiry is not sent for an auto-renewing domain.

Helpers in `registry.ts`: `nameServers(s, d): [string, string]` returns the pair a domain resolves with (the partner's `ns1.<host>` and `ns2.<host>` for `registrar`, `ns1.<company domain>` and `ns2.<company domain>` for `company`, `nsHosts` for `custom`). `parked(s, d)` is true when `ns !== "company"`.

## Resolution

`resolve` in `src/sim/80-business/browser.ts`: a host that is a domain under management with `ns === "registrar"` resolves to a new page `{ kind: "parked"; registrar: RegistrarId; domain: string }`, before the company and customer site checks. A domain with `custom` name servers resolves to `notfound`. The company domain parked at the registrar means the company site is unreachable in the browser and `siteStatus` reports it down, so moving the company domain's name servers away is a real mistake the player can make and undo.

## Actions (`src/sim/90-actions/registrar.ts`)

- `orderDomain(s, name)`: a further domain of the company's own through the partner under contract. Same validity rule as the company domain (`companyDomainError`), needs a contract, pays nothing now (the partner bills monthly), registers with `customerId: null`, `ns: "registrar"`, `autoRenew: false`. Fails with `error.needsRegistrar`, `error.domainInvalid`, `error.domainTaken`.
- `setNameServers(s, name, ns, hosts?)`: any domain under management. `custom` needs two hostnames of the shape `label(.label)+` under a TLD the registries sell or any label pair; invalid hosts fail with `error.nsInvalid`. The change takes `NS_MINUTES = 60` game minutes to propagate: the domain keeps `nsReadyAt`, and `nameServers` and `resolve` use the old pair until then. Saves without it count as ready.
- `setAutoRenew(s, name, on)`.
- `renewDomain` moves out of `orders.ts` into `registrar.ts` and also accepts the company's own domains (no customer: nothing invoiced). `orders.ts` re-exports it so callers stay.
- `dropDomain(s, name)`: a company-owned domain is removed from management at once; a customer's domain cannot be dropped (fails `error.domainCustomer`).

## Panel UI (`src/ui/apps/browser/sites/registrars/`)

`Account` in `RegistrarPage.tsx` becomes the reseller control panel, with the four skins keeping their chrome around it. Inside, a left nav with four views, kept in component state:

1. **Overview**: the specs block as today (tier, domains, certificates, next tier, per month).
2. **Domains**: the domain table with a new Name servers column (`registrar` shows "Parked", `company` shows "ns1/ns2.<company domain>", `custom` shows the hosts) and an Auto-renew column with a checkbox, Renew and Drop buttons per row (Drop only on company-owned domains). Clicking a row opens its Domain page.
3. **Domain** (`name`): the domain's registry, registered on, expires on, yearly wholesale, owner; a Name servers form with three radio choices (Registrar parking, `<partner name>` labels; Own name servers, listed; Custom, two inputs) and a Save button that calls `setNameServers`; a propagation line while `nsReadyAt` is in the future; Auto-renew checkbox; Renew button.
4. **Register domain**: the existing `DomainSearch`, with Buy calling `orderDomain` once the company domain exists (it still calls `orderCompanyDomain` before).

The parking page (`src/ui/apps/browser/sites/registrars/Parked.tsx`): the partner's wordmark, "This domain is parked at <partner>" and the two name servers, in the partner's hue; the four skins reuse it.

The Customers app domain rows and Billing, Domains show the name server state as text and a Renew button as today; no edit there.

## i18n

New English keys go into one new file `src/i18n/ui-registrar-panel.ts` (loaded by glob), mirrored in `src/i18n/<lang>/ui-registrar-panel.ts` for de, es, fr, it and pt. Error keys `error.nsInvalid` and `error.domainCustomer` join the existing error topic file next to `error.needsRegistrar`.

## Tests

`tests/registrar-panel.test.ts`, seeded with `readyGame`: ordering a second company domain lands it parked at the partner and the monthly bill grows by its twelfth; parked domain resolves to the parking page, moving it to the company name servers resolves the site after `NS_MINUTES`; the company domain parked makes `resolve` of the company host give the parking page; auto-renew extends at expiry and invoices a customer but not the company; a customer's domain cannot be dropped; `deserialize` of a save without the fields gives `ns: "company"`, `autoRenew: false`. `tests/i18n.test.ts` covers the keys.

## Order

1. Sim: fields, defaults, helpers, actions, resolve, tick, tests.
2. UI: panel views, parking page, i18n files, skins wiring.
3. CHANGELOG bullet, typecheck, tests, build.

## Open points

- Whether customers may later reach their own domain's name servers through the hosted portal (shop-portal lane) is out of scope here.
