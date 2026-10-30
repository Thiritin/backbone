import { dateOf } from "../../../sim/00-core/time";
import type { TrendPoint } from "../../../sim/80-business/trend";
import { monthYear } from "../support/labels";

const W = 520, H = 150, PAD = { l: 36, r: 8, t: 8, b: 20 };

function niceMax(v: number): number {
  const step = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  return [1, 2, 5, 10].map((k) => k * step).find((x) => x >= v)!;
}

function Series({ title, now, points, max, fixed }: { title: string; now: string; points: { hour: number; v: number }[]; max: number; fixed?: boolean }) {
  const first = points[0]?.hour ?? 0, span = Math.max(1, (points[points.length - 1]?.hour ?? 0) - first);
  const top = fixed ? max : niceMax(max);
  const x = (h: number) => PAD.l + ((h - first) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const line = points.map((p) => `${x(p.hour).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const years = new Set<number>();
  const ticks = points.filter((p) => { const yr = dateOf(p.hour).getUTCFullYear(); return !years.has(yr) && years.add(yr); });
  return (
    <figure className="cus-chart">
      <figcaption><b>{title}</b><span className="num">{now}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(top * f)} y2={y(top * f)} />
            <text className="num" x={PAD.l - 6} y={y(top * f)} textAnchor="end" dominantBaseline="middle">{+(top * f).toFixed(0)}</text>
          </g>
        ))}
        {ticks.slice(1).map((p) => <text key={p.hour} className="num" x={x(p.hour)} y={H - 4} textAnchor="middle">{dateOf(p.hour).getUTCFullYear()}</text>)}
        <text className="num" x={PAD.l} y={H - 4}>{monthYear(first)}</text>
        {points.length > 1 && <polyline className="line" points={line} />}
      </svg>
    </figure>
  );
}

export function TrendCharts({ trend }: { trend: TrendPoint[] }) {
  if (!trend.length) return <div className="sup-none">No history yet</div>;
  const last = trend[trend.length - 1];
  return (
    <div className="cus-charts">
      <Series title="Customers" now={`${last.customers}`} points={trend.map((p) => ({ hour: p.hour, v: p.customers }))} max={Math.max(...trend.map((p) => p.customers))} />
      <Series title="Average happiness" now={last.customers ? last.happiness.toFixed(1) : "none"} points={trend.filter((p) => p.customers).map((p) => ({ hour: p.hour, v: p.happiness }))} max={100} fixed />
    </div>
  );
}
