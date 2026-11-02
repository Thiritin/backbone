import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { PROFILES } from "../../../../../../sim/10-catalog/economy";
import { deskById } from "../../../../../../sim/10-catalog/desks";
import { slaPlans } from "../../../../../../sim/40-support/desk-reports";
import { deskHosts } from "../../../../../../sim/40-support/desk-records";
import { addDepartment, addDeskChannel, removeDepartment, removeDeskChannel, setDeskChannel, testDeskChannel } from "../../../../../../sim/90-actions/desk";
import type { DeskChannel } from "../../../../../../sim/42-mail/types";
import { LOCALE } from "../../../../../../i18n/lang";
import { useStore } from "../../../../../store";
import { HELP_TOPICS } from "./Client";
import { Section, Sub, type OstPage, type OstProps } from "./OsTickitSite";

// The Admin Panel: settings, help topics, SLA plans, emails, agents and departments.
export function AdminPage(p: OstProps) {
  const page = p.route.page as OstPage;
  const sub = SUBS[page] && <Sub items={SUBS[page]!(p).map(([key, target, args]) => [t(key), () => p.nav(target, args), target === page && (!args?.section || args.section === section(p))])} />;
  let body;
  if (page === "helpTopics") body = <HelpTopics {...p} />;
  else if (page === "slas") body = <Slas {...p} />;
  else if (page === "emails" || page === "email") body = <Emails {...p} />;
  else if (page === "departments") body = <Departments {...p} />;
  else if (page === "staff") body = <Agents {...p} />;
  else if (page === "logs") body = <Section title={t("ost.admin.logs")}><p className="ost-empty">{t("ost.noResults")}</p></Section>;
  else body = <Settings {...p} />;
  return <>{sub}{body}</>;
}

const section = (p: OstProps) => (p.route.page === "settings" ? p.route.args.section ?? "system" : "");

type Item = [string, OstPage, Record<string, string>?];
const settingsSub = (p: OstProps): Item[] => [
  ["ost.admin.system", "settings", { section: "system" }],
  ["ost.admin.tickets", "settings", { section: "tickets" }],
  ["ost.admin.emailSettings", "settings", { section: "emails" }],
  ...(p.modern ? [] : [["ost.admin.slas", "slas"] as Item]),
];
const manageSub = (): Item[] => [["ost.admin.helpTopics", "helpTopics"], ["ost.admin.slas", "slas"]];
const agentsSub = (p: OstProps): Item[] => [[p.modern ? "ost.admin.tab.agents" : "ost.admin.staffMembers", "staff"], ...(p.modern ? [["ost.admin.tab.departments", "departments"] as Item] : [])];
const SUBS: Partial<Record<OstPage, (p: OstProps) => Item[]>> = {
  settings: settingsSub,
  slas: (p) => (p.modern ? manageSub() : settingsSub(p)),
  helpTopics: (p) => (p.modern ? manageSub() : []),
  emails: () => [["ost.admin.tab.emails", "emails"]],
  staff: agentsSub,
  departments: (p) => (p.modern ? agentsSub(p) : []),
};

function Settings(p: OstProps) {
  const { game } = p, desk = game.desk!, sec = section(p);
  const rows: [string, string][] = sec === "tickets"
    ? [["ost.admin.numberFormat", t("ost.admin.random", { n: deskById(desk.id)!.ref.digits ?? 6 })], ["ost.admin.defaultPriority", t("ost.priority.normal")], ["ost.admin.defaultSla", PROFILES[0].name]]
    : sec === "emails"
      ? [["ost.admin.defaultEmail", accountOf(p, desk.departments[0]?.channelId ?? null)], ["ost.admin.fetching", t("ost.enabled")]]
      : [["ost.admin.helpdeskUrl", `http://${deskHosts(game)[0] ?? ""}/`], ["ost.admin.helpdeskName", game.company.name], ["ost.admin.defaultDept", desk.departments[0]?.name ?? ""], ["ost.admin.version", p.version]];
  return (
    <Section title={t(sec === "tickets" ? "ost.admin.tickets" : sec === "emails" ? "ost.admin.emailSettings" : "ost.admin.system")}>
      <table className="ost-info"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{t(k)}</th><td>{v}</td></tr>)}</tbody></table>
    </Section>
  );
}

