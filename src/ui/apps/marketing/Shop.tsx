import type { ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { CUSTOM_SCRIPT, HARDWARE_MODULES, includes, moduleName, shopById, SHOPS, type ShopId } from "../../../sim/10-catalog/shops";
import type { Product } from "../../../sim/30-customers/customers";
import type { GameState } from "../../../sim/50-state";
import { owns } from "../../../sim/80-business/marketing";
import { hasModule, shopActive, stockOf, type Stock } from "../../../sim/80-business/shop";
import { buyModule, chooseShop, setStock } from "../../../sim/90-actions/shop";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import { PRODUCT } from "../support/labels";

const ABOUT: Record<ShopId, string> = {
  modemBill: "Sells web hosting on cPanic and Pleskit for a single payment.",
  clientExit: "Sells panel hosting cheaply and adds other software through third-party modules.",
  whmCache: "Connects to every web panel and, from 2008, every game panel.",
  blessta: "Comes with its source code and connects to the common web panels.",
  hostBull: "Connects to every panel, hypervisor and service software out of the box.",
  ubersmyth: "Sets up dedicated servers and colocation by itself.",
  orderBocks: "Costs nothing upfront and keeps a share of what its customers pay.",
  boxBillin: "Costs nothing, and your team integrates each community module itself.",
};
const HARDWARE_NAME: Record<(typeof HARDWARE_MODULES)[number], string> = { registrar: "Domains", ssl: "Certificates", dedicated: "Dedicated servers", colo: "Colocation" };

const price = (id: ShopId): string => {
  const v = shopById(id);
  if (v.cut) return `${Math.round(v.cut * 100)}% of revenue`;
  const parts = [v.setup > 0 && `${euro(v.setup)} once`, v.monthly > 0 && `${euro(v.monthly)} / month${v.perServer ? ` or ${euro(v.perServer)} per server` : ""}`, v.yearly > 0 && `${euro(v.yearly)} / year`];
  return parts.filter(Boolean).join(", ") || "Free";
};

export function Shop({ game }: { game: GameState }) {
  const v = game.shop.variant && shopById(game.shop.variant);
  return <>
    <div className="mkt-list">
      <div className="mkt-row">
        <span className="mkt-label">Orders</span>
        <span className="mkt-grow">{v ? v.name : owns(game, "orderForm") ? "Hand-rolled order form" : "Email"}</span>
        {v && (shopActive(game) ? <span className="pill ok">Taking orders</span> : <span className="pill">Ready {formatDay(game.shop.readyAt)}</span>)}
      </div>
    </div>
    {game.unlocks.includes("shops") && <Variants game={game} />}
    {(v || owns(game, "orderForm")) && <Modules game={game} />}
    {v && <StockList game={game} />}
  </>;
}

function Variants({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour);
  return (
    <div className="shop-grid mkt-flat">
      {SHOPS.filter((v) => year >= v.from).map((v) => {
        const used = game.shop.variant === v.id, sold = v.until === undefined || year <= v.until;
        let state: ReactNode;
        if (used) state = <span className="pill ok">In use</span>;
        else if (!sold) state = <span className="pill">Discontinued</span>;
        else state = <>
          {v.own && <button className="btn" disabled={game.cash < v.own.price} onClick={() => act(chooseShop, v.id, true)}>Buy <span className="num">{euro(v.own.price)}</span></button>}
          <button className="btn primary" disabled={game.cash < v.setup} onClick={() => act(chooseShop, v.id)}>{v.own ? "Lease" : "Choose"}</button>
        </>;
        return (
          <div key={v.id} className="shop-card">
            <div className="shop-name"><strong>{v.name}</strong><span>{ABOUT[v.id]}</span></div>
            <dl className="shop-specs">
              <div><dt>Price</dt><dd className="num">{price(v.id)}</dd></div>
              <div><dt>Modules</dt><dd className="num">{v.extra === null ? "Included only" : v.extra === 0 ? "Free" : `${euro(v.extra)} each`}</dd></div>
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
  const cost = v ? v.extra : CUSTOM_SCRIPT;
  return (
    <div className="mkt-list">
      <div className="side-h">{v ? "Modules" : "Custom scripts"}</div>
      {[...software, ...HARDWARE_MODULES].map((m) => {
        const bought = game.shop.modules[m];
        let state: ReactNode;
        if (v && includes(v, m, year)) state = <span className="pill ok">Included</span>;
        else if (hasModule(game, m)) state = <span className="pill ok">Installed</span>;
        else if (bought !== undefined) state = <span className="pill">Ready {formatDay(bought)}</span>;
        else if (cost === null) state = <span className="pill">Not available</span>;
        else state = <button className="btn" disabled={game.cash < cost} onClick={() => act(buyModule, m)}>{cost ? <>Buy <span className="num">{euro(cost)}</span></> : "Integrate"}</button>;
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

function StockList({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const v = shopById(game.shop.variant!);
  const pick = (p: Product, value: string) => act(setStock, p, (value === "auto" || value === "off" ? value : Math.max(0, Math.floor(Number(value) || 0))) as Stock);
  return (
    <div className="mkt-list">
      <div className="side-h">Stock</div>
      {game.marketing.lines.map((p) => {
        const n = stockOf(game, p), soldOut = game.shop.soldOut[p] ?? 0;
        return (
          <div key={p} className="mkt-row">
            <span className="mkt-label">{PRODUCT[p]}</span>
            <span className="mkt-grow">{soldOut > 0 && <span className="mkt-sub"><span className="num">{soldOut}</span> sold out this month</span>}</span>
            <div className="seg" role="group" aria-label={`Stock of ${PRODUCT[p]}`}>
              <button aria-pressed={n === "off"} onClick={() => pick(p, "off")}>Off</button>
              {v.autoStock && <button aria-pressed={n === "auto"} onClick={() => pick(p, "auto")}>Free capacity</button>}
              <button aria-pressed={typeof n === "number"} onClick={() => typeof n !== "number" && pick(p, "10")}>Units</button>
            </div>
            {typeof n === "number" && <input className="num" type="number" min={0} step={1} style={{ width: "5em" }} aria-label={`Units of ${PRODUCT[p]}`} value={n} onChange={(e) => pick(p, e.target.value)} />}
          </div>
        );
      })}
    </div>
  );
}
