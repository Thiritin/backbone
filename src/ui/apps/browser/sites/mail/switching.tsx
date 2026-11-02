import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf } from "../../../../../sim/00-core/time";
import { leftBehind } from "../../../../../sim/42-mail/imports";
import type { MailAccount } from "../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../sim/50-state";
import { importMail } from "../../../../../sim/90-actions/mailbox";
import { usePageAct } from "../../pageAct";

// The switching pieces every provider site shares (docs/design/plans/webmail-consumer.md, section 6); each site styles
// them through the class names it passes.
const addressOf = (a: MailAccount) => `${a.local}@${a.domain}`;

export function LeftBehind({ game, tenantId, className }: { game: GameState; tenantId: string; className: string }) {
  const l = leftBehind(game, tenantId);
  const rows = l ? [l.mail > 0 && t("mailswitch.mail", { n: l.mail }), l.roles && t("mailswitch.roles"), l.collectors > 0 && t("mailswitch.collectors", { n: l.collectors })].filter((x): x is string => !!x) : [];
  if (!rows.length) return null;
  return <div className={className} role="status" data-left-behind><b>{t("mailswitch.title")}</b><ul>{rows.map((r) => <li key={r}>{r}</li>)}</ul></div>;
}

// Signs in to the old mailbox and queues the copy into one of `targets`.
export function ImportForm({ targets, proto, className }: { targets: MailAccount[]; proto: "pop" | "imap"; className: string }) {
  const act = usePageAct();
  const [to, setTo] = useState(targets[0]?.id ?? ""), [source, setSource] = useState(""), [password, setPassword] = useState("");
  const submit = () => { if (act(importMail, to, { source, password, proto }).ok) { setSource(""); setPassword(""); } };
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label>{t("mailswitch.source")}<input name="source" value={source} onChange={(e) => setSource(e.target.value)} autoComplete="off" /></label>
      <label>{t("mailswitch.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
      {targets.length > 1 && (
        <label>{t("mailswitch.target")}<select name="to" value={to} onChange={(e) => setTo(e.target.value)}>{targets.map((a) => <option key={a.id} value={a.id}>{addressOf(a)}</option>)}</select></label>
      )}
      <button type="submit">{t("mailswitch.start")}</button>
    </form>
  );
}

// The import runs into these mailboxes, newest first.
export function ImportRuns({ game, into, className }: { game: GameState; into: string[]; className: string }) {
  const runs = game.mail.imports.filter((x) => into.includes(x.to)).reverse();
  if (!runs.length) return null;
  const address = (id: string) => { const a = game.mail.accounts.find((x) => x.id === id); return a ? addressOf(a) : ""; };
  const day = (hour: number) => dateOf(hour).toLocaleString(LOCALE, { timeZone: "UTC", dateStyle: "short", timeStyle: "short" });
  return (
    <table className={className} data-table="imports">
      <thead><tr><th>{t("mailswitch.from")}</th><th>{t("mailswitch.to")}</th><th>{t("mailswitch.status")}</th></tr></thead>
      <tbody>{runs.map((x) => (
        <tr key={x.id}><td>{address(x.from)}</td><td>{address(x.to)}</td><td>{x.n === null ? t("mailswitch.running", { date: day(x.doneAt) }) : t("mailswitch.done", { n: x.n })}</td></tr>
      ))}</tbody>
    </table>
  );
}
