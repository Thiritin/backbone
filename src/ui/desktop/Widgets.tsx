import { t } from "../../i18n/en";
import { ChartLine, Flag, LifeBuoy, Trophy, Users, Wallet } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { dateOf } from "../../sim/00-core/time";
import { euro } from "../../sim/00-core/money";
import { metrics } from "../../sim/metrics";
import { appByName } from "../apps/registry";
import { useBoard } from "../leaderboard";
import { useStore } from "../store";
import { LOCALE } from "../../i18n/lang";

function Widget({ app, icon, label, children }: { app: string; icon: ReactNode; label: string; children: ReactNode }) {
  const openApp = useStore((s) => s.openApp);
  return (
    <button className="widget" style={{ "--tile": appByName(app).tile } as CSSProperties} onClick={() => openApp(app)}>
      <span className="w-head">{icon}{label}</span>
      {children}
    </button>
  );
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(LOCALE, { timeZone: "UTC", ...o });

export function Widgets() {
  const game = useStore((s) => s.game);
  const openApp = useStore((s) => s.openApp);
  const m = metrics(game);
  const d = dateOf(game.hour);
  const has = (id: string) => game.installed.includes(id);
  // The challenge leader's last weekly sample at or before this hour.
  const ghost = useBoard(game.challenge)?.ghost.filter(([h]) => h <= game.hour).at(-1);
  if (!ghost && !game.installed.some((id) => id.startsWith("widget"))) return null;
  return (
    <div className="widgets" aria-label={t("desktop.widgets")}>
      {ghost && <button className="widget" style={{ "--tile": appByName("Settings").tile } as CSSProperties} onClick={() => openApp("Settings", { kind: "section", id: "Leaderboard" })}>
        <span className="w-head"><Flag />{t("desktop.widget.leader")}</span>
        <span className="w-ghost">{t("desktop.widget.leaderText", { customers: ghost[1], cash: euro(ghost[2]) })}</span>
      </button>}
      {has("widgetCalendar") && <div className="widget w-cal">
        <span className="w-weekday">{fmt(d, { weekday: "long" })}</span>
        <span className="w-big num">{d.getUTCDate()}<span className="w-month">{fmt(d, { month: "short" }).slice(0, 3)}</span></span>
        <span className="w-sub num">{d.getUTCFullYear()}</span>
      </div>}
      {has("widgetTickets") && <Widget app="Support" icon={<LifeBuoy />} label={t("desktop.widget.tickets")}>
        <span className="w-big num">{m.openTickets}</span>
      </Widget>}
      {has("widgetCash") && <Widget app="Books" icon={<Wallet />} label={t("desktop.widget.cash")}>
        <span className="w-big num">{euro(m.cash)}</span>
      </Widget>}
      {has("widgetRevenue") && <Widget app="Books" icon={<ChartLine />} label={t("desktop.widget.revenue")}>
        <span className="w-big num">{euro(m.mrr)}</span>
      </Widget>}
      {has("widgetCustomers") && <Widget app="Books" icon={<Users />} label={t("desktop.widget.customers")}>
        <span className="w-big num">{m.customers}</span>
      </Widget>}
      {has("widgetLevel") && <Widget app="Books" icon={<Trophy />} label={t("desktop.widget.level", { level: m.level.level })}>
        <span className="w-name">{m.level.name}</span>
        <span className="w-bar"><span style={{ width: `${m.progress * 100}%` }} /></span>
        {m.next && <span className="w-sub num">{t("desktop.widget.levelOf", { now: euro(m.netWorth), next: euro(m.next.netWorth) })}</span>}
      </Widget>}
    </div>
  );
}
