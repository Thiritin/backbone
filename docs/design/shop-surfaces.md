# Shop surfaces: what every shop must have

Each of the eight shop systems (ModemBill, ClientExit, WHMCache, Blessta, HostBull, Ubersmyth, OrderBocks, BoxBillin) has three surfaces, and each surface gets a different look for each major version. This page lists what every surface must contain so the game works the same in every shop. Everything else (layout, colours, type, navigation pattern, icons, wording style, how the look changes from one major version to the next) is decided per shop by the person designing it. No two shops may share a look, and the shared components under `src/ui/apps/browser/sites/portal/shared/` and the vendor shop are wrapped and restyled, never copied with only new colours.

Plan: `docs/design/plans/shop-software.md`.

## Eras

Each surface has at least three distinct looks across the game (2005 to 2035), changing at the shop's real major versions where it lived that long. A shop that ends early (ModemBill) gets at least two. The installed major version picks the admin and client look; the game year picks the vendor site look. A look should feel like its year: table layouts and bevels in the mid 2000s, glossy gradients around 2010, flat and card based in the mid 2010s, and current design after 2020, each in the shop's own interpretation.

## Vendor website

The real-world-style marketing site of the vendor, in the Browser, at the vendor's domain.

- Home page with the product name, a short product pitch and a link to pricing.
- Pricing page listing every edition on sale in the current game month with its cap, the perpetual price with the included updates term and the yearly updates price, and the lease price where one is on sale. Each sold option has an Add to cart button.
- The shared vendor cart and checkout (pay from the bank account), and the order confirmation email with the key.
- My account: the player's keys for this shop with edition, version covered, installation it is assigned to, updates until, and the buttons Renew updates, Upgrade to the next major version (with its price) and Copy key.
- Releases or changelog page listing the major and minor versions released up to the current game month, with dates.
- Download or install instructions page that tells the player to install the shop on a web space of a panel host.
- Footer with the vendor name and the year.

## Admin (`portal.<company domain>/admin`)

- Sign-in page.
- Navigation that reaches every screen: Home, Products, Configurable options, Servers, Pending orders, Clients, Invoices, Licence, Updates.
- Every existing admin screen and every button it has today (product create and edit, stock, option edit, server groups, accept and cancel order, client view, invoice view and mark paid) stays reachable and works.
- Licence page: edition, key, client or server count against the cap, updates until, and a field to enter a key with a Save button. When the trial ended or the key lapsed, sign-in leads only to this page.
- Updates page: installed version, the newest version the key may install with an Install update button, the next major version with an Upgrade button that links to the vendor's My account, and a notice when the installed version no longer receives security updates.
- Version number in the footer.

## Client area and store

- Store front with product groups and products, prices per billing cycle and an Order button.
- Configure and cart pages with the existing steps, a Checkout button and the order result.
- Client sign-in, then the client area with every screen and button it has today (services, invoices with Pay, tickets where present).
- A page shown while the shop takes no orders (licence blocked or host down) with the message from the sim.
- Version number in the footer.

## Rules for the designers

- All copy goes through `t(key)`. Each shop keeps its keys in its own topic file, `src/i18n/ui-shop-<id>.ts`, with the same file in every `src/i18n/<lang>/` folder.
- Labels and values only. No placeholder text, filler hints or lorem ipsum.
- Every real company appears as a pun, and the shop's own name is the pun already in `shops.ts`.
- No em dashes.
- Each look works from 1024 px wide and in the game's light and dark Browser themes where the page follows them.