function HelpTopics({ game }: OstProps) {
  const dept = (id: string) => game.desk!.departments.find((d) => d.id === id)?.name ?? game.desk!.departments[0]?.name ?? "";
  return (
    <Section title={t("ost.admin.helpTopics")}>
      <table className="ost-list">
        <thead><tr><th>{t("ost.helpTopic")}</th><th>{t("ost.admin.status")}</th><th>{t("ost.admin.type")}</th><th>{t("ost.department")}</th></tr></thead>
        <tbody>{HELP_TOPICS.map((x) => <tr key={x.id}><td>{t(`ost.topic.${x.id}`)}</td><td>{t("ost.active")}</td><td>{t("ost.admin.public")}</td><td>{dept(x.dept)}</td></tr>)}</tbody>
      </table>
    </Section>
  );
}

function Slas({ game }: OstProps) {
  return (
    <Section title={t("ost.admin.slas")}>
      <table className="ost-list">
        <thead><tr><th>{t("ost.name")}</th><th>{t("ost.admin.status")}</th><th>{t("ost.admin.grace")}</th><th>{t("ost.admin.schedule")}</th><th>{t("ost.tab.users")}</th></tr></thead>
        <tbody>
          {slaPlans(game).map((x) => (
            <tr key={x.id}><td>{PROFILES.find((pr) => pr.id === x.id)!.name}</td><td>{t("ost.active")}</td><td>{t("ost.hours", { n: x.hours })}</td><td>{t(x.clock === "business" ? "ost.admin.workHours" : "ost.admin.always")}</td><td>{x.customers}</td></tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

const accountOf = ({ game }: OstProps, channelId: string | null): string => {
  const ch = game.mail.channels.find((c) => c.id === channelId), a = ch && game.mail.accounts.find((x) => x.id === ch.accountId);
  return a ? `${a.local}@${a.domain}` : "";
};

const FREQUENCIES = [1, 2, 4, 6, 12, 24];
const AFTER: Record<DeskChannel["mode"], DeskChannel["after"][]> = { imap: ["keep", "read", "move", "delete"], pop: ["keep", "delete"], forward: ["keep"] };

// Emails: the mailboxes the desk fetches, each with its protocol, schedule, what happens to fetched mail, and a test email.
function Emails(p: OstProps) {
  const { game } = p, desk = game.desk!, act = useStore((s) => s.act);
  const chans = game.mail.channels.filter((c) => c.desk === desk.id);
  const free = game.mail.accounts.filter((a) => a.closedAt === null && !game.mail.channels.some((c) => c.accountId === a.id));
  const [pick, setPick] = useState(""), [open, setOpen] = useState(chans[0]?.id ?? ""), [result, setResult] = useState<string | null>(null);
  const ch = chans.find((c) => c.id === open);
  const set = (patch: Partial<DeskChannel>) => { setResult(null); act(setDeskChannel, ch!.id, patch); };
  const folders = ch ? game.mail.folders.filter((f) => f.accountId === ch.accountId && !f.label) : [];
  return (
    <Section title={t("ost.admin.emailAddresses")}>
      <table className="ost-list">
        <thead><tr><th>{t("ost.client.email")}</th><th>{t("ost.department")}</th><th>{t("ost.email.protocol")}</th><th>{t("ost.admin.fetching")}</th><th /></tr></thead>
        <tbody>
          {chans.map((c) => (
            <tr key={c.id}>
              <td><a onClick={() => { setOpen(c.id); setResult(null); }}>{accountOf(p, c.id)}</a></td>
              <td>{desk.departments.find((d) => d.id === c.deptId)?.name ?? t("ost.email.systemDefault")}</td>
              <td>{t(`ost.email.${c.mode}`)}</td>
              <td>{c.error ? <span className="ost-error">{t(c.error)}</span> : t("ost.enabled")}</td>
              <td><button className="ost-btn alt" onClick={() => act(removeDeskChannel, c.id)}>{t("ost.delete")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="ost-inline" onSubmit={(e) => { e.preventDefault(); const r = act(addDeskChannel, pick); if (r.ok) { setPick(""); setOpen(r.id!); } }}>
        <select aria-label={t("ost.client.email")} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="" />
          {free.map((a) => <option key={a.id} value={a.id}>{`${a.local}@${a.domain}`}</option>)}
        </select>
        <button className="ost-btn" disabled={!pick}>{t("ost.email.addNew")}</button>
      </form>
      {ch && (
        <div className="ost-form">
          <h3>{accountOf(p, ch.id)}</h3>
          <label><span>{t("ost.department")}</span>
            <select value={ch.deptId ?? ""} onChange={(e) => set({ deptId: e.target.value || null })}>
              <option value="">{t("ost.email.systemDefault")}</option>
              {desk.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></label>
          <label><span>{t("ost.email.protocol")}</span>
            <select value={ch.mode} onChange={(e) => { const mode = e.target.value as DeskChannel["mode"]; set({ mode, after: AFTER[mode].includes(ch.after) ? ch.after : "keep" }); }}>
              {(["imap", "pop"] as const).map((m) => <option key={m} value={m}>{t(`ost.email.${m}`)}</option>)}
            </select></label>
          <label><span>{t("ost.email.frequency")}</span>
            <select value={ch.every} onChange={(e) => set({ every: Number(e.target.value) })}>
              {FREQUENCIES.map((h) => <option key={h} value={h}>{t("ost.email.minutes", { n: (h * 60).toLocaleString(LOCALE) })}</option>)}
            </select></label>
          <label><span>{t("ost.email.fetched")}</span>
            <select value={ch.after} onChange={(e) => { const after = e.target.value as DeskChannel["after"]; set({ after, folder: after === "move" ? folders[0]?.id ?? null : ch.folder }); }}>
              {AFTER[ch.mode].map((a) => <option key={a} value={a} disabled={a === "move" && !folders.length}>{t(`ost.email.after.${a}`)}</option>)}
            </select></label>
          {ch.after === "move" && (
            <label><span>{t("ost.email.folder")}</span>
              <select value={ch.folder ?? ""} onChange={(e) => set({ folder: e.target.value })}>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select></label>
          )}
          <label><span>{t("ost.email.autoResponse")}</span><input type="checkbox" checked={ch.autoReply} onChange={(e) => set({ autoReply: e.target.checked })} /></label>
          <label><span>{t("ost.email.unknown")}</span><input type="checkbox" checked={ch.unknown} onChange={(e) => set({ unknown: e.target.checked })} /></label>
          <p className="ost-buttons">
            <button type="button" className="ost-btn" onClick={() => { const r = act(testDeskChannel, ch.id); setResult(r.ok ? t("ost.email.imported", { n: Number(r.id) }) : null); }}>{t("ost.email.test")}</button>
          </p>
          {result && <p className="ost-notice">{result}</p>}
        </div>
      )}
    </Section>
  );
}

function Departments({ game }: OstProps) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState("");
  const desk = game.desk!;
  return (
    <Section title={t("ost.admin.tab.departments")}>
      <table className="ost-list">
        <thead><tr><th>{t("ost.name")}</th><th>{t("ost.admin.type")}</th><th>{t("ost.admin.members")}</th><th>{t("ost.admin.defaultEmail")}</th><th /></tr></thead>
        <tbody>
          {desk.departments.map((d, i) => (
            <tr key={d.id}><td>{d.name}</td><td>{t("ost.admin.public")}</td><td>{d.members.length}</td><td>{accountOf({ game } as OstProps, d.channelId)}</td>
              <td>{i > 0 && <button className="ost-btn alt" onClick={() => act(removeDepartment, d.id)}>{t("ost.delete")}</button>}</td></tr>
          ))}
        </tbody>
      </table>
      <form className="ost-inline" onSubmit={(e) => { e.preventDefault(); if (act(addDepartment, name).ok) setName(""); }}>
        <input aria-label={t("ost.name")} placeholder={t("ost.name")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="ost-btn" disabled={!name.trim()}>{t("ost.admin.addDept")}</button>
      </form>
    </Section>
  );
}

function Agents({ game, modern }: OstProps) {
  const desk = game.desk!, team = game.staff.filter((e) => e.role === "support");
  const deptOf = (id: string) => desk.departments.filter((d) => d.members.includes(id)).map((d) => d.name).join(", ") || desk.departments[0]?.name || "";
  return (
    <Section title={t(modern ? "ost.admin.tab.agents" : "ost.admin.staffMembers")}>
      <table className="ost-list">
        <thead><tr><th>{t("ost.name")}</th><th>{t("ost.username")}</th><th>{t("ost.admin.status")}</th><th>{t("ost.department")}</th></tr></thead>
        <tbody>
          <tr><td>{t("ost.you")}</td><td>admin</td><td>{t("ost.active")}</td><td>{desk.departments[0]?.name ?? ""}</td></tr>
          {team.map((e) => <tr key={e.id}><td>{e.name}</td><td>{e.name.split(" ")[0].toLowerCase()}</td><td>{t("ost.active")}</td><td>{deptOf(e.id)}</td></tr>)}
        </tbody>
      </table>
    </Section>
  );
}
