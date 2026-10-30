// docs/design/software.md, section 9: the code-drawn graphs on a VM page; each product's sheet colours them through --chart-*.
import { dateOf } from "../../../../sim/00-core/time";
import { STATS_HOURS } from "../../../../sim/60-infra/stats";

export type ChartKind = "area" | "line" | "bars";
// The plot is drawn in a 100 by 100 box stretched to the figure; the axis labels sit in HTML so they keep their size.
const top = (v: number, max: number) => 100 - (Math.min(v, max) / max) * 100;

// A round axis top at or above the largest value.
export function niceMax(values: number[], floor = 1): number {
  const m = Math.max(floor, ...values), step = 10 ** Math.floor(Math.log10(m));
  return [1, 2, 5, 10].map((k) => k * step).find((x) => x >= m)!;
}

// values are oldest first and end at hour end; slots is the width of the time axis in samples.
export function Chart({ values, max = 1, kind, title, now, unit = "%", end, slots = STATS_HOURS, className = "" }: {
  values: number[]; max?: number; kind: ChartKind; title?: string; now?: string; unit?: string; end?: number; slots?: number; className?: string;
}) {
  const pts = values.length === 1 ? [values[0], values[0]] : values, n = Math.max(slots, pts.length), step = 100 / Math.max(1, n - 1);
  const x = (i: number) => (n - pts.length + i) * step, line = pts.map((v, i) => `${x(i).toFixed(2)},${top(v, max).toFixed(2)}`).join(" ");
  const scale = (v: number) => (unit === "%" ? `${Math.round(v * 100)}%` : `${+v.toFixed(1)}`);
  const ticks = end === undefined ? [] : [18, 12, 6, 0].map((back) => ({ at: (n - 1 - back) * step, h: dateOf(end - back).getUTCHours() }));
  const bar = kind === "bars" ? (100 / n) * 0.7 : 0;
  return (
    <figure className={`cx-chart ${className}`} data-kind={kind}>
      {(title || now) && <figcaption><b>{title}</b>{now && <span className="num">{now}</span>}</figcaption>}
      <div className="cx-chart-body">
        <div className="cx-chart-y">{[1, 0.5, 0].map((f) => <span key={f} className="num" style={{ top: `${top(max * f, max)}%` }}>{scale(max * f)}</span>)}</div>
        <div className="cx-chart-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={title}>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="cx-chart-grid" x1={0} x2={100} y1={top(max * f, max)} y2={top(max * f, max)} />)}
            {kind === "bars" && pts.map((v, i) => <rect key={i} className="cx-chart-bar" x={Math.min(100 - bar, Math.max(0, x(i) - bar / 2))} width={bar} y={top(v, max)} height={100 - top(v, max)} />)}
            {kind === "area" && values.length > 0 && <polygon className="cx-chart-fill" points={`${x(0)},100 ${line} ${x(pts.length - 1)},100`} />}
            {kind !== "bars" && values.length > 0 && <polyline className="cx-chart-line" points={line} />}
          </svg>
          <div className="cx-chart-x">{ticks.map((t) => <span key={t.at} className="num" style={{ left: `${t.at}%` }}>{`${String(t.h).padStart(2, "0")}:00`}</span>)}</div>
        </div>
      </div>
    </figure>
  );
}

// A used-of-limit pie, as the project overview draws its quotas.
export function Donut({ used, of, label, text }: { used: number; of: number; label: string; text: string }) {
  const r = 30, c = 2 * Math.PI * r, share = of > 0 ? Math.min(1, used / of) : 0;
  return (
    <figure className="cx-donut">
      <figcaption>{label}</figcaption>
      <svg viewBox="0 0 80 80" role="img" aria-label={label}>
        <circle className="cx-donut-rest" cx={40} cy={40} r={r} />
        <circle className="cx-donut-used" cx={40} cy={40} r={r} strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 40 40)" />
      </svg>
      <span className="num">{text}</span>
    </figure>
  );
}
