import { t } from "../../../../../../i18n/en";
import { yearOf } from "../../../../../../sim/00-core/time";
import { AdminScreen, SCREEN_LABEL } from "../shared/AdminScreen";
import { screenArgs, screenOf, type Screen, type ScreenName } from "../shared/nav";
import type { SkinProps } from "../skins";
import "../portal.css";
import "./skin.css";

// Menus of the WHMCache admin and the screens under each.
const MENUS: [string, ScreenName[]][] = [
  ["shop-admin.menuClients", ["clients"]],
  ["shop-admin.menuOrders", ["orders"]],
  ["shop-admin.menuBilling", ["invoices"]],
  ["shop-admin.menuSetup", ["products", "options", "servers"]],
];

// WHMCache 3 and 4 until 2011, Blend and the Six theme until 2019, then the flat admin.
export const eraOf = (hour: number): "early" | "mid" | "late" => (yearOf(hour) <= 2011 ? "early" : yearOf(hour) <= 2019 ? "mid" : "late");

export function WhmCacheAdmin({ game, route, open }: SkinProps) {
  const screen = screenOf(route.query);
  const go = (s: Screen) => open("admin", {}, screenArgs(s));
  const current = screen.name === "product" ? "products" : screen.name === "client" ? "clients" : screen.name;
  return (
    <div className={`portal whm whm-${eraOf(game.hour)}`}>
      <header className="whm-head">
        <a href="#" className="whm-logo" onClick={(e) => { e.preventDefault(); go({ name: "home" }); }}>WHMCache</a>
        <span className="whm-user">{t("shop-admin.welcome", { name: "admin" })}</span>
      </header>
      <div className="whm-body">
        <nav className="whm-nav">
          {MENUS.map(([label, items]) => (
            <div key={label} className="whm-menu">
              <strong>{t(label)}</strong>
              {items.map((n) => <a key={n} href="#" className={current === n ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: n }); }}>{n === "products" ? t("shop-admin.productsServices") : SCREEN_LABEL[n]}</a>)}
            </div>
          ))}
        </nav>
        <main className="whm-main">
          <AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} />
        </main>
      </div>
    </div>
  );
}
