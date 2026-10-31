import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { modelById, modelName, type FormFactor } from "../../../sim/10-catalog/hardware";
import { skuById } from "../../../sim/10-catalog/cpus";
import { VENDOR_NAME } from "../../../sim/10-catalog/cpus";
import { leaseOffers } from "../../../sim/10-catalog/leasing";
import { REGIONS } from "../../../sim/20-world/datacenters";
import { buyCart, deliveryWait, unitPrice } from "../../../sim/90-actions/hardware";
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
  const [pay, setPay] = useState("cash");
  const openLoc = useStore((s) => s.openLoc);
  const [to, setTo] = useState<string | null>(null);
  const dest = game.locations.find((l) => l.id === (to ?? openLoc)) ?? game.locations[0];
  const wait = deliveryWait(game, cart), year = yearOf(game.hour), total = cart.reduce((n, l) => n + unitPrice(l, year) * l.qty, 0), units = cart.reduce((n, l) => n + l.qty, 0);
  const offers = total ? leaseOffers(game, total) : [];
  const offer = offers.find((o) => o.id === pay);
  const best = Math.min(...offers.map((o) => o.total));
  const checkout = () => {
    const r = act(buyCart, cart, offer ? { kind: "lease", offerId: offer.id } : { kind: "cash" }, dest.id);
    if (!r.ok) return;
    clearCart();
    setPay("cash");
    notify("Shop", wait ? t("shop.orderedFor", { az: dest.az }) : t("shop.addedToStorage", { az: dest.az }), t("shop.units", { n: units }));
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
          <button role="radio" aria-checked={!offer} className="shop-offer" onClick={() => setPay("cash")}>
            <strong>{t("shop.payNow")}</strong><span className="grow" /><span className="num">{euro(total)}</span>
          </button>
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
          <button className="btn primary" onClick={checkout}>{offer ? t("shop.leaseFor", { price: euro(offer.monthly) }) : t("shop.pay", { price: euro(total) })}</button>
        </div>
      </>}
    </aside>
  );
}
