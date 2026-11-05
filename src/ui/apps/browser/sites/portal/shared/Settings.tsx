import { PTable } from "./ui";
import { t } from "../../../../../../i18n/en";
import { MARKET_DISCOUNT } from "../../../../../../sim/10-catalog/cycles";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { setOptionDiscount } from "../../../../../../sim/90-actions/portal";
import { useStore } from "../../../../../store";
import { CommitInput, toNumber } from "./CommitInput";
import { CYCLE_LABEL } from "./ProductEdit";
import type { ScreenProps } from "./nav";
import { GoLive } from "./GoLive";
import { NumberingStep } from "../../../../setup/SetupWizard";
import { PaymentMethods } from "./Payments";
import type { GameState } from "../../../../../../sim/50-state";

export type SettingsTab = "general" | "invoices" | "gateways" | "import";
const TABS: SettingsTab[] = ["general", "invoices", "gateways", "import"];
const TAB_LABEL: Record<SettingsTab, string> = { general: "shop-admin.d.general", invoices: "shop-admin.d.invoices", gateways: "shop-market.gateways", import: "shop-admin.d.import" };

// Shop settings in tabs: the setup wizard and cycle discounts, the invoice number format, the payment gateways and the customer import.
export function Settings({ game, go, tab }: ScreenProps & { tab: SettingsTab }) {
  return (
    <div className="pt-screen">
      <div className="pt-tabs" role="tablist">
        {TABS.map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go({ name: "settings", tab: k })}>{t(TAB_LABEL[k])}</button>)}
      </div>
      {tab === "general" && <>
        <section><h3>{t("shop-admin.cycleDiscounts")}</h3><CycleDiscounts game={game} /></section>
      </>}
      {tab === "invoices" && <NumberingStep game={game} />}
      {tab === "gateways" && <PaymentMethods game={game} />}
      {tab === "import" && <section><h3>{t("setup.golive.title")}</h3><GoLive game={game} /></section>}
    </div>
  );
}

export function CycleDiscounts({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const v = shopById(game.shop.variant!);
  return (
        <PTable>
          <thead><tr><th /><th>{t("shop-admin.d.yourDiscount")}</th><th>{t("shop-admin.d.marketAvg")}</th></tr></thead>
          <tbody>
            {v.cycles.filter((c) => c !== "monthly").map((c) => (
              <tr key={c}>
                <th scope="row">{CYCLE_LABEL[c]}</th>
                <td>
                  <CommitInput className="num" type="number" min={0} max={50} step={0.1} aria-label={CYCLE_LABEL[c]}
                    value={String(Math.round((game.shop.optionDiscount[c] ?? 0) * 1000) / 10)}
                    onCommit={(x) => { const n = toNumber(x); act(setOptionDiscount, c, n === null ? null : n / 100); }} /> %
                </td>
                <td className="num">{MARKET_DISCOUNT[c] * 100} %</td>
              </tr>
            ))}
          </tbody>
        </PTable>
  );
}
