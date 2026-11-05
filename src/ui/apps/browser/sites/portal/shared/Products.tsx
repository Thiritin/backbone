import { PBody, PBtn, PInput, PSelect, PTable } from "./ui";
import { useState, type FormEvent } from "react";
import { t } from "../../../../../../i18n/en";
import { SITE_LINES } from "../../../../../../sim/80-business/website";
import type { Product } from "../../../../../../sim/30-customers/customers";
import type { Stock } from "../../../../../../sim/80-business/shop";
import type { ShopProduct } from "../../../../../../sim/80-business/shop";
import { createProduct, createProductGroup, deleteProduct, deleteProductGroup } from "../../../../../../sim/90-actions/portal";
import { useStore } from "../../../../../store";
import { PRODUCT } from "../../../../support/labels";
import type { ScreenProps } from "./nav";

export const payType = (p: ShopProduct): string =>
  t(Object.values(p.prices).every((x) => x === 0) && p.setup === 0 ? "shop-admin.payFree" : "shop-admin.payRecurring");

export const stockText = (stock: Stock): string => (stock === "off" ? t("marketing.off") : stock === "auto" ? t("marketing.freeCapacity") : String(stock));

// Product groups as headed tables; the toolbar opens the create pages.
export function Products({ game, go }: ScreenProps) {
  const act = useStore((s) => s.act);
  const groups = game.shop.productGroups;
  return (
    <div className="pt-screen">
      <div className="pt-toolbar">
        <PBtn onClick={() => go({ name: "product", id: "new-group" })}>{t("shop-admin.createGroup")}</PBtn>
        <PBtn disabled={!groups.length} onClick={() => go({ name: "product", id: "new" })}>{t("shop-admin.createProduct")}</PBtn>
      </div>
      {groups.map((g) => (
        <section key={g.id} className="pt-group">
          <h3 className="pt-group-h">{g.name}</h3>
          <PTable>
            <thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-admin.type")}</th><th>{t("shop-admin.payType")}</th><th>{t("shop-admin.stock")}</th><th /></tr></thead>
            <PBody>
              {game.shop.products.filter((p) => p.groupId === g.id).map((p) => (
                <tr key={p.id}>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); go({ name: "product", id: p.id, tab: "details" }); }}>{p.name}</a></td>
                  <td>{PRODUCT[p.line]}</td>
                  <td>{payType(p)}</td>
                  <td className="num">{stockText(p.stock)}</td>
                  <td><PBtn onClick={() => act(deleteProduct, p.id)}>{t("marketing.delete")}</PBtn></td>
                </tr>
              ))}
            </PBody>
          </PTable>
          {!game.shop.products.some((p) => p.groupId === g.id) && <PBtn onClick={() => act(deleteProductGroup, g.id)}>{t("shop-admin.deleteGroup")}</PBtn>}
        </section>
      ))}
    </div>
  );
}

// The create pages behind the toolbar: a group, or a product in a group.
export function ProductCreate({ game, go, group }: ScreenProps & { group?: boolean }) {
  const act = useStore((s) => s.act);
  const groups = game.shop.productGroups, lines = SITE_LINES.filter((l) => game.marketing.lines.includes(l));
  const [name, setName] = useState(""), [gid, setGid] = useState(groups[0]?.id ?? ""), [line, setLine] = useState<Product>(lines[0] ?? "webHosting");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = group ? act(createProductGroup, name) : act(createProduct, gid, name, line);
    if (r.ok) go(group ? { name: "products" } : { name: "product", id: r.id, tab: "details" });
  };
  return (
    <form className="pt-screen" onSubmit={submit}>
      <dl className="pt-fields">
        {!group && <>
          <div><dt>{t("shop-admin.group")}</dt><dd><PSelect value={gid} onChange={(e) => setGid(e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</PSelect></dd></div>
          <div><dt>{t("shop-admin.type")}</dt><dd><PSelect value={line} onChange={(e) => setLine(e.target.value as Product)}>{lines.map((l) => <option key={l} value={l}>{PRODUCT[l]}</option>)}</PSelect></dd></div>
        </>}
        <div><dt>{t(group ? "shop-admin.groupName" : "shop-admin.productName")}</dt><dd><PInput value={name} onChange={(e) => setName(e.target.value)} /></dd></div>
      </dl>
      <div className="pt-toolbar"><PBtn type="submit" primary disabled={!name.trim() || (!group && !gid)}>{t(group ? "shop-admin.createGroup" : "shop-admin.createProduct")}</PBtn></div>
    </form>
  );
}
