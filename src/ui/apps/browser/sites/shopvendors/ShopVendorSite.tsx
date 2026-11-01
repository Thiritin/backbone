import type { ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { hasModule, moduleById } from "../../../../../sim/10-catalog/modules";
import { shopById, type ShopId } from "../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../sim/50-state";
import { bought } from "../../../../../sim/80-business/lexwear";
import { buyShopLink } from "../../../../../sim/90-actions/shoplink";
import { useStore } from "../../../../store";
import "./shopvendors.css";

export interface VendorProps { game: GameState }

// The page every shop vendor sells Shop link on; each vendor's file gives it its colours and wordmark.
export function VendorPage({ game, id, className, mark }: VendorProps & { id: ShopId; className: string; mark: ReactNode }) {
  const act = useStore((s) => s.act);
  const m = moduleById("shop-link")!, v = shopById(id);
  const state = hasModule(game, m.id) && game.shop.variant === id ? <span className="sv-state">{t("vendor-sites.registered")}</span>
    : bought(game, m.id) ? <span className="sv-state">{t("vendor-sites.bought")}</span>
    : <button type="button" className="sv-buy" onClick={() => act(buyShopLink, id)}>{t("vendor-sites.buy")}</button>;
  return (
    <div className={`sv ${className}`}>
      <div className="sv-page">
        <header className="sv-head"><span className="sv-logo">{mark}</span><span className="sv-tag">{t(`shop-link.tagline.${id}`)}</span></header>
        <main className="sv-main">
          <h1>{t("vendor-sites.module.shop-link")}</h1>
          <p>{t("vendor-sites.pitch.shop-link")}</p>
          <table className="sv-price">
            <tbody><tr><th>{t("vendor-sites.price")}</th><td><span className="num sv-amount">{euro(m.price)}</span> {t("vendor-sites.licence")}</td></tr></tbody>
          </table>
          {state}
        </main>
        <footer className="sv-foot">{t("shop-link.footer", { year: yearOf(game.hour), maker: v.maker })}</footer>
      </div>
    </div>
  );
}
