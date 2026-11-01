import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { euro } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { HARDWARE_MODULES, includes, moduleName, shopById } from "../../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../../sim/50-state";
import { hasModule } from "../../../../../../sim/80-business/shop";
import { buyModule } from "../../../../../../sim/90-actions/shop";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import "../../../../marketing/marketing.css";

const HARDWARE_NAME: Record<(typeof HARDWARE_MODULES)[number], string> = { registrar: t("marketing.hwDomains"), ssl: t("marketing.hwCertificates"), dedicated: t("marketing.hwDedicated"), colo: t("marketing.hwColo") };

// Modules for the software the company runs and for the hardware side.
export function Modules({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const v = game.shop.variant && shopById(game.shop.variant), year = yearOf(game.hour);
  const software = [...new Set(game.clusters.map((c) => c.panel ?? c.platform).filter((x): x is string => !!x))];
  const cost = v ? v.extra : null;
  return (
    <div className="mkt-list">
      <div className="side-h">{t("marketing.modules")}</div>
      {[...software, ...HARDWARE_MODULES].map((m) => {
        const bought = game.shop.modules[m];
        let state: ReactNode;
        if (v && includes(v, m, year)) state = <span className="pill ok">{t("marketing.included")}</span>;
        else if (hasModule(game, m)) state = <span className="pill ok">{t("marketing.installed")}</span>;
        else if (bought !== undefined) state = <span className="pill">{t("marketing.readyDay", { day: formatDay(bought) })}</span>;
        else if (cost === null) state = <span className="pill">{t("marketing.notAvailable")}</span>;
        else state = <button className="btn" disabled={cost > 0 && game.cash < cost} onClick={() => act(buyModule, m)}>{cost ? <>{t("marketing.buy")} <span className="num">{euro(cost)}</span></> : t("marketing.integrate")}</button>;
        return (
          <div key={m} className="mkt-row">
            <span className="mkt-grow">{(HARDWARE_NAME as Record<string, string>)[m] ?? moduleName(m)}</span>
            {state}
          </div>
        );
      })}
    </div>
  );
}
