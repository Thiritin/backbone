import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { useAccounts, type Account, type Kind } from "../../data";
import { arrowRows } from "../../view";
import { KINDS, money, shown, typeKey } from "./shared";

// The account tree page: kinds as parent rows with an expander, accounts below, a column header on top.
export function Tree({ selected, select, open }: { selected: string | null; select: (id: string) => void; open: (a: Account) => void }) {
  const accounts = useAccounts();
  const [closed, setClosed] = useState<Kind[]>([]);
  const total = (k: Kind) => accounts.filter((a) => a.kind === k).reduce((x, a) => x + a.balance, 0);
  return (
    <div className="gc-scroll" onKeyDown={arrowRows}>
      <table className="gc-tree" role="treegrid">
        <thead><tr><th>{t("gc.col.name")}</th><th>{t("gc.col.type")}</th><th>{t("gc.col.code")}</th><th className="r">{t("gc.col.total")}</th></tr></thead>
        <tbody>
          {KINDS.filter((k) => accounts.some((a) => a.kind === k)).map((k) => [
            <tr key={k} className="gc-parent" aria-expanded={!closed.includes(k)} onClick={() => setClosed(closed.includes(k) ? closed.filter((x) => x !== k) : [...closed, k])}>
              <td><span className="gc-exp" aria-hidden />{t(`gc.grp.${k}`)}</td><td /><td /><td className={`r num${shown(k, total(k)) < 0 ? " neg" : ""}`}>{money(k, total(k))}</td>
            </tr>,
            ...(closed.includes(k) ? [] : accounts.filter((a) => a.kind === k).map((a) => (
              <tr key={a.id} aria-selected={a.id === selected} tabIndex={0} onClick={() => select(a.id)} onDoubleClick={() => open(a)} onKeyDown={(e) => e.key === "Enter" && open(a)}>
                <td className="gc-leaf">{a.label}</td><td>{t(`gc.type.${typeKey(a)}`)}</td><td className="num">{a.no}</td>
                <td className={`r num${shown(a.kind, a.balance) < 0 ? " neg" : ""}`}>{money(a.kind, a.balance)}</td>
              </tr>
            ))),
          ])}
        </tbody>
      </table>
    </div>
  );
}
