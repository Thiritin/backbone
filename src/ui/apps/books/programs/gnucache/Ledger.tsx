import { useRef, useState } from "react";
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

  let run = a.balance - a.entries.reduce((x, e) => { const [d, c] = sides(a, e); return x + d - c; }, 0);
  const rows = a.entries.map((e) => {
    const [d, c] = sides(a, e);
    run += d - c;
    return { e, d, c, run };
  }).slice(-300);
  const counter = (category: string) => accounts.find((x) => x.id === (a.id === "bank" ? category : "bank"))?.label ?? "";
  const cell = (v: number) => (v ? euroCents(v) : "");

  const clear = () => { setNum(""); setDesc(""); numRef.current?.focus(); };
  const commit = () => {
    if (!line) return;
    const r = attempt(bookByNumber, line.id, num);
    say(r.ok ? t("gc.status.booked") : t(r.error, r.params));
    if (r.ok) clear();
  };
  const keys = (e: React.KeyboardEvent) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") clear(); };
  return (
    <div className="gc-scroll">
      <table className="gc-register">
        <thead><tr>
          <th>{t("gc.col.date")}</th><th>{t("gc.col.num")}</th><th>{t("gc.col.desc")}</th><th>{t("gc.col.transfer")}</th>
          <th className="r">{t("gc.col.debit")}</th><th className="r">{t("gc.col.credit")}</th><th className="r">{t("gc.col.balance")}</th>
        </tr></thead>
        <tbody>
          {rows.map(({ e, d, c, run }, i) => (
            <tr key={i}>
              <td className="num">{formatDay(e.hour)}</td><td /><td title={t(e.key, e.params)}>{t(e.key, e.params)}</td><td>{counter(e.category)}</td>
              <td className="r num">{cell(d)}</td><td className="r num">{cell(c)}</td><td className="r num">{money(a.kind, run)}</td>
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
