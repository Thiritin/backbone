import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { dateOf } from "../../../sim/00-core/time";
import { HALL } from "../../../sim/20-world/properties";
import type { GameState, Location } from "../../../sim/50-state";
import { cancelWorkOrder, nowMin } from "../../../sim/90-actions/work-orders";
import { useStore } from "../../store";
import { Slab } from "./Slab";
import "./corkboard.css";

// The customers' open remote hands jobs of a hall, with the minute each is due.
export function ticketsOf(game: GameState, locationId: string) {
  const now = nowMin(game), hall = game.properties.find((p) => p.hall?.locationId === locationId)?.hall;
  return game.orders.filter((o) => o.customerId && !o.applied && o.locationId === locationId).map((o) => {
    const due = o.queuedAt + HALL.hands.dueHours * 60;
    return { id: o.id, customer: hall?.customers.find((c) => c.id === o.customerId)?.name ?? "", what: o.what ?? "", due, late: !!o.late || now >= due, begun: o.startAt !== null && o.startAt <= now };
  });
}

// The wall board enlarged: a slot with a pin for every ticket, at least four.
export function TicketsPanel({ loc, title, onClose }: { loc: Location; title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), jobs = ticketsOf(game, loc.id);
  const slots = Math.max(4, jobs.length), today = dateOf(game.hour).getUTCDate();
  const clock = (min: number) => {
    const d = dateOf(Math.floor(min / 60)), hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;
    return d.getUTCDate() === today ? hm : `${d.toLocaleDateString(LOCALE, { day: "numeric", month: "numeric", timeZone: "UTC" })} ${hm}`;
  };
  return (
    <Slab title={title} onClose={onClose} data={{ tickets: "" }}>
      <div className="wp-scene">
        <div className="cb-board tk-board" style={{ width: `min(${slots > 4 ? 4 : slots} * 190px + 56px, 100%)` }}>
          <ol className="tk-grid">
            {Array.from({ length: slots }, (_, i) => {
              const j = jobs[i];
              return j ? (
                <li key={j.id} className={`cb-card tk-ticket${j.late ? " late" : ""}`} data-ticket={j.id} data-late={j.late} style={{ rotate: `${((i * 37) % 7 - 3) * 0.4}deg` }}>
                  <i className="cb-pin" />
                  <b>{j.customer}</b>
                  <span>{t(`orders.kind.${j.what}`)}</span>
                  <span>{t("hall.tickets.due")}</span>
                  <span className="num">{clock(j.due)}</span>
                  {j.late && <span className="tk-stamp">{t("hall.tickets.late")}</span>}
                  {!j.begun && <button className="tk-cancel" onClick={() => act(cancelWorkOrder, j.id)}>{t("figures.cancel")}</button>}
                </li>
              ) : <li key={`e${i}`} className="tk-slot"><i className="cb-pin" /></li>;
            })}
          </ol>
        </div>
      </div>
    </Slab>
  );
}
