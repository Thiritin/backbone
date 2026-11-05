import { t } from "../../../../../../i18n/en";
import { yearOf } from "../../../../../../sim/00-core/time";
import { hasModule } from "../../../../../../sim/10-catalog/modules";
import { PAYMENT_METHODS } from "../../../../../../sim/10-catalog/payments";
import type { GameState } from "../../../../../../sim/50-state";
import { shopVendorUrl } from "../../../../../../sim/80-business/shoplink";
import { setPaymentMethod } from "../../../../../../sim/90-actions/shoplink";
import { useStore } from "../../../../../store";
import { feeText, methodName } from "../../../../marketing/payments";
import { PBadge, PBtn, PCheck, PTable } from "./ui";

// The shop's checkout: bank transfer always, every other method of the year once its module is registered.
export function PaymentMethods({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const year = yearOf(game.hour);
  return (
    <PTable>
      <thead><tr><th>{t("payment-methods.title")}</th><th>{t("payment-methods.fee")}</th><th /></tr></thead>
      <tbody>
        {PAYMENT_METHODS.filter((m) => m.year <= year).map((m) => (
          <tr key={m.id}>
            <td>{methodName(m.id)}</td>
            <td className="num">{feeText(m)}</td>
            <td className="pt-act">
              {m.id === "transfer" ? <PBadge tone="ok">{t("payment-methods.on")}</PBadge>
                : hasModule(game, m.id)
                  ? <PCheck aria-label={t("payment-methods.accept", { method: methodName(m.id) })} checked={!game.shop.methodsOff.includes(m.id)} onChange={(e) => act(setPaymentMethod, m.id, e.target.checked)} />
                  : <PBtn onClick={() => openApp("Browser", { kind: "url", id: shopVendorUrl(game.shop.variant!) })}>{t("vendor-sites.viewModule")}</PBtn>}
            </td>
          </tr>
        ))}
      </tbody>
    </PTable>
  );
}
