# Plan: research unlocks and reseller hosting

Every skill in the Research app says exactly what it switches on, each unlock is clickable, and an unlock that only works with certain software names that software. Reseller hosting becomes a product line of its own behind a new skill. Source of truth for skill numbers is `docs/design/economy.md`, "Know-how and unlock costs"; for panel features `docs/design/panel-features.md`.

## Today

`Skill` in `src/sim/10-catalog/research.ts` has `opens` (Pear Store item ids, rendered as tiles) and `grants` (free English strings, rendered as a check list). The strings are not translated, not clickable, and several skills gate code that no string mentions:

| Skill | Gates in code | Declared |
| --- | --- | --- |
| Monitoring | Nagiosaurus; failure notifications (`88-tick/tick.ts`) | Nagiosaurus only |
| Memory reservation | reservation per cluster (`90-actions/clusters.ts`, Clusters tab) | yes |
| Automation | ChadGPT, Clipsy; automated billing rules (`45-billing/billing.ts`, `rulesAutomated`) | bots only |
| Network operations | Network app; transit, peering and DDoS actions (`90-actions/network.ts`) | app only |
| High availability | live migration, failover, auto-balancing, HA product lines; needs a hypervisor cluster | yes, software not named |
| GPU computing | GPU virtual machines; needs a hypervisor cluster with GPU cards | software not named |
| Cloud orchestration | OpenStash install (`software.skill`), cloud product line, Watchman | yes |
| Product management | Marketing > Pricing (rates per product line) | yes |
| Shop systems | buying a shop system (`90-actions/shop.ts`), Marketing > Shop variants | nothing |
| Provisioning automation | automatic setup host, order automation switch | yes |
| Fraud screening | MaxMined switch in Settings and order screening | yes |
| Documentation | Knowledge base app | yes |
| Market research | Market app | yes |
| Employee management | Staff app | yes |
| Marketing basics | review events, sponsoring (`80-business/sponsoring.ts`), Marketing > Reviews and Community | nothing |
| Marketing campaigns | Marketing app, all sections | app only |

## Unlock model

`grants: string[]` is replaced by `unlocks: Unlock[]`:

```ts
type Unlock =
  | { kind: "app"; id: string }                       // Pear Store item, replaces opens
  | { kind: "product"; id: Product }                   // a product line in Marketing > Pricing
  | { kind: "software"; id: string }                   // a platform install, e.g. openstash
  | { kind: "feature"; id: string; software?: string[] }  // anything else; software lists the platforms it needs
```

- Text: `sim.unlock.<id>` for features (`textFields` cannot do arrays, so the key is built from the id); products use the product name keys, software and store items their catalog names. Every new key lands in every `src/i18n/<lang>/` file.
- `opens` stays as a derived getter (`unlocks.filter(kind === "app")`) so `skillFor`, `isAvailable`, the Pear Store and the SkillSheet tiles keep working.
- Rendering in the Research panel (`ResearchApp.tsx`, `Panel`): one list, every row a button. `app` opens the app when installed, else the Pear Store at that item. `product` opens Marketing > Products. `software` opens the software's vendor site in the Browser, since platform software and shop systems are sold there. `feature` with `software` shows the feature name and below it the software names as links to their vendor sites, leaving out software not yet released; when none of them is installed anywhere, the row shows the software names in the muted style. The old "Open app" and "Pear Store" buttons go.
- The Explain text in `docs/design/research.md` stays as is.

## Declarations per skill

| Skill | unlocks |
| --- | --- |
| Monitoring | app Nagiosaurus; feature failureAlerts |
| Memory reservation | feature memoryReservation, software: hypervisors |
| Automation | app chadGpt, clipsy; feature billingRules |
| Network operations | app Network; feature transit; feature peering |
| High availability | feature liveMigration, failover, autoBalance (software: hypervisors); feature haProducts |
| GPU computing | feature gpuVms (software: hypervisors) |
| Cloud orchestration | software openstash; product cloud; feature watchman (software: openstash) |
| Product management | feature rates |
| Shop systems | feature shopSystems (software: every shop system id from `shops.ts`) |
| Provisioning automation | feature autoHost; feature orderAutomation |
| Fraud screening | feature screening |
| Documentation | app Knowledge base |
| Market research | app Market |
| Employee management | app Staff |
| Company law | feature limitedCompany |
| Marketing basics | feature reviews; feature sponsoring |
| Marketing campaigns | app Marketing |
| Reseller hosting (new) | product reseller (software: cpanic, pleskit, directadmen) |

The hypervisor list comes from `platforms.ts` (`kind === "cloud"`, except openstash), not a copy.

## Reseller hosting

A reseller buys a block of web hosting capacity and sells accounts of their own inside it. In the game that is a product line, not a customer type.

- New `Product` id `reseller`. `PRODUCTS.reseller = { runsOn: "cluster", period: "hour", commitMonths: 1 }`. Spec: ten times a web hosting spec of the request's size (disk, traffic, mailboxes), one booking on a panel cluster. Needs a panel cluster whose panel is cpanic, pleskit or directadmen; FreePanel cannot host it, and a request on a cluster without such a panel is lost with the reason `lost.needsResellerPanel`.
- Rates: its own line in Marketing > Pricing like every product, default rate 0.6 of the web hosting rate per GB (a wholesale price; economy.md gets the row).
- Demand: agency 0.2 (taken from vps), hobbyDev 0.1 (taken from vps), smallBiz 0.1 (taken from webHosting). The product is demanded only once the skill is learned; before that those weights go back to the old product, so the market does not shrink.
- Skill `reseller`: track sales, tier 2, 200 know-how, 10 days, needs `products` and `shops`. Unlock: `product reseller` with software cpanic, pleskit, directadmen. Explain pages in `docs/design/research.md`.
- Competitors: Ionose and OVHeat sell `reseller`.
- Panels: the reseller shows in the panel as one account of the reseller level (DirectAdmen Reseller Level, WHM reseller list, Pleskit reseller). The account counts as one account against licence caps; sub-accounts, cascading holds and the reseller's own customers stay deferred as `panel-features.md` says.
- Every file that switches on `Product` gets the new case; `rg -n '"webHosting"' src/sim` lists them. Old saves load: a new product needs no state field, rates default from the catalog.

## Order

1. Unlock model and the declarations above, Research panel rendering, i18n in every language, `tests/research.test.ts` checks every unlock id resolves (store item, product, platform or shop id, feature key present in every language).
2. Reseller hosting product, skill, rates, demand, competitors, seeded test, changelog bullet.

Step 2 builds on step 1 and starts after it merges.
