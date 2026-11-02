# Web developers, flyers and the design agency

Status: building. Lane ids: `webdev-segment`, `flyers`, `design-agency`.

Related design: `docs/design/economy/README.md` (Market and leads, Marketing and reviews, Resellers), [web-presence](web-presence.md), [shop-portal](shop-portal.md).

## What changes

Three things the player notices:

1. A new customer profile, the web developer: freelancers and one-room web agencies who host their clients' sites. They prefer a reseller block once one is on offer and otherwise order web hosting, one account per client. They are rare in the first years, pick a host by its reputation above its price, and hear about you through sponsored community events. Word of mouth brings fewer orders than today.
2. Flyers as a marketing channel. A print shop in the browser sells print runs, the flyers are handed out in one of your cities over four weeks, and the Marketing app lists every running run next to the campaigns and sends the player to the print shop to order more. The site index gets a Marketing category for the print shop and the agency.
3. The web design agency. The first site is built by hand and looks like 2005 shareware: a frameset, a visitor counter, a marquee. Every design after that is ordered on the agency's own site. The price grows with the year and with the size of the company, from 400 euros in 2005 for a basement hoster to several thousand in 2025, and far more for a datacenter baron. The player can order a redesign at any time; the agency grows from a one-person page to a real agency over the years.

## Lane `webdev-segment`

Sim only, plus one seeded test and the economy doc.

- New `Profile` value `webDev` in `src/sim/30-customers/customers.ts`, a `PROFILES` row in `src/sim/10-catalog/economy.ts` (medium budget, high skill, mix 0.03 taken from private, which drops to 0.22; reputation weight high, price weight low, lambda low, churn low), `CATALOG_ID` in `src/sim/40-support/tickets.ts`, `PROFILE_IDS` in `src/sim/80-business/marketing.ts`, `NEEDS` in `src/sim/30-market/market.ts` (webHosting 0.85, vps 0.15, gpu share), a business profile in `src/sim/10-catalog/attention.ts` (office hours), default SLA business, a company name generator entry (freelancer: "<last> Webdesign", "<last> Media").
- Reseller preference: in `src/sim/30-customers/resellers.ts` a `WEBDEV_LEAD_SHARE` of 0.6 next to the agency share, applied where `src/sim/30-market/sales.ts` turns agency leads into reseller leads.
- Rare at the start: awareness for `webDev` starts at a quarter of the others in `newMarketing()`; sponsored community events whose audience is developers (the dev meetups and barcamps in `src/sim/80-business/community.ts`) add `webDev` to their audience so Sponsor-Bored is the early way to reach them. Trade fairs that reach agencies reach web developers too.
- Word of mouth: `REFERRAL_LEADS` 0.005 to 0.003 and `ORGANIC_CONSIDER` 0.4 to 0.3 in `src/sim/30-market/market.ts`. Run `npm run balance` before and after and keep the bot solvent; if the first-year run starves, raise `ORGANIC_CONSIDER` to 0.35 instead and say so.
- Marketing app: the awareness table, campaign reach and lost-demand views pick up the new profile through `PROFILE_IDS`; add the profile label key `marketing.profile.webDev` (and any `profile.webDev` key the UI already uses per profile) in English and every language.
- Test `tests/webdev.test.ts`: over a seeded 2005 year fewer than 5% of leads are web developers; with a cPanic host in 2009 the majority of web developer leads ask for a reseller block; referral leads at a fixed happy customer count are 40% lower than the old constant would give.
- Doc: the profile mix table and the Resellers paragraph in `docs/design/economy/resellers.md`.

## Lane `flyers`

