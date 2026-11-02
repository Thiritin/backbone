# Software licences

Lane ids: `catalog-terms`, `licence-state`, `install-key`, `vendor-shop`, `my-account`, `renewals`, `migrate`, `versions-catalog`, `licence-eras`, `software-upgrade`, `lifecycle`, `vendor-versions`, `vendor-news`, `console-by-version`. Version data: `docs/design/software-versions.md`. Related design: `docs/design/software.md` (install from the console, one website per software), `docs/design/economy.md` (Platforms and licenses), `docs/design/plans/panel-host-sim.md` (licence tiers), `docs/design/plans/billing-by-hand.md` (lane `vendor-sites`, Lexwear keys by email).

## What changes

Today installing licensed software charges the licence on the spot: `buyLicenses` books a ledger line at install, monthly fees run on their own, and a licensed panel starts on a 30-day trial of its top tier. After this plan, software is installed the way it is in real life:

- Software whose real counterpart offers a trial or evaluation installs without a key and runs as a trial for the vendor's real trial length. When the trial ends, the software keeps its data but stops doing the thing the trial gates (a panel blocks new accounts as it does today, a hypervisor refuses to start VMs, a backup job stops running). A licensed panel whose trial ended or whose key lapsed shows only its licence page after sign-in, where a typed key or an unassigned key from My account brings the admin UI back. Its sites keep serving, but each day a fifth of its customers without an open ticket write in that their panel login shows the licence page, and those tickets resolve once the panel is licensed again.
- Software without a trial asks for a licence key during install. Without a valid, unassigned key the install does not start.
- Keys are bought on the vendor's website in the Browser: a product page with editions, a shop with a cart, a checkout with billing details, payment by the company card (its number, expiry and security code as the online bank shows them) or a transfer, and a review, and an order confirmation email with the keys.
- Each vendor site has a My account page that lists every licence bought there: product, edition, key, the machine it is assigned to, and when it renews or expired. Monthly licences are cancelled there.
- A trial is turned into a full licence by entering a key in the software's licence page (the `readouts` licence page frame), the Windoors activation dialog, or the console command the vendor's site documents.
- A freshly installed licensed panel opens on a licence setup page at its first sign-in: the player enters a key, picks an unassigned one, or continues on the trial the install started. The setup page does not hold back accounts, since the install already licensed the panel; panels from older saves count as set up.
- Free software (Debiant, FreePanel, Proxmocks and the rest) needs no key, but it is versioned and ages like everything else.

## Versions

- Every software has its own version list with the real version numbers and release months from `docs/design/software-versions.md`, the way operating systems already have one. An install takes the newest version out in the game month; installed software keeps its version until the player upgrades it.
- Every version has two end dates from the real vendor: the end of updates and the end of security updates. Past the end of updates the version gets no new features or fixes; past the end of security updates it collects known vulnerabilities, which raise the compromise and incident chances of the machine, and its console shows the version as unsupported.
- Upgrading is an action per installation that goes one major version at a time, like the OS in-place upgrade. Each step takes hours, and steps where the real admin UI changed switch the console to the new look. The console look follows the installed version, not the calendar year.
- Each vendor site gets a Versions page listing every released version with its release date, end of updates and end of security updates, and a News page where each release is announced with its headline features on the day it comes out.

## Licence models over time

- Each product carries licensing eras taken from its real history. A licence is either version-bound (a perpetual licence for one major version) or term-bound (a yearly or monthly subscription that covers whatever version is current while it runs).
- A version-bound key does not cover a newer major. Upgrading past it needs an upgrade licence bought on the vendor site. Buyers whose licence for the previous major was bought in the last 12 months are offered the upgrade at the discounted upgrade price; everyone else pays the full new price.
- When a vendor ends an option in real life, the shop stops selling it on that date. A player who keeps an old perpetual licence keeps running the version it covers, and that version runs out of updates and security fixes on its real schedule. Moving on means buying into the new model.
- A term-bound key covers every version released while it is paid. When it lapses, the software behaves like an ended trial until it is renewed.

The catalog carries these eras (`licensing` in `src/sim/10-catalog/platforms.ts` and `server-os.ts`); prices are in economy.md, Platforms and licenses.

| Product | Eras |
|---|---|
| Windoors Server | perpetual per machine; from 2016-10 per core a month, 16 per server and 8 per CPU at least |
| VMwhere | perpetual per CPU socket; from 2023-12 per core a year, 16 per CPU at least |
| cPanic | Dedicated per server a month; from 2019-06 the account editions Solo, Admin, Pro and Premier, and a Dedicated key renews as the one that fits its accounts |
| DirectAdmen | lifetime per major or Standard a month; from 2019-09 monthly only, Personal, Lite and Standard |
| Veeham Backup | perpetual per CPU socket; from 2018 per server a year |
| MultiKraft | per server a month; from 2020 per game server beyond 25 a month |
| Pleskit, HyperVee, TCAdmen, Sysko AnyConnekt | one monthly era, unchanged |

## Terms per product

The trial lengths follow the real products. `null` means a key is needed at install.

