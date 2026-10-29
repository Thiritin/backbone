import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { RECONNECT_HOUR, STATIC_LINE_ADDRESSES } from "../../../sim/10-catalog/addresses";
import { HOME_LINES, homeLineById, type HomeLine as Line } from "../../../sim/20-world/datacenters";
import type { GameState } from "../../../sim/50-state";
import { homePeak } from "../../../sim/60-infra/network";
import { orderHomeLine } from "../../../sim/90-actions/hardware";
import { BrandLogo } from "../../art/logos";
import { useStore } from "../../store";
import { day } from "../hw";

const speed = (mbit: number) => (mbit >= 1000 ? `${mbit / 1000} Gbit/s` : `${mbit} Mbit/s`);

// The basement's internet line and the lines on offer this year.
export function HomeLinePanel({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const { id, next } = game.homeLine;
  const current = homeLineById(id), peak = homePeak(game);
  const offers = HOME_LINES.filter((l) => l.from <= yearOf(game.hour));
  const card = (l: Line) => (
    <div key={l.id} className={`loc-line${l.id === id ? " current" : ""}`}>
      <div className="loc-line-name">
        <strong>{l.name}</strong>
        <span><BrandLogo brand={l.isp} size={14} />{l.isp}</span>
      </div>
      <dl className="loc-line-specs">
        <div><dt>Download</dt><dd className="num">{speed(l.down)}</dd></div>
        <div><dt>Upload</dt><dd className="num">{speed(l.up)}</dd></div>
        <div><dt>Addresses</dt><dd className="num">{l.staticIp ? `${STATIC_LINE_ADDRESSES} static` : "1 dynamic"}</dd></div>
        <div><dt>Reconnect</dt><dd className="num">{l.staticIp ? "None" : `Daily ${String(RECONNECT_HOUR).padStart(2, "0")}:00`}</dd></div>
        <div><dt>Installation</dt><dd className="num">{l.installDays} days</dd></div>
      </dl>
      <div className="loc-line-foot">
        <strong className="num">{euro(l.monthly)} / month</strong>
        <span className="grow" />
        {l.id === id ? <span className="pill ok">Active</span>
          : l.id === next?.id ? <>
            <span className="pill">Connects <span className="num">{day(next.at)}</span></span>
            <button className="btn" onClick={() => act(orderHomeLine, id)}>Cancel</button>
          </>
          : <button className="btn primary" onClick={() => act(orderHomeLine, l.id)}>Order</button>}
      </div>
    </div>
  );
  return (
    <div className="loc-card" id="home-line">
      <div className="loc-card-h">
        <h3>Internet line</h3>
        <span className="grow" />
        {current.id ? <span className="loc-muted">{current.isp} {current.name}, <span className="num">{speed(current.down)}</span> down, <span className="num">{speed(current.up)}</span> up</span>
          : <span className="pill bad">No line</span>}
        {current.id && <span className={`pill${peak > current.up ? " bad" : peak > 0.8 * current.up ? " warn" : ""}`}>Peak upload <span className="num">{peak.toFixed(peak >= 10 ? 0 : 1)} Mbit/s</span></span>}
      </div>
      <div className="loc-lines">{offers.map(card)}</div>
    </div>
  );
}
