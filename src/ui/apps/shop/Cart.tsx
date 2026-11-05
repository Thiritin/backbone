import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { modelById, modelName, type FormFactor } from "../../../sim/10-catalog/hardware";
import { skuById } from "../../../sim/10-catalog/cpus";
import { VENDOR_NAME } from "../../../sim/10-catalog/cpus";
import { leaseOffers } from "../../../sim/10-catalog/leasing";
import { REGIONS } from "../../../sim/20-world/datacenters";
import { buyCart, cardOnly, deliveryWait, PREPAY_HOURS, unitPrice, type Payment } from "../../../sim/90-actions/hardware";
import { bankOf } from "../../../sim/46-finance/bank";
import { HARDWARE_SHOP, type Method, type Payable } from "../../../sim/46-finance/payables";
import { payOptions } from "../browser/sites/shared/PayMethods";
import { feeLine, freshDoc, OrderDone, startMethod } from "../browser/sites/shared/PayButton";
import { TRANSFER_HOURS } from "../../../sim/10-catalog/banks";
import { Isometric } from "../../art/Isometric";
import { Logo } from "../../art/logos";
import { useStore } from "../../store";
import { t } from "../../../i18n/en";
import { partLabel } from "../hw";

export function Stepper({ value, onChange, min = 0, max, step = 1, label = t("shop.quantity") }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label?: string }) {
  return (
    <div className="shop-qty" role="group" aria-label={label}>
      <button className="btn icon" aria-label={t("shop.fewer")} disabled={value - step < min} onClick={() => onChange(value - step)}><Minus /></button>
      <span className="num">{value}</span>
      <button className="btn icon" aria-label={t("shop.more")} disabled={max !== undefined && value + step > max} onClick={() => onChange(value + step)}><Plus /></button>
    </div>
  );
}

const pct = (total: number, cash: number) => `+${Math.round((total / cash - 1) * 100)}%`;

