import { LOCALE } from "../../../../i18n/lang";
import { t } from "../../../../i18n/en";
import { dateOf, formatClock } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { SERIES_HOURS, STORAGE_DAYS, seriesOf, vpnSessions, type MailCheck } from "../../../../sim/80-business/readouts";
import { Chart, niceMax } from "./Chart";
import "./hypervisor.css";

const mine = (game: GameState, c: Cluster) => game.workloads.filter((w) => w.clusterId === c.id);
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

// Queries per hour over the last day; the early look gets the counters alone.
export function DnsStatistics({ game, c, table }: { game: GameState; c: Cluster; table?: boolean }) {
  const q = seriesOf(game, mine(game, c), "queries");
  if (table) return (
    <table className="cx-readout">
      <tbody>
        <tr><th>{t("readouts.dns.total")}</th><td className="num">{Math.round(sum(q))}</td></tr>
        <tr><th>{t("readouts.dns.perHour")}</th><td className="num">{Math.round(q[q.length - 1])}</td></tr>
      </tbody>
    </table>
  );
  return <Chart kind="bars" values={q} max={niceMax(q, 10)} unit="" title={t("readouts.dns.perHour")} now={String(Math.round(q[q.length - 1]))} end={game.hour} slots={SERIES_HOURS} />;
}

export function VpnReadout({ game, c }: { game: GameState; c: Cluster }) {
  const list = vpnSessions(game, c), mbit = seriesOf(game, mine(game, c), "mbit");
  return (
    <div className="cx-readout">
      <Chart kind="area" values={mbit} max={niceMax(mbit, 1)} unit="Mbit/s" title={t("readouts.vpn.throughput")} now={`${+mbit[mbit.length - 1].toFixed(1)} Mbit/s`} end={game.hour} slots={SERIES_HOURS} />
      <table>
        <thead><tr><th>{t("readouts.vpn.user")}</th><th>{t("readouts.vpn.real")}</th><th>{t("readouts.vpn.address")}</th><th>{t("readouts.vpn.received")}</th><th>{t("readouts.vpn.sent")}</th><th>{t("readouts.vpn.since")}</th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={6} className="cx-empty">{t("readouts.vpn.none")}</td></tr>}
          {list.slice(0, 40).map((x) => <tr key={`${x.workloadId}${x.user}`}><td>{x.user}</td><td className="num">{x.realIp}</td><td className="num">{x.vpnIp}</td><td className="num">{x.rxMb} MB</td><td className="num">{x.txMb} MB</td><td className="num">{formatClock(x.since)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

// The storage fill over the last month, one point a day.
export function StorageUsage({ game, c }: { game: GameState; c: Cluster }) {
  const ws = mine(game, c), v = seriesOf(game, ws, "storage"), booked = sum(ws.map((w) => w.diskGb));
  const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
  const ticks = [STORAGE_DAYS - 1, 20, 10, 0].map((back) => day.format(dateOf(game.hour - back * 24)));
  return <Chart kind="area" values={v} max={niceMax([booked, ...v], 1)} unit="GB" title={t("readouts.storage.usage")} now={`${+v[v.length - 1].toFixed(1)} GB`} slots={STORAGE_DAYS} ticks={ticks} />;
}

export const checkLabel = (x: MailCheck) => t(`readouts.check.${x}`);
export const checkTone = (x: MailCheck) => (x === "pass" ? "ok" : x === "missing" ? "bad" : "");
