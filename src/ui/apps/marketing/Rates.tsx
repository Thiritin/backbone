import { Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../../../i18n/en";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { marketRates, marketSetup, PRODUCTS, sizeSpec, specPrice, UNITS, type Unit } from "../../../sim/10-catalog/products";
import type { Product } from "../../../sim/30-customers/customers";
import { offerPrice } from "../../../sim/30-market/spec";
import type { GameState } from "../../../sim/50-state";
import { SITE_LINES } from "../../../sim/80-business/website";
import { resetRates, setRate } from "../../../sim/90-actions/rates";
import { useStore } from "../../store";
import { marketSide } from "../sales/PriceField";
import { PRODUCT } from "../support/labels";
import "../products/products.css";
import "../sales/sales.css";

const LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "gpu", "dedicated", "colocation", "domain", "ssl"];
const UNIT: Record<Unit | "setup", string> = {
  account: t("web.reseller.unitAccount"),
  base: t("marketing.unitBase"), vcpu: t("marketing.unitVcpu"), ramGb: t("marketing.unitRamGb"), diskGb: t("marketing.unitDiskGb"), mailbox: t("marketing.unitMailbox"), zone: t("marketing.unitZone"), user: t("marketing.unitUser"), unit: t("marketing.unitUnit"), kw: t("marketing.unitKw"), traffic: t("marketing.unitTraffic"), ip: t("marketing.unitIp"), gpu: t("marketing.unitGpu"), updates: t("marketing.unitUpdates"), updateOnce: t("marketing.unitUpdateOnce"), setup: t("marketing.unitSetup"),
};
// Rates below ten cents need a tenth of a cent, below one cent a hundredth.
const digits = (x: number) => (x <= 0 || x >= 0.1 ? 2 : x >= 0.01 ? 3 : 4);
const rate = (x: number) => (digits(x) > 2 ? `${x.toFixed(digits(x))} €` : euroCents(x));

// One rate: the player's euros per unit, the market's beside it.
function RateRow({ product, unit, mine, market }: { product: Product; unit: Unit | "setup"; mine: number | undefined; market: number }) {
  const act = useStore((s) => s.act);
  const [text, setText] = useState(mine === undefined ? "" : String(mine));
  useEffect(() => setText(mine === undefined ? "" : String(mine)), [mine]);
  const commit = () => {
    const v = text.trim() === "" ? null : Number(text.replace(",", "."));
    if (v === null ? mine !== undefined : v !== mine) act(setRate, product, unit, v);
  };
  const side = mine !== undefined && market > 0 ? marketSide(mine, market) : null;
  return (
    <div className="rate-row">
      <label htmlFor={`rate-${product}-${unit}`}>{UNIT[unit]}</label>
      <span className="price-input">
        <input id={`rate-${product}-${unit}`} type="number" min={0} step={0.0001} placeholder={market.toFixed(digits(market))} value={text}
          onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
        <span aria-hidden>€</span>
      </span>
      <span className="rate-ref">{t("marketing.market")} <span className="num">{rate(market)}</span></span>
      {side ? <span className={`pill ${side.cls}`}>{side.label}</span> : <span />}
    </div>
  );
}

export function Rates({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), year = yearOf(game.hour);
  return (
    <div className="prd-pad">
      <div className="prd-title"><Tags /><h2>{t("marketing.pricing")}</h2></div>
      <div className="rate-cards">
        {LINES.map((p) => {
          const mine = game.rates[p] ?? {}, market = marketRates(p, year), smallest = sizeSpec(p, 0, year);
          const per = (price: number) => t(PRODUCTS[p].period === "year" ? "marketing.priceYear" : "marketing.priceMonth", { price: euroCents(price) });
          return (
            <section key={p} className="fin-card">
              <div className="fin-card-h">
                {PRODUCT[p]}
                <span className="grow" />
                <button className="btn" disabled={!Object.keys(mine).length} onClick={() => act(resetRates, p)}>{t("marketing.marketRates")}</button>
              </div>
              <div className="fin-card-b">
                {UNITS[p].map((u) => <RateRow key={u} product={p} unit={u} mine={mine[u]} market={market[u] ?? 0} />)}
                {SITE_LINES.includes(p) && p !== "ssl" && <RateRow product={p} unit="setup" mine={mine.setup} market={marketSetup(p, year)} />}
                <dl className="rate-from">
                  <div><dt>{t("marketing.from")}</dt><dd className="num">{per(offerPrice(game, p, smallest))}</dd></div>
                  <div><dt>{t("marketing.marketFrom")}</dt><dd className="num">{per(specPrice(p, smallest, year))}</dd></div>
                </dl>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
