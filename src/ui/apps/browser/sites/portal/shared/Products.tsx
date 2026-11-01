import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { SITE_LINES } from "../../../../../../sim/80-business/website";
import type { Product } from "../../../../../../sim/30-customers/customers";
import { stockOf } from "../../../../../../sim/80-business/shop";
import type { ShopProduct } from "../../../../../../sim/80-business/shop";
import { createProduct, createProductGroup, deleteProduct, deleteProductGroup } from "../../../../../../sim/90-actions/portal";
import { useStore } from "../../../../../store";
import { PRODUCT } from "../../../../support/labels";
import type { ScreenProps } from "./nav";

export const payType = (p: ShopProduct): string =>
  t(Object.values(p.prices).every((x) => x === 0) && p.setup === 0 ? "shop-admin.payFree" : "shop-admin.payRecurring");

export const stockText = (stock: ReturnType<typeof stockOf>): string => (stock === "off" ? t("marketing.off") : stock === "auto" ? t("marketing.freeCapacity") : String(stock));

// Product groups as headed tables, with the buttons that create groups and products.
export function Products({ game, go }: ScreenProps) {
  const act = useStore((s) => s.act);
  const groups = game.shop.productGroups, lines = SITE_LINES.filter((l) => game.marketing.lines.includes(l));
  const [name, setName] = useState(""), [pname, setPname] = useState("");
  const [gid, setGid] = useState(""), [line, setLine] = useState<Product>(lines[0] ?? "webHosting");
  const target = groups.some((g) => g.id === gid) ? gid : groups[0]?.id ?? "";
  return (
    <div className="pt-screen">
      {groups.map((g) => (
        <section key={g.id} className="pt-group">
          <h3>{g.name}</h3>
          <table className="pt-table">
            <thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-admin.type")}</th><th>{t("shop-admin.payType")}</th><th>{t("shop-admin.stock")}</th><th /></tr></thead>
            <tbody>
              {game.shop.products.filter((p) => p.groupId === g.id).map((p) => (
                <tr key={p.id}>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); go({ name: "product", id: p.id, tab: "details" }); }}>{p.name}</a></td>
                  <td>{PRODUCT[p.line]}</td>
                  <td>{payType(p)}</td>
                  <td className="num">{stockText(p.stock)}</td>
                  <td><button className="btn" onClick={() => act(deleteProduct, p.id)}>{t("marketing.delete")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!game.shop.products.some((p) => p.groupId === g.id) && <button className="btn" onClick={() => act(deleteProductGroup, g.id)}>{t("shop-admin.deleteGroup")}</button>}
        </section>
      ))}
      <div className="pt-form">
        <input aria-label={t("shop-admin.groupName")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { act(createProductGroup, name); setName(""); }}>{t("shop-admin.createGroup")}</button>
      </div>
      {groups.length > 0 && lines.length > 0 && (
        <div className="pt-form">
          <select aria-label={t("shop-admin.group")} value={target} onChange={(e) => setGid(e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <select aria-label={t("shop-admin.type")} value={line} onChange={(e) => setLine(e.target.value as Product)}>{lines.map((l) => <option key={l} value={l}>{PRODUCT[l]}</option>)}</select>
          <input aria-label={t("shop-admin.productName")} value={pname} onChange={(e) => setPname(e.target.value)} />
          <button className="btn" disabled={!pname.trim()} onClick={() => { act(createProduct, target, pname, line); setPname(""); }}>{t("shop-admin.createProduct")}</button>
        </div>
      )}
    </div>
  );
}
