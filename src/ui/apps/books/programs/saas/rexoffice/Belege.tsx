import { Upload } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf } from "../../../../../../sim/00-core/time";
import { bankOf, hbci } from "../../../../../../sim/46-finance/bank";
import { lateInBooks, unbooked, type Payable } from "../../../../../../sim/46-finance/payables";
import { assignPayment, payAllDue, setAutoPay, unassignPayment } from "../../../../../../sim/90-actions/bank";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { useSessionState } from "../../../../../session";
import { useStore } from "../../../../../store";
import { payUrl } from "../../../PayablesTab";
import { useBooks } from "../../../view";
import { Card, Chip, Empty, Tabs } from "../ui";

type Filter = "open" | "overdue" | "all";
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const left = (p: Payable) => Math.round((p.amount - p.booked) * 100) / 100;

// Belege: the supplier documents. A document is uploaded from a purchase, then assigned to the bank booking that paid it.
export function Belege({ q, focus }: { q: string; focus: string | null }) {
  const game = useBooks(), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const [filter, setFilter] = useState<Filter>("open");
  const [uploaded, setUploaded] = useSessionState<string[]>("rx.uploaded", []);
  const [selected, setSelected] = useState<string | null>(focus);
  const [source, setSource] = useState("");
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const all = [...game.payables].reverse().filter((p) => !q || `${p.name} ${p.number}`.toLowerCase().includes(q.toLowerCase()));
  const status = (p: Payable) => !unbooked(p) ? "paid" : lateInBooks(game, p) ? "overdue" : "open";
  const list = all.filter((p) => filter === "all" || (filter === "open" ? status(p) !== "paid" : status(p) === "overdue"));
  const waiting = game.payables.filter((p) => !uploaded.includes(p.id));
  const sel = game.payables.find((p) => p.id === selected);
  const run = (r: ActionResult) => setError(r.ok ? "" : t(r.error, r.params));
  const upload = (id: string) => {
    if (!id) return;
    setUploaded([...uploaded, id]);
    setSelected(id);
    setSource("");
  };
  const bookings = (game.bank?.outgoing ?? []).filter((o) => o.matched === null && !o.returned);
  const paid = (p: Payable) => (game.bank?.outgoing ?? []).find((o) => o.matched === p.id);
  return (
    <>
      <div className="sx-head">
        <h1>{t("rx.nav.belege")}</h1>
        <div className="sx-actions">
          {hbci(game) ? <>
            <button type="button" className="sx-btn" onClick={() => act(payAllDue)}>{t("bank.pay.all")}</button>
            <label><input type="checkbox" checked={!!game.bank?.autoPay} onChange={(e) => act(setAutoPay, e.target.checked)} /> {t("bank.pay.auto")}</label>
          </> : game.bank && <button type="button" className="sx-btn" disabled={!game.payables.some((p) => unbooked(p) && left(p) > 0)} onClick={() => openApp("Browser", { kind: "url", id: `www.${bankOf(game)!.host}/banking/transfer?batch=1` })}>{t("bank.pay.all")}</button>}
        </div>
      </div>
      <div className={`sx-drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(source || waiting[0]?.id); }}>
        <Upload aria-hidden />
        <strong>{t("rx.dropBeleg")}</strong>
        <div>
          <select className="sx-btn" aria-label={t("pkg.order")} value={source || waiting[0]?.id || ""} disabled={!waiting.length} onChange={(e) => setSource(e.target.value)}>
            {waiting.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.number} · {euroCents(p.amount)}</option>)}
          </select>
          <button type="button" className="sx-btn primary" disabled={!waiting.length} onClick={() => upload(source || waiting[0].id)}>{t("rx.uploadBeleg")}</button>
        </div>
      </div>
      <Tabs value={filter} onPick={(f) => setFilter(f as Filter)} items={(["open", "overdue", "all"] as Filter[]).map((f) => ({ id: f, label: t(`rx.belege.${f}`) }))} />
      {list.length === 0 ? <Empty>{t("bank.pay.none")}</Empty> : (
        <table className="sx-table">
          <thead><tr><th>{t("bank.pay.supplier")}</th><th>{t("bank.pay.number")}</th><th>{t("bank.pay.due")}</th><th className="r">{t("misc.amount")}</th><th>{t("bank.pay.status")}</th></tr></thead>
          <tbody>
            {list.slice(0, 50).map((p) => (
              <tr key={p.id} className={p.id === selected ? "sel" : ""} tabIndex={0} onClick={() => setSelected(p.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(p.id)}>
                <td>{p.name}</td><td className="num">{p.number}</td><td className="num">{day(p.dueAt)}</td><td className="r num">{euroCents(p.amount)}</td>
                <td><Chip tone={status(p) === "paid" ? "ok" : status(p) === "overdue" ? "warn" : undefined}>{status(p) === "paid" ? t("bank.pay.paid") : status(p) === "overdue" ? t("bank.pay.overdue") : p.booked > 0 ? t("bank.pay.partly", { amount: euroCents(left(p)) }) : t("bank.pay.open")}</Chip>{uploaded.includes(p.id) && <Chip tone="accent">{t("rx.uploaded")}</Chip>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sel && (
        <Card title={`${t("rx.belegDetails")}: ${sel.number}`}>
          <p>{sel.name} · {euroCents(sel.amount)} · {day(sel.dueAt)}</p>
          <div className="sx-actions">
            {!uploaded.includes(sel.id) && <button type="button" className="sx-btn" onClick={() => upload(sel.id)}>{t("rx.uploadBeleg")}</button>}
            {unbooked(sel) && left(sel) > 0 && game.bank && <button type="button" className="sx-btn" onClick={() => openApp("Browser", { kind: "url", id: payUrl(game, sel) })}>{t("bank.pay.pay")}</button>}
            {paid(sel) && <button type="button" className="sx-btn" onClick={() => run(act(unassignPayment, paid(sel)!.id))}>{t("rx.unassign")}</button>}
          </div>
          {unbooked(sel) && (
            <table className="sx-table">
              <tbody>
                {bookings.map((o) => (
                  <tr key={o.id}><td>{o.name}</td><td>{o.reference}</td><td className="r num">{euroCents(o.amount)}</td>
                    <td className="r"><button type="button" className="sx-btn primary" onClick={() => run(act(assignPayment, o.id, sel.id))}>{t("rx.assign")}</button></td></tr>
                ))}
                {!bookings.length && <tr><td>{t("books.noTransfers")}</td></tr>}
              </tbody>
            </table>
          )}
          {error && <p className="sx-err" role="alert">{error}</p>}
        </Card>
      )}
    </>
  );
}
