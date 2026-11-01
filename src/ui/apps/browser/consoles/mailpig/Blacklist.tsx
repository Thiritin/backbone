import type { GameState } from "../../../../../sim/50-state";
import { mailAddress } from "../../../../../sim/60-infra/addresses";
import { spamSenders } from "../../../../../sim/60-infra/netsvc-mail";
import { requestDelist } from "../../../../../sim/90-actions/addresses";
import { suspendService } from "../../../../../sim/90-actions/holds";
import { setMailRelay } from "../../../../../sim/90-actions/netsvc-mail";
import { t } from "../../../../../i18n/en";
import { usePageAct } from "../../pageAct";

// A blocklist lookup box: the address, its standing, the customers sending from it and the delisting request.
export function Blacklist({ game, clusterId }: { game: GameState; clusterId: string }) {
  const act = usePageAct(), a = mailAddress(game, clusterId);
  if (!a) return <p className="cx-empty">{t("netsvc.noAddress")}</p>;
  const senders = spamSenders(game, a.id), level = a.rep < 30 ? "bad" : a.rep < 50 ? "warn" : "ok";
  return (
    <>
      <table className="cx-table">
        <tbody>
          <tr><th>{t("netsvc.address")}</th><td className="num">{a.ip}</td></tr>
          <tr><th>{t("netsvc.status")}</th><td><span className={`cx-state ${a.listed ? "bad" : "ok"}`}>{a.listed ? t("netsvc.listed") : t("netsvc.notListed")}</span></td></tr>
          <tr><th>{t("netsvc.reputation")}</th><td><span className="cx-bar" data-level={level}><i style={{ width: `${a.rep}%` }} /></span>{a.rep}</td></tr>
          {a.delistAt !== null && <tr><th>{t("netsvc.delisting")}</th><td className="num">{t("netsvc.delistIn", { h: Math.max(0, a.delistAt - game.hour) })}</td></tr>}
        </tbody>
      </table>
      <div className="mp-queue-bar"><b>{t("netsvc.topSenders")}</b><button className="cx-btn" disabled={!a.listed || a.delistAt !== null} onClick={() => act(requestDelist, a.id)}>{t("netsvc.requestDelist")}</button></div>
      {senders.length === 0 ? <p className="cx-empty">{t("netsvc.noSenders")}</p> : (
        <table className="cx-table">
          <thead><tr><th>{t("netsvc.customer")}</th><th>{t("netsvc.spamPerDay")}</th><th /></tr></thead>
          <tbody>{senders.map((x) => <tr key={x.service.id}><td>{game.customers.find((c) => c.id === x.customerId)?.name}</td><td className="num">{x.thousands}k</td><td><button className="cx-btn danger" onClick={() => act(suspendService, x.service.id, "abuse")}>{t("netsvc.suspend")}</button></td></tr>)}</tbody>
        </table>
      )}
    </>
  );
}

// Mailu's relayed domains: each panel host can send its customers' mail through this mail server.
export function Relays({ game, clusterId }: { game: GameState; clusterId: string }) {
  const act = usePageAct(), panels = game.clusters.filter((c) => c.kind === "panel");
  return (
    <table className="cx-table">
      <thead><tr><th>{t("netsvc.panelHost")}</th><th>{t("netsvc.relayHost")}</th></tr></thead>
      <tbody>{panels.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td><input type="checkbox" aria-label={t("netsvc.relayHost")} checked={game.netsvc.relay[c.id] === clusterId} onChange={(e) => act(setMailRelay, c.id, e.target.checked ? clusterId : null)} /></td></tr>)}</tbody>
    </table>
  );
}
