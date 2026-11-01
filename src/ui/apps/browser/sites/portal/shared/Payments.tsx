import { t } from "../../../../../../i18n/en";
import { yearOf } from "../../../../../../sim/00-core/time";
import { hasModule } from "../../../../../../sim/10-catalog/modules";
import { PAYMENT_METHODS } from "../../../../../../sim/10-catalog/payments";
import type { GameState } from "../../../../../../sim/50-state";
import { shopVendorUrl } from "../../../../../../sim/80-business/shoplink";
import { setPaymentMethod } from "../../../../../../sim/90-actions/shoplink";
import { useStore } from "../../../../../store";
import { feeText, methodName } from "../../../../marketing/payments";
import "../../../../marketing/marketing.css";

// The shop's checkout: bank transfer always, every other method of the year once its module is registered.
export function PaymentMethods({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const year = yearOf(game.hour);
  return (
    <div className="mkt-list">
      <div className="side-h">{t("payment-methods.title")}</div>
      {PAYMENT_METHODS.filter((m) => m.year <= year).map((m) => (
        <div key={m.id} className="mkt-row">
          <span className="mkt-grow">{methodName(m.id)}</span>
          <span className="num">{feeText(m)}</span>
          {m.id === "transfer" ? <span className="pill ok">{t("payment-methods.on")}</span>
            : hasModule(game, m.id)
              ? <input type="checkbox" role="switch" className="switch" aria-label={t("payment-methods.accept", { method: methodName(m.id) })}
                checked={!game.shop.methodsOff.includes(m.id)} onChange={(e) => act(setPaymentMethod, m.id, e.target.checked)} />
              : <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: shopVendorUrl(game.shop.variant!) })}>{t("vendor-sites.viewModule")}</button>}
        </div>
      ))}
    </div>
  );
}
