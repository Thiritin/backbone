// GDD, Own datacenter, Service doors: the main distribution board drawn as the switchgear panel. One bay per transformer with a meter
// needle, a lamp and a breaker; copper feeders run down to the bus bar, which feeds the main breaker. A tripped main breaker is reset by
// throwing its handle.
import { t } from "../../i18n/en";

export interface Bay { id: string; used: number; max: number }
interface Props { bays: Bay[]; feedB: boolean; minutes: number; ready: boolean; tripped: boolean; refused: string | null; onReset: () => void }

const BW = 124, TOP = 26, R = 30, SWEEP = 120;
const num = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

// A breaker with its handle thrown up (on) or down (off).
const Breaker = ({ x, y, up, wide }: { x: number; y: number; up: boolean; wide?: boolean }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect className="wp-brk" width={wide ? 44 : 22} height="54" />
    <rect className="wp-brk-slot" x={wide ? 15 : 6} y="14" width="10" height="26" />
    <rect className={`wp-brk-lever${wide ? " main" : ""}`} x={wide ? 13 : 4} y={up ? 12 : 28} width="14" height="14" />
    {wide && <rect className="wp-brk-lever main" x="27" y={up ? 12 : 28} width="4" height="14" />}
  </g>
);

const Lamp = ({ x, y, on }: { x: number; y: number; on: boolean }) => <circle className={`hb-lamp${on ? " hb-lamp-on" : ""}`} cx={x} cy={y} r="5" />;

// A moving-coil meter: dial with scale ticks and a needle swung by the fill.
function Meter({ cx, cy, fill }: { cx: number; cy: number; fill: number }) {
  const a = (f: number) => (-SWEEP / 2 + SWEEP * f) * Math.PI / 180, at = (f: number, r: number) => ({ x: cx + r * Math.sin(a(f)), y: cy + R * 0.45 - r * Math.cos(a(f)) });
  const n = at(Math.max(0, Math.min(1, fill)), R - 6);
  return (
    <g>
      <rect className="hb-bezel" x={cx - R} y={cy - R} width={2 * R} height={2 * R} rx="4" />
      <rect className="hb-dial" x={cx - R + 4} y={cy - R + 4} width={2 * R - 8} height={2 * R - 8} rx="2" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => { const p = at(f, R - 8), q = at(f, R - 13); return <line key={f} className={`hb-tick${f > 0.85 ? " hb-tick-hot" : ""}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />; })}
      <line className="hb-needle" x1={cx} y1={cy + R * 0.45} x2={n.x} y2={n.y} />
      <circle className="hb-pivot" cx={cx} cy={cy + R * 0.45} r="3" />
    </g>
  );
}

export function MainBoardFace({ bays, feedB, minutes, ready, tripped, refused, onReset }: Props) {
  const cols = Math.max(3, bays.length), W = cols * BW + 40, busY = 232, mainY = 256, H = 364;
  const mx = W - 76;
  const rows: [boolean, string, string?][] = [[feedB, t("hall.board.feedB")], [minutes > 0, t("hall.board.runtime", { min: minutes })], [ready, t("hall.board.generator"), ready ? t("hall.board.ready") : t("hall.board.none")]];
  return (
    <svg className="wp-art hb-board" viewBox={`-10 -10 ${W + 20} ${H + 20}`} width={(W + 20) * 1.25} data-mainboard="">
      <rect className="w-fuse" x="0" y="0" width={W} height={H} />
      <rect className="w-fuse-in" x="10" y="10" width={W - 20} height={H - 20} />
      {[[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]].map(([x, y]) => <circle key={`${x}${y}`} className="wp-screw" cx={x} cy={y} r="3" />)}
      {bays.map((b, i) => {
        const cx = 20 + (i + (cols - bays.length) / 2) * BW + BW / 2, fill = b.max ? b.used / b.max : 0, top = TOP + 36;
        return (
          <g key={b.id} data-bay={b.id}>
            <text className="hb-t" x={cx} y={TOP + 6} textAnchor="middle">{t("hall.board.xfmr", { n: i + 1 })}</text>
            <text className="hb-t hb-num" x={cx} y={TOP + 20} textAnchor="middle">{t("hall.board.load", { used: num(tripped ? 0 : b.used), max: num(b.max) })}</text>
            <Meter cx={cx} cy={top + R} fill={tripped ? 0 : fill} />
            <Lamp x={cx} y={top + 2 * R + 14} on={!tripped} />
            <Breaker x={cx - 11} y={top + 2 * R + 26} up={!tripped} />
            <rect className="hb-feeder" x={cx - 4} y={top + 2 * R + 80} width="8" height={busY - (top + 2 * R + 80)} />
          </g>
        );
      })}
      <rect className="hb-bus-shade" x="22" y={busY + 4} width={W - 44} height="12" />
      <rect className="hb-bus" x="22" y={busY} width={W - 44} height="12" />
      {[40, W / 2, W - 60].map((x) => <rect key={x} className="hb-insulator" x={x - 5} y={busY + 12} width="10" height="8" />)}
      <rect className="hb-feeder" x={mx + 18} y={busY + 12} width="8" height={mainY - busY - 12} />
      <g transform={`translate(${W - 30 - 44 - 8} 0)`} className="hb-main" role="switch" aria-checked={!tripped} aria-label={t("hall.board.main")} tabIndex={0} {...(tripped ? { "data-reset-breaker": "" } : {})}
        onClick={tripped ? onReset : undefined} onKeyDown={(e) => { if (tripped && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onReset(); } }}>
        <Breaker x={0} y={mainY} up={!tripped} wide />
        {tripped && <rect className="wp-trip-flag" x={31} y={mainY + 30} width="6" height="8" data-tripped="" />}
        <rect className="hb-plate" x="-14" y={mainY + 60} width="72" height="14" />
        <text className="hb-plate-t" x="22" y={mainY + 70.5} textAnchor="middle">{t("hall.board.main")}</text>
        <Lamp x={22} y={mainY + 88} on={!tripped} />
      </g>
      {rows.map(([on, label, state], i) => (
        <g key={label}>
          <Lamp x={34} y={mainY + 12 + i * 26} on={on} />
          <text className="hb-t" x="48" y={mainY + 16 + i * 26}>{label}</text>
          {state && <text className="hb-t hb-num" x={mx - 30} y={mainY + 16 + i * 26} textAnchor="end">{state}</text>}
        </g>
      ))}
      {refused && <text className="hb-t hb-bad" x={mx - 30} y={mainY + 16 + 3 * 26} textAnchor="end" role="alert">{t(refused)}</text>}
    </svg>
  );
}
