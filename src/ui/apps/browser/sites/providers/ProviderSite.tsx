import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import type { Look } from "../../../../../sim/10-catalog/sites";
import { DATACENTERS, LEAD_DAYS, NOTICE_MONTHS, SPACE_SIZES, spacePrice, type Datacenter, type Provider } from "../../../../../sim/20-world/datacenters";
import { ownAddress } from "../../../../../sim/30-customers/addresses";
import type { GameState, SpaceKind } from "../../../../../sim/50-state";
import { fits } from "../../../../../sim/60-infra/status";
import { addLocation, joinWaitlist } from "../../../../../sim/90-actions/hardware";
import { formatDay } from "../../../billing/format";
import { backupLabel, exchangeLabel, feedsLabel, shareUnits, spaceSize } from "../../../locations/ui";
import { usePageAct } from "../../pageAct";
import "./providers.css";

// docs/design/plans/colo-portals.md, section 4: the pages every provider site shares; each provider lays them out in its own look.
export type Rented = Exclude<SpaceKind, "basement">;
export type Route =
  | { page: "home" }
  | { page: "sites" }
  | { page: "site"; dc: Datacenter }
  | { page: "order"; dc: string | null; space: string | null; size: number }
  | { page: "account" }
  | { page: "notfound" };
export interface ProviderProps { game: GameState; p: Provider; look: Look; route: Route; year: number; go: (path: string) => void }

export const dcsOf = (id: string): Datacenter[] => DATACENTERS.filter((d) => d.provider === id);
export const citiesOf = (id: string): string[] => [...new Set(dcsOf(id).map((d) => d.city))];
// The cheapest space the provider rents, for a "from" price.
export const fromPrice = (id: string): number => Math.min(...dcsOf(id).map((d) => spacePrice(d, "share", 8)));

export function routeOf(id: string, path: string): Route {
  const [base, query = ""] = path.split("?"), [top, sub] = base.split("/").filter(Boolean);
  if (!top) return { page: "home" };
  if (top === "sites") {
    const dc = sub && dcsOf(id).find((d) => d.id === sub);
    return !sub ? { page: "sites" } : dc ? { page: "site", dc } : { page: "notfound" };
  }
  if (top === "order") {
    const q = new URLSearchParams(query);
    return { page: "order", dc: q.get("dc"), space: q.get("space"), size: Number(q.get("size")) };
  }
  if (top === "account") return { page: "account" };
  return { page: "notfound" };
}

const PATH = { home: "/", sites: "/sites", order: "/order", account: "/account" } as const;
export type Section = keyof typeof PATH;
const sectionOf = (r: Route): Section | null => (r.page === "site" ? "sites" : r.page === "notfound" ? null : r.page);

