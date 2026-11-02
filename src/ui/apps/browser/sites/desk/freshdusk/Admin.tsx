import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { DESK_ROUTE, deskById, deskHas, seats, tenantHost } from "../../../../../../sim/10-catalog/desks";
import { PROFILES } from "../../../../../../sim/10-catalog/economy";
import { deskItem, monthlyCharge } from "../../../../../../sim/10-catalog/store";
import type { DeskRule } from "../../../../../../sim/40-support/desk";
import { deskRecords } from "../../../../../../sim/40-support/desk-records";
import { slaPlans } from "../../../../../../sim/40-support/desk-reports";
import { OWNER, PRIORITIES } from "../../../../../../sim/40-support/desk-work";
import { TEMPLATES, type TicketKind } from "../../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../../sim/50-state";
import { registrarUrl } from "../../../../../../sim/80-business/browser";
import { deskPath } from "../../../../../../sim/80-business/deskroutes";
import { addDepartment, addDeskChannel, addRule, removeDepartment, removeDeskChannel, removeRule, testDeskChannel } from "../../../../../../sim/90-actions/desk";
import { removeDesk, verifyDesk, verifyForwarding } from "../../../../../../sim/90-actions/desk-install";
import { Confirm } from "../../../../../desktop/Confirm";
import { useStore } from "../../../../../store";
import { AiSwitches, aiFeatures } from "../headless/AiPage";
import { agentName, SCENARIOS } from "./Agent";
import { Panel, type FdProps, type Look } from "./FreshduskSite";

type Section = "helpdesk" | "portal" | "email" | "agents" | "groups" | "canned" | "scenarios" | "dispatcher" | "supervisor" | "observer" | "sla" | "account" | "ai";
const RULES: Section[] = ["dispatcher", "supervisor", "observer"];

// The Admin page per look: Helpdesk Settings, Helpdesk Productivity and General Settings, regrouped by Mint.
function groups(look: Look, sla: boolean, ai: Section[]): [string, Section[]][] {
  const s: Section[] = sla ? ["sla"] : [];
  if (look !== "mint") {
    return [["fd.admin.g.settings", ["helpdesk", "email", "portal", ...s]], ["fd.admin.g.productivity", ["dispatcher", "supervisor", "observer", "scenarios", "canned", ...ai]],
      ["fd.admin.g.general", ["agents", "groups", "account"]]];
  }
  return [["fd.admin.g.channels", ["email", "portal"]], ["fd.admin.g.workflows", ["dispatcher", "supervisor", "observer", ...s]],
    ["fd.admin.g.agentProductivity", ["scenarios", "canned", ...ai]], ["fd.admin.g.team", ["agents", "groups"]], ["fd.admin.g.account", ["helpdesk", "account"]]];
}
// Suggested solutions from 2011, Freddie from 2018.
const label = (look: Look, x: Section, year = 0) =>
  x === "ai" ? t(year >= 2018 ? "ai.fd.page.freddie" : "ai.fd.suggestedArticles") : t(look === "mint" && RULES.includes(x) ? `fd.admin.${x}.mint` : `fd.admin.${x}`);

export function AdminPage(p: FdProps) {
  const all = groups(p.look, deskHas(p.game, "slaTimers"), aiFeatures(p.game).length ? ["ai"] : []), section = p.route.args.section as Section | undefined;
  if (p.route.page === "admin" || !section || !all.some(([, items]) => items.includes(section))) {
    return (
      <div className="fd-admin">
        {all.map(([head, items]) => (
          <Panel key={head} title={t(head)}>
            <div className="fd-admintiles">{items.map((x) => <a key={x} onClick={() => p.nav("adminScreen", { section: x })}>{label(p.look, x, p.year)}</a>)}</div>
          </Panel>
        ))}
      </div>
    );
  }
  return (
    <>
      <p className="fd-crumbs"><a onClick={() => p.nav("admin")}>{t("fd.nav.admin")}</a> / <span>{label(p.look, section, p.year)}</span></p>
      <Screen {...p} section={section} />
    </>
  );
}

