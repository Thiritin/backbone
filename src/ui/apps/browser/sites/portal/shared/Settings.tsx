import { t } from "../../../../../../i18n/en";
import { MARKET_DISCOUNT } from "../../../../../../sim/10-catalog/cycles";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { setOptionDiscount } from "../../../../../../sim/90-actions/portal";
import { useStore } from "../../../../../store";
import { CommitInput, toNumber } from "./CommitInput";
import { CYCLE_LABEL } from "./ProductEdit";
import type { ScreenProps } from "./nav";
import type { GameState } from "../../../../../../sim/50-state";

// Shop settings: the setup wizard and the discount per billing cycle that prices products with automatic cycle prices.
export function Settings({ game, go }: ScreenProps) {
  return (
    <div className="pt-screen">
      <p><button className="btn" onClick={() => go({ name: "setup" })}>{t("setup.title")}</button></p>
      <section>
        <h3>{t("shop-admin.cycleDiscounts")}</h3>
        <CycleDiscounts game={game} />
      </section>
    </div>
  );
}

export function CycleDiscounts({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const v = shopById(game.shop.variant!);
  return (
        <table className="pt-table">
          <tbody>
            {v.cycles.filter((c) => c !== "monthly").map((c) => (
              <tr key={c}>
                <th scope="row">{CYCLE_LABEL[c]}</th>
                <td>
                  <CommitInput className="num" type="number" min={0} max={50} step={0.1} aria-label={CYCLE_LABEL[c]}
                    value={String(Math.round((game.shop.optionDiscount[c] ?? 0) * 1000) / 10)}
                    onCommit={(x) => { const n = toNumber(x); act(setOptionDiscount, c, n === null ? null : n / 100); }} /> %
                </td>
                <td className="num">{t("shop-admin.market")} {MARKET_DISCOUNT[c] * 100} %</td>
              </tr>
            ))}
          </tbody>
        </table>
  );
}