- Catalog `src/sim/10-catalog/flyers.ts`: print shop "Flyerlarm" (pun on Flyeralarm), host `flyerlarm.de`, runs of 1,000, 5,000 and 10,000 flyers at 2026 prices of 0.09, 0.07 and 0.06 euros each, scaled with `priceAt(..., 0.6, year)`, delivery after 3 days, handed out over 28 days in one location city, response rate 0.004 leads per flyer spread over the private, sole proprietor and small business profiles by their mix, conversion 0.8. Flyers need no website and no research unlock.
- State: `marketing.flyers: FlyerRun[]` with `{ id, city, size, orderedAt, flyersLeft, leads }`, default `[]` in `newMarketing()` and filled by `deserialize` for old saves.
- Action `orderFlyers(s, city, size)` in `src/sim/90-actions/marketing.ts`: checks the city has a location of yours and cash, books the run under ledger category `marketing` with key `ledger.flyers`.
- Tick: daily hand-out after delivery; lead batches join `leadsThisMonth` with a new `LeadBatch.source` value `flyer`, and the arriving requests name flyers as their source where sources are shown.
- Browser: `src/ui/apps/browser/sites/marketing/FlyerlarmSite.tsx` with an early (2005) and a late (2015) era via `eraOf`, pages Home, Flyers (pick city and run, see the price, order) and My orders (runs so far). Page kind `flyers` in `src/sim/80-business/browser.ts` and `BrowserApp.tsx`. Row in the Marketing category of `siteIndex` (`src/sim/80-business/index.ts`, the category already exists with empty rows).
- Marketing app, Campaigns tab: a Flyers card above the campaign cards that lists every running run (city, flyers left, leads so far) and an Order button that opens the browser at the print shop; look at how the Website card's Manage button and the Community tab open a site for the pattern.
- Strings: new `ui-flyers.ts` in English and every language folder, including `sim.index.flyers`.
- Test `tests/flyers.test.ts`: ordering without a location fails; a 5,000 run in the home city books the ledger line, hands out all flyers within 31 days, and the month's lead batches contain a flyer batch whose count matches the response rate; a saved game before this change still loads.
- Doc: a Flyers paragraph under Marketing and reviews in `docs/design/economy/marketing-and-reviews.md`, the channel added to the cost per lead table.

## Lane `design-agency`

- Pricing in `src/sim/80-business/website.ts`: `designPrice(year, level)` = base by generation (2005: 400, 2009: 650, 2013: 1,000, 2017: 1,500, 2021: 2,200, 2025: 3,500, interpolated per year, flat after 2026) times (1 + 0.5 × (level − 1)), with level from `metrics(s).level.level`. `OWNED.website.setup` keeps 400 as the 2005 base so the balance bot and the channel table still work; `setUpChannel("website")` and `redesign` both charge `designPrice`. `redesign` no longer refuses a current design: it is allowed at any time and sets `designYear` to the current generation; the site is delivered `DESIGN_DAYS` (14) later through `marketing.designReady`, during which the old design stays live. Default `null` in `newMarketing()` and `deserialize`.
- Agency site: "Young von Mutt" (pun on Jung von Matt), host `youngvonmutt.de`, in `src/ui/apps/browser/sites/marketing/AgencySite.tsx`. Three eras: 2005 a one-person freelancer page (table layout, "Webdesign aus <city>", a GIF-style under-construction strip), 2013 a studio with a portfolio grid, 2021 a full agency with a team page. Pages: Home, Work, Quote (shows the price for your company from `designPrice`, the delivery time and an Order button that calls `setUpChannel` or `redesign`), About. Page kind `agency` in `browser.ts` and `BrowserApp.tsx`, a row in the Marketing category of `siteIndex`.
- Marketing app `Website.tsx`: the web design offer and the Redesign button open the browser at the agency site instead of paying inline; the card shows the design year, the delivery date while a redesign is in progress, and the current price.
- Company site `CompanySite.tsx`: the self-built look (no `website` channel) becomes a frameset-style page with a left frame menu, a marquee line, a visitor counter and a "best viewed in 800x600" footer; the agency generations keep their looks and the 2005 agency look is clean but dated (table layout, no marquee).
- Strings: new `ui-agency.ts` in English and every language, `sim.index.agency`.
- Test `tests/design-agency.test.ts`: `designPrice(2005, 1)` is 400, `designPrice(2025, 1)` is 3,500, `designPrice(2025, 6)` is 12,250; a redesign with a current design is accepted, books the price under `marketing` and flips `designYear` only after 14 days; an old save without `designReady` loads.
- Doc: the Owned channels table and the Design generations paragraph in `docs/design/economy/README.md`.

## Order

The three lanes are independent and run at once in their own worktrees. `flyers` and `design-agency` both add a row to the Marketing category of `siteIndex` and a page kind to the browser; the merge resolves those two adjacent additions. Each lane updates every language folder for its own new keys, adds a CHANGELOG bullet under today's heading, and leaves the balance run green.

## Decisions taken without the user

- Web developers are a profile in the existing lead pipeline, not a new segment type: the segment type only decides attention hours, and they behave like business customers there.
- Flyers reach only the three low and medium budget consumer and small business profiles, because that is who reads a flyer in a letterbox.
- A redesign takes 14 days to deliver, so ordering one is a decision with a visible wait instead of an instant switch.
- The company level stands in for company size, since no headcount metric exists and the level already scales lead caps.
