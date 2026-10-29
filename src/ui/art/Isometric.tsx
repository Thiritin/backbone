// A catalog model as a fake-3D picture: the real front face plus a top and a right side, seen from slightly above and left.
import type { ReactNode } from "react";
import type { ComponentKind, DeviceModel } from "../../sim/10-catalog/hardware";
import { Defs, Front } from "./fronts";

interface Props { model: DeviceModel; brand: string; w?: number; count?: number }

// A 19-inch front is about 11 units wide per unit of height.
export function Isometric({ model, brand, w: width = 150, count = 1 }: Props) {
  if (model.kind === "part") return <PartIso kind={model.id.replace(/^part-/, "") as ComponentKind} name={model.name} w={width} count={count} />;
  // A tower is a narrow, tall case.
  const w = model.shelf ? width * 0.42 : width, units = Math.max(1, model.height), u = Math.max(8, w / 10.9), h = model.shelf ? width * 0.62 : units * u, dx = w * 0.16, dy = dx * 0.5;
  const copies = Math.min(3, Math.max(1, count)), step = 7, extra = (copies - 1) * step;
  const W = w + dx + extra + 2, H = h + dy + extra + 2 + (count > 1 ? 14 : 0);
  const box = (k: number) => {
    const x = 1 + (copies - 1 - k) * step, y = 1 + dy + k * step;
    return (
      <g key={k} transform={`translate(${x} ${y})`}>
        <path d={`M0 0L${dx} ${-dy}H${w + dx}L${w} 0z`} fill="oklch(0.46 0.008 255)" stroke="var(--metal-line)" strokeWidth="0.6" strokeLinejoin="round" />
        <path d={`M${w} 0L${w + dx} ${-dy}V${h - dy}L${w} ${h}z`} fill="oklch(0.2 0.006 255)" stroke="var(--metal-line)" strokeWidth="0.6" strokeLinejoin="round" />
        <Front model={model} brand={brand} name="" state="off" ports={[]} w={w} h={h} />
      </g>
    );
  };
  return (
    <svg className="device-svg iso" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={count > 1 ? `${count} × ${model.name}` : model.name}>
      <Defs />
      {Array.from({ length: copies }, (_, k) => box(k))}
      {count > 1 && <text x={W - 2} y={H - 2} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600" fill="var(--text-2)">×{count}</text>}
    </svg>
  );
}

const PCB = "oklch(0.42 0.09 155)", PCB_SIDE = "oklch(0.3 0.07 155)", GOLD = "oklch(0.78 0.13 85)", CHIP = "oklch(0.18 0.005 255)";
const METAL = "oklch(0.76 0.006 255)", METAL_SIDE = "oklch(0.5 0.006 255)", DARK = "oklch(0.22 0.005 255)", DARK_SIDE = "oklch(0.14 0.004 255)";
// Depth runs up and to the right at this slope, as on the device pictures.
const SLOPE = 0.55;

// A box whose front edge starts at (x, y): wide W, deep D, tall T. Children draw on the top face in flat (u, v) coordinates,
// v = 0 at the front edge; face draws on the front face with (0, 0) at its top left.
function Slab({ x, y, W, D, T, top, side, front = side, children, face }: { x: number; y: number; W: number; D: number; T: number; top: string; side: string; front?: string; children?: ReactNode; face?: ReactNode }) {
  const dx = D * SLOPE, dy = D * SLOPE * 0.5;
  return (
    <g>
      <path d={`M${x + W} ${y}l${dx} ${-dy}v${T}l${-dx} ${dy}z`} fill={side} stroke="var(--metal-line)" strokeWidth="0.5" strokeLinejoin="round" />
      <g transform={`matrix(1 0 ${SLOPE} ${-SLOPE * 0.5} ${x} ${y})`}>
        <rect width={W} height={D} fill={top} stroke="var(--metal-line)" strokeWidth="0.5" />
        {children}
      </g>
      <g transform={`translate(${x} ${y})`}>
        <rect width={W} height={T} fill={front} stroke="var(--metal-line)" strokeWidth="0.5" />
        {face}
      </g>
    </g>
  );
}

const chips = (n: number, x: number, y: number, w: number, h: number, gap: number) =>
  Array.from({ length: n }, (_, i) => <rect key={i} x={x + i * (w + gap)} y={y} width={w} height={h} rx="0.6" fill={CHIP} />);
const pins = (n: number, x: number, y: number, w: number, h: number) =>
  Array.from({ length: n }, (_, i) => <rect key={i} x={x + i * (w / n)} y={y} width={w / n - 0.8} height={h} fill={GOLD} />);

const PARTS: Record<ComponentKind, ReactNode> = {
  hdd: (
    <Slab x={22} y={88} W={92} D={62} T={14} top={METAL} side={METAL_SIDE} front={DARK}
      face={<><rect x="6" y="5" width="30" height="4" rx="1" fill={GOLD} /><rect x="64" y="4" width="22" height="6" rx="1" fill={DARK_SIDE} /></>}>
      <rect x="10" y="10" width="52" height="38" rx="2" fill="oklch(0.93 0.005 255)" />
      <rect x="14" y="16" width="30" height="3" fill="oklch(0.55 0.15 255)" />
      <rect x="14" y="24" width="40" height="2" fill="oklch(0.6 0.01 255)" />
      <rect x="14" y="30" width="34" height="2" fill="oklch(0.6 0.01 255)" />
      {[[5, 5], [86, 5], [5, 56], [86, 56]].map(([u, v]) => <circle key={u * 100 + v} cx={u} cy={v} r="1.8" fill={METAL_SIDE} />)}
    </Slab>
  ),
  ssd: (
    <Slab x={28} y={90} W={84} D={58} T={7} top="oklch(0.3 0.03 255)" side={DARK_SIDE} front={DARK}
      face={<rect x="58" y="2" width="20" height="3" rx="0.6" fill={GOLD} />}>
      <rect x="10" y="10" width="64" height="34" rx="2" fill="oklch(0.9 0.005 255)" />
      <rect x="16" y="18" width="24" height="5" rx="1" fill="oklch(0.6 0.16 30)" />
      <rect x="16" y="28" width="44" height="2" fill="oklch(0.6 0.01 255)" />
    </Slab>
  ),
  nvme: (
    <Slab x={16} y={76} W={124} D={26} T={2} top={PCB} side={PCB_SIDE}>
      {pins(10, 2, 6, 12, 14)}
      {chips(3, 22, 5, 24, 16, 6)}
      <rect x="106" y="8" width="10" height="10" rx="1" fill={CHIP} />
      <circle cx="120" cy="13" r="3" fill="none" stroke={GOLD} strokeWidth="1.4" />
    </Slab>
  ),
  psu: (
    <Slab x={36} y={80} W={50} D={104} T={24} top="url(#bb-perf)" side={METAL_SIDE} front={DARK}
      face={<><circle cx="15" cy="12" r="8.5" fill="url(#bb-hex)" /><rect x="30" y="7" width="10" height="9" rx="1" fill={DARK_SIDE} stroke="var(--metal-line)" strokeWidth="0.5" />
        <circle cx="45" cy="5" r="1.4" fill="oklch(0.78 0.2 145)" /><path d="M5 22h40" stroke={METAL} strokeWidth="1.6" strokeLinecap="round" /></>}>
      <rect x="4" y="70" width="42" height="28" rx="1" fill="oklch(0.9 0.005 255)" />
      <rect x="8" y="76" width="22" height="3" fill="oklch(0.6 0.01 255)" />
    </Slab>
  ),
  fan: (
    <Slab x={44} y={34} W={62} D={22} T={62} top={DARK} side={DARK_SIDE}
      face={<><circle cx="31" cy="31" r="27" fill="oklch(0.12 0.004 255)" />
        {[0, 72, 144, 216, 288].map((a) => <path key={a} d="M31 31c4-10 14-16 22-14c-5 6-11 12-22 14z" fill="oklch(0.32 0.005 255)" transform={`rotate(${a} 31 31)`} />)}
        <circle cx="31" cy="31" r="8" fill={DARK} stroke="var(--metal-line)" strokeWidth="0.5" />
        {[[5, 5], [57, 5], [5, 57], [57, 57]].map(([cx, cy]) => <circle key={cx * 100 + cy} cx={cx} cy={cy} r="2" fill={METAL_SIDE} />)}</>} />
  ),
  ram: (
    <Slab x={14} y={58} W={124} D={6} T={32} top={PCB_SIDE} side={PCB_SIDE} front={PCB}
      face={<>{chips(8, 7, 6, 11, 14, 3.6)}{pins(40, 4, 26, 116, 5)}<rect x="58" y="26" width="3" height="6" fill={PCB} /></>} />
  ),
  board: (
    <Slab x={10} y={96} W={116} D={84} T={3} top={PCB} side={PCB_SIDE}>
      <rect x="40" y="34" width="26" height="26" rx="1" fill="oklch(0.85 0.005 255)" stroke={CHIP} strokeWidth="1.2" />
      {[0, 1, 2, 3].map((k) => <rect key={k} x={74 + k * 6} y="22" width="3" height="52" fill={CHIP} />)}
      <rect x="6" y="6" width="14" height="72" rx="1" fill={METAL} />
      <rect x="30" y="8" width="38" height="5" fill={CHIP} />
      <rect x="30" y="18" width="38" height="5" fill={CHIP} />
      <rect x="40" y="66" width="12" height="12" rx="1" fill={CHIP} />
    </Slab>
  ),
  cpu: (
    <Slab x={44} y={88} W={62} D={62} T={5} top="oklch(0.38 0.08 150)" side={PCB_SIDE} front="oklch(0.38 0.08 150)">
      <rect x="9" y="9" width="44" height="44" rx="3" fill={METAL} stroke={METAL_SIDE} strokeWidth="0.8" />
      <rect x="16" y="22" width="22" height="3" fill="oklch(0.55 0.01 255)" />
      <rect x="16" y="30" width="30" height="2" fill="oklch(0.55 0.01 255)" />
      <path d="M2 2l5 0l-5 5z" fill={GOLD} />
    </Slab>
  ),
  nic: (
    <>
      <Slab x={30} y={84} W={102} D={50} T={2} top={PCB} side={PCB_SIDE}>
        {pins(16, 34, 0, 56, 6)}
        <rect x="40" y="16" width="20" height="20" rx="1" fill={CHIP} />
        <rect x="70" y="20" width="12" height="12" rx="1" fill={CHIP} />
      </Slab>
      <Slab x={22} y={68} W={8} D={50} T={18} top={METAL} side={METAL_SIDE} front={METAL} />
    </>
  ),
  gpu: (
    <>
      <Slab x={24} y={80} W={118} D={54} T={16} top="oklch(0.28 0.03 255)" side={DARK_SIDE} front={DARK}
        face={<rect x="8" y="5" width="46" height="4" rx="1" fill={GOLD} />}>
        <circle cx="30" cy="27" r="17" fill={DARK_SIDE} /><circle cx="30" cy="27" r="11" fill="oklch(0.2 0.02 255)" />
        <circle cx="86" cy="27" r="17" fill={DARK_SIDE} /><circle cx="86" cy="27" r="11" fill="oklch(0.2 0.02 255)" />
      </Slab>
      <Slab x={20} y={64} W={6} D={54} T={18} top={METAL} side={METAL_SIDE} front={METAL} />
    </>
  ),
};

// Spare parts are drawn loose rather than as rack fronts.
function PartIso({ kind, name, w, count }: { kind: ComponentKind; name: string; w: number; count: number }) {
  const H = Math.round((w * 110) / 170);
  return (
    <svg className="device-svg iso" width={w} height={H} viewBox="0 0 170 110" role="img" aria-label={count > 1 ? `${count} × ${name}` : name}>
      <Defs />
      {PARTS[kind]}
      {count > 1 && <text x="168" y="108" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="13" fontWeight="600" fill="var(--text-2)">×{count}</text>}
    </svg>
  );
}
