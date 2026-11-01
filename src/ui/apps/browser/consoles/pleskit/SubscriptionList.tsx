import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { sslStatus } from "../../../../../sim/60-infra/webpanel";
import { Actions, RowsTable, type Row } from "../PanelBase";
import { subscriptionsOf } from "./subscriptions";

const status = (game: GameState, id: string): "defaced" | "sslExpired" | "active" =>
  game.sites.defaced.includes(id) ? "defaced" : sslStatus(game, id) === "expired" ? "sslExpired" : "active";
const TONE = { defaced: "bad", sslExpired: "bad", active: "ok" } as const;

// Websites & Domains: Plesk 8 to 11 list the clients and the domains apart, Onyx on groups the domains under their subscription.
export function SubscriptionList({ game, c, rows, late }: { game: GameState; c: Cluster; rows: Row[]; late: boolean }) {
  const [open, setOpen] = useState<string[]>([]), subs = subscriptionsOf(game, c.id);
  const rowOf = (serviceId: string) => rows.find((r) => game.workloads.find((w) => w.id === r.id)?.serviceId === serviceId);
  if (!late) {
    const clients = [...new Set(subs.map((x) => x.service.customerId))];
    return (
      <>
        <h3>{t("web.sub.clients")}</h3>
        <table className="cx-table">
          <thead><tr><th>{t("web.sub.client")}</th><th>{t("web.sub.domains")}</th></tr></thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={2} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
            {clients.map((id) => <tr key={id}><td>{game.customers.find((x) => x.id === id)?.name}</td><td>{subs.filter((x) => x.service.customerId === id).map((x) => x.service.label).join(", ")}</td></tr>)}
          </tbody>
        </table>
        <h3>{t("browser-consoles-2.domains")}</h3>
        <RowsTable rows={rows} name={t("browser-consoles-2.domain")} />
      </>
    );
  }
  return (
    <table className="cx-table">
      <thead><tr><th>{t("web.sub.subscription")}</th><th>{t("web.sub.plan")}</th><th>{t("browser-consoles-2.status")}</th><th>{t("web.sub.domains")}</th><th /></tr></thead>
      <tbody>
        {subs.length === 0 && <tr><td colSpan={5} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
        {subs.map(({ service: v, domains }) => {
          const st = status(game, v.id), r = rowOf(v.id), shown = open.includes(v.id);
          return [
            <tr key={v.id}>
              <td><button className="cx-btn" aria-expanded={shown} aria-label={v.label} onClick={() => setOpen(shown ? open.filter((x) => x !== v.id) : [...open, v.id])}>{shown ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}</button> <b>{v.label}</b></td>
              <td>{v.pkg ?? t("web.sub.custom")}</td>
              <td><span className={`cx-state ${TONE[st]}`}>{t(`web.sub.${st}`)}</span></td>
              <td className="num">{domains.length}</td>
              <td>{r && <Actions actions={r.actions} className="cx-acts" />}</td>
            </tr>,
            ...(shown ? domains.map((d) => { const ds = d.product === "ssl" ? st : "active"; return <tr key={`${v.id}-${d.id}`}><td colSpan={2}>{d.label}<span className="cx-sub">{t(`web.sub.${d.product}`)}</span></td><td colSpan={3}><span className={`cx-state ${TONE[ds]}`}>{t(`web.sub.${ds}`)}</span></td></tr>; }) : []),
          ];
        })}
      </tbody>
    </table>
  );
}
