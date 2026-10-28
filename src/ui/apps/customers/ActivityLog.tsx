import { activityFor } from "../../../sim/47-staff/activity";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { stamp } from "../support/labels";

export function ActivityLog({ customerId, serviceId }: { customerId: string; serviceId?: string }) {
  const game = useStore((s) => s.game);
  const entries = activityFor(game, customerId, serviceId);
  if (!entries.length) return <div className="cus-row cus-dim">No activity</div>;
  return (
    <ol className="cus-activity">
      {entries.map((a, i) => (
        <li key={i}>
          <span className="num cus-dim">{stamp(a.hour)}</span>
          <span className="grow">{t(a.key, a.params)}</span>
          <span className="cus-dim">{a.by ?? "You"}</span>
          <span className="num cus-dim">{a.minutes ? `${a.minutes} min` : ""}</span>
        </li>
      ))}
    </ol>
  );
}
