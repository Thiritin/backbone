import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { CYCLE_MONTHS, CYCLES, type Cycle } from "../../../../../../sim/10-catalog/cycles";
import type { Product } from "../../../../../../sim/30-customers/customers";
import type { GameState } from "../../../../../../sim/50-state";
import { productCycles, productSellable } from "../../../../../../sim/80-business/portal";
import type { SkinProps } from "../skins";
import { CYCLE_LABEL } from "./ProductEdit";

export interface StoreLook { flat?: boolean; steps?: boolean }

// What a visitor can put in the cart: a product of the shop.
interface Item { key: string; name: string; line: Product; cycles: Cycle[]; sellable: boolean; price: (c: Cycle) => number; setup: number }

const cities = (g: GameState): string[] => g.locations.map((l) => l.city);

export function itemOf(g: GameState, key: string): Item | null {
  const p = g.shop.variant ? g.shop.products.find((x) => x.id === key) : undefined;
  if (!p) return null;
  return {
    key, name: p.name, line: p.line, cycles: productCycles(g, p), sellable: cities(g).some((c) => productSellable(g, p, c)),
    price: (c) => p.prices[c] ?? 0, setup: p.setup,
  };
}

const savings = (it: Item, c: Cycle): number => {
  const base = it.price("monthly") * CYCLE_MONTHS[c];
  return c === "monthly" || !(base > 0) ? 0 : Math.round((1 - it.price(c) / base) * 100);
};
const lowest = (it: Item): number => Math.min(...CYCLES.filter((c) => it.cycles.includes(c)).map((c) => it.price(c) / CYCLE_MONTHS[c]));

function Steps({ at }: { at: 0 | 1 | 2 }) {
  return (
    <ol className="shop-steps">
      {[t("shop-store.stepChoose"), t("shop-store.stepConfigure"), t("shop-store.stepReview")].map((s, i) => <li key={s} className={i === at ? "on" : ""}>{s}</li>)}
    </ol>
  );
}

function Store({ game, route, open, flat }: SkinProps & StoreLook) {
  const groups = game.shop.productGroups.filter((g) => !g.hidden);
  const shown = !flat && route.group ? groups.filter((g) => g.id === route.group) : groups;
  const row = (key: string, group: string) => {
    const it = itemOf(game, key);
    if (!it) return null;
    const gone = !it.sellable;
    return (
      <li key={key} className={`shop-item${gone ? " gone" : ""}`}>
        <span className="ps-name">{it.name}</span>
        {it.cycles.length > 0 && <span className="num">{t("shop-store.from", { price: euroCents(lowest(it)) })}</span>}
        {gone ? <span className="shop-sold">{t("shop-store.soldOut")}</span>
          : <button className="pt-btn" onClick={() => open("configure", { group, product: key })}>{t("shop-store.orderNow")}</button>}
      </li>
    );
  };
  return (
    <div className="shop-store">
      {flat
        ? <ul className="ps-list">{game.shop.products.filter((p) => !p.hidden).map((p) => row(p.id, p.groupId))}</ul>
        : shown.map((g) => <section key={g.id}><h2>{g.name}</h2><ul className="ps-list">{game.shop.products.filter((p) => p.groupId === g.id && !p.hidden).map((p) => row(p.id, g.id))}</ul></section>)}
    </div>
  );
}

function Summary({ it, cycle }: { it: Item; cycle: Cycle }) {
  const price = it.price(cycle), setup = it.setup;
  return (
    <table className="pt-table shop-cart">
      <thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-store.cycle")}</th><th>{t("shop-admin.price")}</th></tr></thead>
      <tbody>
        <tr><td>{it.name}</td><td>{CYCLE_LABEL[cycle]}</td><td className="num">{euroCents(price)}</td></tr>
        {setup > 0 && <tr><td colSpan={2}>{t("shop-admin.setupFee")}</td><td className="num">{euroCents(setup)}</td></tr>}
        <tr><th colSpan={2}>{t("shop-admin.total")}</th><td className="num">{euroCents(price + setup)}</td></tr>
      </tbody>
    </table>
  );
}

// Contact fields prefilled from the company; completing the order only shows the confirmation and changes nothing in the game.
function Checkout({ game }: { game: GameState }) {
  const [placed, setPlaced] = useState(false);
  if (placed) return <p className="shop-checkout" role="status">{t("shop-store.orderPlaced")}</p>;
  return (
    <form className="shop-checkout" onSubmit={(e) => { e.preventDefault(); setPlaced(true); }}>
      <h3>{t("shop-store.contact")}</h3>
      <label>{t("shop-store.company")}<input readOnly value={game.company.name} /></label>
      <label>{t("shop-store.email")}<input readOnly value={game.company.domain ? `info@${game.company.domain}` : ""} /></label>
      <button className="pt-btn primary">{t("shop-store.completeOrder")}</button>
    </form>
  );
}

function Configure({ game, route, open, steps, inCart }: SkinProps & StoreLook & { inCart: boolean }) {
  const key = route.product ?? route.query.get("p") ?? "";
  const it = itemOf(game, key);
  if (!it) return null;
  const cycle = (CYCLES.includes(route.query.get("cycle") as Cycle) && it.cycles.includes(route.query.get("cycle") as Cycle) ? route.query.get("cycle") : it.cycles[0]) as Cycle;
  const domain = route.query.get("domain") ?? "";
  const group = route.group ?? game.shop.products.find((x) => x.id === key)?.groupId ?? "";
  const set = (patch: Record<string, string>) => open("configure", { group, product: key }, { cycle, domain, ...patch });
  return (
    <div className="shop-configure">
      {steps && <Steps at={inCart ? 2 : 1} />}
      <h2>{it.name}</h2>
      {!inCart && (
        <div className="shop-fields">
          <label>{t("shop-store.cycle")}
            <select value={cycle} onChange={(e) => set({ cycle: e.target.value })}>
              {it.cycles.map((c) => <option key={c} value={c}>{`${CYCLE_LABEL[c]}  ${euroCents(it.price(c))}${savings(it, c) > 0 ? `  ${t("shop-store.save", { pct: savings(it, c) })}` : ""}`}</option>)}
            </select>
          </label>
          {it.line === "webHosting" && <label>{t("shop-store.domain")}<input value={domain} onChange={(e) => set({ domain: e.target.value })} /></label>}
        </div>
      )}
      {inCart && <Summary it={it} cycle={cycle} />}
      {inCart && <Checkout game={game} />}
      {!inCart && <button className="pt-btn primary" onClick={() => open("cart", { group, product: key }, { cycle, domain, p: key })}>{t("shop-store.addToCart")}</button>}
    </div>
  );
}

// Store front, configure page and cart of every skin; shop systems with one order page show the cart on it.
export function StoreFront(props: SkinProps & StoreLook) {
  const { route, steps } = props;
  if (route.area === "configure" || route.area === "cart") {
    const inCart = route.area === "cart" || route.query.get("p") !== null;
    return <Configure {...props} inCart={inCart} />;
  }
  return <>{steps && <Steps at={0} />}<Store {...props} /></>;
}