function Screen(p: FdProps & { section: Section }) {
  const { game, section } = p, title = label(p.look, section, p.year);
  if (section === "email") return <Email game={game} />;
  if (section === "ai") return <Panel title={title}><AiSwitches game={game} brand="fd" /></Panel>;
  if (section === "agents") return <Agents game={game} />;
  if (section === "groups") return <Groups game={game} />;
  if (section === "canned") return <Panel title={title}><Table head={["fd.admin.title", "fd.admin.folder"]} rows={[...new Set(Object.values(TEMPLATES).flat())].map((id) => [t(`template.${id}.title`), t("fd.solutions.general")])} /></Panel>;
  if (section === "scenarios") return <Panel title={title}><Table head={["fd.admin.title", "fd.rule.actions"]} rows={SCENARIOS.map((x) => [t(`fd.scenario.${x.id}`), x.actions(game).join(", ")])} /></Panel>;
  if (section === "dispatcher") return <Dispatcher {...p} title={title} />;
  if (section === "supervisor" || section === "observer") return <Panel title={title}><Table head={["fd.admin.title", "fd.rule.conditions", "fd.rule.actions"]} rows={[]} /></Panel>;
  if (section === "sla") return <Panel title={title}><Table head={["fd.admin.policy", "fd.admin.respondWithin", "fd.admin.hoursType", "fd.nav.contacts"]} rows={slaPlans(game).map((x) => [PROFILES.find((pr) => pr.id === x.id)!.name, t("fd.hours", { n: x.hours }), t(x.clock === "business" ? "fd.admin.business" : "fd.admin.calendar"), String(x.customers)])} /></Panel>;
  if (section === "helpdesk") return <Helpdesk {...p} title={title} />;
  if (section === "portal") return <PortalSettings {...p} title={title} />;
  return <Account game={game} />;
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="fd-table">
      <thead><tr>{head.map((h) => <th key={h}>{t(h)}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        {!rows.length && <tr><td colSpan={head.length} className="fd-empty">{t("fd.none")}</td></tr>}
      </tbody>
    </table>
  );
}

const host = (s: GameState) => tenantHost(deskById("freshdusk")!, s.desk?.tenant ?? "");
const address = (s: GameState, accountId: string) => { const a = s.mail.accounts.find((x) => x.id === accountId); return a ? `${a.local}@${a.domain}` : ""; };

// Support emails: the account's own address, mailboxes forwarding to it once verified, and mailboxes it fetches by IMAP.
function Email({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [pick, setPick] = useState(""), [mode, setMode] = useState<"forward" | "imap">("forward"), [group, setGroup] = useState("");
  const chans = game.mail.channels.filter((c) => c.desk === "freshdusk"), target = `support@${host(game)}`, depts = game.desk!.departments;
  const free = game.mail.accounts.filter((a) => a.closedAt === null && !game.mail.channels.some((c) => c.accountId === a.id));
  return (
    <Panel title={t("fd.admin.supportEmails")}>
      <table className="fd-table">
        <thead><tr><th>{t("fd.admin.supportEmail")}</th><th>{t("fd.admin.forwardTo")}</th><th>{t("fd.admin.mailServer")}</th><th>{t("fd.group")}</th><th>{t("fd.admin.status")}</th><th /></tr></thead>
        <tbody>
          <tr><td>{target}</td><td /><td>{t("fd.admin.server.forward")}</td><td>{depts[0]?.name}</td><td><span className="fd-chip ok">{t("fd.admin.primary")}</span></td><td /></tr>
          {chans.map((c) => (
            <tr key={c.id}>
              <td>{address(game, c.accountId)}</td>
              <td>{c.mode === "forward" && <code>{target}</code>}</td>
              <td>{t(`fd.admin.server.${c.mode === "forward" ? "forward" : "imap"}`)}</td>
              <td>{depts.find((d) => d.id === c.deptId)?.name ?? depts[0]?.name}</td>
              <td>
                {c.mode === "forward"
                  ? <span className={c.verified ? "fd-chip ok" : "fd-chip"}>{t(c.verified ? "fd.admin.verified" : "fd.admin.unverified")}</span>
                  : <span className={c.error ? "fd-chip bad" : "fd-chip ok"}>{c.error ? t(c.error) : t("fd.admin.active")}</span>}
              </td>
              <td>
                {c.mode === "forward"
                  ? <button type="button" className="fd-btn" onClick={() => act(verifyForwarding, c.id)}>{t("fd.admin.verify")}</button>
                  : <button type="button" className="fd-btn" onClick={() => act(testDeskChannel, c.id)}>{t("fd.admin.test")}</button>}{" "}
                <button type="button" className="fd-btn" onClick={() => act(removeDeskChannel, c.id)}>{t("fd.delete")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="fd-row" onSubmit={(e) => { e.preventDefault(); if (act(addDeskChannel, pick, { mode, deptId: group || null }).ok) setPick(""); }}>
        <select aria-label={t("fd.admin.supportEmail")} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="" />
          {free.map((a) => <option key={a.id} value={a.id}>{address(game, a.id)}</option>)}
        </select>
        <select aria-label={t("fd.admin.mailServer")} value={mode} onChange={(e) => setMode(e.target.value as "forward" | "imap")}>
          <option value="forward">{t("fd.admin.server.forward")}</option>
          <option value="imap">{t("fd.admin.server.imap")}</option>
        </select>
        <select aria-label={t("fd.group")} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">-</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="fd-btn primary" disabled={!pick}>{t("fd.admin.newEmail")}</button>
      </form>
    </Panel>
  );
}

// Helpdesk settings: the account URL, the portal's own domain and the records that map it and sign replies.
function Helpdesk({ game, go, title }: FdProps & { title: string }) {
  const act = useStore((s) => s.act);
  const rows = deskRecords(game), [result, setResult] = useState<string | null>(null);
  return (
    <Panel title={title}>
      <table className="fd-info"><tbody>
        <tr><th>{t("fd.admin.helpdeskName")}</th><td>{game.company.name}</td></tr>
        <tr><th>{t("fd.admin.helpdeskUrl")}</th><td>{host(game)}</td></tr>
        <tr><th>{t("fd.admin.portalUrl")}</th><td>{`support.${game.company.domain}`}</td></tr>
      </tbody></table>
      <table className="fd-table">
        <thead><tr><th>{t("fd.admin.type")}</th><th>{t("fd.admin.host")}</th><th>{t("fd.admin.pointsTo")}</th><th>{t("fd.admin.status")}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={`${r.type} ${r.name}`}><td>{r.type}</td><td><code>{r.name}</code></td><td><code>{r.data}</code></td><td><span className={r.ok ? "fd-chip ok" : "fd-chip"}>{t(r.ok ? "fd.admin.verified" : "fd.admin.unverified")}</span></td></tr>)}</tbody>
      </table>
      <p className="fd-row">
        <button type="button" className="fd-btn primary" onClick={() => setResult(act(verifyDesk).ok ? t("fd.admin.verified") : null)}>{t("fd.admin.verify")}</button>
        {result && <span>{result}</span>}
        <a onClick={() => go(`${registrarUrl(game)}login/dns`)}>{t("fd.admin.dns")}</a>
      </p>
    </Panel>
  );
}

function PortalSettings({ game, go, title }: FdProps & { title: string }) {
  const url = host(game) + deskPath("freshdusk", "portal");
  return (
    <Panel title={title}>
      <table className="fd-info"><tbody>
        <tr><th>{t("fd.admin.portalName")}</th><td>{game.company.name}</td></tr>
        <tr><th>{t("fd.admin.portalUrl")}</th><td><a onClick={() => go(url)}>{url}</a></td></tr>
        <tr><th>{t("fd.admin.portalTickets")}</th><td>{game.tickets.filter((x) => x.via === "web").length}</td></tr>
      </tbody></table>
    </Panel>
  );
}

function Account({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [cancelling, setCancelling] = useState(false);
  const d = deskById("freshdusk")!;
  return (
    <Panel title={t("fd.admin.account")}>
      <table className="fd-info"><tbody>
        <tr><th>{t("fd.admin.helpdeskName")}</th><td>{game.company.name}</td></tr>
        <tr><th>{t("fd.admin.helpdeskUrl")}</th><td>{host(game)}</td></tr>
        <tr><th>{t("fd.admin.agents")}</th><td>{seats(game)}</td></tr>
        <tr><th>{t("fd.admin.monthly")}</th><td>{euroCents(monthlyCharge(game, deskItem(d)))}</td></tr>
      </tbody></table>
      <button type="button" className="fd-btn" onClick={() => setCancelling(true)}>{t("fd.admin.cancel")}</button>
      {cancelling && <Confirm title={t("desk-sites.cancelTitle", { name: d.name })} text={t("desk-sites.cancelText", { name: d.name })} action={t("fd.admin.cancel")}
        onCancel={() => setCancelling(false)} onConfirm={() => { setCancelling(false); act(removeDesk); }} />}
    </Panel>
  );
}

function Agents({ game }: { game: GameState }) {
  const desk = game.desk!, groupsOf = (id: string) => desk.departments.filter((d) => d.members.includes(id)).map((d) => d.name).join(", ") || desk.departments[0]?.name || "";
  return (
    <Panel title={t("fd.admin.agents")}>
      <Table head={["fd.name", "fd.admin.role", "fd.admin.groups"]} rows={[
        [t("support.you"), t("fd.admin.roleAdmin"), desk.departments[0]?.name ?? ""],
        ...game.staff.filter((e) => e.role === "support").map((e) => [e.name, t("fd.admin.roleAgent"), groupsOf(e.id)]),
      ]} />
    </Panel>
  );
}

function Groups({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState("");
  return (
    <Panel title={t("fd.admin.groups")}>
      <table className="fd-table">
        <thead><tr><th>{t("fd.name")}</th><th>{t("fd.admin.agents")}</th><th /></tr></thead>
        <tbody>{game.desk!.departments.map((d, i) => <tr key={d.id}><td>{d.name}</td><td>{d.members.length}</td><td>{i > 0 && <button type="button" className="fd-btn" onClick={() => act(removeDepartment, d.id)}>{t("fd.delete")}</button>}</td></tr>)}</tbody>
      </table>
      <form className="fd-row" onSubmit={(e) => { e.preventDefault(); if (act(addDepartment, name).ok) setName(""); }}>
        <input aria-label={t("fd.name")} placeholder={t("fd.name")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="fd-btn primary" disabled={!name.trim()}>{t("fd.admin.newGroup")}</button>
      </form>
    </Panel>
  );
}

// Kinds a rule can match: those the desk files, by the tag every ticket of the kind carries.
const KINDS = (Object.keys(DESK_ROUTE) as TicketKind[]).filter((k) => DESK_ROUTE[k].dept !== null);

// Dispatch'r, or Ticket creation in Mint: rules run in order on every new ticket.
function Dispatcher({ game, title }: FdProps & { title: string }) {
  const act = useStore((s) => s.act);
  const desk = game.desk!;
  const cond = (r: DeskRule) => (r.when === "*" ? t("fd.rule.any") : t("fd.rule.tag", { tag: r.when.toLowerCase() }));
  const acts = (r: DeskRule) => [
    r.set.deptId && t("fd.rule.setGroup", { name: desk.departments.find((d) => d.id === r.set.deptId)?.name ?? "" }),
    r.set.assignee && t("fd.rule.setAgent", { name: agentName(game, r.set.assignee) }),
    r.set.priority && t("fd.rule.setPriority", { name: t(`fd.priority.${r.set.priority}`) }),
  ].filter(Boolean).join(", ");
  return (
    <Panel title={title}>
      <table className="fd-table">
        <thead><tr><th>{t("fd.rule.conditions")}</th><th>{t("fd.rule.actions")}</th><th /></tr></thead>
        <tbody>
          {desk.rules.map((r, i) => <tr key={i}><td>{cond(r)}</td><td>{acts(r)}</td><td><button type="button" className="fd-btn" onClick={() => act(removeRule, i)}>{t("fd.delete")}</button></td></tr>)}
          {!desk.rules.length && <tr><td colSpan={3} className="fd-empty">{t("fd.none")}</td></tr>}
        </tbody>
      </table>
      <form className="fd-rule" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? "") || undefined;
        const r = act(addRule, { when: (get("when") ?? "*") as DeskRule["when"], set: { deptId: get("group"), assignee: get("agent"), priority: get("priority") as DeskRule["set"]["priority"] } });
        if (r.ok) e.currentTarget.reset();
      }}>
        <h3>{t("fd.rule.new")}</h3>
        <label><span>{t("fd.rule.conditions")}</span>
          <select name="when" defaultValue="*"><option value="*">{t("fd.rule.any")}</option>{KINDS.map((k) => <option key={k} value={k}>{t("fd.rule.tag", { tag: k.toLowerCase() })}</option>)}</select>
        </label>
        <label><span>{t("fd.group")}</span><select name="group" defaultValue=""><option value="">-</option>{desk.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label><span>{t("fd.col.agent")}</span><select name="agent" defaultValue=""><option value="">-</option><option value={OWNER}>{t("support.you")}</option>{game.staff.filter((e) => e.role === "support").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label><span>{t("fd.col.priority")}</span><select name="priority" defaultValue=""><option value="">-</option>{[...PRIORITIES].reverse().map((x) => <option key={x} value={x}>{t(`fd.priority.${x}`)}</option>)}</select></label>
        <button type="submit" className="fd-btn primary">{t("fd.save")}</button>
      </form>
    </Panel>
  );
}
