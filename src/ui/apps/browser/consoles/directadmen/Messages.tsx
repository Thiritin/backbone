import { t } from "../../../../../i18n/en";
import { formatClock } from "../../../../../sim/00-core/time";
import { subjectParams } from "../../../../../sim/40-support/notices";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { hostMessages, unreadCount } from "../../../../../sim/60-infra/messages";
import { vulnById } from "../../../../../sim/60-infra/security";
import { useStore } from "../../../../store";

// Admin level > Message System: tickets of this host's customers and what the system says about the host.
export function Messages({ game, c, late }: { game: GameState; c: Cluster; late: boolean }) {
  const openApp = useStore((s) => s.openApp), list = hostMessages(game, c.id), unread = unreadCount(list);
  const name = (id: string) => game.customers.find((x) => x.id === id)?.name ?? "";
  const label = (id?: string) => game.services.find((v) => v.id === id)?.label ?? "";
  return (
    <>
      {late && <p><span className="da-badge">{unread}</span> {t("web.msg.unread")}</p>}
      <table className="cx-readout">
        <thead><tr><th>{t("web.msg.subject")}</th><th>{t("web.msg.from")}</th><th>{t("web.msg.date")}</th><th /></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={4} className="cx-empty">{t("web.msg.none")}</td></tr>}
          {list.map((m) => {
            const tk = m.ticket, subject = tk ? t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(game, tk)) : m.kind === "advisory" ? t("web.msg.advisory", { name: vulnById(game.security.vuln)?.id ?? "" }) : t("web.msg.certExpired", { domain: label(m.serviceId) });
            return (
              <tr key={m.id} className={late && tk?.unread ? "da-unread" : undefined}>
                <td>{subject}</td>
                <td>{tk ? name(tk.customerId) : t("web.msg.system")}</td>
                <td className="num">{formatClock(m.hour)}</td>
                <td>{tk && <button className="cx-btn" onClick={() => openApp("Support", { kind: "ticket", id: tk.id })}>{t("web.msg.open")}</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
