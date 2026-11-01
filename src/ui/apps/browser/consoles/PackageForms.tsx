// The package screens and create forms every console draws in its own chrome.
import { useState, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { yearOf } from "../../../../sim/00-core/time";
import type { Resources, Spec } from "../../../../sim/10-catalog/products";
import type { Product } from "../../../../sim/30-customers/customers";
import { orderChoices, type OrderChoice } from "../../../../sim/30-market/manual";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { belowFloor, covers, defaultSpecFor, packageNamed, packageProducts, packageUse, packagesOf, type PackageDef } from "../../../../sim/80-business/packages";
import { provisionOrder } from "../../../../sim/90-actions/orders";
import { addPackage, changePackage, copyPackages, deletePackage, editPackage } from "../../../../sim/90-actions/packages";
import { useStore } from "../../../store";
import { noAutofill } from "../../../no-autofill";

const num = (n: number) => `${+n.toFixed(2)}`;
export const specLine = (r: Resources): string => t("pkg.specLine", { vcpu: num(r.vcpu), ram: num(r.ramGb), disk: num(r.diskGb) });

// A select of the open orders a form can take; an order that cannot be provisioned yet is listed disabled with its reason.
export function OrderPicker({ choices, value, onChange, label = t("pkg.order"), className = "cx-field" }: { choices: OrderChoice[]; value: string; onChange: (ticketId: string) => void; label?: string; className?: string }) {
  return (
    <label className={className}>{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("pkg.noOrder")}</option>
        {choices.map((o) => <option key={o.ticketId} value={o.ticketId} disabled={!!o.error}>{[o.name, o.domain].filter(Boolean).join(" · ")}{o.error ? ` (${t(o.error)})` : ""}</option>)}
      </select>
    </label>
  );
}

// The packages of an installation with how many accounts use each, and Edit, Delete and Copy to another installation.
export function PackageTable({ game, c, onEdit, className = "cx-table" }: { game: GameState; c: Cluster; onEdit: (p: PackageDef) => void; className?: string }) {
  const act = useStore((s) => s.act), web = c.kind === "panel";
  const others = game.clusters.filter((x) => x.id !== c.id && x.kind === c.kind && !!(x.panel || x.platform));
  return (
    <table className={className}>
      <thead><tr><th>{t("pkg.name")}</th><th>vCPU</th><th>{t("pkg.ram")}</th><th>{t("pkg.disk")}</th>{web && <th>{t("pkg.traffic")}</th>}{web && <th>{t("pkg.mailboxes")}</th>}<th>{t("pkg.usedBy")}</th><th /></tr></thead>
      <tbody>
        {packagesOf(c).length === 0 && <tr><td colSpan={web ? 8 : 6} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
        {packagesOf(c).map((p) => (
          <tr key={p.name}>
            <td><b>{p.name}</b></td>
            <td className="num">{num(p.spec.vcpu)}</td><td className="num">{num(p.spec.ramGb)}</td><td className="num">{num(p.spec.diskGb)}</td>
            {web && <td className="num">{num(p.spec.trafficGb)}</td>}{web && <td className="num">{num(p.spec.mailboxes)}</td>}
            <td className="num">{packageUse(game, c, p.name)}</td>
            <td className="cx-acts">
              <button className="cx-btn" onClick={() => onEdit(p)}>{t("pkg.edit")}</button>
              <button className="cx-btn danger" onClick={() => act(deletePackage, c.id, p.name)}>{t("pkg.delete")}</button>
              {others.length > 0 && (
                <select aria-label={t("pkg.copyTo")} value="" onChange={(e) => e.target.value && act(copyPackages, c.id, e.target.value)}>
                  <option value="">{t("pkg.copyTo")}</option>
                  {others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The Add and Edit form of a package. A package cannot be renamed, so the name is fixed while editing.
export function PackageFields({ game, c, editing, done, className = "cx-form" }: { game: GameState; c: Cluster; editing?: PackageDef; done: () => void; className?: string }) {
  const act = useStore((s) => s.act), products = packageProducts(c), web = (editing?.product ?? products[0]) === "webHosting";
  const [name, setName] = useState(editing?.name ?? ""), [product, setProduct] = useState<Product>(editing?.product ?? products[0]);
  const [spec, setSpec] = useState<Spec>(editing?.spec ?? defaultSpecFor(products[0], yearOf(game.hour)));
  const field = (key: keyof Spec, label: string) => (
    <label className="cx-field">{label}
      <input type="number" min={0} step="any" value={Number(spec[key] ?? 0)} onChange={(e) => setSpec({ ...spec, [key]: Number(e.target.value) })} />
    </label>
  );
  const save = () => (editing ? act(editPackage, c.id, editing.name, spec) : act(addPackage, c.id, { name, product, spec })).ok && done();
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label className="cx-field">{t("pkg.name")}<input value={name} disabled={!!editing} onChange={(e) => setName(e.target.value)} /></label>
      {products.length > 1 && !editing && (
        <label className="cx-field">{t("pkg.product")}
          <select value={product} onChange={(e) => { const p = e.target.value as Product; setProduct(p); setSpec(defaultSpecFor(p, yearOf(game.hour))); }}>
            {products.map((p) => <option key={p} value={p}>{t(`pkg.product.${p}`)}</option>)}
          </select>
        </label>
      )}
      {field("vcpu", "vCPU")}{field("ramGb", t("pkg.ram"))}{field("diskGb", t("pkg.disk"))}
      {web && field("trafficGb", t("pkg.traffic"))}{web && field("mailboxes", t("pkg.mailboxes"))}
      <div className="cx-tools">
        <button className="cx-btn primary" type="submit">{editing ? t("pkg.save") : t("pkg.add")}</button>
        {editing && <button className="cx-btn" type="button" onClick={done}>{t("pkg.cancel")}</button>}
      </div>
    </form>
  );
}

// The packages screen: the table, and the form below it for a new or an edited package.
export function PackagesScreen({ game, c }: { game: GameState; c: Cluster }) {
  const [editing, setEditing] = useState<PackageDef | null>(null);
  return (
    <>
      <PackageTable game={game} c={c} onEdit={setEditing} />
      <h2>{editing ? t("pkg.editPackage") : t("pkg.addPackage")}</h2>
      <PackageFields key={editing?.name ?? ""} game={game} c={c} editing={editing ?? undefined} done={() => setEditing(null)} />
    </>
  );
}

// The packages a form offers for an order: the ones that cover it first, then smaller ones that oversell. Below the floor none is offered.
export function packageOptions(c: Cluster, o: OrderChoice): { pkg: PackageDef; oversells: boolean }[] {
  const mine = packagesOf(c).filter((p) => p.product === o.product && !belowFloor(p, o.spec));
  return [...mine.filter((p) => covers(p, o.spec)).map((pkg) => ({ pkg, oversells: false })), ...mine.filter((p) => !covers(p, o.spec)).map((pkg) => ({ pkg, oversells: true }))];
}

// The host or node a form can book on: the installation itself, and each node of a hypervisor cluster.
export const hostChoices = (game: GameState, c: Cluster): { id: string; label: string }[] =>
  [{ id: c.id, label: c.name }, ...(c.kind === "cloud" && c.nodes.length > 1 ? c.nodes.map((n) => ({ id: n.deviceId, label: game.devices.find((d) => d.id === n.deviceId)?.hostname ?? n.deviceId })) : [])];

// The Package select: custom first, then the packages that cover the order, then the smaller ones marked.
export function PlanSelect({ c, o, value, onChange, label = t("pkg.package") }: { c: Cluster; o: OrderChoice | undefined; value: string; onChange: (name: string) => void; label?: string }) {
  return (
    <label className="cx-field">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("pkg.custom")}</option>
        {(o ? packageOptions(c, o) : []).map(({ pkg: p, oversells }) => <option key={p.name} value={p.name}>{oversells ? t("pkg.oversells", { name: p.name }) : p.name}</option>)}
      </select>
    </label>
  );
}

// The products the hypervisor forms take orders for.
export const HYPERVISOR_ORDERS: Product[] = ["vps", "gameServer", "cloud"];

// The create-account form: the Order field fills the fixed facts, the player picks host, package and username.
// sections are the console's own names for the three groups; without them the fields sit in one list.
export function ProvisionForm({ game, c, products, order, sections, className = "cx-form", button = t("pkg.create") }: {
  game: GameState; c: Cluster; products: Product[]; order?: string; sections?: { order: string; account: string; plan: string }; className?: string; button?: string;
}) {
  const act = useStore((s) => s.act), choices = orderChoices(game, products);
  const [ticket, setTicket] = useState(choices.some((o) => o.ticketId === order) ? order! : ""), [pkg, setPkg] = useState(""), [user, setUser] = useState<string | null>(null);
  const hosts = hostChoices(game, c);
  const [route, setRoute] = useState(c.id);
  const o = choices.find((x) => x.ticketId === ticket), tk = game.tickets.find((x) => x.id === ticket), web = o?.product === "webHosting";
  const username = user ?? o?.suggestedUsername ?? "";
  const group = (title: string | undefined, body: ReactNode) => (title ? <fieldset className="cx-group"><legend>{title}</legend>{body}</fieldset> : <>{body}</>);
  const run = () => o && act(provisionOrder, o.ticketId, route, { package: pkg || undefined, username: web ? username : undefined });
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); run(); }}>
      {group(sections?.order, (
        <>
          <OrderPicker choices={choices} value={ticket} onChange={(id) => { setTicket(id); setPkg(""); setUser(null); }} />
          {o && (
            <dl className="cx-summary">
              <dt>{t("pkg.fullName")}</dt><dd>{o.name}</dd>
              {o.domain && <><dt>{t("pkg.domain")}</dt><dd>{o.domain}</dd></>}
              <dt>{t("pkg.plan")}</dt><dd>{specLine(o.spec)}</dd>
              <dt>{t("pkg.city")}</dt><dd>{o.city}</dd>
            </dl>
          )}
        </>
      ))}
      {web && group(sections?.account, (
        <>
          <label className="cx-field">{t("pkg.domain")}<input value={o!.domain ?? ""} readOnly /></label>
          <label className="cx-field">{t("pkg.username")}<input value={username} onChange={(e) => setUser(e.target.value)} /></label>
          <label className="cx-field">{t("pkg.password")}<input type="password" defaultValue="correcthorse" {...noAutofill} /></label>
          <label className="cx-field">{t("pkg.email")}<input value={`contact@${o!.domain ?? ""}`} readOnly /></label>
        </>
      ))}
      {group(sections?.plan, (
        <>
          <label className="cx-field">{t("pkg.node")}
            <select value={route} onChange={(e) => setRoute(e.target.value)}>{hosts.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</select>
          </label>
          <PlanSelect c={c} o={o} value={pkg} onChange={setPkg} />
        </>
      ))}
      <div className="cx-tools">
        <button className="cx-btn primary" type="submit" disabled={!o || !!o.error || !!tk?.work || (!!pkg && !packageNamed(c, pkg))}>{button}</button>
        {tk?.work && <span className="cx-note">{t("pkg.queued")}</span>}
      </div>
    </form>
  );
}

// The packages of the host a customer's service could be moved to: its product, not below the floor of what it was sold.
export function planChoices(game: GameState, c: Cluster, serviceId: string | null | undefined): PackageDef[] {
  const v = game.services.find((x) => x.id === serviceId && x.endedAt === null);
  return v ? packagesOf(c).filter((p) => p.product === v.product && !belowFloor(p, v.spec)) : [];
}

// The inline form under an account row that books another package on it.
export function ChangePackage({ game, c, serviceId, label = t("pkg.changePlan"), done }: { game: GameState; c: Cluster; serviceId: string; label?: string; done: () => void }) {
  const act = useStore((s) => s.act), v = game.services.find((x) => x.id === serviceId), [name, setName] = useState(v?.pkg ?? "");
  return (
    <div className="cx-inline">
      <label className="cx-field">{t("pkg.package")}
        <select value={name} onChange={(e) => setName(e.target.value)}>
          {!v?.pkg && <option value="">{t("pkg.custom")}</option>}
          {planChoices(game, c, serviceId).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </label>
      <button className="cx-btn primary" disabled={!name || name === v?.pkg} onClick={() => act(changePackage, serviceId, name).ok && done()}>{label}</button>
      <button className="cx-btn" onClick={done}>{t("browser-consoles-2.cancel")}</button>
    </div>
  );
}
