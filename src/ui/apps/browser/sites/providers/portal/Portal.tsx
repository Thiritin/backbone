import { useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { euro } from "../../../../../../sim/00-core/money";
import {
  crossConnectSetup, DATACENTERS, datacenterById, EXTRA_POWER_LEAD_DAYS, EXTRA_STEP_KW, extraStepPrice, FLAT_CONTRACTS, flatMonthly, maxExtraKw,
  NOTICE_MONTHS, PROVIDERS, rackUnits, RETENTION_PROVIDERS, SHARE_RACKS, type Provider,
} from "../../../../../../sim/20-world/datacenters";
import { yearOf } from "../../../../../../sim/00-core/time";
import { crossConnectTargets, targetName } from "../../../../../../sim/10-catalog/network";
import type { Contract, GameState, LedgerEntry } from "../../../../../../sim/50-state";
import { flatOffer } from "../../../../../../sim/60-infra/status";
import { FEED_PRICE } from "../../../../../../sim/88-tick/tick";
import { cancelContract, cancelCrossConnect, noticeEnd, orderCrossConnect, revokeCancel, setExtraPower, setFeed, setFlatPower } from "../../../../../../sim/90-actions/hardware";
import { useSessionState } from "../../../../../session";
import { Page } from "../../../../books/InvoicesTab";
import { formatDay } from "../../../../billing/format";
import { monthYear } from "../../../../support/labels";
import { useFieldAct, usePageAct } from "../../../pageAct";
import { A, ownAddress, SignIn, spaceText, type ProviderProps, type Route } from "../ProviderSite";
import "../../../../books/books.css";
import "./portal.css";

// docs/design/plans/colo-portals.md, section 5: the customer portal under /account, shared by every provider's design.
type Props = Pick<ProviderProps, "game" | "p" | "go"> & { route: Extract<Route, { page: "account" }>; className?: string };
const SECTIONS = ["contracts", "invoices", "services", "tickets", "profile"] as const;
const RENT = new Set(["ledger.space", "ledger.feed", "ledger.flatPower", "ledger.crossConnect", "ledger.crossConnectSetup"]);

const byProvider = (id: string, e: LedgerEntry) => DATACENTERS.find((d) => d.id === e.params.dc)?.provider === id;
export const contractNo = (c: Contract) => `C-${c.id.replace(/\D/g, "")}`;
const customerNo = (game: GameState, p: Provider) => String(10000 + ((game.seed * 7919 + PROVIDERS.indexOf(p) * 104729) % 90000));
const day = (h: number) => formatDay(h);
const kw = (n: number) => `${n.toLocaleString(LOCALE)} kW`;
// A contract ends at midnight; its last day is the one before.
const lastDay = (h: number) => formatDay(h - 1);

export interface PortalInvoice { no: string; hour: number; paid: boolean; lines: LedgerEntry[] }
// The provider's monthly charges: paid ones from the ledger, unpaid ones from the open supplier invoices, newest first.
export function providerInvoices(s: GameState, id: string): PortalInvoice[] {
  const lines = [
    ...s.ledger.filter((e) => RENT.has(e.key) && byProvider(id, e)).map((e) => ({ e, paid: true })),
    ...s.payables.filter((x) => x.supplier === "datacenter" && x.paidAt === null).flatMap((x) => x.lines.filter((e) => byProvider(id, e)).map((e) => ({ e, paid: false }))),
  ];
  const groups = new Map<string, PortalInvoice>();
  for (const { e, paid } of lines) {
    const k = `${e.hour}-${paid}`, g = groups.get(k) ?? { no: "", hour: e.hour, paid, lines: [] };
    g.lines.push(e);
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => a.hour - b.hour).map((g, i) => ({ ...g, no: `${100000 + i + 1}` })).reverse();
}

// Remote-hands jobs the player booked at this provider's sites.
export const providerTickets = (s: GameState, id: string) =>
  s.ledger.map((e, i) => ({ e, no: `RH-${1000 + i}` })).filter(({ e }) => e.key === "ledger.remoteHands" && byProvider(id, e)).reverse();

const total = (lines: LedgerEntry[]) => 0 - lines.reduce((n, e) => n + e.amount, 0);
const Pill = ({ ok, children }: { ok: boolean | "warn"; children: ReactNode }) => <span className={`ps-pill ${ok === "warn" ? "warn" : ok ? "ok" : "bad"}`}>{children}</span>;
const Kv = ({ rows }: { rows: [string, ReactNode][] }) => <dl className="ps-kv">{rows.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>;

function Status({ game, c }: { game: GameState; c: Contract }) {
  const loc = game.locations.find((l) => l.id === c.locationId);
  if (loc && loc.readyAt > game.hour) return <Pill ok="warn">{t("portal.provisioning")}</Pill>;
  if (c.endsAt !== null) return <Pill ok={false}>{t("portal.ends", { day: lastDay(c.endsAt) })}</Pill>;
  return <Pill ok>{t("portal.active")}</Pill>;
}

const nextInvoice = (game: GameState, c: Contract) => {
  const at = noticeEnd(game.hour, 0);
  return c.endsAt !== null && c.endsAt <= at ? "" : day(at);
};

function Contracts({ game, p, go }: Props) {
  const mine = game.contracts.filter((c) => c.provider === p.id);
  if (!mine.length) return <p className="ps-portal-empty">{t("portal.noContracts")}</p>;
  return (
    <table className="ps-table ps-contracts">
      <thead><tr><th>{t("portal.contract")}</th><th>{t("providers.site")}</th><th>{t("providers.space")}</th><th>{t("portal.since")}</th><th className="ps-num">{t("providers.perMonth")}</th><th>{t("portal.nextInvoice")}</th><th>{t("portal.status")}</th></tr></thead>
      <tbody>
        {mine.map((c) => (
          <tr key={c.id}>
            <td><A to={`/account/contracts/${c.id}`} go={go}>{contractNo(c)}</A></td><td>{datacenterById(c.dc).name}</td><td>{spaceText(c.space, c.positions)}</td>
            <td>{day(c.since)}</td><td className="ps-num">{euro(c.monthly)}</td><td>{nextInvoice(game, c)}</td><td><Status game={game} c={c} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContractDetail({ game, p, id }: Props & { id: string }) {
  const act = usePageAct(), [sheet, setSheet] = useState(false);
  const c = game.contracts.find((x) => x.id === id && x.provider === p.id);
  if (!c) return <p className="ps-portal-empty">{t("providers.notFound")}</p>;
  const racks = game.racks.filter((r) => r.locationId === c.locationId);
  const offer = RETENTION_PROVIDERS.includes(p.id) && c.retainedAt === null;
  const xcs = game.crossConnects.filter((x) => x.contractId === c.id);
  return (
    <div className="ps-contract">
      <h3 className="ps-portal-h">{t("portal.contractTitle", { n: contractNo(c), site: datacenterById(c.dc).name })}</h3>
      <Kv rows={[
        [t("providers.space"), spaceText(c.space, c.positions)], [t("portal.since"), day(c.since)], [t("providers.perMonth"), euro(c.monthly)],
        [t("providers.notice"), t("providers.noticeValue", { n: NOTICE_MONTHS[c.space] })], [t("portal.nextInvoice"), nextInvoice(game, c)], [t("portal.status"), <Status game={game} c={c} />],
      ]} />
      {c.endsAt === null
        ? <div className="ps-actions"><button className="ps-btn ps-danger" onClick={() => setSheet(true)}>{t("portal.cancel")}</button></div>
        : <>
          {offer && (
            <div className="ps-offer">
              <strong>{t("portal.offerTitle")}</strong>
              <p>{t("portal.offerText", { amount: euro(c.monthly) })}</p>
              <button className="ps-btn pri" onClick={() => act(revokeCancel, c.id, true)}>{t("portal.acceptOffer")}</button>
            </div>
          )}
          <div className="ps-actions"><button className="ps-btn" onClick={() => act(revokeCancel, c.id)}>{t("portal.revoke")}</button></div>
        </>}
      <h3 className="ps-portal-h">{t("portal.racks")}</h3>
      <table className="ps-table ps-racks">
        <thead><tr><th>{t("portal.rack")}</th><th className="ps-num">{t("portal.height")}</th><th>{t("providers.feeds")}</th><th>{t("portal.powerContract")}</th><th className="ps-num">{t("portal.extraPower")}</th></tr></thead>
        <tbody>
          {racks.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td className="ps-num">{rackUnits(r.model)} U</td><td>{r.feedB ? "A + B" : "A"}</td>
              <td>{r.flatKw ? t("portal.flat", { kw: r.flatKw }) : t("portal.metered")}</td><td className="ps-num">{kw(r.extraKw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!racks.length && <p className="ps-portal-empty">{t("portal.noRacks")}</p>}
      <h3 className="ps-portal-h">{t("portal.crossConnects")}</h3>
      {xcs.length ? (
        <table className="ps-table">
          <thead><tr><th>{t("portal.partner")}</th><th>{t("portal.since")}</th><th className="ps-num">{t("providers.perMonth")}</th><th /></tr></thead>
          <tbody>
            {xcs.map((x) => (
              <tr key={x.id}>
                <td>{targetName(x.to)}</td><td>{day(x.since)}</td><td className="ps-num">{euro(x.monthly)}</td>
                <td className="ps-num"><button className="ps-btn" onClick={() => act(cancelCrossConnect, x.id)}>{t("portal.disconnect")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="ps-portal-empty">{t("portal.noCrossConnects")}</p>}
      <div className="ps-actions"><OrderCrossConnect game={game} c={c} /></div>
      {sheet && <CancelSheet game={game} c={c} onClose={() => setSheet(false)} />}
    </div>
  );
}

// The confirm step: when the contract would end and what the space must be emptied of by then.
function CancelSheet({ game, c, onClose }: { game: GameState; c: Contract; onClose: () => void }) {
  const [act, error] = useFieldAct();
  const ends = noticeEnd(game.hour, NOTICE_MONTHS[c.space]);
  const racks = game.racks.filter((r) => r.locationId === c.locationId);
  const mounted = game.devices.filter((d) => racks.some((r) => r.id === d.rackId)).length;
  const stored = game.devices.filter((d) => d.store === c.locationId || d.transitTo === c.locationId).length;
  const confirm = () => { if (act(cancelContract, c.id).ok) onClose(); };
  return (
    <div className="ps-sheet-veil">
      <div className="ps-sheet" role="dialog" aria-label={t("portal.cancelTitle", { n: contractNo(c) })}>
        <h3 className="ps-sheet-h">{t("portal.cancelTitle", { n: contractNo(c) })}</h3>
        <div className="ps-sheet-b">
          <Kv rows={[[t("providers.notice"), t("providers.noticeValue", { n: NOTICE_MONTHS[c.space] })], [t("portal.endsOn"), <strong>{lastDay(ends)}</strong>]]} />
          <h4>{t("portal.mustBeEmpty")}</h4>
          <Kv rows={[[t("portal.inRacks"), mounted], [t("portal.inStorage"), stored], [t("portal.ownRacks"), racks.filter((r) => !r.provided).length]]} />
          <p>{t("portal.revocable", { day: lastDay(ends) })}</p>
          {error && <p className="ps-error">{t(error)}</p>}
        </div>
        <div className="ps-sheet-f ps-actions">
          <button className="ps-btn" onClick={onClose}>{t("portal.keep")}</button>
          <button className="ps-btn ps-danger" onClick={confirm}>{t("portal.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// The order step: the target, the setup fee and the monthly price before the player confirms.
function CrossConnectSheet({ game, c, onClose }: { game: GameState; c: Contract; onClose: () => void }) {
  const [act, error] = useFieldAct(), dc = datacenterById(c.dc), targets = crossConnectTargets(dc);
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const confirm = () => { if (act(orderCrossConnect, c.id, to).ok) onClose(); };
  return (
    <div className="ps-sheet-veil">
      <div className="ps-sheet" role="dialog" aria-label={t("portal.orderCrossConnect")}>
        <h3 className="ps-sheet-h">{t("portal.orderCrossConnect")}</h3>
        <div className="ps-sheet-b">
          <Kv rows={[
            [t("providers.site"), dc.name],
            [t("portal.partner"), <select value={to} onChange={(e) => setTo(e.target.value)}>{targets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>],
            [t("portal.setupFee"), euro(crossConnectSetup(dc))], [t("providers.perMonth"), euro(dc.crossConnect)], [t("portal.billedFrom"), monthYear(noticeEnd(game.hour, 0))],
          ]} />
          {error && <p className="ps-error">{t(error)}</p>}
        </div>
        <div className="ps-sheet-f ps-actions">
          <button className="ps-btn" onClick={onClose}>{t("providers.back")}</button>
          <button className="ps-btn pri" onClick={confirm}>{t("portal.order")}</button>
        </div>
      </div>
    </div>
  );
}

function OrderCrossConnect({ game, c }: { game: GameState; c: Contract }) {
  const [open, setOpen] = useState(false);
  if (c.endsAt !== null) return null;
  return <>
    <button className="ps-btn" onClick={() => setOpen(true)}>{t("portal.orderCrossConnect")}</button>
    {open && <CrossConnectSheet game={game} c={c} onClose={() => setOpen(false)} />}
  </>;
}

function Invoices({ game, p, go }: Props) {
  const list = providerInvoices(game, p.id);
  if (!list.length) return <p className="ps-portal-empty">{t("portal.noInvoices")}</p>;
  return (
    <table className="ps-table ps-invoices">
      <thead><tr><th>{t("portal.number")}</th><th>{t("portal.date")}</th><th className="ps-num">{t("portal.amount")}</th><th>{t("portal.status")}</th></tr></thead>
      <tbody>
        {list.map((i) => (
          <tr key={i.no}>
            <td><A to={`/account/invoices/${i.no}`} go={go}>{i.no}</A></td><td>{day(i.hour)}</td>
            <td className="ps-num">{euro(total(i.lines))}</td><td><Pill ok={i.paid}>{i.paid ? t("portal.paid") : t("portal.open")}</Pill></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvoiceView({ game, p, go, no }: Props & { no: string }) {
  const inv = providerInvoices(game, p.id).find((i) => i.no === no);
  if (!inv) return <p className="ps-portal-empty">{t("providers.notFound")}</p>;
  const own = ownAddress(game);
  return (
    <div className="ps-invoice">
      <div className="ps-actions"><A to="/account/invoices" go={go} className="ps-btn">{t("providers.back")}</A></div>
      <div className="books-preview">
        <Page game={game} title={t("portal.invoice", { n: inv.no })} from={[p.name, datacenterById(String(inv.lines[0].params.dc)).city].join(" · ")}
          to={own} items={inv.lines.map((e) => ({ serviceId: null, key: e.key, params: e.params, amount: 0 - e.amount }))}
          footer={<><span>{day(inv.hour)}</span><Pill ok={inv.paid}>{inv.paid ? t("portal.paid") : t("portal.open")}</Pill></>} />
      </div>
    </div>
  );
}

// Rack options the provider bills monthly: extra power on a share, feed B and the power contract on own racks.
function Services({ game, p }: Props) {
  const act = usePageAct(), year = yearOf(game.hour), mine = game.contracts.filter((c) => c.provider === p.id);
  if (!mine.length) return <p className="ps-portal-empty">{t("portal.noContracts")}</p>;
  const from = (h: number) => monthYear(noticeEnd(h, 0));
  const lead = game.hour + 24 * EXTRA_POWER_LEAD_DAYS;
  return <>{mine.map((c) => {
    const dc = datacenterById(c.dc), rows: { key: string; name: string; value: ReactNode; price: string; from: string }[] = [];
    for (const r of game.racks.filter((x) => x.locationId === c.locationId)) {
      if (r.provided) {
        const size = SHARE_RACKS.find((m) => m.id === r.model)?.size ?? 1, target = r.extraKwAt?.kw ?? r.extraKw;
        const steps = Array.from({ length: Math.floor(maxExtraKw(dc, size) / EXTRA_STEP_KW) + 1 }, (_, i) => +(i * EXTRA_STEP_KW).toFixed(2));
        rows.push({
          key: `${r.id}-x`, name: `${t("portal.extraPower")}, ${r.name}`, price: euro((target / EXTRA_STEP_KW) * extraStepPrice(dc)), from: r.extraKwAt ? from(r.extraKwAt.at) : target ? "" : from(lead),
          value: <select value={target} onChange={(e) => act(setExtraPower, r.id, Number(e.target.value))}>{steps.map((x) => <option key={x} value={x}>{kw(x)}</option>)}</select>,
        });
        continue;
      }
      rows.push({
        key: `${r.id}-b`, name: `${t("portal.feedB")}, ${r.name}`, price: euro(Math.round(FEED_PRICE.feedB * dc.positionPrice)), from: r.feedB ? "" : from(game.hour),
        value: <button className="ps-btn" onClick={() => act(setFeed, r.id, "b", !r.feedB)}>{r.feedB ? t("portal.remove") : t("portal.book")}</button>,
      });
      const offer = flatOffer(game, r.locationId);
      if (offer === "metered") continue;
      const target = r.flatKwAt?.kw ?? r.flatKw, kws = [...(offer === "both" ? [0] : []), ...FLAT_CONTRACTS.map((x) => x.kw)];
      rows.push({
        key: `${r.id}-f`, name: `${t("portal.powerContract")}, ${r.name}`, price: target ? euro(flatMonthly(dc, target, year)) : t("portal.perKwh"), from: r.flatKwAt ? from(r.flatKwAt.at) : "",
        value: <select value={target} onChange={(e) => act(setFlatPower, r.id, Number(e.target.value))}>{kws.map((kw) => <option key={kw} value={kw}>{kw ? t("portal.flat", { kw }) : t("portal.metered")}</option>)}</select>,
      });
    }
    for (const x of game.crossConnects.filter((k) => k.contractId === c.id)) {
      rows.push({
        key: x.id, name: t("ledger.crossConnect", { to: targetName(x.to) }), price: euro(x.monthly), from: noticeEnd(x.since, 0) > game.hour ? from(x.since) : "",
        value: <button className="ps-btn" onClick={() => act(cancelCrossConnect, x.id)}>{t("portal.disconnect")}</button>,
      });
    }
    rows.push({ key: `${c.id}-x`, name: t("portal.crossConnect"), value: <OrderCrossConnect game={game} c={c} />, price: euro(dc.crossConnect), from: "" });
    rows.push({ key: `${c.id}-h`, name: t("providers.remoteHands"), value: t("portal.response", { n: dc.remoteHands.responseHours }), price: t("portal.perHour", { price: euro(dc.remoteHands.perHour) }), from: "" });
    return (
      <section key={c.id} className="ps-services">
        <h3 className="ps-portal-h">{t("portal.contractTitle", { n: contractNo(c), site: dc.name })}</h3>
        <table className="ps-table">
          <thead><tr><th>{t("portal.service")}</th><th>{t("portal.booked")}</th><th className="ps-num">{t("providers.perMonth")}</th><th>{t("portal.billedFrom")}</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.key}><td>{x.name}</td><td>{x.value}</td><td className="ps-num">{x.price}</td><td>{x.from}</td></tr>)}</tbody>
        </table>
      </section>
    );
  })}</>;
}

function Tickets({ game, p }: Props) {
  const list = providerTickets(game, p.id);
  if (!list.length) return <p className="ps-portal-empty">{t("portal.noTickets")}</p>;
  return (
    <table className="ps-table ps-tickets">
      <thead><tr><th>{t("portal.ticket")}</th><th>{t("providers.site")}</th><th>{t("portal.work")}</th><th>{t("portal.opened")}</th><th className="ps-num">{t("portal.responseTime")}</th><th>{t("portal.status")}</th><th className="ps-num">{t("portal.billed")}</th></tr></thead>
      <tbody>
        {list.map(({ e, no }) => {
          const dc = datacenterById(String(e.params.dc)), done = game.hour >= Number(e.params.done ?? 0);
          return (
            <tr key={no}>
              <td>{no}</td><td>{dc.name}</td><td>{t(e.key, e.params)}</td><td>{day(e.hour)}</td><td className="ps-num">{dc.remoteHands.responseHours} h</td>
              <td><Pill ok={done || "warn"}>{done ? t("portal.done") : t("portal.scheduled")}</Pill></td><td className="ps-num">{euro(-e.amount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Profile({ game, p }: Props) {
  const own = ownAddress(game);
  return <Kv rows={[
    [t("portal.customerNo"), customerNo(game, p)], [t("providers.company"), game.company.name], [t("providers.contact"), own.contact],
    [t("providers.street"), own.street], [t("providers.city"), `${own.zip} ${own.city}`], [t("providers.email"), own.email],
  ]} />;
}

// The signed-in portal: a bar with the customer, a menu of the sections and the page.
export function PortalShell(props: Props & { signOut: () => void }) {
  const { game, p, go, route, className, signOut } = props, [top = "contracts", id] = route.sub;
  const at = (SECTIONS as readonly string[]).includes(top) ? top : "contracts";
  const page = at === "contracts" ? (id ? <ContractDetail {...props} id={id} /> : <Contracts {...props} />)
    : at === "invoices" ? (id ? <InvoiceView {...props} no={id} /> : <Invoices {...props} />)
    : at === "services" ? <Services {...props} /> : at === "tickets" ? <Tickets {...props} /> : <Profile {...props} />;
  return (
    <div className={`ps-portal ${className ?? ""}`}>
      <div className="ps-portal-bar">
        <span className="ps-portal-who"><strong>{game.company.name}</strong><span>{t("portal.customer", { n: customerNo(game, p) })}</span></span>
        <button className="ps-portal-out" onClick={signOut}>{t("portal.signOut")}</button>
      </div>
      <div className="ps-portal-frame">
        <div className="ps-portal-nav" role="navigation">
          {SECTIONS.map((x) => <A key={x} to={`/account/${x}`} go={go} current={x === at}>{t(`portal.nav.${x}`)}</A>)}
        </div>
        <div className="ps-portal-main">
          <h2 className="ps-portal-title">{t(`portal.nav.${at}`)}</h2>
          {page}
        </div>
      </div>
    </div>
  );
}

// Every page under /account: the sign-in until the player signs in, which lasts while the tab is open.
export function Portal(props: Props) {
  const [on, setOn] = useSessionState(`provider.${props.p.id}.signedIn`, false);
  if (!on) return <SignIn game={props.game} className={props.className} onSignIn={() => setOn(true)} />;
  return <PortalShell {...props} signOut={() => setOn(false)} />;
}
