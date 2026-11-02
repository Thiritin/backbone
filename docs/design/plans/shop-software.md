# Shop systems as installed software

Status: `shop-catalog`, `shop-versions`, `shop-install` and `shop-marketing-cut` are built. The Marketing app has no Shop tab; the shop is installed from the panel host's software page (`ShopInstall` in `src/ui/apps/browser/consoles/HostSettings.tsx`), and its modules and payment methods moved into the shared admin screens. The shop runs as the machine id `shop` in `src/sim/60-infra/licence.ts`, so keys, trials, upgrades and the lifecycle treat it like any other installation. Its admin's Licence and Updates screens, the closed store page and the version footer are shared components in `src/ui/apps/browser/sites/portal/shared/Licence.tsx`. Until a shop's vendor site exists, the Updates screen's Upgrade button buys the next major's key directly.

Lane ids: `shop-catalog`, `shop-install`, `shop-sites`, `shop-versions`, `shop-marketing-cut`. Related design: `docs/design/shop.md` (the shop variants), `docs/design/plans/software-licences.md` (keys, eras, versions, vendor shop, My account), `docs/design/plans/shop-portal.md` (the hosted portal and its admin), `docs/design/software-versions.md` (version data).

## What changes

Today a shop system is bought from the Shop tab in the Marketing app and starts working on its own. After this plan, a shop system is software like a hosting panel:

- Each shop variant (ModemBill, ClientExit, WHMCache, Blessta, HostBull, Ubersmyth, OrderBocks, BoxBillin) is a licensed product in the software licence catalog, with editions, licensing eras, major versions and update windows taken from its real history.
- Keys are bought on the vendor's own website in the Browser, through the shared vendor shop and My account from the software-licences plan. Every vendor site has its own look, as the panel vendor sites do.
- A perpetual key is paid once and covers the major version on sale when it was bought. It includes updates for a limited period (the vendor's support and updates term, usually a year). After that, the player either pays the yearly updates fee to keep receiving minor updates and security fixes, or keeps running the version they have until its security support ends. Moving to the next major version is a paid upgrade at the vendor's upgrade price.
- Where a vendor really sold a monthly lease (WHMCache leased licences, HostBull), that option is a term-bound era: the key covers whatever version is current while it is paid, and a lapsed lease blocks new orders after the grace period, as a lapsed panel licence blocks new accounts.
- Free software (BoxBillin) needs no key and still has versions and an end of support.
- The shop runs where the player installs it. It goes onto a web space on one of the player's own panel hosts, uses one account there and counts against that panel's licence cap. If that host, its panel or the web space is down, the portal and its order form are down, and visitors become lost orders as they do during a site outage today.
- The Shop tab in the Marketing app goes away. Buying happens on the vendor sites, installing happens through the panel, and running the shop happens in its admin at `portal.<company domain>/admin` (shop-portal plan).

## Licence rules

Shop keys reuse the panel licence state with no shop-only branches:

- **Trial.** Variants whose real counterpart offered a trial install without a key and run for the vendor's trial length. When it ends, the portal takes no new orders and the admin shows only its licence page until a key is entered.
- **Editions and caps.** An edition caps active clients (WHMCache, Blessta, ClientExit) or managed servers (Ubersmyth, HostBull), as the real editions did. Going over the cap blocks new orders, the same way `licenceBlock` refuses one more panel account.
- **Updates window.** Each key stores the hour its updates end. Inside the window, minor updates install from the admin's update page. Outside it, the update page offers the renewal price instead.
- **Security end.** When a major version's security support ends, the vendor emails a notice, and the installation starts raising fraud and hacked-portal incidents at the rate the panel lifecycle uses for unsupported versions.
- **Eras.** When a vendor stops selling an option (owned licences, a lease, an edition), its shop stops offering it on that date, and keys already bought keep working.

## Versions

Every variant gets a version line in `software-versions.ts` with major, release month, end of updates and end of security support. The real release history is researched into `docs/design/software-versions.md` first, in the same way as the panels. The admin shows its version in the footer and on its update page. A new major version changes the admin look where the real product changed it, through `UI_LOOKS`.

## Old saves

A save with a shop variant and at least one panel host installs that variant on the first panel host, in the newest major version of the save's year, holding a perpetual key with its updates window starting at the save's hour. A save with a shop and no panel host keeps the variant uninstalled, so the portal is down until the player installs it.

## Lanes

| Lane | What it builds |
| --- | --- |
| `shop-catalog` | Shop variants as entries in the licence catalog: editions with caps, eras with perpetual price, updates price and term, lease price, trial length, upgrade price. The prices in `shops.ts` move here. |
| `shop-versions` | Version lines for all eight variants from the researched history, release and end dates, admin looks per major. |
| `shop-install` | Installing a shop onto a web space of a panel host, the account it takes, portal availability following the host, key entry, trial, cap block, update and upgrade from the admin, security-end incidents. |
| `shop-sites` | One styled vendor website per variant with product page, editions, the shared cart and checkout, and My account. |
| `shop-marketing-cut` | The Marketing Shop tab removed, stock and server groups moved into the shop admin, and old saves migrated as described above. |

`shop-catalog` and `shop-versions` ship first, in one pull request. `shop-install` and `shop-sites` can then run in parallel. `shop-marketing-cut` comes last, once buying and installing work.

## Out of scope

Moving an installed shop to another server: the player installs it again on the new host and enters the same key, which frees the key from the old installation.
