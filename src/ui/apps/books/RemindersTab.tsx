import { Mail } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { AUTO_COLLECT_DAYS, AUTO_SUSPEND_DAYS, dueStep, owed, rulesAutomated, STEPS, type BillingRules } from "../../../sim/45-billing/billing";
import { sendReminder, setBillingRules } from "../../../sim/90-actions/billing";
import { t } from "../../../i18n/en";
import { menuOn } from "../../desktop/ContextMenu";
import { useSessionState } from "../../session";
import { useStore } from "../../store";
import { useBooks } from "./view";
import { invoiceMenu, InvoiceDialog, reminder, type Asking } from "./InvoiceMenu";
import { More } from "../More";

const DAY = 24;

export function RemindersTab({ focus }: { focus: string | null }) {
  const game = useBooks(), act = useStore((s) => s.act);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [settings, setSettings] = useSessionState("books.reminderSettings", false);
  const late = game.invoices.filter((i) => i.status === "overdue").sort((a, b) => a.dueAt - b.dueAt);
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  return (
    <>
      <div className="fin-toolbar">
        <button className="btn books-settings" aria-pressed={settings} onClick={() => setSettings(!settings)}>{t("books.settings")}</button>
      </div>
      {settings ? <div className="fin-scroll"><Rules /></div> : <div className="fin-scroll">
        <table className="table fin-table">
          <thead>
            <tr><th>{t("books.col.number")}</th><th>{t("books.col.customer")}</th><th className="r">{t("books.col.amount")}</th><th className="r">{t("books.col.daysLate")}</th><th>{t("books.col.level")}</th><th /><th /></tr>
          </thead>
          <tbody>
            {late.map((i) => {
              const step = dueStep(i, game.hour), sent = i.reminders.length;
              const menu = () => invoiceMenu(i, game.hour, setAsking);
              return (
                <tr key={i.id} className={i.id === focus ? "sel" : ""} onContextMenu={menuOn(menu)}>
                  <td className="num">{i.number}</td>
                  <td>{name(i.customerId)}</td>
                  <td className="r num">{euroCents(owed(i))}</td>
                  <td className="r num">{Math.floor((game.hour - i.dueAt) / DAY)}</td>
                  <td>
                    {sent ? t(`invoice.step.${STEPS[sent - 1].key}`) : t("books.level.none")}
                    {i.suspended && <span className="pill">{t("books.status.suspended")}</span>}
                  </td>
                  <td>{step !== null && <button className="btn" onClick={() => act(sendReminder, i.id)}><Mail />{reminder(step)}</button>}</td>
                  <td className="r"><More label={i.number} entries={menu} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {late.length === 0 && <p className="books-none">{t("books.noLate")}</p>}
      </div>}
      {asking && <InvoiceDialog asking={asking} onClose={() => setAsking(null)} />}
    </>
  );
}

function DaysRule<D extends number>({ label, days, value, onChange }: { label: string; days: readonly D[]; value: D; onChange: (d: D) => void }) {
  return (
    <div className="settings-line">
      <span>{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {days.map((d) => <button key={d} aria-pressed={value === d} onClick={() => onChange(d)}>{d ? t("misc1.billing.nDays", { n: d }) : t("misc1.billing.off")}</button>)}
      </div>
    </div>
  );
}

// The billing rules bookkeepers and accountants carry out in their work hours, or that run by themselves after the Automation research.
function Rules() {
  const game = useBooks(), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const rules = game.billingRules;
  const set = (r: Partial<BillingRules>) => act(setBillingRules, r);
  const auto = rulesAutomated(game);
  const clerks = game.staff.filter((e) => e.role === "bookkeeper" || e.role === "accountant").map((e) => e.name);
  return (
    <div className="settings fin-auto books-rules">
      <h2>{auto ? t("misc1.billing.automation") : t("misc1.billing.rules")}</h2>
      {!auto && (
        <div className="settings-group">
          <div className="settings-line">
            <span>{t("misc1.billing.carriedOutBy")}</span>
            {clerks.length ? <span className="fin-auto-by">{clerks.join(", ")}</span> : (
              <span className="fin-auto-by">{t("misc1.billing.clerkRoles")} · {game.installed.includes("Staff")
                ? <button className="link" onClick={() => openApp("Staff", { kind: "market", id: "bookkeeper" })}>{t("misc1.billing.hireStaff")}</button>
                : <button className="link" onClick={() => openApp("Shop", { kind: "software", id: "Staff" })}>{t("misc1.billing.getStaff")}</button>}</span>
            )}
          </div>
        </div>
      )}
      <div className="settings-group">
        <div className="settings-line">
          <span>{t("misc1.billing.sendReminders")}</span>
          <input type="checkbox" role="switch" className="switch" aria-label={t("misc1.billing.sendReminders")} checked={rules.autoRemind} onChange={(e) => set({ autoRemind: e.target.checked })} />
        </div>
        <DaysRule label={t("misc1.billing.suspendAfter")} days={AUTO_SUSPEND_DAYS} value={rules.autoSuspendDays} onChange={(d) => set({ autoSuspendDays: d })} />
        <DaysRule label={t("misc1.billing.collectAfter")} days={AUTO_COLLECT_DAYS} value={rules.autoCollectDays} onChange={(d) => set({ autoCollectDays: d })} />
      </div>
    </div>
  );
}
