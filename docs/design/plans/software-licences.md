# Software licences

Lane ids: `catalog-terms`, `licence-state`, `install-key`, `vendor-shop`, `my-account`, `renewals`, `migrate`. Related design: `docs/design/software.md` (install from the console, one website per software), `docs/design/economy.md` (Platforms and licenses), `docs/design/plans/panel-host-sim.md` (licence tiers), `docs/design/plans/billing-by-hand.md` (lane `vendor-sites`, Lexwear keys by email).

## What changes

Today installing licensed software charges the licence on the spot: `buyLicenses` books a ledger line at install, monthly fees run on their own, and a licensed panel starts on a 30-day trial of its top tier. After this plan, software is installed the way it is in real life:

- Software whose real counterpart offers a trial or evaluation installs without a key and runs as a trial for the vendor's real trial length. When the trial ends, the software keeps its data but stops doing the thing the trial gates (a panel blocks new accounts as it does today, a hypervisor refuses to start VMs, a backup job stops running).
- Software without a trial asks for a licence key during install. Without a valid, unassigned key the install does not start.
- Keys are bought on the vendor's website in the Browser: a product page with editions, a shop with a cart, a checkout that pays from the bank account, and an order confirmation email with the keys.
- Each vendor site has a My account page that lists every licence bought there: product, edition, key, the machine it is assigned to, and when it renews or expired. Monthly licences are cancelled there.
- A trial is turned into a full licence by entering a key in the software's licence page (the `readouts` licence page frame), the Windoors activation dialog, or the console command the vendor's site documents.
- Free software (Debiant, FreePanel, Proxmocks and the rest) is unchanged.

## Terms per product

The trial lengths follow the real products. `null` means a key is needed at install.

| Software | Real counterpart | Trial | Licence sold |
|---|---|---|---|
| Windoors Server | Windows Server evaluation | 180 days | once per server, per core from 2016 |
| HyperVee | Hyper-V on a Windows Server evaluation | 180 days | per server, monthly |
| cPanic | cPanel 15-day trial | 15 days | edition per server, Premier per account, monthly |
| Pleskit | Plesk full trial | 14 days | edition per server, monthly |
| DirectAdmen | DirectAdmin trial licence | 30 days | edition per server, monthly |
| VMwhere | vSphere evaluation | 60 days | once per server, per core from 2024 |
| Veeham Backup | Veeam trial | 30 days | per server, monthly |
| TCAdmen | TCAdmin | `null` | per server, monthly |
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

`vendor-shop`, `renewals` and `migrate` can run in parallel once `licence-state` is in. Every lane adds seeded tests under `tests/` and English keys with the same keys in every `src/i18n/<lang>/` file.
