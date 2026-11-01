import type { ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { hasModule, MODULES, type Module } from "../../../../../sim/10-catalog/modules";
import { methodById, type MethodId } from "../../../../../sim/10-catalog/payments";
import { feeText } from "../../../marketing/payments";
import { shopById, type ShopId } from "../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../sim/50-state";
import { bought } from "../../../../../sim/80-business/licences";
import { buyShopLink } from "../../../../../sim/90-actions/shoplink";
import "./shopvendors.css";
import { usePageAct } from "../../pageAct";

export interface VendorProps { game: GameState; path?: string; go?: (url: string) => void }

// The page every shop vendor sells its modules on, Shop link and the payment methods of the year; each vendor's file
// gives it its colours and wordmark.
export function VendorPage({ game, id, className, mark }: VendorProps & { id: ShopId; className: string; mark: ReactNode }) {
  const act = usePageAct();
  const v = shopById(id), year = yearOf(game.hour);
  const modules = MODULES.filter((m) => m.vendor === "shop" && m.year <= year);
  const state = (m: Module) => hasModule(game, m.id) && game.shop.variant === id ? <span className="sv-state">{t("vendor-sites.registered")}</span>
    : bought(game, m.id) ? <span className="sv-state">{t("vendor-sites.bought")}</span>
    : <button type="button" className="sv-buy" onClick={() => act(buyShopLink, id, m.id)}>{t("vendor-sites.buy")}</button>;
  return (
    <div className={`sv ${className}`}>
      <div className="sv-page">
        <header className="sv-head"><span className="sv-logo">{mark}</span><span className="sv-tag">{t(`shop-link.tagline.${id}`)}</span></header>
        <main className="sv-main">
          {modules.map((m) => (
            <section key={m.id} className="sv-item">
              <h2>{t(`vendor-sites.module.${m.id}`)}</h2>
              <p>{t(`vendor-sites.pitch.${m.id}`)}</p>
              <table className="sv-price">
                <tbody>
                  <tr><th>{t("vendor-sites.price")}</th><td><span className="num sv-amount">{euro(m.price)}</span> {t("vendor-sites.licence")}</td></tr>
                  {m.id !== "shop-link" && <tr><th>{t("payment-methods.fee")}</th><td className="num">{feeText(methodById(m.id as MethodId))}</td></tr>}
                </tbody>
              </table>
              {state(m)}
            </section>
          ))}
        </main>
        <footer className="sv-foot">{t("shop-link.footer", { year: yearOf(game.hour), maker: v.maker })}</footer>
      </div>
    </div>
  );
}
