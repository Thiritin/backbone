import { t } from "../../../../../../i18n/en";
import { MARKET_DISCOUNT } from "../../../../../../sim/10-catalog/cycles";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { setOptionDiscount } from "../../../../../../sim/90-actions/portal";
import { useStore } from "../../../../../store";
import { CommitInput, toNumber } from "./CommitInput";
import { CYCLE_LABEL } from "./ProductEdit";
import { LineStock } from "./LineStock";
import { Rates } from "./Rates";
import type { ScreenProps } from "./nav";

// Per-unit rates for lines without a product, the discount per billing cycle, and the stock of those lines.
export function Options({ game }: ScreenProps) {
  const act = useStore((s) => s.act);
  const v = shopById(game.shop.variant!);
  return (
    <div className="pt-screen">
      <section>
        <h3>{t("shop-admin.billingCycles")}</h3>
        <table className="pt-table">
          <tbody>
            {v.cycles.filter((c) => c !== "monthly").map((c) => (
              <tr key={c}>
                <th scope="row">{CYCLE_LABEL[c]}</th>
                <td>
                  <CommitInput className="num" type="number" min={0} max={50} step={0.1} aria-label={CYCLE_LABEL[c]} placeholder={String(MARKET_DISCOUNT[c] * 100)}
                    value={game.shop.optionDiscount[c] === undefined ? "" : String(Math.round(game.shop.optionDiscount[c]! * 1000) / 10)}
                    onCommit={(x) => { const n = toNumber(x); act(setOptionDiscount, c, n === null ? null : n / 100); }} /> %
                </td>
                <td className="num">{t("shop-admin.market")} {MARKET_DISCOUNT[c] * 100} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Rates game={game} />
      <LineStock game={game} />
    </div>
  );
}