export const A = ({ to, go, className, current, children }: { to: string; go: ProviderProps["go"]; className?: string; current?: boolean; children: ReactNode }) => (
  <a href={`#${to}`} className={className} aria-current={current ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);

// The sections in the order given, each labelled by the provider or by default.
export function Nav({ route, go, className, items = ["home", "sites", "order", "account"], labels }: Pick<ProviderProps, "route" | "go"> & { className?: string; items?: Section[]; labels?: Partial<Record<Section, string>> }) {
  const at = sectionOf(route);
  return (
    <nav className={className}>
      {items.map((x) => <A key={x} to={PATH[x]} go={go} current={x === at}>{labels?.[x] ?? sectionTitle(x)}</A>)}
    </nav>
  );
}
export const sectionTitle = (x: Section): string => ({ home: t("providers.home"), sites: t("providers.sites"), order: t("providers.order"), account: t("providers.portal") })[x];
export const titleOf = (r: Route): string => (r.page === "site" ? r.dc.name : r.page === "order" ? t("providers.orderTitle") : r.page === "notfound" ? t("providers.notFound") : sectionTitle(r.page));

const yesNo = (v: boolean) => (v ? t("providers.yes") : t("providers.no"));
const kwOf = (dc: Datacenter, space: Rented, size: number) => +(space === "share" ? dc.kwPerPosition / size : dc.kwPerPosition * size).toFixed(2);
const spaceText = (space: Rented, size: number) => (space === "share" ? `${spaceSize(space, size)}, ${shareUnits(size)} U` : spaceSize(space, size));
const kinds = (dc: Datacenter): Rented[] => (["share", "cage", "suite"] as Rented[]).filter((k) => k !== "cage" || dc.cages);
export const orderPath = (dc: Datacenter, space: Rented, size: number) => `/order?dc=${dc.id}&space=${space}&size=${size}`;

// Every site of the provider with what sets it apart.
export function SitesList({ p, go, className }: { p: Provider; go: ProviderProps["go"]; className?: string }) {
  return (
    <table className={`ps-table ${className ?? ""}`}>
      <thead><tr><th>{t("providers.site")}</th><th>{t("providers.city")}</th><th className="ps-num">{t("providers.carriers")}</th><th>{t("providers.exchange")}</th><th>{t("providers.power")}</th><th>{t("providers.green")}</th><th>{t("providers.certified")}</th></tr></thead>
      <tbody>
        {dcsOf(p.id).map((d) => (
          <tr key={d.id}>
            <td><A to={`/sites/${d.id}`} go={go}>{d.name}</A></td><td>{d.city}</td><td className="ps-num">{d.carriers}</td><td>{exchangeLabel(d)}</td>
            <td>{feedsLabel(d)}, {backupLabel(d)}</td><td>{yesNo(d.green)}</td><td>{yesNo(d.certified)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SiteFacts({ dc, className }: { dc: Datacenter; className?: string }) {
  const rows: [string, ReactNode][] = [
    [t("providers.city"), dc.city], [t("providers.carriers"), dc.carriers], [t("providers.exchange"), exchangeLabel(dc)],
    [t("providers.feeds"), feedsLabel(dc)], [t("providers.backup"), backupLabel(dc)], [t("providers.green"), yesNo(dc.green)],
    [t("providers.certified"), yesNo(dc.certified)], [t("providers.cages"), yesNo(dc.cages)],
    [t("providers.remoteHands"), t("providers.handsValue", { price: euro(dc.remoteHands.perHour), hours: dc.remoteHands.responseHours })],
    [t("providers.crossConnect"), euro(dc.crossConnect)],
  ];
  return <dl className={`ps-facts ${className ?? ""}`}>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

// One row per space the site rents, with what it costs, when it is ready and whether it is free.
export function PriceTable({ game, dc, go, className }: { game: GameState; dc: Datacenter; go: ProviderProps["go"]; className?: string }) {
  const act = usePageAct();
  return (
    <table className={`ps-table ps-prices ${className ?? ""}`}>
      <thead><tr><th>{t("providers.space")}</th><th className="ps-num">{t("providers.power")}</th><th className="ps-num">{t("providers.readyIn")}</th><th className="ps-num">{t("providers.perMonth")}</th><th>{t("providers.availability")}</th><th /></tr></thead>
      <tbody>
        {kinds(dc).flatMap((k) => SPACE_SIZES[k].map((n) => {
          const wait = game.waitlist.find((w) => w.dc === dc.id && w.space === k && w.size === n), open = fits(game, dc.id, k, n) || wait?.heldUntil != null;
          return (
            <tr key={`${k}-${n}`}>
              <td>{spaceText(k, n)}</td><td className="ps-num">{kwOf(dc, k, n)} kW</td><td className="ps-num">{t("providers.days", { n: LEAD_DAYS[k] })}</td><td className="ps-num">{euro(spacePrice(dc, k, n))}</td>
              <td><span className={`ps-pill ${open ? "ok" : "bad"}`}>{wait?.heldUntil != null ? t("providers.held") : open ? t("providers.available") : wait ? t("providers.waiting") : t("providers.full")}</span></td>
              <td>{open ? <A to={orderPath(dc, k, n)} go={go} className="ps-btn pri">{t("providers.orderNow")}</A> : !wait && <button className="ps-btn" onClick={() => act(joinWaitlist, dc.id, k, n)}>{t("providers.joinWaitlist")}</button>}</td>
            </tr>
          );
        }))}
      </tbody>
    </table>
  );
}

export function SiteDetail({ game, dc, go, className }: { game: GameState; dc: Datacenter; go: ProviderProps["go"]; className?: string }) {
  return (
    <div className={className}>
      <h2>{t("providers.facts")}</h2>
      <SiteFacts dc={dc} />
      <h2>{t("providers.prices")}</h2>
      <PriceTable game={game} dc={dc} go={go} />
    </div>
  );
}

type Step = 1 | 2 | 3 | "ordered" | "waiting";

// Three steps: space, contact details prefilled from the company, summary. Confirming rents the space or joins the waitlist.
export function OrderForm({ game, p, route, className }: { game: GameState; p: Provider; route: Extract<Route, { page: "order" }>; className?: string }) {
  const act = usePageAct(), sites = dcsOf(p.id);
  const [step, setStep] = useState<Step>(1);
  const [dcId, setDc] = useState(sites.some((d) => d.id === route.dc) ? route.dc! : sites[0].id);
  const [kind, setKind] = useState(route.space as Rented);
  const [size, setSize] = useState(route.size);
  const [readyAt, setReadyAt] = useState(0);
  const own = ownAddress(game);
  const [contact, setContact] = useState({ company: game.company.name, contact: own.contact, street: own.street, town: `${own.zip} ${own.city}`, email: own.email });
  const dc = sites.find((d) => d.id === dcId)!;
  const k: Rented = kinds(dc).includes(kind) ? kind : "share";
  const n = SPACE_SIZES[k].includes(size) ? size : SPACE_SIZES[k][0];
  const open = fits(game, dc.id, k, n) || game.waitlist.some((w) => w.dc === dc.id && w.space === k && w.size === n && w.heldUntil !== null);
  const place = () => {
    if (!open) { if (act(joinWaitlist, dc.id, k, n).ok) setStep("waiting"); return; }
    if (act(addLocation, dc.id, k, n).ok) { setReadyAt(game.hour + 24 * LEAD_DAYS[k]); setStep("ordered"); }
  };
  const summary: [string, ReactNode][] = [
    [t("providers.site"), dc.name], [t("providers.space"), spaceText(k, n)], [t("providers.power"), `${kwOf(dc, k, n)} kW`],
    [t("providers.perMonth"), euro(spacePrice(dc, k, n))], [t("providers.term"), t("providers.termValue")], [t("providers.notice"), t("providers.noticeValue", { n: NOTICE_MONTHS[k] })],
  ];
  const Kv = ({ rows }: { rows: [string, ReactNode][] }) => <dl className="ps-kv">{rows.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>;

  if (step === "ordered" || step === "waiting") {
    return (
      <div className={`ps-order ${className ?? ""}`}>
        <h2>{step === "ordered" ? t("providers.confirmed") : t("providers.waitlisted")}</h2>
        <Kv rows={[...summary.slice(0, 2), ...(step === "ordered" ? [[t("providers.ready"), formatDay(readyAt)] as [string, ReactNode]] : [])]} />
      </div>
    );
  }
  const field = (key: keyof typeof contact, label: string) => (
    <label className="ps-field" key={key}><span>{label}</span><input value={contact[key]} onChange={(e) => setContact({ ...contact, [key]: e.target.value })} /></label>
  );
  return (
    <div className={`ps-order ${className ?? ""}`}>
      <ol className="ps-steps">
        {[t("providers.step1"), t("providers.step2"), t("providers.step3")].map((s, i) => <li key={s} className={i + 1 === step ? "now" : i + 1 < step ? "done" : ""}>{s}</li>)}
      </ol>
      {step === 1 && <>
        <label className="ps-field"><span>{t("providers.site")}</span>
          <select value={dc.id} onChange={(e) => setDc(e.target.value)}>{sites.map((d) => <option key={d.id} value={d.id}>{d.name}, {d.city}</option>)}</select>
        </label>
        <label className="ps-field"><span>{t("providers.space")}</span>
          <select value={`${k}-${n}`} onChange={(e) => { const [a, b] = e.target.value.split("-"); setKind(a as Rented); setSize(Number(b)); }}>
            {kinds(dc).flatMap((x) => SPACE_SIZES[x].map((s) => <option key={`${x}-${s}`} value={`${x}-${s}`}>{spaceText(x, s)}, {euro(spacePrice(dc, x, s))}</option>))}
          </select>
        </label>
        <Kv rows={[[t("providers.power"), `${kwOf(dc, k, n)} kW`], [t("providers.readyIn"), t("providers.days", { n: LEAD_DAYS[k] })], [t("providers.availability"), open ? t("providers.available") : t("providers.full")]]} />
        <div className="ps-actions"><button className="ps-btn pri" onClick={() => setStep(2)}>{t("providers.next")}</button></div>
      </>}
      {step === 2 && <>
        {field("company", t("providers.company"))}{field("contact", t("providers.contact"))}{field("street", t("providers.street"))}{field("town", t("providers.city"))}{field("email", t("providers.email"))}
        <div className="ps-actions"><button className="ps-btn" onClick={() => setStep(1)}>{t("providers.back")}</button><button className="ps-btn pri" onClick={() => setStep(3)}>{t("providers.next")}</button></div>
      </>}
      {step === 3 && <>
        <Kv rows={[...summary, [t("providers.ready"), open ? formatDay(game.hour + 24 * LEAD_DAYS[k]) : t("providers.full")], [t("providers.contact"), `${contact.company}, ${contact.contact}, ${contact.email}`]]} />
        <div className="ps-actions"><button className="ps-btn" onClick={() => setStep(2)}>{t("providers.back")}</button><button className="ps-btn pri" onClick={place}>{open ? t("providers.placeOrder") : t("providers.joinWaitlist")}</button></div>
      </>}
    </div>
  );
}

// Until the customer portal exists, every page under /account is its sign-in.
export function SignIn({ className }: { className?: string }) {
  return (
    <form className={`ps-signin ${className ?? ""}`} onSubmit={(e) => e.preventDefault()}>
      <label className="ps-field"><span>{t("providers.email")}</span><input type="email" /></label>
      <label className="ps-field"><span>{t("providers.password")}</span><input type="password" /></label>
      <div className="ps-actions"><button className="ps-btn pri" disabled>{t("providers.signIn")}</button></div>
    </form>
  );
}

// The body of every page but home, which each site lays out itself.
export function Body({ game, p, route, go, className }: ProviderProps & { className?: string }) {
  if (route.page === "sites") return <SitesList p={p} go={go} className={className} />;
  if (route.page === "site") return <SiteDetail game={game} dc={route.dc} go={go} className={className} />;
  if (route.page === "order") return <OrderForm game={game} p={p} route={route} className={className} />;
  if (route.page === "account") return <SignIn className={className} />;
  return null;
}
