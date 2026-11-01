import type { ReactNode } from "react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { HARDWARE_MODULES, includes, moduleName, shopById, SHOPS, type ShopId } from "../../../sim/10-catalog/shops";
import type { GameState } from "../../../sim/50-state";
import { companyDomain } from "../../../sim/30-customers/domains";
import { hasModule, shopActive } from "../../../sim/80-business/shop";
import { buyModule, chooseShop } from "../../../sim/90-actions/shop";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";

const ABOUT: Record<ShopId, string> = {
  handRolled: t("marketing.aboutHandRolled"),
  modemBill: t("marketing.aboutModemBill"),
  clientExit: t("marketing.aboutClientExit"),
  whmCache: t("marketing.aboutWhmCache"),
  blessta: t("marketing.aboutBlessta"),
  hostBull: t("marketing.aboutHostBull"),
  ubersmyth: t("marketing.aboutUbersmyth"),
  orderBocks: t("marketing.aboutOrderBocks"),
  boxBillin: t("marketing.aboutBoxBillin"),
};
const HARDWARE_NAME: Record<(typeof HARDWARE_MODULES)[number], string> = { registrar: t("marketing.hwDomains"), ssl: t("marketing.hwCertificates"), dedicated: t("marketing.hwDedicated"), colo: t("marketing.hwColo") };

const price = (id: ShopId): string => {
  const v = shopById(id);
  if (v.cut) return t("marketing.priceCut", { pct: Math.round(v.cut * 100) });
  const parts = [v.setup > 0 && t("marketing.priceOnce", { price: euro(v.setup) }), v.monthly > 0 && (v.perServer ? t("marketing.priceMonthlyPerServer", { price: euro(v.monthly), perServer: euro(v.perServer) }) : t("marketing.slashMonth", { price: euro(v.monthly) })), v.yearly > 0 && t("marketing.priceYearly", { price: euro(v.yearly) })];
  return parts.filter(Boolean).join(", ") || t("marketing.free");
};

export function Shop({ game }: { game: GameState }) {
  const openApp = useStore((s) => s.openApp);
  const v = game.shop.variant && shopById(game.shop.variant);
  return <>
    <div className="mkt-list">
      <div className="mkt-row">
        <span className="mkt-label">{t("marketing.orders")}</span>
        <span className="mkt-grow">{v ? (v.id === "handRolled" ? t("marketing.selfScriptedOrderForm") : v.name) : t("marketing.email")}</span>
        {v && (shopActive(game) ? <span className="pill ok">{t("marketing.takingOrders")}</span> : <span className="pill">{t("marketing.readyDay", { day: formatDay(game.shop.readyAt) })}</span>)}
        {shopActive(game) && <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: `portal.${companyDomain(game)}/admin` })}>{t("shop-admin.openAdmin")}</button>}
      </div>
    </div>
    <Variants game={game} />
    {v && <Modules game={game} />}
  </>;
}

function Variants({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour);
  return (
    <div className="shop-grid mkt-flat">
      {SHOPS.filter((v) => year >= v.from && (v.id === "handRolled" || game.unlocks.includes("shops"))).map((v) => {
        const used = game.shop.variant === v.id, sold = v.until === undefined || year <= v.until;
        let state: ReactNode;
        if (used) state = <span className="pill ok">{t("marketing.inUse")}</span>;
        else if (!sold) state = <span className="pill">{t("marketing.discontinued")}</span>;
        else state = <>
          {v.own && <button className="btn" disabled={game.cash < v.own.price} onClick={() => act(chooseShop, v.id, true)}>{t("marketing.buy")} <span className="num">{euro(v.own.price)}</span></button>}
          <button className="btn primary" disabled={game.cash < v.setup} onClick={() => act(chooseShop, v.id)}>{v.own ? t("marketing.lease") : t("marketing.choose")}</button>
        </>;
        return (
          <div key={v.id} className="shop-card">
            <div className="shop-name"><strong>{v.name}</strong><span>{ABOUT[v.id]}</span></div>
            <dl className="shop-specs">
              <div><dt>{t("marketing.price")}</dt><dd className="num">{price(v.id)}</dd></div>
              <div><dt>{t("marketing.modules")}</dt><dd className="num">{v.extra === null ? t("marketing.includedOnly") : v.extra === 0 ? t("marketing.free") : t("marketing.priceEach", { price: euro(v.extra) })}</dd></div>
            </dl>
            <div className="shop-buy"><span className="grow" />{state}</div>
          </div>
        );
      })}
    </div>
  );
}

// Modules for the software the company runs and for the hardware side.
function Modules({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const v = game.shop.variant && shopById(game.shop.variant), year = yearOf(game.hour);
  const software = [...new Set(game.clusters.map((c) => c.panel ?? c.platform).filter((x): x is string => !!x))];
  const cost = v ? v.extra : null;
  return (
    <div className="mkt-list">
      <div className="side-h">{v && v.id !== "handRolled" ? t("marketing.modules") : t("marketing.customScripts")}</div>
      {[...software, ...HARDWARE_MODULES].map((m) => {
        const bought = game.shop.modules[m];
        let state: ReactNode;
        if (v && includes(v, m, year)) state = <span className="pill ok">{t("marketing.included")}</span>;
        else if (hasModule(game, m)) state = <span className="pill ok">{t("marketing.installed")}</span>;
        else if (bought !== undefined) state = <span className="pill">{t("marketing.readyDay", { day: formatDay(bought) })}</span>;
        else if (cost === null) state = <span className="pill">{t("marketing.notAvailable")}</span>;
        else state = <button className="btn" disabled={game.cash < cost} onClick={() => act(buyModule, m)}>{cost ? <>{t("marketing.buy")} <span className="num">{euro(cost)}</span></> : t("marketing.integrate")}</button>;
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
