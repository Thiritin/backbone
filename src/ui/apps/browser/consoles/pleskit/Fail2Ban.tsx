import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { formatClock } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { newHostBans } from "../../../../../sim/60-infra/bans";
import { setJail, trustIp, unbanIp, untrustIp } from "../../../../../sim/90-actions/webpanel";
import { usePageAct } from "../../pageAct";

type Part = "settings" | "jails" | "banned" | "trusted";

// Tools & Settings > IP Address Banning (Fail2Ban) with the real tabs.
export function Fail2Ban({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), [part, setPart] = useState<Part>("settings"), [ip, setIp] = useState("");
  const b = game.webpanel.bans[c.id] ?? newHostBans(), scanners = b.list.filter((x) => x.kind === "scanner").length;
  const name = (id?: string) => game.services.find((v) => v.id === id)?.label ?? "";
  return (
    <>
      <div className="cx-tools" role="tablist">
        {(["settings", "jails", "banned", "trusted"] as Part[]).map((k) => <button key={k} role="tab" className="cx-chip" aria-pressed={part === k} onClick={() => setPart(k)}>{t(`web.ban.${k}`)}</button>)}
      </div>
      {part === "settings" && (
        <>
          <p>{b.jail ? t("web.ban.on") : t("web.ban.off")}</p>
          <p className="cx-acts"><button className="cx-btn" onClick={() => act(setJail, c.id, !b.jail)}>{b.jail ? t("web.ban.disable") : t("web.ban.enable")}</button></p>
          <table className="cx-readout"><tbody>
            <tr><th>{t("web.ban.banTime")}</th><td className="num">{t("web.ban.days", { n: 7 })}</td></tr>
            <tr><th>{t("web.ban.maxRetry")}</th><td className="num">3</td></tr>
            <tr><th>{t("web.ban.failed")}</th><td className="num">{b.failed}</td></tr>
          </tbody></table>
        </>
      )}
      {part === "jails" && (
        <table className="cx-readout">
          <thead><tr><th>{t("web.ban.jail")}</th><th>{t("web.ban.status")}</th><th>{t("web.ban.count")}</th></tr></thead>
          <tbody>
            <tr><td>plesk-panel</td><td>{b.jail ? t("web.ban.active") : t("web.ban.inactive")}</td><td className="num">{b.list.length - scanners}</td></tr>
            <tr><td>ssh</td><td>{b.jail ? t("web.ban.active") : t("web.ban.inactive")}</td><td className="num">{scanners}</td></tr>
          </tbody>
        </table>
      )}
      {part === "banned" && (
        <table className="cx-readout">
          <thead><tr><th>{t("web.ban.ip")}</th><th>{t("web.ban.jail")}</th><th>{t("web.ban.until")}</th><th /></tr></thead>
          <tbody>
            {b.list.length === 0 && <tr><td colSpan={4} className="cx-empty">{t("web.ban.none")}</td></tr>}
            {b.list.map((x) => (
              <tr key={x.ip}>
                <td>{x.ip}{x.serviceId && <span className="cx-sub">{name(x.serviceId)}</span>}</td>
                <td>{x.kind === "scanner" ? "ssh" : "plesk-panel"}</td>
                <td className="num">{formatClock(x.until)}</td>
                <td><button className="cx-btn" onClick={() => act(unbanIp, c.id, x.ip)}>{t("web.ban.unban")}</button>{x.kind === "customer" && <button className="cx-btn" onClick={() => act(trustIp, c.id, x.ip)}>{t("web.ban.trust")}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {part === "trusted" && (
        <>
          <form className="cx-acts" onSubmit={(e) => { e.preventDefault(); if (ip.trim()) { act(trustIp, c.id, ip); setIp(""); } }}>
            <input aria-label={t("web.ban.ip")} value={ip} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.7" />
            <button className="cx-btn primary" type="submit">{t("web.ban.add")}</button>
          </form>
          <table className="cx-readout">
            <thead><tr><th>{t("web.ban.ip")}</th><th /></tr></thead>
            <tbody>
              {b.trusted.length === 0 && <tr><td colSpan={2} className="cx-empty">{t("web.ban.none")}</td></tr>}
              {b.trusted.map((x) => <tr key={x}><td>{x}</td><td><button className="cx-btn" onClick={() => act(untrustIp, c.id, x)}>{t("web.ban.remove")}</button></td></tr>)}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
