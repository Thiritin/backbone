// The player's order list by the clock: the order in progress with its minutes, then the waiting ones, each with a cross that cancels it.
import { t } from "../../i18n/en";
import type { GameState, Location } from "../../sim/50-state";
import { arriveAt, cancelWorkOrder, nowMin, opensOf } from "../../sim/90-actions/work-orders";
import { useStore } from "../store";
import { useVisit } from "./visit";

export function OrderChip({ game, loc }: { game: GameState; loc: Location }) {
  const act = useStore((s) => s.act);
  const pending = useVisit((v) => v.pending), set = useVisit((v) => v.set), m = nowMin(game);
  const list = opensOf(game, "player").filter((o) => o.locationId === loc.id), waiting = pending?.locationId === loc.id ? pending : null;
  if (!list.length && !waiting) return null;
  const begun = (o: (typeof list)[number]) => o.startAt !== null && o.startAt <= m;
  return (
    <ul className="w-orders" aria-live="polite">
      {list.slice(0, 5).map((o) => (
        <li key={o.id} data-order={o.id}>
          <span className="num">{begun(o) ? t("figures.chip.current", { kind: t(`orders.kind.${o.kind}`), done: Math.min(o.workMin, Math.max(0, Math.floor(m - arriveAt(o)))), total: o.workMin }) : t("figures.chip.queued", { kind: t(`orders.kind.${o.kind}`), total: o.workMin })}</span>
          {!begun(o) && <button className="w-orders-x" aria-label={t("figures.cancel")} onClick={() => act(cancelWorkOrder, o.id)}>×</button>}
        </li>
      ))}
      {waiting && <li data-visit><span>{waiting.label}</span><button className="w-orders-x" aria-label={t("figures.cancel")} onClick={() => set({ pending: null })}>×</button></li>}
    </ul>
  );
}
