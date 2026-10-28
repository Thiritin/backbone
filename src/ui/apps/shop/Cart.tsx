import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { modelById, priceOf } from "../../../sim/10-catalog/hardware";
import { leaseOffers } from "../../../sim/10-catalog/leasing";
import { REGIONS } from "../../../sim/20-world/datacenters";
import { buyCart } from "../../../sim/90-actions/hardware";
import { Isometric } from "../../art/Isometric";
import { Logo } from "../../art/logos";
import { useStore } from "../../store";

export function Stepper({ value, onChange, min = 0, step = 1, label = "Quantity" }: { value: number; onChange: (n: number) => void; min?: number; step?: number; label?: string }) {
  return (
    <div className="shop-qty" role="group" aria-label={label}>
      <button className="btn icon" aria-label="Fewer" disabled={value - step < min} onClick={() => onChange(value - step)}><Minus /></button>
      <span className="num">{value}</span>
      <button className="btn icon" aria-label="More" onClick={() => onChange(value + step)}><Plus /></button>
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
  const total = cart.reduce((n, l) => n + priceOf(modelById(l.model), l.brand) * l.qty, 0), units = cart.reduce((n, l) => n + l.qty, 0);
  const offers = total ? leaseOffers(game, total) : [];
  const offer = offers.find((o) => o.id === pay);
  const best = Math.min(...offers.map((o) => o.total));
  const checkout = () => {
    const r = act((s) => buyCart(s, cart, offer ? { kind: "lease", offerId: offer.id } : { kind: "cash" }, dest.id));
    if (!r.ok) return;
    clearCart();
    setPay("cash");
    notify("Shop", `Added to storage in ${dest.az}`, `${units} ${units === 1 ? "unit" : "units"}`);
  };

  return (
    <aside className="shop-cart" aria-label="Cart">
      <div className="shop-cart-h"><h3>Cart</h3><span className="grow" /><span className="num shop-muted">{units}</span></div>
      <div className="shop-cart-list">
        {cart.map((l) => {
          const m = modelById(l.model);
          return (
            <div key={`${l.model}|${l.brand}`} className="shop-line">
              <Isometric model={m} brand={l.brand} w={56} />
              <div className="shop-line-name"><strong>{m.name}</strong><span>{l.brand}</span></div>
              <Stepper value={l.qty} min={1} onChange={(n) => setCartQty(l.model, l.brand, n)} />
              <span className="num shop-line-total">{euro(priceOf(m, l.brand) * l.qty)}</span>
              <button className="btn ghost icon" aria-label={`Remove ${m.name}`} onClick={() => setCartQty(l.model, l.brand, 0)}><X /></button>
            </div>
          );
        })}
        {!cart.length && <div className="shop-none">Empty</div>}
      </div>
      {cart.length > 0 && <>
        <div className="shop-dest" role="group" aria-label="Deliver to">
          <span>Deliver to</span>
          <div className="picks">
            {REGIONS.flatMap((r) => game.locations.filter((l) => l.city === r.city)).map((l) => (
              <button key={l.id} className="pick" aria-pressed={l.id === dest.id} onClick={() => setTo(l.id)}>
                <strong>{l.name}</strong><span className="sub num">{l.az}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="shop-cart-total"><span>Total</span><span className="grow" /><strong className="num">{euro(total)}</strong></div>
        <div className="shop-pay" role="radiogroup" aria-label="Payment">
          <button role="radio" aria-checked={!offer} className="shop-offer" onClick={() => setPay("cash")}>
            <strong>Pay now</strong><span className="grow" /><span className="num">{euro(total)}</span>
          </button>
          {offers.map((o) => (
            <button key={o.id} role="radio" aria-checked={offer?.id === o.id} className="shop-offer" onClick={() => setPay(o.id)}>
              <span className="shop-offer-top">
                <Logo provider={o.lessor} size={16} word />
                <span className="grow" />
                {o.total === best && <span className="pill accent">Lowest</span>}
                <span className="num shop-markup">{pct(o.total, total)}</span>
              </span>
              <span className="shop-offer-terms num">
                <span>{o.months} months</span>
                <span>{euro(o.monthly)} / month</span>
                <span>{euro(o.total)} total</span>
              </span>
            </button>
          ))}
        </div>
        <div className="shop-cart-foot">
          <button className="btn primary" onClick={checkout}>{offer ? `Lease for ${euro(offer.monthly)} / month` : `Pay ${euro(total)}`}</button>
        </div>
      </>}
    </aside>
  );
}
