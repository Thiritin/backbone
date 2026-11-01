import { EyeOff, Package, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { euroPrice } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { CYCLES, type Cycle } from "../../../sim/10-catalog/cycles";
import { SIZES, sizeSpec, type Sla } from "../../../sim/10-catalog/products";
import type { Product } from "../../../sim/30-customers/customers";
import { specText } from "../../../sim/30-market/spec";
import { PRODUCT_NAME_MAX, type CatalogProduct } from "../../../sim/80-business/catalog";
import type { GameState } from "../../../sim/50-state";
import { addProduct, removeProduct, updateProduct } from "../../../sim/90-actions/catalog";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";

const LINES = Object.keys(SIZES) as Product[];
const SLA_LABEL: Record<Sla, string> = { basic: "misc.slaBasic", business: "misc.slaBusiness", premium: "misc.slaPremium" };

export function ProductsTab({ focus }: { focus: string | null }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [editing, setEditing] = useState<string | null>(focus);
  const [line, setLine] = useState<Product>(LINES[0]);
  const p = game.catalog.find((x) => x.id === editing);
  if (p) return <ProductForm key={p.id} game={game} p={p} onDone={() => setEditing(null)} />;
  const add = (
    <div className="books-pick">
      <select className="field" aria-label={t("books.line")} value={line} onChange={(e) => setLine(e.target.value as Product)}>
        {LINES.map((l) => <option key={l} value={l}>{t(`sim.line.${l}`)}</option>)}
      </select>
      <button className="btn" onClick={() => { const r = act(addProduct, line); if (r.ok) setEditing(r.id!); }}><Plus />{t("books.newProduct")}</button>
    </div>
  );
  if (game.catalog.length === 0) return <div className="fin-empty"><Package />{t("books.noProducts")}{add}</div>;
  const open = (x: CatalogProduct) => setEditing(x.id);
  return (
    <div className="fin-scroll books-products">
      {add}
      <table className="table fin-table">
        <thead>
          <tr>
            <th>{t("books.col.name")}</th><th>{t("books.col.size")}</th><th className="r">{t("books.col.monthly")}</th>
            <th>{t("books.col.cycles")}</th><th className="r">{t("books.col.setup")}</th><th>{t("books.col.hidden")}</th>
          </tr>
        </thead>
        {LINES.filter((l) => game.catalog.some((x) => x.line === l)).map((l) => (
          <tbody key={l}>
            <tr><th colSpan={6} scope="colgroup">{t(`sim.line.${l}`)}</th></tr>
            {game.catalog.filter((x) => x.line === l).map((x) => (
              <tr key={x.id} onClick={() => open(x)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(x)}>
                <td>{x.name}</td>
                <td>{specText(x.line, x.spec)}</td>
                <td className="r num">{x.prices.monthly === undefined ? "" : euroPrice(x.prices.monthly)}</td>
                <td>{CYCLES.filter((c) => x.prices[c] !== undefined).map((c) => t(`books.cycle.${c}`)).join(", ")}</td>
                <td className="r num">{euroPrice(x.setup)}</td>
                <td>{x.hidden && <EyeOff aria-label={t("books.col.hidden")} />}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

// Books > Products > a product: the fields of one catalog record. An empty price leaves the cycle out.
function ProductForm({ game, p, onDone }: { game: GameState; p: CatalogProduct; onDone: () => void }) {
  const act = useStore((s) => s.act), year = yearOf(game.hour);
  const [name, setName] = useState(p.name), [spec, setSpec] = useState(p.spec), [sla, setSla] = useState(p.sla);
  const [prices, setPrices] = useState<Record<Cycle, string>>(() => Object.fromEntries(CYCLES.map((c) => [c, p.prices[c]?.toString() ?? ""])) as Record<Cycle, string>);
  const [setup, setSetup] = useState(String(p.setup)), [hidden, setHidden] = useState(p.hidden);
  const sizes = SIZES[p.line].map((_, i) => sizeSpec(p.line, i, year));
  const size = sizes.findIndex((x) => JSON.stringify(x) === JSON.stringify(spec));
  const save = () => {
    const priced = Object.fromEntries(CYCLES.filter((c) => prices[c].trim() !== "").map((c) => [c, Number(prices[c])]));
    if (act(updateProduct, p.id, { name, spec, sla, prices: priced, setup: Number(setup), hidden }).ok) onDone();
  };
  return (
    <form className="books-new books-product" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="books-new-head"><h2>{p.name}</h2><span>{t(`sim.line.${p.line}`)}</span></div>
      <fieldset className="books-new-form">
        <label className="books-f">{t("books.col.name")}<input className="field" value={name} maxLength={PRODUCT_NAME_MAX} onChange={(e) => setName(e.target.value)} /></label>
        <label className="books-f">{t("books.col.size")}
          <select className="field" value={size} onChange={(e) => setSpec(sizes[Number(e.target.value)])}>
            {size < 0 && <option value={-1}>{specText(p.line, spec)}</option>}
            {sizes.map((x, i) => <option key={i} value={i}>{specText(p.line, x)}</option>)}
          </select>
        </label>
        <label className="books-f">{t("misc.sla")}
          <select className="field" value={sla} onChange={(e) => setSla(e.target.value as Sla)}>
            {(Object.keys(SLA_LABEL) as Sla[]).map((x) => <option key={x} value={x}>{t(SLA_LABEL[x])}</option>)}
          </select>
        </label>
        <div className="books-f">{t("books.prices")}
          <div className="books-prices">
            {CYCLES.map((c) => (
              <label key={c} className="books-f">{t(`books.cycle.${c}`)}
                <input className="field num" type="number" min={0} step="any" value={prices[c]} onChange={(e) => setPrices({ ...prices, [c]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
        <label className="books-f">{t("books.col.setup")}<input className="field num" type="number" min={0} step="any" value={setup} onChange={(e) => setSetup(e.target.value)} /></label>
        <label><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> {t("books.col.hidden")}</label>
        <div className="actions-row">
          <button className="btn primary" type="submit"><Save />{t("pkg.save")}</button>
          <button className="btn" type="button" onClick={onDone}>{t("pkg.cancel")}</button>
          <button className="btn" type="button" onClick={() => act(removeProduct, p.id).ok && onDone()}><Trash2 />{t("pkg.delete")}</button>
        </div>
      </fieldset>
    </form>
  );
}