export function Cart() {
  const cart = useStore((s) => s.cart), setCartQty = useStore((s) => s.setCartQty), clearCart = useStore((s) => s.clearCart);
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const game = useStore((s) => s.game);
  const [pick, setPay] = useState<string | null>(null);
  const [done, setDone] = useState<Payable | null>(null);
  const openLoc = useStore((s) => s.openLoc);
  const [to, setTo] = useState<string | null>(null);
  const dest = game.locations.find((l) => l.id === (to ?? openLoc)) ?? game.locations[0];
  const year = yearOf(game.hour), total = cart.reduce((n, l) => n + unitPrice(l, year) * l.qty, 0), units = cart.reduce((n, l) => n + l.qty, 0);
  const order = { supplier: "hardware" as const, lines: feeLine(game, total), name: HARDWARE_SHOP }, onlyCard = cardOnly(cart);
  // A cart with a brand sold abroad pays by card or lease only.
  const methods = payOptions(game, order).map((o) => (onlyCard && o.method !== "card" && !o.off ? { ...o, off: t("payA.off.cardOnly") } : o));
  const offers = total ? leaseOffers(game, total) : [];
  const usable = (id: string | null) => !!id && (methods.some((m) => m.method === id && !m.off) || offers.some((o) => o.id === id));
  const start = onlyCard ? (usable("card") ? "card" : offers[0]?.id ?? null) : startMethod(game, order);
  const pay = usable(pick) ? pick : start;
  const base = deliveryWait(game, cart);
  const wait = pay === "transfer" && base ? base + PREPAY_HOURS + TRANSFER_HOURS[bankOf(game)?.speed ?? "nextDay"] : base;
  const offer = offers.find((o) => o.id === pay);
  const best = Math.min(...offers.map((o) => o.total));
  const checkout = () => {
    if (!pay) return;
    const payment: Payment = offer ? { kind: "lease", offerId: offer.id } : { kind: pay as Method };
    const before = useStore.getState().game, r = act(buyCart, cart, payment, dest.id);
    if (!r.ok) return;
    setDone(freshDoc(before) ?? null);
    clearCart();
    setPay(null);
    notify("Shop", wait ? t("shop.orderedFor", { az: dest.name }) : t("shop.addedToStorage", { az: dest.name }), t("shop.units", { n: units }));
  };

  return (
    <aside className="shop-cart" aria-label={t("shop.cart")}>
      <div className="shop-cart-h"><h3>{t("shop.cart")}</h3><span className="grow" /><span className="num shop-muted">{units}</span></div>
      <div className="shop-cart-list">
        {cart.map((l) => {
          const m = modelById(l.model), name = l.part ? partLabel(l.part) : modelName(m, l.brand);
          const parts = [...(l.extras ?? []).map((e) => `${e.qty} × ${partLabel({ ...e, ff: e.ff as FormFactor | undefined })}`)];
          return (
            <div key={`${l.model}|${l.brand}|${l.vendor}|${l.cpu}|${JSON.stringify([l.extras, l.part])}`} className="shop-line">
              <Isometric model={m} brand={l.brand} w={56} />
              <div className="shop-line-name">
                <strong>{name}</strong><span>{l.brand}{l.cpu ? ` · ${VENDOR_NAME[skuById(l.cpu)!.vendor]} ${skuById(l.cpu)!.name}` : l.vendor && ` · ${VENDOR_NAME[l.vendor]}`}</span>
              </div>
              <Stepper value={l.qty} min={1} onChange={(n) => setCartQty(l, n)} />
              <span className="num shop-line-total">{euro(unitPrice(l, year) * l.qty)}</span>
              <button className="btn ghost icon" aria-label={t("shop.remove", { name })} onClick={() => setCartQty(l, 0)}><X /></button>
              {parts.length > 0 && <div className="shop-line-parts num">{parts.join(", ")}</div>}
            </div>
          );
        })}
        {!cart.length && <div className="shop-none">{t("shop.empty")}</div>}
        {!cart.length && done && <div className="shop-cart-foot"><OrderDone doc={done} btn="btn" /></div>}
      </div>
      {cart.length > 0 && <>
        <div className="shop-dest" role="group" aria-label={t("shop.deliverTo")}>
          <span>{t("shop.deliverTo")}</span>
          <div className="picks">
            {REGIONS.flatMap((r) => game.locations.filter((l) => l.city === r.city)).map((l) => (
              <button key={l.id} className="pick" aria-pressed={l.id === dest.id} onClick={() => setTo(l.id)}>
                <strong>{l.name}</strong><span className="sub num">{l.az}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="shop-cart-total"><span>{t("shop.delivery")}</span><span className="grow" /><span className="num">{wait ? t("shop.arrivesIn", { n: wait > 24 ? Math.ceil(wait / 24) : 1 }) : t("shop.arrivesNow")}</span></div>
        <div className="shop-cart-total"><span>{t("shop.total")}</span><span className="grow" /><strong className="num">{euro(total)}</strong></div>
        <div className="shop-pay" role="radiogroup" aria-label={t("shop.payment")}>
          {methods.map((m) => (
            <button key={m.method} role="radio" aria-checked={pay === m.method} className="shop-offer" disabled={!!m.off} onClick={() => setPay(m.method)}>
              <strong>{m.label}</strong><span className="grow" /><span className="num">{m.off ?? euro(total)}</span>
            </button>
          ))}
          {offers.length > 0 && <strong className="shop-pay-h">{t("shop.leasing")}</strong>}
          {offers.map((o) => (
            <button key={o.id} role="radio" aria-checked={offer?.id === o.id} className="shop-offer" onClick={() => setPay(o.id)}>
              <span className="shop-offer-top">
                <Logo provider={o.lessor} size={16} word />
                <span className="grow" />
                {o.total === best && <span className="pill accent">{t("shop.lowest")}</span>}
                <span className="num shop-markup">{pct(o.total, total)}</span>
              </span>
              <span className="shop-offer-terms num">
                <span>{t("shop.months", { n: o.months })}</span>
                <span>{t("shop.perMonth", { price: euro(o.monthly) })}</span>
                <span>{t("shop.totalOf", { price: euro(o.total) })}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="shop-cart-foot">
          <button className="btn primary" disabled={!pay} onClick={checkout}>{offer ? t("shop.leaseFor", { price: euro(offer.monthly) }) : t("shop.pay", { price: euro(total) })}</button>
        </div>
      </>}
    </aside>
  );
}
