import { euroPrice } from "../../../../../../sim/00-core/money";
import { OWNER } from "../../../../../../sim/40-support/desk-work";
import { isFinal, monthlyValue, type Ticket } from "../../../../../../sim/40-support/tickets";
import { senderName, subjectParams } from "../../../../../../sim/40-support/notices";
import { companyParams } from "../../../../../../sim/40-support/replies";
import { ORDER } from "../../../../../../sim/80-business/vendor-shop";
import { isLicence } from "../../../../../../sim/80-business/licences";
import type { GameState } from "../../../../../../sim/50-state";
import { t } from "../../../../../../i18n/en";
import { due, monthYear, span, stamp, statusOf } from "../../../../support/labels";

export interface PaneMessage { from: string; hour: number; text: string; you: boolean }
// What a desk renders under the opening message: a sign-in link, licence keys or the register button.
export type PaneExtra = "login" | "order" | "licence";
export type PaneItem =
  | { type: "opening"; msg: PaneMessage; extra: PaneExtra | null }
  | { type: "reply"; msg: PaneMessage; followUp: PaneMessage | null }
  | { type: "msg"; msg: PaneMessage }
  | { type: "event"; text: string; hour: number | null }
  // An internal note: typed by the player or an employee, or an event the desk logged.
  | { type: "note"; by: string; text: string; hour: number };

export interface PaneModel {
  subject: string;
  ref: string;
  opened: number;
  // Set while the ticket is open: the time left as text and its tone.
  due: { text: string; tone: "" | "warn" | "bad" } | null;
  status: string;
  assignees: { id: string | null; name: string; active: boolean }[];
  sender: { id: string; from: string; url: string | null } | null;
  customer: { id: string; name: string; line: string; happiness: number } | null;
  items: PaneItem[];
}

// The ticket's properties, parties and thread as data.
export function useTicketPane(s: GameState, tk: Ticket): PaneModel {
  const c = s.customers.find((x) => x.id === tk.customerId);
  const p = subjectParams(s, tk);
  const left = tk.dueAt - s.hour;
  const sent = tk.kind === "migration" || !!tk.term || (tk.kind === "maintenance" && (tk.topic === "notice" || tk.topic === "moved"));
  const agents = isFinal(tk) ? [] : s.staff.filter((e) => e.role === "support");
  const name = c?.name ?? "";

  const svc = s.services.find((v) => v.id === tk.serviceId);
  const services = s.services.filter((v) => v.customerId === tk.customerId && v.endedAt === null);
  const customer = c && {
    id: c.id,
    name: c.name,
    line: t("support.custLine", { what: svc ? svc.label : services.length === 1 ? services[0].label : t("support.nServices", { n: services.length }), price: euroPrice(monthlyValue(s.services, c.id)), since: monthYear(c.since) }),
    happiness: c.happiness,
  };

  const items: PaneItem[] = [{
    type: "opening",
    msg: { from: tk.notice ? senderName(tk.notice.sender) : sent ? t("support.you") : tk.kind === "sponsor" ? String(p.event) : tk.mail ? tk.mail.from : tk.kind === "pear" ? t("walk.from") : name, hour: tk.createdAt, text: t(`ticket.${tk.kind}.${tk.topic}.text`, p), you: sent },
    extra: tk.mail && tk.topic === "registrarLogin" ? "login" : tk.topic === ORDER ? "order" : isLicence(tk.topic) ? "licence" : null,
  }];
  for (const r of tk.replies) items.push({
    type: "reply",
    msg: { from: r.by ?? t("support.you"), hour: r.hour, text: r.key ? t(r.key, r.params) : t(`template.${r.template}.text`, companyParams(s)), you: true },
    followUp: r.right ? null : { from: name, hour: r.hour, text: t("ticket.followUp.text"), you: false },
  });
  for (const n of tk.notes ?? []) items.push({ type: "note", by: s.staff.find((e) => e.id === n.by)?.name ?? (n.by === OWNER ? t("support.you") : n.by), text: n.key ? t(n.key, n.params) : n.text ?? "", hour: n.hour });
  for (const m of tk.move?.log ?? []) items.push({ type: "msg", msg: { from: name, hour: m.hour, text: t(m.key, m.params), you: false } });
  if (tk.move?.windowAt != null && tk.status === "waiting") items.push({ type: "event", text: t("support.moveAt", { time: stamp(tk.move.windowAt) }), hour: null });
  if (tk.outcome === "withdrawn") items.push({ type: "msg", msg: { from: name, hour: tk.updatedAt, text: t("ticket.withdrawn.text"), you: false } });
  if (tk.work) items.push({ type: "event", text: t("support.queuedUntil", { time: stamp(tk.work.doneAt / 60) }), hour: null });
  if (tk.status === "escalated" || isFinal(tk)) items.push({ type: "event", text: t(`outcome.${tk.outcome ?? (tk.status === "closed" ? "closed" : tk.status === "escalated" ? "escalated" : "resolved")}`), hour: tk.updatedAt });

  return {
    subject: t(`ticket.${tk.kind}.${tk.topic}.subject`, p),
    ref: tk.id.slice(3),
    opened: tk.createdAt,
    due: tk.status === "open"
      ? { text: tk.notice || left < 0 ? t(left < 0 ? "support.overdueBy" : "support.toRespondIn", { span: span(left) }) : t("support.due", { time: due(tk.dueAt, s.hour) }), tone: left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : "" }
      : null,
    status: statusOf(tk),
    assignees: agents.length ? [{ id: null, name: t("support.nobody"), active: tk.assignee === null }, { id: OWNER, name: t("support.you"), active: tk.assignee === OWNER }, ...agents.map((a) => ({ id: a.id, name: a.name, active: tk.assignee === a.id }))] : [],
    sender: tk.notice ? { id: tk.notice.sender, from: tk.notice.from, url: tk.notice.url } : null,
    customer: customer || null,
    items,
  };
}
