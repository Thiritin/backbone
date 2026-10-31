import { dateOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { mailAddress } from "../../../../../sim/60-infra/addresses";
import { mailStateOf, queueEntries } from "../../../../../sim/60-infra/netsvc-mail";
import { deleteQueue, flushQueue } from "../../../../../sim/90-actions/netsvc-mail";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { useStore } from "../../../../store";

const stamp = (hour: number) => dateOf(hour).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

// The address a mail host sends from and what waits in its deferred queue.
export function useMailQueue(game: GameState, clusterId: string) {
  const act = useStore((s) => s.act), address = mailAddress(game, clusterId);
  return {
    address, deferred: address ? mailStateOf(game, address.id).deferred : 0, entries: address ? queueEntries(game, address.id) : [],
    flush: () => address && act(flushQueue, address.id), clear: () => address && act(deleteQueue, address.id),
  };
}

// The mailcow queue manager: the deferred queue as a table with the flush and delete buttons.
export function MailQueue({ game, clusterId }: { game: GameState; clusterId: string }) {
  const q = useMailQueue(game, clusterId);
  return (
    <>
      <div className="mp-queue-bar">
        <b>{t("netsvc.deferred", { n: q.deferred.toLocaleString(LOCALE) })}</b>
        <button className="cx-btn" onClick={q.flush}>{t("netsvc.flush")}</button>
        <button className="cx-btn danger" onClick={q.clear}>{t("netsvc.deleteAll")}</button>
      </div>
      {q.entries.length === 0 ? <p className="cx-empty">{t("browser-consoles-1.mpQueueEmpty")}</p> : (
        <table className="cx-table">
          <thead><tr><th>{t("netsvc.queueId")}</th><th>{t("netsvc.sender")}</th><th>{t("netsvc.recipients")}</th><th>{t("netsvc.arrived")}</th><th>{t("netsvc.reason")}</th></tr></thead>
          <tbody>{q.entries.map((e) => <tr key={e.id}><td className="num">{e.id}</td><td>{e.sender}</td><td>{e.recipient}</td><td className="num">{stamp(e.hour)}</td><td>{e.reason}</td></tr>)}</tbody>
        </table>
      )}
    </>
  );
}
