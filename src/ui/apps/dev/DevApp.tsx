import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { dateOf, formatClock } from "../../../sim/00-core/time";
import { setDate, setKnowHow, setMoney } from "../../../sim/90-actions/dev";
import { useStore } from "../../store";
import "./dev.css";

// The dev menu from `sudo dev` in the Terminal: raw edits of the date, cash and research points for testing.
export function DevApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [date, setDay] = useState(() => dateOf(game.hour).toISOString().slice(0, 10));
  const [hour, setHour] = useState(() => dateOf(game.hour).getUTCHours());
  const [cash, setCash] = useState(() => String(game.cash));
  const [points, setPoints] = useState(() => String(game.knowHow));
  const enter = (run: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter") run(); };
  const applyDate = () => { if (date) act(setDate, date, hour); };
  const applyCash = () => { if (cash.trim()) act(setMoney, Number(cash)); };
  const applyPoints = () => { if (points.trim()) act(setKnowHow, Number(points)); };

  return (
    <div className="dev">
      <div className="dev-row">
        <label htmlFor="dev-date">Date</label>
        <div className="dev-inputs">
          <input id="dev-date" className="field" type="date" min="2005-01-01" value={date} onChange={(e) => setDay(e.target.value)} onKeyDown={enter(applyDate)} />
          <input className="field dev-hour" type="number" min={0} max={23} aria-label="Hour" value={hour} onChange={(e) => setHour(Math.max(0, Math.min(23, Math.round(Number(e.target.value)))))} onKeyDown={enter(applyDate)} />
        </div>
        <button className="btn primary" disabled={!date} onClick={applyDate}>Set date</button>
        <span className="sub">Now {formatClock(game.hour, game.minute)}. The jump skips the ticks in between.</span>
      </div>
      <div className="dev-row">
        <label htmlFor="dev-cash">Money (€)</label>
        <div className="dev-inputs">
          <input id="dev-cash" className="field" type="number" step="any" value={cash} onChange={(e) => setCash(e.target.value)} onKeyDown={enter(applyCash)} />
        </div>
        <button className="btn primary" disabled={!cash.trim()} onClick={applyCash}>Set money</button>
        <span className="sub">Now {euroCents(game.cash)}.</span>
      </div>
      <div className="dev-row">
        <label htmlFor="dev-points">Research points</label>
        <div className="dev-inputs">
          <input id="dev-points" className="field" type="number" min={0} step={1} value={points} onChange={(e) => setPoints(e.target.value)} onKeyDown={enter(applyPoints)} />
        </div>
        <button className="btn primary" disabled={!points.trim()} onClick={applyPoints}>Set points</button>
        <span className="sub">Now {game.knowHow}.</span>
      </div>
    </div>
  );
}
