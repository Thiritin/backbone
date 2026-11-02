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
import { addDepartment, addDeskChannel, addRule, removeDepartment, removeDeskChannel, removeRule } from "../../../../../../sim/90-actions/desk";
import { removeDesk, verifyDesk, verifyForwarding } from "../../../../../../sim/90-actions/desk-install";
import { Confirm } from "../../../../../desktop/Confirm";
import { useStore } from "../../../../../store";
import { AiSwitches, aiFeatures } from "../headless/AiPage";
import { assigneeName, VIEWS, viewName } from "./Agent";

// Article suggestions from 2013, Answer Bot from 2017, AI agents from 2023.
const aiTitle = (year: number) => t(year >= 2023 ? "ai.zd.page.agents" : year >= 2017 ? "ai.zd.answerBot" : "ai.zd.suggestedArticles");
import { MANAGE, Panel, SETTINGS, type ZdProps } from "./ZenduskSite";

type Section = "overview" | "people" | "groups" | "views" | "macros" | "triggers" | "automations" | "sla" | "email" | "branding" | "subscription" | "ai";

// The admin menu per look: classic splits it over the Manage, Settings and Account tabs, the later looks group it in a side menu.
function menu(p: ZdProps): [string, Section[]][] {
  const sla: Section[] = deskHas(p.game, "slaTimers") ? ["sla"] : [], ai: Section[] = aiFeatures(p.game).length ? ["ai"] : [];
  if (p.look === "classic") {
    const s = p.route.args.section ?? "";
    return MANAGE.includes(s) ? [["zd.nav.manage", ["macros", "views", "triggers", "automations", ...sla, "people", "groups"]]]
      : SETTINGS.includes(s) ? [["zd.nav.settings", ["email", "branding"]]] : [["zd.nav.account", ["overview", "subscription"]]];
  }
  if (p.look === "lotus") {
    return [["zd.admin.manage", ["overview", "people", "groups", "views", "macros"]], ["zd.admin.rules", ["triggers", "automations", ...sla]],
      ["zd.admin.channels", ["email", ...ai]], ["zd.admin.settings", ["branding", "subscription"]]];
  }
  const late = p.year >= 2023;
  return [["zd.admin.account", ["overview", "branding", "subscription"]], ...(late ? [["ai.zd.group", ai] as [string, Section[]]] : []), ["zd.admin.people", ["people", "groups"]],
    ["zd.admin.channels", ["email", ...(late ? [] : ai)]], ["zd.admin.workspaces", ["views", "macros"]], ["zd.admin.objects", ["triggers", "automations", ...sla]]];
}

export function AdminPage(p: ZdProps) {
  const section = (p.route.page === "admin" ? "overview" : p.route.args.section ?? "overview") as Section;
  const groups = menu(p);
  const nav = groups.map(([head, items]) => (
    <div key={head}>
      {p.look !== "classic" && <h4>{t(head)}</h4>}
      {items.map((x) => <a key={x} className={x === section ? "active" : ""} onClick={() => (x === "overview" ? p.nav("admin") : p.nav("adminScreen", { section: x }))}>{x === "ai" ? aiTitle(p.year) : t(`zd.admin.${x}`)}</a>)}
    </div>
  ));
  return (
    <div className={p.look === "classic" ? "zd-admin classic" : "zd-admin"}>
      <nav className="zd-adminnav">{nav}</nav>
      <div className="zd-adminbody"><Screen {...p} section={section} /></div>
    </div>
  );
}

