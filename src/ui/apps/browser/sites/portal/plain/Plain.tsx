import { t } from "../../../../../../i18n/en";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { euroCents } from "../../../../../../sim/00-core/money";
import { monthlyOf } from "../../../../../../sim/80-business/portal";
import { PRODUCT } from "../../../../support/labels";
import { AdminScreen, SCREEN_LABEL } from "../shared/AdminScreen";
import { screenArgs, screenOf, type ScreenName } from "../shared/nav";
import type { Skin, SkinProps } from "../skins";
import "../portal.css";

const NAV: ScreenName[] = ["home", "products", "options", "servers", "orders", "clients", "invoices"];

function Admin({ game, variant, route, open }: SkinProps) {
  const screen = screenOf(route.query);
  const go = (s: Parameters<typeof screenArgs>[0]) => open("admin", {}, screenArgs(s));
  return (
    <div className="portal portal-plain">
      <header><h1>{shopById(variant).name}</h1></header>
      <nav>{NAV.map((n) => <button key={n} className={screen.name === n ? "on" : ""} onClick={() => go({ name: n })}>{SCREEN_LABEL[n]}</button>)}</nav>
      <main><AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} /></main>
    </div>
  );
}

function Store({ game, variant }: SkinProps) {
  return (
    <div className="portal portal-plain">
      <header><h1>{shopById(variant).name}</h1></header>
      <main>
        {game.shop.productGroups.filter((g) => !g.hidden).map((g) => (
          <section key={g.id}>
            <h2>{g.name}</h2>
            <ul>{game.shop.products.filter((p) => p.groupId === g.id && !p.hidden).map((p) => <li key={p.id}>{p.name} <span className="num">{euroCents(monthlyOf(p))}</span></li>)}</ul>
          </section>
        ))}
      </main>
    </div>
  );
}

function Client({ game, variant, route }: SkinProps) {
  const c = game.customers.find((x) => x.id === route.query.get("c"));
  return (
    <div className="portal portal-plain">
      <header><h1>{shopById(variant).name}</h1></header>
      <main>
        {c && <><h2>{c.name}</h2><ul>{game.services.filter((v) => v.customerId === c.id && v.endedAt === null).map((v) => <li key={v.id}>{v.label || PRODUCT[v.product]}</li>)}</ul></>}
        {!c && <h2>{t("shop-admin.clientArea")}</h2>}
      </main>
    </div>
  );
}

export const Plain: Skin = { Admin, Store, Client };
