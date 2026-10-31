import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { CYCLE_MONTHS, MARKET_DISCOUNT, type Cycle } from "../../../../../../sim/10-catalog/cycles";
import { SERVES } from "../../../../../../sim/10-catalog/platforms";
import { marketPrice, marketSetup } from "../../../../../../sim/10-catalog/products";
import { moduleName, shopById } from "../../../../../../sim/10-catalog/shops";
import { packagesOf } from "../../../../../../sim/80-business/packages";
import { monthlyOf, packageSpec } from "../../../../../../sim/80-business/portal";
import type { SetupMode, Stock } from "../../../../../../sim/80-business/shop";
import { setProductPrice, updateProduct, type ProductPatch } from "../../../../../../sim/90-actions/portal";
import { useStore } from "../../../../../store";
import { CommitInput, toNumber } from "./CommitInput";
import type { ScreenProps } from "./nav";

export const CYCLE_LABEL: Record<Cycle, string> = {
  monthly: t("shop-admin.cycleMonthly"), quarterly: t("shop-admin.cycleQuarterly"), annual: t("shop-admin.cycleAnnual"), biennial: t("shop-admin.cycleBiennial"),
};
const SETUP: [SetupMode, string][] = [["payment", t("shop-admin.setupPayment")], ["accept", t("shop-admin.setupAccept")], ["off", t("shop-admin.setupOff")]];
const TABS = [["details", t("shop-admin.tabDetails")], ["pricing", t("marketing.pricing")], ["module", t("shop-admin.tabModule")]] as const;

export function ProductEdit({ game, go, id, tab = "details" }: ScreenProps & { id: string; tab?: string }) {
  const act = useStore((s) => s.act);
  const p = game.shop.products.find((x) => x.id === id), v = game.shop.variant && shopById(game.shop.variant);
  if (!p || !v) return null;
  const patch = (x: ProductPatch) => act(updateProduct, p.id, x);
  const year = yearOf(game.hour), group = game.shop.groups.find((g) => g.id === p.serverGroupId);
  const cycles = p.line === "ssl" ? (["monthly"] as Cycle[]) : v.cycles;
  const monthly = marketPrice(p.line, packageSpec(game, p), year), base = monthlyOf(p);
  const stockKind = p.stock === "off" ? "off" : p.stock === "auto" ? "auto" : "units";
  const packages = [...new Set((group?.members ?? []).flatMap((m) => packagesOf(game.clusters.find((c) => c.id === m)!).map((x) => x.name)))];
  const member = game.clusters.find((c) => c.id === group?.members[0]), software = member && (member.panel ?? member.platform);
  const serverGroups = game.shop.groups.filter((g) => SERVES[g.kind].includes(p.line));
  return (
    <div className="pt-screen">
      <h3>{p.name}</h3>
      <div className="pt-tabs" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go({ name: "product", id: p.id, tab: k })}>{label}</button>)}
      </div>
      {tab === "details" && (
        <dl className="pt-fields">
          <dt>{t("shop-admin.productName")}</dt>
          <dd><CommitInput value={p.name} onCommit={(name) => patch({ name })} /></dd>
          <dt>{t("shop-admin.group")}</dt>
          <dd><select value={p.groupId} onChange={(e) => patch({ groupId: e.target.value })}>{game.shop.productGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></dd>
          <dt>{t("shop-admin.stock")}</dt>
          <dd>
            <select aria-label={t("shop-admin.stock")} value={stockKind} onChange={(e) => patch({ stock: (e.target.value === "units" ? 10 : e.target.value) as Stock })}>
              <option value="off">{t("marketing.off")}</option>
              {v.autoStock && <option value="auto">{t("marketing.freeCapacity")}</option>}
              <option value="units">{t("marketing.units")}</option>
            </select>
            {typeof p.stock === "number" && <CommitInput className="num" type="number" min={0} aria-label={t("shop-admin.quantity")} value={String(p.stock)} onCommit={(x) => patch({ stock: Math.max(0, Math.floor(Number(x) || 0)) })} />}
          </dd>
          <dt>{t("shop-admin.hidden")}</dt>
          <dd><input type="checkbox" aria-label={t("shop-admin.hidden")} checked={p.hidden} onChange={(e) => patch({ hidden: e.target.checked })} /></dd>
        </dl>
      )}
      {tab === "pricing" && (
        <table className="pt-table">
          <thead><tr><th /><th>{t("shop-admin.price")}</th><th>{t("shop-admin.market")}</th><th /></tr></thead>
          <tbody>
            <tr>
              <th scope="row">{t("shop-admin.setupFee")}</th>
              <td><CommitInput className="num" type="number" min={0} step={0.01} aria-label={t("shop-admin.setupFee")} value={String(p.setup)} onCommit={(x) => patch({ setup: Math.max(0, toNumber(x) ?? 0) })} /></td>
              <td className="num">{euroCents(marketSetup(p.line, year))}</td>
              <td />
            </tr>
            {cycles.map((c) => {
              const price = p.prices[c], save = price !== undefined && c !== "monthly" ? 1 - price / (CYCLE_MONTHS[c] * base) : 0;
              return (
                <tr key={c}>
                  <th scope="row">{CYCLE_LABEL[c]}</th>
                  <td><CommitInput className="num" type="number" min={0} step={0.01} aria-label={CYCLE_LABEL[c]} value={price === undefined ? "" : String(price)} onCommit={(x) => act(setProductPrice, p.id, c, toNumber(x))} /></td>
                  <td className="num">{euroCents(Math.round(monthly * CYCLE_MONTHS[c] * (1 - MARKET_DISCOUNT[c]) * 100) / 100)}</td>
                  <td className="num">{save > 0.005 && t("shop-admin.save", { pct: Math.round(save * 100) })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {tab === "module" && (
        <dl className="pt-fields">
          <dt>{t("shop-admin.moduleName")}</dt>
          <dd>{software ? moduleName(software) : t("shop-admin.none")}</dd>
          <dt>{t("shop-admin.serverGroup")}</dt>
          <dd>
            <select aria-label={t("shop-admin.serverGroup")} value={p.serverGroupId ?? ""} onChange={(e) => patch({ serverGroupId: e.target.value || null, packageName: null })}>
              <option value="">{t("shop-admin.none")}</option>
              {serverGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </dd>
          <dt>{t("shop-admin.packageName")}</dt>
          <dd>
            <select aria-label={t("shop-admin.packageName")} value={p.packageName ?? ""} onChange={(e) => patch({ packageName: e.target.value || null })}>
              <option value="">{t("shop-admin.none")}</option>
              {packages.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </dd>
          <dt>{t("shop-admin.autoSetup")}</dt>
          <dd role="radiogroup" aria-label={t("shop-admin.autoSetup")}>
            {SETUP.map(([k, label]) => <label key={k}><input type="radio" name={`setup-${p.id}`} checked={p.setupMode === k} onChange={() => patch({ setupMode: k })} /> {label}</label>)}
          </dd>
        </dl>
      )}
    </div>
  );
}
