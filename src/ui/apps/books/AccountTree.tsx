import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { euroCents } from "../../../sim/00-core/money";
import { t } from "../../../i18n/en";
import { useSessionState } from "../../session";
import { AccountSheet, accountsOf, type Account, type Kind } from "./accounts";
import { arrowRows, useBooks } from "./view";

const KINDS: Kind[] = ["asset", "liability", "equity", "income", "expense"];
// GnuCache shows credit accounts with their sign turned, so income and debts read positive.
const shown = (kind: Kind, v: number) => (kind === "asset" || kind === "expense" ? v : -v);

// GnuCache's Accounts page: the account tree with totals; opening an account adds its register as a page beside it.
export function AccountTree({ go }: { go: (tab: string) => void }) {
  const game = useBooks();
  const accounts = accountsOf(game);
  const [closed, setClosed] = useState<Kind[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useSessionState<string | null>("books.gnuOpen", null);
  const page = accounts.find((a) => a.id === open);
  const path = (a: Account) => `${t(`books-screens.kind.${a.kind}`)}:${a.label}`;
  const bank = accounts.find((a) => a.id === "bank")!;
  const openAccount = (a: Account) => (a.go ? go(a.go) : setOpen(a.id));
  const keys = (e: KeyboardEvent, a: Account) => e.key === "Enter" && openAccount(a);
  const total = (k: Kind) => accounts.filter((a) => a.kind === k).reduce((x, a) => x + a.balance, 0);
  const sel = accounts.find((a) => a.id === selected);
  return (
    <div className="bk-gnu">
      <div className="bk-gnu-pages" role="tablist">
        <button role="tab" aria-selected={!page} onClick={() => setOpen(null)}>{t("books.tab.accounts")}</button>
        {page && (
          <span role="tab" aria-selected className="bk-gnu-page">
            {page.label}
            <button className="bk-gnu-close" aria-label={t("support.close")} onClick={() => setOpen(null)}><X /></button>
          </span>
        )}
      </div>
      {page ? (
        <div className="fin-scroll">
          <AccountSheet a={page} counter={(e) => (page.id === "bank" ? path(accounts.find((a) => a.id === e.category) ?? bank) : path(bank))} show={(v) => euroCents(shown(page.kind, v))} />
        </div>
      ) : (
        <>
          <div className="bk-gnu-tools">
            <button className="btn" disabled={!sel} onClick={() => sel && openAccount(sel)}>{t("books-screens.open")}</button>
          </div>
          <div className="fin-scroll" onKeyDown={arrowRows}>
            <table className="table fin-table bk-gnu-tree" role="treegrid">
              <thead><tr><th>{t("books-screens.col.account")}</th><th>{t("books-screens.col.code")}</th><th className="r">{t("books-screens.col.total")}</th></tr></thead>
              <tbody>
                {KINDS.filter((k) => accounts.some((a) => a.kind === k)).map((k) => [
                  <tr key={k} className="bk-gnu-parent" aria-expanded={!closed.includes(k)} onClick={() => setClosed(closed.includes(k) ? closed.filter((x) => x !== k) : [...closed, k])}>
                    <td>{t(`books-screens.kind.${k}`)}</td><td /><td className={`r num${shown(k, total(k)) < 0 ? " neg" : ""}`}>{euroCents(shown(k, total(k)))}</td>
                  </tr>,
                  ...(closed.includes(k) ? [] : accounts.filter((a) => a.kind === k).map((a) => (
                    <tr key={a.id} className={a.id === selected ? "sel" : ""} tabIndex={0} onClick={() => setSelected(a.id)} onDoubleClick={() => openAccount(a)} onKeyDown={(e) => keys(e, a)}>
                      <td className="bk-gnu-leaf">{a.label}</td>
                      <td className="num">{a.no}</td>
                      <td className={`r num${shown(a.kind, a.balance) < 0 ? " neg" : ""}`}>{euroCents(shown(a.kind, a.balance))}</td>
                    </tr>
                  ))),
                ])}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
