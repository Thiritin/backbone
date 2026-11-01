import { t } from "../../../../../../i18n/en";
import type { Product } from "../../../../../../sim/30-customers/customers";
import type { GameState } from "../../../../../../sim/50-state";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { stockOf, type Stock } from "../../../../../../sim/80-business/shop";
import { setStock } from "../../../../../../sim/90-actions/shop";
import { useStore } from "../../../../../store";
import { PRODUCT } from "../../../../support/labels";
import "../../../../marketing/marketing.css";

// Units on offer per line, for lines sold through configurable options.
export function LineStock({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const v = shopById(game.shop.variant!);
  const pick = (p: Product, value: string) => act(setStock, p, (value === "auto" || value === "off" ? value : Math.max(0, Math.floor(Number(value) || 0))) as Stock);
  return (
    <div className="mkt-list">
      <div className="side-h">{t("marketing.stock")}</div>
      {game.marketing.lines.map((p) => {
        const n = stockOf(game, p), soldOut = game.shop.soldOut[p] ?? 0;
        return (
          <div key={p} className="mkt-row">
            <span className="mkt-label">{PRODUCT[p]}</span>
            <span className="mkt-grow">{soldOut > 0 && <span className="mkt-sub">{t("marketing.soldOutThisMonth", { n: soldOut })}</span>}</span>
            <div className="seg" role="group" aria-label={t("marketing.stockOf", { product: PRODUCT[p] })}>
              <button aria-pressed={n === "off"} onClick={() => pick(p, "off")}>{t("marketing.off")}</button>
              {v.autoStock && <button aria-pressed={n === "auto"} onClick={() => pick(p, "auto")}>{t("marketing.freeCapacity")}</button>}
              <button aria-pressed={typeof n === "number"} onClick={() => typeof n !== "number" && pick(p, "10")}>{t("marketing.units")}</button>
            </div>
            {typeof n === "number" && <input className="num" type="number" min={0} step={1} style={{ width: "5em" }} aria-label={t("marketing.unitsOf", { product: PRODUCT[p] })} value={n} onChange={(e) => pick(p, e.target.value)} />}
          </div>
        );
      })}
    </div>
  );
}
