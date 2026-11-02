# Plan: registrar control panel, domains and name servers

The registrar partner's reseller panel (the `/login` page of NameCheep, GoDuddy Reseller, InterNetY and OpenSRSly in the in-game browser, `RegistrarPanel.tsx`) already lists every domain under management with its renewal switch, status and auth code, and has a DNS page for the company domain's zone. This lane adds what a real reseller panel has on top: ordering further domains of the company's own, and name servers per domain that decide whether the domain reaches the company's sites or stays parked at the registrar.

Source of truth for the registrar economics is `docs/design/gdd.md`, "Registrar partners", and `docs/design/economy.md`, Domains. Billing does not change: the partner invoices one twelfth of the yearly wholesale of every domain under management at each month start, so a further company domain costs its twelfth a month. Renewal stays the existing switch (`cancelled`); there is no second auto-renew flag.

## Domain model

`Domain` (`src/sim/30-customers/registry.ts`) gains name servers, defaulted in `deserialize` and set by `register`:

- `ns: "registrar" | "company" | "custom"`. `registrar` is the partner's parking name servers (`ns1.<partner host>`, `ns2.<partner host>`), `company` is `ns1.<company domain>` and `ns2.<company domain>`, `custom` is two hostnames the player typed in `nsHosts`. Customer domains and the company domain are registered with `company`, so everything that resolves today keeps resolving, and saves from before the field load with `company`. A domain ordered in the panel starts parked at the registrar, like at a real one.
- A change propagates: `setNameServers` keeps the previous mode in `nsPrev` and the ready minute in `nsReadyAt`; `nameServers(s, d)` and `resolve` use the previous pair until `NS_MINUTES` (60 game minutes) have passed. Saves without the fields count as ready.

Helpers: `nameServers(s, d)`, `parked(s, d)` (effective mode is not `company`), `nsPropagating(s, d)`.

## Resolution

`resolve` in `src/sim/80-business/browser.ts`: a host that is a domain under management whose effective mode is `registrar` resolves to the new page `{ kind: "parked"; registrar; domain }` before the company and customer site checks; `custom` resolves to `notfound`. The company domain parked makes the company site unreachable and `siteStatus` reports it down, a mistake the player can make and undo on the domain's page.

## Actions (`src/sim/90-actions/registrar.ts`)

- `orderDomain(s, name)`: a further domain of the company's own through the partner under contract. Validity as the company domain (`companyDomainError`), needs a contract, nothing paid now, `customerId: null`, `ns: "registrar"`. Errors `error.needsRegistrar`, `error.domainInvalid`, `error.domainTaken`.
- `setNameServers(s, name, ns, hosts?)`: any domain under management; `custom` needs two valid hostnames, else `error.nsInvalid`; the same mode and hosts as now is a no-op.

## Panel UI (`src/ui/apps/browser/sites/registrars/`)

`RegistrarPanel.tsx` gains two pages next to Domains and DNS, routed under `/login/...` in `index.tsx` like the DNS page:

- **Register** (`/login/register`): the existing `DomainSearch` from `RegistrarPage.tsx`, whose Buy calls `orderDomain` once the company domain exists and `orderCompanyDomain` before.
- **Domain** (`/login/domain/<name>`): registry, registered on, expires on, yearly wholesale, owner, status; a Name servers form with three radio choices (the partner's parking name servers, the company's own `ns1`/`ns2`, custom with two inputs) and a Save button calling `setNameServers`; a propagation line while `nsPropagating`.

The Domains table gets a Name servers column (parked, the company's pair, or the custom hosts) and each domain name links to its Domain page.

The parking page (`Parked.tsx`, `ParkedPage({ game, registrar, domain })`): the partner's wordmark in its hue, a sentence that the domain is parked at the partner, and its two name servers. `BrowserApp.tsx` renders it for `kind: "parked"`.

## i18n

New keys join `src/i18n/ui-registrar-panel.ts` under `registrarPanel.*`, mirrored in the five language files; the error key `error.nsInvalid` joins `src/i18n/domains.ts` and its mirrors.

## Tests

`tests/registrar-nameservers.test.ts`, seeded with `readyGame`: ordering a second company domain parks it and the monthly total grows by its twelfth; a parked domain resolves to the parking page; moving it to the company name servers resolves the site only after `NS_MINUTES`; the company domain parked resolves to the parking page and `siteStatus` is down; custom hosts are validated; a save without the fields loads with `ns: "company"`. `tests/i18n.test.ts` covers the keys.

## Order

1. Sim: fields, defaults, helpers, actions, resolve, tests.
2. UI: panel pages, parking page, i18n, routing.
3. CHANGELOG bullet, typecheck, tests, build.
