import { useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { euro, euroCents } from "../../../sim/00-core/money";
import { hasModule as registered } from "../../../sim/10-catalog/modules";
import { invoiceTotal } from "../../../sim/45-billing/billing";
import { shopVendorUrl } from "../../../sim/80-business/shoplink";
import { yearOf } from "../../../sim/00-core/time";
import { HARDWARE_MODULES, includes, moduleName, shopById, SHOPS, type ShopId } from "../../../sim/10-catalog/shops";
import type { Product } from "../../../sim/30-customers/customers";
import type { GameState } from "../../../sim/50-state";
import { groupOf, hasModule, shopActive, stockOf, type Stock } from "../../../sim/80-business/shop";
import { addToGroup, buyModule, chooseShop, createGroup, deleteGroup, removeFromGroup, setGroupDeploy, setGroupSale, setStock } from "../../../sim/90-actions/shop";
import { SERVES, type SoftwareKind } from "../../../sim/10-catalog/platforms";
import { useStore } from "../../store";
import { NodeActions } from "../browser/consoles/HypervisorBase";
import type { NodeState } from "../../../sim/60-infra/cluster";
import { formatDay } from "../billing/format";
import { PRODUCT } from "../support/labels";
import { PaymentMethods } from "./payments";

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
  const v = game.shop.variant && shopById(game.shop.variant), real = v && v.id !== "handRolled";
  return <>
    <div className="mkt-list">
      <div className="mkt-row">
        <span className="mkt-label">{t("marketing.orders")}</span>
        <span className="mkt-grow">{v ? (v.id === "handRolled" ? t("marketing.selfScriptedOrderForm") : v.name) : t("marketing.email")}</span>
        {v && (shopActive(game) ? <span className="pill ok">{t("marketing.takingOrders")}</span> : <span className="pill">{t("marketing.readyDay", { day: formatDay(game.shop.readyAt) })}</span>)}
      </div>
    </div>
    <Variants game={game} />
    {v && <Modules game={game} />}
    {real && <Groups game={game} />}
    {real && <StockList game={game} />}
    {real && <PaymentMethods game={game} />}
    {real && <ShopRecords game={game} />}
  </>;
}

// ponytail: the latest 50 of each; the shop portal's admin replaces this list.
const SHOWN = 50;

