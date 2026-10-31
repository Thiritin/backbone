import { useId, useState } from "react";
import { dateOf } from "../../../sim/00-core/time";
import type { TrendPoint } from "../../../sim/80-business/trend";
import { monthYear } from "../support/labels";

const day = (hour: number): string => {
  const d = dateOf(hour);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

const W = 520, H = 150, PAD = { l: 36, r: 8, t: 8, b: 20 };

function niceMax(v: number): number {
  const step = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  return [1, 2, 5, 10].map((k) => k * step).find((x) => x >= v)!;
}

function Series({ title, now, points, max, fixed, decimals = 0 }: { title: string; now: string; points: { hour: number; v: number }[]; max: number; fixed?: boolean; decimals?: number }) {
  const gid = useId(), [hover, setHover] = useState<number | null>(null);
  const first = points[0]?.hour ?? 0, span = Math.max(1, (points[points.length - 1]?.hour ?? 0) - first);
  const top = fixed ? max : niceMax(max);
  const x = (h: number) => PAD.l + ((h - first) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const line = points.map((p) => `${x(p.hour).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const at = (e: React.MouseEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM();
    if (!m) return;
    const hour = first + ((new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).x - PAD.l) / (W - PAD.l - PAD.r)) * span;
    setHover(points.reduce((best, p, i) => (Math.abs(p.hour - hour) < Math.abs(points[best].hour - hour) ? i : best), 0));
  };
  const h = hover === null ? null : points[hover];
  const years = new Set<number>();
  const ticks = points.filter((p) => { const yr = dateOf(p.hour).getUTCFullYear(); return !years.has(yr) && years.add(yr); });
  return (
    <figure className="cus-chart">
      <figcaption><b>{title}</b><span className="num">{h ? `${day(h.hour)}: ${h.v.toFixed(decimals)}` : now}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseMove={at} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(top * f)} y2={y(top * f)} />
            <text className="num" x={PAD.l - 6} y={y(top * f)} textAnchor="end" dominantBaseline="middle">{+(top * f).toFixed(0)}</text>
          </g>
        ))}
        {ticks.slice(1).map((p) => <text key={p.hour} className="num" x={x(p.hour)} y={H - 4} textAnchor="middle">{dateOf(p.hour).getUTCFullYear()}</text>)}
        <text className="num" x={PAD.l} y={H - 4}>{monthYear(first)}</text>
        {points.length > 1 && <polygon fill={`url(#${gid})`} points={`${x(first)},${y(0)} ${line} ${x(points[points.length - 1].hour)},${y(0)}`} />}
        {points.length > 1 && <polyline className="line" points={line} />}
        {points.length > 0 && !h && <circle className="dot" cx={x(points[points.length - 1].hour)} cy={y(points[points.length - 1].v)} r={3} />}
        {h && (
          <g>
            <line className="cross" x1={x(h.hour)} x2={x(h.hour)} y1={PAD.t} y2={H - PAD.b} />
            <circle className="dot" cx={x(h.hour)} cy={y(h.v)} r={4} />
          </g>
        )}
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
      <Series title="Average happiness" now={last.customers ? last.happiness.toFixed(1) : "none"} points={trend.filter((p) => p.customers).map((p) => ({ hour: p.hour, v: p.happiness }))} max={100} fixed decimals={1} />
    </div>
  );
}
