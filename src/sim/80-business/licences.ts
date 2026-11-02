// docs/design/plans/billing-by-hand.md, lanes vendor-sites and shop-link: a shop module is bought on its maker's site, a
// purchase is a ledger line and the licence key follows by email a minute later.
import { t } from "../../i18n/en";
import { keyCode } from "../00-core/rng";
import { moduleById, MODULES } from "../10-catalog/modules";
import { shopById } from "../10-catalog/shops";
import { deliverMail, type Ticket } from "../40-support/tickets";
import type { GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";

// Fixed per game and module.
export const licenceKey = (s: GameState, id: string): string => keyCode(s.seed, MODULES.findIndex((m) => m.id === id) + 1, 607);

const LEDGER = "ledger.module.";
const purchaseOf = (e: LedgerEntry): string | null => (e.key.startsWith(LEDGER) ? e.key.slice(LEDGER.length) : null);
export const bought = (s: GameState, id: string): boolean => s.ledger.some((e) => purchaseOf(e) === id);
// A shop vendor's licence email for a module it sells.
export const SHOP_LICENCE = "shop-link.licence";
export const isLicence = (topic: string): boolean => topic === SHOP_LICENCE;
export const licenceMail = (s: GameState, id: string): Ticket | undefined =>
  s.tickets.find((x) => x.kind === "mail" && x.mail?.params.module === id && x.topic === SHOP_LICENCE);

// A licence email's params as shown: the module's name and pitch in the player's language.
export const vendorParams = (p: Record<string, string | number>): Record<string, string> => ({
  module: t(`vendor-sites.module.${p.module}`), pitch: t(`vendor-sites.pitch.${p.module}`), key: String(p.key ?? ""), shop: String(p.shop ?? ""),
});

// Every minute and hour: purchases of the last hour without their licence email get it now.
export function deliverLicences(s: GameState): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = s.ledger.length - 1; i >= 0 && s.ledger[i].hour >= s.hour - 1; i--) {
    const id = purchaseOf(s.ledger[i]);
    if (!id || moduleById(id)?.vendor !== "shop" || !s.shop.variant || licenceMail(s, id)) continue;
    const shop = shopById(s.shop.variant).name, params = { module: id, key: licenceKey(s, id), shop };
    const m = deliverMail(s, shop, SHOP_LICENCE, params);
    out.push({ app: "Support", key: "event.ticket", params: { ...params, ...vendorParams(params), ticketId: m.id, name: shop, subject: `ticket.mail.${SHOP_LICENCE}.subject` } });
  }
  return out;
}
