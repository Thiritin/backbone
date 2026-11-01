import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { holdReason } from "../../../../../../sim/45-billing/billing";
import { suspendService, terminateService, unsuspendService } from "../../../../../../sim/90-actions/holds";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import { PRODUCT } from "../../../../support/labels";
import { CustomerView } from "../../../../customers/open";
import type { ScreenProps } from "./nav";

export function Clients({ game, go }: ScreenProps) {
  const clients = game.customers.filter((c) => c.churnedAt === null);
  return (
    <div className="pt-screen">
      <table className="pt-table">
        <thead><tr><th>{t("shop-admin.client")}</th><th>{t("shop-admin.services")}</th><th>{t("shop-admin.since")}</th></tr></thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td><a href="#" onClick={(e) => { e.preventDefault(); go({ name: "client", id: c.id }); }}>{c.name}</a></td>
              <td className="num">{game.services.filter((v) => v.customerId === c.id && v.endedAt === null).length}</td>
              <td className="num">{formatDay(c.since)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One client: the customer record, the services with their hold and terminate links, and the way into the client area as that client.
export function ClientSummary({ game, go, id, tab, toClient }: ScreenProps & { id: string; tab?: string }) {
  const act = useStore((s) => s.act);
  const c = game.customers.find((x) => x.id === id);
  if (!c) return null;
  return (
    <div className="pt-screen">
      <CustomerView game={game} id={c.id} tab={tab} onBack={() => go({ name: "clients" })} />
      {toClient && <button className="btn" onClick={() => toClient(c.id)}>{t("shop-admin.loginAsClient")}</button>}
      <table className="pt-table">
        <thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-admin.price")}</th><th /></tr></thead>
        <tbody>
          {game.services.filter((v) => v.customerId === c.id && v.endedAt === null).map((v) => {
            const held = !!holdReason(game, v);
            return (
              <tr key={v.id}>
                <td>{v.label || PRODUCT[v.product]}</td>
                <td className="num">{euroCents(v.price)}</td>
                <td>
                  <button className="btn" onClick={() => act(held ? unsuspendService : suspendService, v.id)}>{t(held ? "shop-admin.unsuspend" : "shop-admin.suspend")}</button>
                  <button className="btn" onClick={() => act(terminateService, v.id)}>{t("shop-admin.terminate")}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
