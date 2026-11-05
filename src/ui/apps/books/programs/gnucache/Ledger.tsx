import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { bookByNumber } from "../../../../../sim/90-actions/bookkeeping";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import { formatDay } from "../../../billing/format";
import { sides, useAccounts, type Account } from "../../data";
import { useBooks } from "../../view";
import { money } from "./shared";

// The bank lines no booking covers yet, oldest first: what the blank row can book.
function openLines(game: ReturnType<typeof useBooks>) {
  return [
    ...game.transfers.filter((x) => x.matchedAt === null && !x.covers).map((x) => ({ id: x.id, hour: x.hour, text: `${x.from} ${t(x.reference, x.params)}`, amount: x.amount, account: "receivables" })),
    ...(game.bank?.outgoing ?? []).filter((o) => o.matched === null && !o.returned).map((o) => ({ id: o.id, hour: o.hour, text: `${o.name} ${o.reference}`, amount: Math.abs(o.amount), account: "payables" })),
  ].sort((a, b) => a.hour - b.hour);
}

// An account's register: its entries oldest first with the running balance, and on the bank a blank last row. Typing the
// document number in it and pressing Enter books the line it names; Tab moves to the next cell.
export function Ledger({ a, say }: { a: Account; say: (text: string) => void }) {
  const game = useBooks(), attempt = useStore((s) => s.attempt), accounts = useAccounts();
  const [num, setNum] = useState(""), [desc, setDesc] = useState(""), [to, setTo] = useState<string | null>(null);
  const numRef = useRef<HTMLInputElement>(null);
  const all = a.id === "bank" ? openLines(game) : [];
  const account = to ?? all[0]?.account ?? "receivables";
  const lines = all.filter((l) => l.account === account);
  const label = (l: (typeof all)[number]) => t("gc.reg.line", { text: l.text, amount: euroCents(l.amount) });
  const key = desc.trim().toLowerCase();
  const line = lines.find((l) => label(l) === desc) ?? (key ? lines.find((l) => label(l).toLowerCase().includes(key)) : undefined) ?? lines[0];

  const label_ = (id: string) => accounts.find((x) => x.id === id)?.label ?? "";
  let run = a.balance - a.entries.reduce((x, e) => { const [d, c] = sides(a, e); return x + d - c; }, 0);
  // Posted entries carry the running balance; the bank lines booked against a document sit among them without one.
  const posted = a.entries.map((e) => {
    const [d, c] = sides(a, e);
    run += d - c;
    return { hour: e.hour, num: "", text: t(e.key, e.params), to: a.id === "bank" ? label_(e.category) : label_("bank"), d, c, run: money(a.kind, run) };
  });
  const booked = a.id !== "bank" ? [] : [
    ...game.transfers.filter((x) => x.matchedAt !== null && x.invoiceId).map((x) => ({ hour: x.hour, num: game.invoices.find((i) => i.id === x.invoiceId)?.number ?? "", text: `${x.from} ${t(x.reference, x.params)}`, to: label_("receivables"), d: Math.max(0, x.amount), c: Math.max(0, -x.amount), run: "" })),
    ...(game.bank?.outgoing ?? []).filter((o) => o.matched !== null).map((o) => ({ hour: o.hour, num: game.payables.find((p) => p.id === o.payableId)?.number ?? "", text: `${o.name} ${o.reference}`, to: label_("payables"), d: 0, c: Math.abs(o.amount), run: "" })),
  ];
  const rows = [...posted, ...booked].sort((x, y) => x.hour - y.hour).slice(-300);
  const cell = (v: number) => (v ? euroCents(v) : "");
  useEffect(() => { numRef.current?.focus(); }, []);

  const clear = () => { setNum(""); setDesc(""); numRef.current?.focus(); };
  const commit = () => {
    if (!line) return;
    const r = attempt(bookByNumber, line.id, num);
    say(r.ok ? t("gc.status.booked") : t(r.error, r.params));
    if (r.ok) clear();
  };
  // Up and Down step between rows; Down from the last booked row lands in the blank one.
  const move = (e: KeyboardEvent<HTMLElement>) => {
    const tr = (e.target as HTMLElement).closest("tr"), blank = tr?.classList.contains("gc-blank");
    if (!tr || (e.key !== "ArrowUp" && e.key !== "ArrowDown") || (blank && e.key === "ArrowDown")) return;
    const next = (e.key === "ArrowUp" ? tr.previousElementSibling : tr.nextElementSibling) as HTMLElement | null;
    if (!next) return;
    e.preventDefault();
    (next.classList.contains("gc-blank") ? next.querySelector("input") : next)?.focus();
  };
  const keys = (e: KeyboardEvent) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") clear(); };
  return (
    <div className="gc-scroll">
      <table className="gc-register">
        <thead><tr>
          <th>{t("gc.col.date")}</th><th>{t("gc.col.num")}</th><th>{t("gc.col.desc")}</th><th>{t("gc.col.transfer")}</th>
          <th className="r">{t("gc.col.debit")}</th><th className="r">{t("gc.col.credit")}</th><th className="r">{t("gc.col.balance")}</th>
        </tr></thead>
        <tbody onKeyDown={move}>
          {rows.map((r, i) => (
            <tr key={i} tabIndex={0}>
              <td className="num">{formatDay(r.hour)}</td><td className="num">{r.num}</td><td title={r.text}>{r.text}</td><td>{r.to}</td>
              <td className="r num">{cell(r.d)}</td><td className="r num">{cell(r.c)}</td><td className="r num">{r.run}</td>
            </tr>
          ))}
          {a.id === "bank" && (
            <tr className="gc-blank" onKeyDown={keys}>
              <td className="num">{line ? formatDay(line.hour) : ""}</td>
              <td><input ref={numRef} className="num" aria-label={t("gc.col.num")} value={num} onChange={(e) => setNum(e.target.value)} /></td>
              <td>
                <input aria-label={t("gc.col.desc")} list="gc-lines" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <datalist id="gc-lines">{lines.map((l) => <option key={l.id} value={label(l)} />)}</datalist>
              </td>
              <td>
                <select aria-label={t("gc.col.transfer")} value={account} onChange={(e) => { setTo(e.target.value); setDesc(""); }}>
                  {["receivables", "payables"].map((id) => <option key={id} value={id}>{accounts.find((x) => x.id === id)?.label}</option>)}
                </select>
              </td>
              <td className="r num">{line && line.account === "receivables" ? euroCents(line.amount) : ""}</td>
              <td className="r num">{line && line.account === "payables" ? euroCents(line.amount) : ""}</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