// The shop system's own customers and invoices, with its Shop link module.
function ShopRecords({ game }: { game: GameState }) {
  const openApp = useStore((s) => s.openApp);
  const customers = game.customers.filter((c) => c.source === "shop");
  const invoices = game.invoices.filter((i) => i.source === "shop");
  const name = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  return (
    <div className="mkt-list">
      <div className="mkt-row">
        <strong className="mkt-grow">{t("vendor-sites.module.shop-link")}</strong>
        {registered(game, "shop-link")
          ? <span className="pill ok">{t("vendor-sites.registered")}</span>
          : <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: shopVendorUrl(game.shop.variant!) })}>{t("vendor-sites.viewModule")}</button>}
      </div>
      <div className="side-h">{t("shop-link.customers")}</div>
      <table className="table">
        <thead><tr><th>{t("books.col.customer")}</th><th>{t("books.col.date")}</th></tr></thead>
        <tbody>{customers.slice(-SHOWN).reverse().map((c) => <tr key={c.id}><td>{c.name}</td><td className="num">{formatDay(c.since)}</td></tr>)}</tbody>
      </table>
      <div className="side-h">{t("shop-link.invoices")}</div>
      <table className="table">
        <thead><tr><th>{t("books.col.number")}</th><th>{t("books.col.customer")}</th><th className="r">{t("books.col.amount")}</th><th>{t("books.col.status")}</th></tr></thead>
        <tbody>
          {invoices.slice(-SHOWN).reverse().map((i) => (
            <tr key={i.id}>
              <td className="num">{i.number}</td>
              <td>{name(i.customerId)}</td>
              <td className="r num">{euroCents(invoiceTotal(i))}</td>
              <td>{t(i.shopPaid ? "books.status.paid" : "books.status.sent")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

function StockList({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const v = shopById(game.shop.variant!);
  const pick = (p: Product, value: string) => act(setStock, p, (value === "auto" || value === "off" ? value : Math.max(0, Math.floor(Number(value) || 0))) as Stock);
  return (
    <div className="mkt-list">
      <div className="side-h">{t("marketing.stock")}</div>
      {game.marketing.lines.map((p) => {
        const n = stockOf(game, p), soldOut = game.shop.soldOut[p] ?? 0;
        return (
          <div key={p} className="mkt-row">
            <span className="mkt-label">{PRODUCT[p]}</span>
            <span className="mkt-grow">{soldOut > 0 && <span className="mkt-sub">{t("marketing.soldOutThisMonth", { n: soldOut })}</span>}</span>
            <div className="seg" role="group" aria-label={t("marketing.stockOf", { product: PRODUCT[p] })}>
              <button aria-pressed={n === "off"} onClick={() => pick(p, "off")}>{t("marketing.off")}</button>
              {v.autoStock && <button aria-pressed={n === "auto"} onClick={() => pick(p, "auto")}>{t("marketing.freeCapacity")}</button>}
              <button aria-pressed={typeof n === "number"} onClick={() => typeof n !== "number" && pick(p, "10")}>{t("marketing.units")}</button>
            </div>
            {typeof n === "number" && <input className="num" type="number" min={0} step={1} style={{ width: "5em" }} aria-label={t("marketing.unitsOf", { product: PRODUCT[p] })} value={n} onChange={(e) => pick(p, e.target.value)} />}
          </div>
        );
      })}
    </div>
  );
}

const NODE_STATE: Record<NodeState, string> = { active: t("marketing.nodeActive"), cordoned: t("marketing.nodeCordoned"), draining: t("marketing.nodeDraining"), maintenance: t("marketing.nodeMaintenance") };
const KIND: Partial<Record<SoftwareKind, string>> = { panel: t("marketing.kindPanel"), cloud: t("marketing.kindCloud"), game: t("marketing.kindGame"), dns: t("marketing.kindDns"), vpn: t("marketing.kindVpn"), storage: t("marketing.kindStorage") };

// Server groups: which software installations the shop sells from and deploys to.
function Groups({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [kind, setKind] = useState<SoftwareKind>("panel");
  const [name, setName] = useState("");
  return (
    <div className="mkt-list">
      <div className="side-h">{t("marketing.serverGroups")}</div>
      {game.shop.groups.map((g) => {
        const free = game.clusters.filter((c) => c.kind === g.kind && !groupOf(game, c.id));
        return (
          <div key={g.id} className="mkt-list">
            <div className="mkt-row">
              <strong className="mkt-grow">{g.name}</strong>
              <span className="mkt-sub">{KIND[g.kind]}</span>
              <button className="btn" onClick={() => act(deleteGroup, g.id)}>{t("marketing.delete")}</button>
            </div>
            {g.members.map((id) => game.clusters.find((c) => c.id === id)).filter((c) => !!c).map((c) => (
              <div key={c.id} className="mkt-list">
                <div className="mkt-row">
                  <span className="mkt-grow">{c.name}</span>
                  <button className="btn" onClick={() => act(removeFromGroup, g.id, c.id)}>{t("marketing.remove")}</button>
                </div>
                {c.nodes.map((n) => (
                  <div key={n.deviceId} className="mkt-row">
                    <span className="mkt-grow mkt-sub">{game.devices.find((d) => d.id === n.deviceId)?.label ?? game.devices.find((d) => d.id === n.deviceId)?.name}</span>
                    <span className="pill">{NODE_STATE[n.state]}</span>
                    <NodeActions c={c} n={n} className="btn" />
                  </div>
                ))}
              </div>
            ))}
            {free.length > 0 && (
              <div className="mkt-row">
                <select aria-label={t("marketing.addTo", { group: g.name })} value="" onChange={(e) => e.target.value && act(addToGroup, g.id, e.target.value)}>
                  <option value="">{t("marketing.addSoftware")}</option>
                  {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {SERVES[g.kind].map((p) => (
              <label key={p} className="mkt-row">
                <span className="mkt-grow">{t("marketing.sell", { product: PRODUCT[p] })}</span>
                <input type="checkbox" role="switch" className="switch" aria-label={t("marketing.sellFrom", { product: PRODUCT[p], group: g.name })} checked={g.sale.includes(p)} onChange={(e) => act(setGroupSale, g.id, p, e.target.checked)} />
              </label>
            ))}
            <label className="mkt-row">
              <span className="mkt-grow">{t("marketing.deployOrders")}</span>
              <input type="checkbox" role="switch" className="switch" aria-label={t("marketing.deployOrdersTo", { group: g.name })} checked={g.deploy} onChange={(e) => act(setGroupDeploy, g.id, e.target.checked)} />
            </label>
          </div>
        );
      })}
      <div className="mkt-row">
        <select aria-label={t("marketing.softwareKind")} value={kind} onChange={(e) => setKind(e.target.value as SoftwareKind)}>
          {Object.entries(KIND).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <input className="mkt-grow" aria-label={t("marketing.groupName")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { act(createGroup, kind, name); setName(""); }}>{t("marketing.newGroup")}</button>
      </div>
    </div>
  );
}