function Screen(p: ZdProps & { section: Section }) {
  const { game, section } = p;
  if (section === "people") return <People game={game} />;
  if (section === "groups") return <Groups game={game} />;
  if (section === "views") return <Panel title={t("zd.admin.views")}><Table head={["zd.admin.title", "zd.col.tickets"]} rows={VIEWS.map(([id, get]) => [viewName(p, id), String(get(game).length)])} /></Panel>;
  if (section === "macros") return <Panel title={t("zd.admin.macros")}><Table head={["zd.admin.title"]} rows={[...new Set(Object.values(TEMPLATES).flat())].map((id) => [t(`template.${id}.title`)])} /></Panel>;
  if (section === "triggers") return <Triggers game={game} />;
  if (section === "automations") return <Panel title={t("zd.admin.automations")}><Table head={["zd.admin.title"]} rows={[]} /></Panel>;
  if (section === "sla") return <Panel title={t("zd.admin.sla")}><Table head={["zd.admin.policy", "zd.admin.firstReply", "zd.users"]} rows={slaPlans(game).map((x) => [PROFILES.find((pr) => pr.id === x.id)!.name, t(x.clock === "business" ? "zd.businessHours" : "zd.hours", { n: x.hours }), String(x.customers)])} /></Panel>;
  if (section === "email") return <Email game={game} />;
  if (section === "ai") return <Panel title={aiTitle(p.year)}><AiSwitches game={game} brand="zd" /></Panel>;
  if (section === "branding") return <Branding {...p} />;
  return <Subscription game={game} detail={section === "subscription"} />;
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="zd-table">
      <thead><tr>{head.map((h) => <th key={h}>{t(h)}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        {!rows.length && <tr><td colSpan={head.length} className="zd-empty">{t("zd.none")}</td></tr>}
      </tbody>
    </table>
  );
}

const address = (s: GameState, accountId: string) => { const a = s.mail.accounts.find((x) => x.id === accountId); return a ? `${a.local}@${a.domain}` : ""; };
const tenantAddress = (s: GameState) => `support@${tenantHost(deskById("zendusk")!, s.desk?.tenant ?? "")}`;

// Support addresses: the account's own address, and each mailbox that forwards to it once Verify forwarding has seen a message arrive.
function Email({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), [pick, setPick] = useState("");
  const chans = game.mail.channels.filter((c) => c.desk === "zendusk"), target = tenantAddress(game);
  const free = game.mail.accounts.filter((a) => a.closedAt === null && !game.mail.channels.some((c) => c.accountId === a.id));
  return (
    <Panel title={t("zd.admin.addresses")}>
      <table className="zd-table">
        <thead><tr><th>{t("zd.email")}</th><th>{t("zd.admin.forwardTo")}</th><th>{t("zd.admin.forwarding")}</th><th /></tr></thead>
        <tbody>
          <tr><td>{target}</td><td /><td><span className="zd-chip ok">{t("zd.admin.default")}</span></td><td /></tr>
          {chans.map((c) => (
            <tr key={c.id}>
              <td>{address(game, c.accountId)}</td>
              <td><code>{target}</code></td>
              <td><span className={c.verified ? "zd-chip ok" : "zd-chip"}>{t(c.verified ? "zd.admin.verified" : "zd.admin.unverified")}</span></td>
              <td>
                <button type="button" className="zd-btn" onClick={() => act(verifyForwarding, c.id)}>{t("zd.admin.verify")}</button>{" "}
                <button type="button" className="zd-btn" onClick={() => act(removeDeskChannel, c.id)}>{t("zd.delete")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="zd-row" onSubmit={(e) => { e.preventDefault(); if (act(addDeskChannel, pick).ok) setPick(""); }}>
        <select aria-label={t("zd.email")} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="" />
          {free.map((a) => <option key={a.id} value={a.id}>{address(game, a.id)}</option>)}
        </select>
        <button className="zd-btn primary" disabled={!pick}>{t("zd.admin.addAddress")}</button>
      </form>
    </Panel>
  );
}

// Host mapping: the CNAME to the account address, and the SPF and DKIM records that let replies go out as the company domain.
function Branding({ game, go }: ZdProps) {
  const act = useStore((s) => s.act);
  const rows = deskRecords(game), [result, setResult] = useState<string | null>(null);
  return (
    <Panel title={t("zd.admin.branding")}>
      <table className="zd-info"><tbody>
        <tr><th>{t("zd.admin.subdomain")}</th><td>{tenantHost(deskById("zendusk")!, game.desk?.tenant ?? "")}</td></tr>
        <tr><th>{t("zd.admin.hostMapping")}</th><td>{`support.${game.company.domain}`}</td></tr>
      </tbody></table>
      <table className="zd-table">
        <thead><tr><th>{t("zd.admin.type")}</th><th>{t("zd.admin.host")}</th><th>{t("zd.admin.pointsTo")}</th><th>{t("zd.admin.status")}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={`${r.type} ${r.name}`}><td>{r.type}</td><td><code>{r.name}</code></td><td><code>{r.data}</code></td><td><span className={r.ok ? "zd-chip ok" : "zd-chip"}>{t(r.ok ? "zd.admin.verified" : "zd.admin.unverified")}</span></td></tr>)}</tbody>
      </table>
      <p className="zd-row">
        <button type="button" className="zd-btn primary" onClick={() => { const r = act(verifyDesk); setResult(r.ok ? t("zd.admin.verified") : null); }}>{t("zd.admin.verifyDns")}</button>
        {result && <span>{result}</span>}
        <a onClick={() => go(`${registrarUrl(game)}login/dns`)}>{t("zd.admin.dns")}</a>
      </p>
    </Panel>
  );
}

function Subscription({ game, detail }: { game: GameState; detail: boolean }) {
  const act = useStore((s) => s.act);
  const [cancelling, setCancelling] = useState(false);
  const d = deskById("zendusk")!;
  return (
    <Panel title={t(detail ? "zd.admin.subscription" : "zd.admin.overview")}>
      <table className="zd-info"><tbody>
        <tr><th>{t("zd.admin.accountName")}</th><td>{game.company.name}</td></tr>
        <tr><th>{t("zd.admin.subdomain")}</th><td>{tenantHost(d, game.desk?.tenant ?? "")}</td></tr>
        <tr><th>{t("zd.admin.agents")}</th><td>{seats(game)}</td></tr>
        <tr><th>{t("zd.admin.monthly")}</th><td>{euroCents(monthlyCharge(game, deskItem(d)))}</td></tr>
      </tbody></table>
      {detail && <button type="button" className="zd-btn" onClick={() => setCancelling(true)}>{t("zd.admin.cancel")}</button>}
      {cancelling && <Confirm title={t("desk-sites.cancelTitle", { name: d.name })} text={t("desk-sites.cancelText", { name: d.name })} action={t("zd.admin.cancel")}
        onCancel={() => setCancelling(false)} onConfirm={() => { setCancelling(false); act(removeDesk); }} />}
    </Panel>
  );
}

function People({ game }: { game: GameState }) {
  const desk = game.desk!, groupsOf = (id: string) => desk.departments.filter((d) => d.members.includes(id)).map((d) => d.name).join(", ") || desk.departments[0]?.name || "";
  return (
    <Panel title={t("zd.admin.people")}>
      <Table head={["zd.name", "zd.admin.role", "zd.admin.groups"]} rows={[
        [t("support.you"), t("zd.admin.roleAdmin"), desk.departments[0]?.name ?? ""],
        ...game.staff.filter((e) => e.role === "support").map((e) => [e.name, t("zd.admin.roleAgent"), groupsOf(e.id)]),
      ]} />
    </Panel>
  );
}

function Groups({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState("");
  return (
    <Panel title={t("zd.admin.groups")}>
      <table className="zd-table">
        <thead><tr><th>{t("zd.name")}</th><th>{t("zd.admin.agents")}</th><th /></tr></thead>
        <tbody>{game.desk!.departments.map((d, i) => <tr key={d.id}><td>{d.name}</td><td>{d.members.length}</td><td>{i > 0 && <button type="button" className="zd-btn" onClick={() => act(removeDepartment, d.id)}>{t("zd.delete")}</button>}</td></tr>)}</tbody>
      </table>
      <form className="zd-row" onSubmit={(e) => { e.preventDefault(); if (act(addDepartment, name).ok) setName(""); }}>
        <input aria-label={t("zd.name")} placeholder={t("zd.name")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="zd-btn primary" disabled={!name.trim()}>{t("zd.admin.addGroup")}</button>
      </form>
    </Panel>
  );
}

// Kinds a trigger can match: those the desk files, by the tag every ticket of the kind carries.
const KINDS = (Object.keys(DESK_ROUTE) as TicketKind[]).filter((k) => DESK_ROUTE[k].dept !== null);

function Triggers({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const desk = game.desk!;
  const staff = game.staff.filter((e) => e.role === "support");
  const cond = (r: DeskRule) => (r.when === "*" ? t("zd.trigger.created") : t("zd.trigger.tag", { tag: r.when.toLowerCase() }));
  const acts = (r: DeskRule) => [
    r.set.deptId && t("zd.trigger.setGroup", { name: desk.departments.find((d) => d.id === r.set.deptId)?.name ?? "" }),
    r.set.assignee && t("zd.trigger.setAssignee", { name: assigneeName(game, r.set.assignee) }),
    r.set.priority && t("zd.trigger.setPriority", { name: t(`zd.priority.${r.set.priority}`) }),
  ].filter(Boolean).join(", ");
  return (
    <Panel title={t("zd.admin.triggers")}>
      <table className="zd-table">
        <thead><tr><th>{t("zd.trigger.conditions")}</th><th>{t("zd.trigger.actions")}</th><th /></tr></thead>
        <tbody>
          {desk.rules.map((r, i) => <tr key={i}><td>{cond(r)}</td><td>{acts(r)}</td><td><button type="button" className="zd-btn" onClick={() => act(removeRule, i)}>{t("zd.delete")}</button></td></tr>)}
          {!desk.rules.length && <tr><td colSpan={3} className="zd-empty">{t("zd.none")}</td></tr>}
        </tbody>
      </table>
      <form className="zd-trigger" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? "") || undefined;
        const r = act(addRule, { when: (get("when") ?? "*") as DeskRule["when"], set: { deptId: get("group"), assignee: get("assignee"), priority: get("priority") as DeskRule["set"]["priority"] } });
        if (r.ok) e.currentTarget.reset();
      }}>
        <h3>{t("zd.trigger.add")}</h3>
        <label><span>{t("zd.trigger.conditions")}</span>
          <select name="when" defaultValue="*"><option value="*">{t("zd.trigger.created")}</option>{KINDS.map((k) => <option key={k} value={k}>{t("zd.trigger.tag", { tag: k.toLowerCase() })}</option>)}</select>
        </label>
        <label><span>{t("zd.group")}</span><select name="group" defaultValue=""><option value="">-</option>{desk.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label><span>{t("zd.col.assignee")}</span><select name="assignee" defaultValue=""><option value="">-</option><option value={OWNER}>{t("support.you")}</option>{staff.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label><span>{t("zd.col.priority")}</span><select name="priority" defaultValue=""><option value="">-</option>{[...PRIORITIES].reverse().map((x) => <option key={x} value={x}>{t(`zd.priority.${x}`)}</option>)}</select></label>
        <button type="submit" className="zd-btn primary">{t("zd.trigger.create")}</button>
      </form>
    </Panel>
  );
}