| Software | Real counterpart | Trial | Licence sold |
|---|---|---|---|
| Windoors Server | Windows Server evaluation | 180 days | once per server, per core from 2016 |
| HyperVee | Hyper-V on a Windows Server evaluation | 180 days | per server, monthly |
| cPanic | cPanel 15-day trial | 15 days | edition per server, Premier per account, monthly |
| Pleskit | Plesk full trial | 14 days | edition per server, monthly |
| DirectAdmen | DirectAdmin, no trial since about 2019 | `null` | edition per server, monthly |
| VMwhere | vSphere evaluation | 60 days | once per server, per core from 2024 |
| Veeham Backup | Veeam trial | 30 days | per server, monthly |
| TCAdmen | TCAdmin 30-day trial | 30 days | per server, monthly |
| MultiKraft | Multicraft | `null` | per server, monthly |
| Sysko AnyConnekt | AnyConnect | `null` | per server, monthly |

## Decisions

- One key covers one machine. A key is assigned on install or activation and released when the software is removed or the machine is wiped, so a key can move to another machine.
- A once licence never expires. A monthly licence renews on the day of the month it was bought, paid from the bank account; an unpaid renewal lapses after the existing `LAPSE_GRACE_DAYS`, and the software behaves like an ended trial.
- The edition is part of the key. Upgrading an edition is a new purchase on the vendor site, and entering the new key replaces the old one; the old key goes back to My account as unassigned.
- A trial runs once per machine and product. Reinstalling does not restart it.
- Keys reuse the Lexwear format and generator (`licenceKey`, four groups of four), seeded per order line.
- Templates and cluster builds that install licensed software take keys from My account in the order shown there; if there are not enough unassigned keys, the build fails with an error that names the product.
- `s.licenses` becomes the list of bought keys. The ledger line moves from install to checkout.
- Checkout pays a one-time licence's price and a term licence's first month for one unit, as one ledger line per order. A cancelled term licence stops renewing, runs to the end of the term it paid for and then lapses.
- The cart is one list in the game state; each vendor site shows and checks out only the lines it sells. Lexwear and the other bookkeeping vendors keep selling their modules on their own pages.

## Lanes

| Lane | Scope | After |
|---|---|---|
| `catalog-terms` | `trialDays` on every licensed entry in `server-os.ts` and `platforms.ts`, values from the table above; vendor site id per product | none |
| `licence-state` | `s.licenses` as keys: id, product, edition, kind, key, orderId, boughtAt, machineId or null, renewsAt, lapsedAt. Trial state per installation: trialUntil. `60-infra/licence.ts` derives trial, active, ended, lapsed for every licensed install, replacing the panel-only check | `catalog-terms` |
| `install-key` | install actions in `software.ts`, `console.ts`, `templates.ts`, `clusters.ts` take an optional key: no charge at install, trial when the product has one, `error.licenceKey` otherwise. New action `activateLicence(machineId, softwareId, key)`. The console install command takes `--key`, the Windoors setup and the licence page get a key field | `licence-state` |
| `vendor-shop` | a shared vendor shop on every licensed product's site: product page with editions and prices by year, cart, checkout (bank payment, ledger line per order), order email with keys through `deliverMail`. Lexwear moves onto the same cart | `licence-state` |
| `my-account` | My account page on each vendor site: licences with edition, key, machine, renews or expired, Cancel for monthly licences, copy key | `vendor-shop` |
| `renewals` | the monthly run charges active monthly licences on their renewal day, lapses unpaid ones after the grace days, and sends the vendor's renewal and lapse emails | `licence-state` |
| `migrate` | `deserialize` turns old `s.licenses` entries and existing installs into assigned keys with a renewal date, so running machines stay licensed; the panel `licence.trialUntil` maps to the new trial state | `licence-state` |
| `versions-catalog` | version lists with release month, end of updates and end of security updates for every software in `platforms.ts`, from `software-versions.md`; installed software stores its version; new installs take the newest version out | `licence-state` |
| `licence-eras` | licensing eras per product from the real history: model (version or term), price, upgrade price, whether still sold; the shop sells only what the current era offers | `versions-catalog`, `vendor-shop` |
| `software-upgrade` | upgrade action per installation, one major at a time, hours per step; a version-bound licence that does not cover the target asks for an upgrade key; the 12-month upgrade offer on the vendor site | `licence-eras`, `install-key` |
| `lifecycle` | end of updates and end of security updates per installed version: unsupported badge in the console, vulnerabilities that raise incident and compromise chances | `versions-catalog` |
| `vendor-versions` | Versions page on every vendor site: version, released, updates until, security until | `versions-catalog` |
| `vendor-news` | News page on every vendor site with a release announcement and headline features per version, posted on the release day; the game news shows major releases | `versions-catalog` |
| `console-by-version` | console looks keyed by installed version instead of year, using the UI generations in `software-versions.md` | `versions-catalog` |

The foundation (`catalog-terms`, `licence-state`, `migrate`) ships as one pull request. After it, `vendor-shop` (with `my-account`), `install-key`, `renewals` and `versions-catalog` run in parallel; then `licence-eras`, `lifecycle`, `vendor-versions`, `vendor-news` and `console-by-version`; `software-upgrade` comes last. Every lane adds seeded tests under `tests/` and English keys with the same keys in every `src/i18n/<lang>/` file.
