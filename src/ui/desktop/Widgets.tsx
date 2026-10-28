import { ChartLine, LifeBuoy, Trophy, Users, Wallet } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { dateOf } from "../../sim/00-core/time";
import { euro } from "../../sim/00-core/money";
import { metrics } from "../../sim/metrics";
import { appByName } from "../apps/registry";
import { useStore } from "../store";

function Widget({ app, icon, label, children }: { app: string; icon: ReactNode; label: string; children: ReactNode }) {
  const openApp = useStore((s) => s.openApp);
  return (
    <button className="widget" style={{ "--tile": appByName(app).tile } as CSSProperties} onClick={() => openApp(app)}>
      <span className="w-head">{icon}{label}</span>
      {children}
    </button>
  );
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { timeZone: "UTC", ...o });

export function Widgets() {
  const game = useStore((s) => s.game);
  const m = metrics(game);
  const d = dateOf(game.hour);
  return (
    <div className="widgets" aria-label="Widgets">
      <div className="widget w-cal">
        <span className="w-weekday">{fmt(d, { weekday: "long" })}</span>
        <span className="w-big num">{d.getUTCDate()}</span>
        <span className="w-sub">{fmt(d, { month: "long", year: "numeric" })}</span>
      </div>
      <Widget app="Support" icon={<LifeBuoy />} label="Open tickets">
        <span className="w-big num">{m.openTickets}</span>
      </Widget>
      <Widget app="Finance" icon={<Wallet />} label="Cash">
        <span className="w-big num">{euro(m.cash)}</span>
      </Widget>
      <Widget app="Finance" icon={<ChartLine />} label="Monthly revenue">
        <span className="w-big num">{euro(m.mrr)}</span>
      </Widget>
      <Widget app="Customers" icon={<Users />} label="Customers">
        <span className="w-big num">{m.customers}</span>
      </Widget>
      <Widget app="Finance" icon={<Trophy />} label={`Level ${m.level.level}`}>
        <span className="w-name">{m.level.name}</span>
        <span className="w-bar"><span style={{ width: `${m.progress * 100}%` }} /></span>
        {m.next && <span className="w-sub num">{euro(m.netWorth)} of {euro(m.next.netWorth)}</span>}
      </Widget>
    </div>
  );
}
