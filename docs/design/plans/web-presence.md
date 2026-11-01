# Software from the web, Strateaux and moving between hosts

Status: planned. Lane ids: `books-download`, `app-catalogue`, `strateaux-account`, `migrate`, `self-host-loss`, `customer-views`.

Related design: [shop-software](shop-software.md) (shop keys, versions, vendor sites), [billing-by-hand](billing-by-hand.md) (Books, vendor sites, Shop link), [software-licences](software-licences.md) (cart, My account, activation), [shop-portal](shop-portal.md) (the portal and its admin), `docs/design/shop-surfaces.md` (skins wrap shared screens).

## What changes

The Pear Store sells Pear's own apps and nothing else. Third-party software is bought on its maker's website and installed where it really runs:

- **Bookkeeping programs** are bought on the vendor's site in the Browser. A desktop program (Lexwear, Wizo, Saga, Orgamin, GnuCache) downloads in game time at the company's line speed and then installs from the same page into the dock; a browser program (Collmix, Sevdeck, Lexoffize) opens straight after sign-up. The Bookkeeping shelf in the Pear Store goes away.
- **Shop systems** are installed through the web host's app catalogue, as a real hoster would: pick the shop, pick the web space, install. The install needs no key. The shop then runs its trial, or stays closed when it has none, until the key bought on the vendor's site is activated in the shop admin's Licence screen. The key field of today's install form goes away.
- **The company website and the shop** live either on rented web space at Strateaux or on one of the company's own panel hosts. Strateaux has its own customer login where the package is managed, and the hosting picker in the Marketing app goes away. Marketing keeps building, designing and listing the site.
- **Moving between hosts** is an action on both sides: on the Strateaux dashboard to move the site, the shop and the mail onto an own panel host, and on the own panel host's console to move them back to Strateaux.
- **One shop instance** runs at a time. Installing a second shop, or the same shop on a second host, is refused until the first is removed or moved.
- **Customers** are shown by the software that holds them: the shop admin in its skin, and Books in its vendor's layout. Both use one shared customer core, so nothing is written twice.

## Lane `books-download`

1. Sim: a desktop program's purchase on its vendor site adds a download (`books.download: { vendor, edition, readyAt } | null`, default null in `newGame` and `deserialize`). Its length is the program's size over the company's line speed, as for OS images. `installBooks` for a desktop vendor needs a finished download of that vendor; a browser vendor installs at sign-up as today. Switching vendors keeps the old data rule of today.
2. UI: the vendor site's Buy button becomes Download for desktop programs, shows the progress, then Install. The Pear Store's Bookkeeping shelf and `BooksShelf.tsx` go; the Getting started guide and anything focusing that shelf point at the vendor list in the Browser index instead.
3. Test: seeded suite for download, install, a refused install without a download, and an old save with Books installed.

## Lane `app-catalogue`

1. A panel's app catalogue page in the panel console, named for the era's installer pun (Fantastiko from 2005, Softaculus from 2009). It lists the shop systems on sale that year, each as a wide tile.
2. Install: pick the web space (panel host) and install. `installShop` loses its key parameter; old calls with a key still activate it so saves and tests keep working.
3. Activation: the Licence screen in the shop admin is the only place a key is entered. A shop without a trial shows that screen until a key is active.
4. One instance: `installShop` refuses while a shop is installed elsewhere (`error.shopOneInstance`); removing the shop is an explicit action that keeps the shop's data in its own state until the next install.
5. Strateaux's dashboard gets the same catalogue (lane `strateaux-account`), so the shop can also run on rented space.

## Lane `strateaux-account`

1. A Strateaux website in the Browser (`www.strateaux.de` style, era looks like the other provider sites) with a customer login and a dashboard.
2. Packages: the rented site package of today (`SITE_RENT`) becomes a Strateaux contract in state (`strateaux: { package, since, mail } | null`). A larger package from the era allows the app catalogue for the shop and costs more. Prices go into `economy.md`.
3. Mail: every package includes mailboxes under the company domain. Company mail gets a fourth kind, `strateaux`, so the existing free, external and self choices stay and the Strateaux mailboxes are one more.
4. The dashboard has wide action tiles at about 3:1, icon on the left, title and one line of text on the right: Website, Shop, Email, App catalogue, Move to own server.
5. Strateaux never goes down and never loses data: its site and shop status are always up.
6. Marketing: the hosting picker is removed. Launching the site needs a Strateaux contract or an own panel host with room, chosen through Strateaux or through the panel's catalogue.
7. Old saves: a launched site on `{ kind: "rented" }` becomes a Strateaux contract with the base package; `{ kind: "own" }` stays as it is.

## Lane `migrate`

1. A migration page, reached from the Strateaux tile and from a matching tile on the own panel console: choose what moves (site, shop, mail), choose the target host, start. Each item is its own action with its own duration and a short downtime.
2. The move copies the item's data; the old copy is removed when the move ends. Moving the shop keeps its customers, invoices, products and key.
3. Reverse: moving from an own host back to Strateaux needs a package that allows it (the shop needs the larger one).
4. Tests: each direction, a refused move without room or without the right package, and the shop's data after a move.

## Lane `self-host-loss`

1. A site or shop on an own host shares the host's fate: a disk loss without a usable backup point loses it.
2. Lost site: the site must be rebuilt in Marketing (the hand-written build or the current design).
3. Lost shop: the shop must be installed fresh from the catalogue. Its customers and invoices come back from Books, by importing them or by turning Shop link sync back on; anything Books never received is gone. Products must be set up again.
4. A restore from a good backup point brings everything back as it does for customer workloads.
5. Tests: loss without backup, restore with backup, re-import from Books.

## Lane `customer-views`

1. One customer core (data rows, actions, services, invoices, tickets, activity) that both the portal's client page and Books' Customers tab use, so the two stop being separate implementations.
2. Each software shows the fields it would have: a shop shows services, orders and logins; a bookkeeping program shows address, invoices, balance and dunning. The look comes from the portal skin or the Books layout, never a copied component.
3. The stale reference to the removed Customers app in `packages-provisioning.md` is updated.

## Order

`books-download` and `app-catalogue` need nothing and go first. `strateaux-account` follows `app-catalogue`. `migrate` and `self-host-loss` need both. `customer-views` is independent and can run at any time.

## Decisions taken without the user

- Browser bookkeeping programs need no download (they never had one).
- The shop's data survives an uninstall in state until the next install, so a reinstall of the same shop continues.
- The Strateaux small package holds the site and mail only; the shop needs the larger package.
