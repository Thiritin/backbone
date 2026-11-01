import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { endUsers, resellersOn } from "../../../../../sim/30-customers/resellers";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";

type Page = "users" | "packages" | "messages";

// Reseller level: the block's end users, the block itself and the users' messages.
export function ResellerLevel({ game, c }: { game: GameState; c: Cluster }) {
  const blocks = resellersOn(game, c.id), [id, setId] = useState(blocks[0]?.id), [page, setPage] = useState<Page>("users");
  const v = blocks.find((x) => x.id === id) ?? blocks[0];
  if (!v) return null;
  const users = endUsers(game, v), r = game.webpanel.resellers[v.customerId];
  return (
    <>
      <nav className="da-crumb">
        {blocks.length > 1 && (
          <select aria-label={t("web.rs.reseller")} value={v.id} onChange={(e) => setId(e.target.value)}>
            {blocks.map((b) => <option key={b.id} value={b.id}>{game.customers.find((x) => x.id === b.customerId)?.name}</option>)}
          </select>
        )}
        {(["users", "packages", "messages"] as Page[]).map((p) => <button key={p} className="da-link" onClick={() => setPage(p)}>{t(`web.rs.${p}`)}</button>)}
      </nav>
      {page === "users" && (
        <table className="cx-readout">
          <thead><tr><th>{t("web.da.customer")}</th><th>{t("browser-consoles-2.domain")}</th><th>{t("web.da.disk")}</th></tr></thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={3} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
            {users.map((u) => <tr key={u.user}><td>{u.user}</td><td>{u.domain}</td><td className="num">{u.diskGb.toFixed(1)} GB</td></tr>)}
          </tbody>
        </table>
      )}
      {page === "packages" && (
        <dl className="da-facts">
          <div><dt>{t("web.rs.accounts")}</dt><dd className="num">{users.length} / {v.spec.accounts}</dd></div>
          <div><dt>{t("web.da.disk")}</dt><dd className="num">{v.spec.diskGb} GB</dd></div>
          <div><dt>{t("web.rs.traffic")}</dt><dd className="num">{Math.round(v.spec.trafficGb)} GB</dd></div>
          <div><dt>{t("web.rs.fill")}</dt><dd className="num">{Math.round((r?.fillRate ?? 0) * 100)} %</dd></div>
        </dl>
      )}
      {page === "messages" && (
        <table className="cx-readout">
          <thead><tr><th>{t("web.msg.subject")}</th><th>{t("web.msg.from")}</th></tr></thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={2} className="cx-empty">{t("web.msg.none")}</td></tr>}
            {users.slice(0, 5).map((u) => <tr key={u.user}><td>{t("web.rs.question", { domain: u.domain })}</td><td>{u.user}</td></tr>)}
          </tbody>
        </table>
      )}
    </>
  );
}
