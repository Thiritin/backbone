import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { euro } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { hasModule as registered, MODULES } from "../../../../../../sim/10-catalog/modules";
import type { MethodId } from "../../../../../../sim/10-catalog/payments";
import { SOFTWARE } from "../../../../../../sim/10-catalog/platforms";
import { HARDWARE_MODULES, moduleName, moduleOffer, MODULE_IDS, shopById } from "../../../../../../sim/10-catalog/shops";
import { releasedAt, versionsOf } from "../../../../../../sim/10-catalog/software-versions";
import type { GameState } from "../../../../../../sim/50-state";
import { hasModule } from "../../../../../../sim/80-business/shop";
import { shopVendorUrl } from "../../../../../../sim/80-business/shoplink";
import { buyModule } from "../../../../../../sim/90-actions/shop";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import { methodName } from "../../../../marketing/payments";
import "../../../../marketing/marketing.css";

const HARDWARE_NAME: Record<(typeof HARDWARE_MODULES)[number], string> = { registrar: t("marketing.hwDomains"), ssl: t("marketing.hwCertificates"), dedicated: t("marketing.hwDedicated"), colo: t("marketing.hwColo") };
const Pill = ({ ok, children }: { ok?: boolean; children: ReactNode }) => <span className={ok ? "pill ok" : "pill"}>{children}</span>;
const Row = ({ name, children }: { name: string; children: ReactNode }) => <div className="mkt-row"><span className="mkt-grow">{name}</span>{children}</div>;

// Apps & Integrations: the provisioning modules, payment gateways and the Books link, each included, for sale or not offered by
// this shop system. Gateways and the Books link are bought on the vendor's site and registered with their key.
export function Marketplace({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const id = game.shop.variant;
  if (!id) return null;
  const v = shopById(id), year = yearOf(game.hour);
  const released = (m: string) => !SOFTWARE.some((x) => x.id === m) || !versionsOf(m).length || releasedAt(m, game.hour).length > 0;
  const provisioning = (m: string) => {
    const offer = moduleOffer(v, m, year), bought = game.shop.modules[m];
    if (offer === "included") return <Pill ok>{t("marketing.included")}</Pill>;
    if (hasModule(game, m)) return <Pill ok>{t("marketing.installed")}</Pill>;
    if (bought !== undefined) return <Pill>{t("marketing.readyDay", { day: formatDay(bought) })}</Pill>;
    if (offer === "unavailable") return <Pill>{t("marketing.notAvailable")}</Pill>;
    return <button className="btn" disabled={offer > 0 && game.cash < offer} onClick={() => act(buyModule, m)}>{offer ? <>{t("marketing.buy")} <span className="num">{euro(offer)}</span></> : t("marketing.integrate")}</button>;
  };
  const licensed = (m: (typeof MODULES)[number]) => registered(game, m.id)
    ? <Pill ok>{t("marketing.installed")}</Pill>
    : <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: shopVendorUrl(id) })}><span className="num">{euro(m.price)}</span> {t("vendor-sites.viewModule")}</button>;
  const sold = MODULES.filter((m) => m.year <= year);
  return (
    <div className="pt-screen">
      <div className="mkt-list">
        <div className="side-h">{t("shop-market.provisioning")}</div>
        {MODULE_IDS.filter(released).map((m) => <Row key={m} name={(HARDWARE_NAME as Record<string, string>)[m] ?? moduleName(m)}>{provisioning(m)}</Row>)}
      </div>
      <div className="mkt-list">
        <div className="side-h">{t("shop-market.gateways")}</div>
        {sold.filter((m) => m.id !== "shop-link").map((m) => <Row key={m.id} name={methodName(m.id as MethodId)}>{licensed(m)}</Row>)}
      </div>
      <div className="mkt-list">
        <div className="side-h">{t("shop-market.integrations")}</div>
        {sold.filter((m) => m.id === "shop-link").map((m) => <Row key={m.id} name={t("vendor-sites.module.shop-link")}>{licensed(m)}</Row>)}
      </div>
    </div>
  );
}
