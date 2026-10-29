import { Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { marketRates, PRODUCTS, sizeSpec, specPrice, UNITS, type Unit } from "../../../sim/10-catalog/products";
import type { Product } from "../../../sim/30-customers/customers";
import { offerPrice } from "../../../sim/30-market/spec";
import type { GameState } from "../../../sim/50-state";
import { resetRates, setRate } from "../../../sim/90-actions/rates";
import { useStore } from "../../store";
import { marketSide } from "../sales/PriceField";
import { PRODUCT } from "../support/labels";

const LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "dedicated", "colocation", "domain", "ssl"];
const UNIT: Record<Unit, string> = { base: "Base fee", vcpu: "Per vCPU", ramGb: "Per GB RAM", diskGb: "Per GB disk", mailbox: "Per mailbox", unit: "Per rack unit", kw: "Per kW" };
// Rates below ten cents need a tenth of a cent.
const fine = (x: number) => x > 0 && x < 0.1;
const rate = (x: number) => (fine(x) ? `€${x.toFixed(3)}` : euroCents(x));

// One rate: the player's euros per unit, the market's beside it.
function RateRow({ product, unit, mine, market }: { product: Product; unit: Unit; mine: number | undefined; market: number }) {
  const act = useStore((s) => s.act);
  const [text, setText] = useState(mine === undefined ? "" : String(mine));
  useEffect(() => setText(mine === undefined ? "" : String(mine)), [mine]);
  const commit = () => {
    const v = text.trim() === "" ? null : Number(text.replace(",", "."));
    if (v === null ? mine !== undefined : v !== mine) act((s) => setRate(s, product, unit, v));
  };
  const side = mine !== undefined && market > 0 ? marketSide(mine, market) : null;
  return (
    <div className="rate-row">
      <label htmlFor={`rate-${product}-${unit}`}>{UNIT[unit]}</label>
      <span className="price-input">
        <span aria-hidden>€</span>
        <input id={`rate-${product}-${unit}`} type="number" min={0} step={0.001} placeholder={market.toFixed(fine(market) ? 3 : 2)} value={text}
          onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
      </span>
      <span className="rate-ref">Market <span className="num">{rate(market)}</span></span>
      {side ? <span className={`pill ${side.cls}`}>{side.label}</span> : <span />}
    </div>
  );
}

export function Rates({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), year = yearOf(game.hour);
  return (
    <div className="prd-pad">
      <div className="prd-title"><Tags /><h2>Pricing</h2></div>
      <div className="rate-cards">
        {LINES.map((p) => {
          const mine = game.rates[p] ?? {}, market = marketRates(p, year), smallest = sizeSpec(p, 0, year);
          const per = PRODUCTS[p].period === "year" ? "a year" : "a month";
          return (
            <section key={p} className="fin-card">
              <div className="fin-card-h">
                {PRODUCT[p]}
                <span className="grow" />
                <button className="btn" disabled={!Object.keys(mine).length} onClick={() => act((s) => resetRates(s, p))}>Market rates</button>
              </div>
              <div className="fin-card-b">
                {UNITS[p].map((u) => <RateRow key={u} product={p} unit={u} mine={mine[u]} market={market[u] ?? 0} />)}
                <dl className="rate-from">
                  <div><dt>From</dt><dd className="num">{euroCents(offerPrice(game, p, smallest))} {per}</dd></div>
                  <div><dt>Market from</dt><dd className="num">{euroCents(specPrice(p, smallest, year))} {per}</dd></div>
                </dl>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
