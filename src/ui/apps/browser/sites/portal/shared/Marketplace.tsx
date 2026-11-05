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
import type { ScreenProps } from "./nav";
import { PBadge, PBody, PBtn, PTable } from "./ui";

const HARDWARE_NAME: Record<(typeof HARDWARE_MODULES)[number], string> = { registrar: t("marketing.hwDomains"), ssl: t("marketing.hwCertificates"), dedicated: t("marketing.hwDedicated"), colo: t("marketing.hwColo") };
const Row = ({ name, price, children }: { name: string; price?: number; children: ReactNode }) => <tr><td>{name}</td><td className="num">{price ? euro(price) : ""}</td><td className="pt-act">{children}</td></tr>;
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="pt-group"><h3 className="pt-group-h">{title}</h3><PTable><thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-admin.price")}</th><th>{t("shop-admin.status")}</th></tr></thead><PBody>{children}</PBody></PTable></section>
);

// Modules and payment gateways in two tabs: what a module costs and what the shop already has. Gateways and the Books link are
// bought on the vendor's site and registered with their key.
export type MarketTerms = "exec" | "box";
export function Marketplace({ game, go, tab, terms }: { game: GameState; go: ScreenProps["go"]; tab: "modules" | "gateways"; terms?: MarketTerms }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const id = game.shop.variant;
  if (!id) return null;
  const v = shopById(id), year = yearOf(game.hour);
  const released = (m: string) => !SOFTWARE.some((x) => x.id === m) || !versionsOf(m).length || releasedAt(m, game.hour).length > 0;
  const installed = (m: string) => moduleOffer(v, m, year) === "included" || hasModule(game, m);
  const provisioning = (m: string) => {
    const offer = moduleOffer(v, m, year), bought = game.shop.modules[m];
    if (installed(m)) return <PBadge tone="ok">{t(offer === "included" ? "marketing.included" : "marketing.installed")}</PBadge>;
    if (bought !== undefined) return <PBadge>{t("marketing.readyDay", { day: formatDay(bought) })}</PBadge>;
    if (offer === "unavailable" || offer === "included") return <PBadge>{t("marketing.notAvailable")}</PBadge>;
    return <PBtn disabled={offer > 0 && game.cash < offer} onClick={() => act(buyModule, m)}>{offer ? t("marketing.buy") : t(terms === "box" ? "shop-admin.d.activate" : "marketing.integrate")}</PBtn>;
  };
  const licensed = (m: (typeof MODULES)[number]) => registered(game, m.id)
    ? <PBadge tone="ok">{t("marketing.installed")}</PBadge>
    : <PBtn onClick={() => openApp("Browser", { kind: "url", id: shopVendorUrl(id) })}>{t("vendor-sites.viewModule")}</PBtn>;
  const sold = MODULES.filter((m) => m.year <= year);
  const mods = MODULE_IDS.filter(released), name = (m: string) => (HARDWARE_NAME as Record<string, string>)[m] ?? moduleName(m);
  const link = sold.filter((m) => m.id === "shop-link");
  return (
    <div className="pt-screen">
      <div className="pt-tabs" role="tablist">
        {(["modules", "gateways"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go({ name: "marketplace", tab: k })}>{t(terms === "exec" ? (k === "modules" ? "shop-admin.d.tabServices" : "shop-admin.d.tabGateways") : k === "modules" ? "shop-admin.d.modules" : "shop-market.gateways")}</button>)}
      </div>
      {tab === "modules" && <>
        <Section title={t("marketing.installed")}>{mods.filter(installed).map((m) => <Row key={m} name={name(m)} price={typeof moduleOffer(v, m, year) === "number" ? (moduleOffer(v, m, year) as number) : 0}>{provisioning(m)}</Row>)}</Section>
        <Section title={t("shop-admin.d.available")}>{mods.filter((m) => !installed(m)).map((m) => <Row key={m} name={name(m)} price={typeof moduleOffer(v, m, year) === "number" ? (moduleOffer(v, m, year) as number) : 0}>{provisioning(m)}</Row>)}</Section>
        {link.length > 0 && <Section title={t("shop-market.integrations")}>{link.map((m) => <Row key={m.id} name={t("vendor-sites.module.shop-link")} price={m.price}>{licensed(m)}</Row>)}</Section>}
      </>}
      {tab === "gateways" && <Section title={t("shop-market.gateways")}>{sold.filter((m) => m.id !== "shop-link").map((m) => <Row key={m.id} name={methodName(m.id as MethodId)} price={m.price}>{licensed(m)}</Row>)}</Section>}
    </div>
  );
}
