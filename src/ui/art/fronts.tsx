// Code-drawn device fronts, ported from docs/design/mockups/shell.js. Sizes are px; u is one rack unit.
import type { ReactNode } from "react";
import { PATCH_JACKS, type DeviceModel } from "../../sim/10-catalog/hardware";
import { Back } from "./backs";

export type Lamp = "ok" | "warn" | "bad" | "off";
export type PortLamp = "off" | "ok" | "warn" | "bad" | "fiber";

export const LED = { ok: "oklch(0.78 0.2 145)", warn: "oklch(0.83 0.17 80)", bad: "oklch(0.66 0.23 27)", off: "oklch(0.4 0.01 255)", act: "oklch(0.8 0.14 225)", fiber: "oklch(0.8 0.12 195)" };
export const CABLE = { copper: "oklch(0.62 0.14 250)", dac: "oklch(0.7 0.02 255)", fiber: LED.fiber, uplink: "oklch(0.82 0.15 90)" };
export const GROUP = "oklch(0.74 0.14 300)";
const LABEL = "oklch(0.78 0.01 255)";
const MONO = "JetBrains Mono, monospace";

// Label size grows with the unit height; tw estimates a mono label's width.
export const fsz = (h: number) => Math.max(6.5, Math.min(10.5, h * 0.42));
export const tw = (t: string, fs: number) => t.length * fs * 0.62;
const hex = (cx: number, cy: number, r: number) => `M${cx} ${cy - r}l${0.866 * r} ${0.5 * r}v${r}l${-0.866 * r} ${0.5 * r}l${-0.866 * r} ${-0.5 * r}v${-r}z`;

// Bezel textures; every device <svg> carries its own copy so it renders standalone.
export function Defs() {
  return (
    <defs>
      <pattern id="bb-hex" width="3.46" height="6" patternUnits="userSpaceOnUse">
        <rect width="3.46" height="6" fill="oklch(0.4 0.006 255)" />
        <path d={hex(0, 0, 1.55) + hex(3.46, 0, 1.55) + hex(1.73, 3, 1.55) + hex(0, 6, 1.55) + hex(3.46, 6, 1.55)} fill="oklch(0.12 0.004 255)" />
      </pattern>
      <pattern id="bb-perf" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
        <rect width="2.6" height="2.6" fill="oklch(0.66 0.006 255)" />
        <circle cx="1.3" cy="1.3" r="0.75" fill="oklch(0.3 0.006 255)" />
      </pattern>
    </defs>
  );
}

function Ears({ w, h, fill = "var(--metal)" }: { w: number; h: number; fill?: string }) {
  return (
    <>
      <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill={fill} stroke="var(--metal-line)" />
      <rect x="3" y={h / 2 - 2} width="4" height="4" rx="1" fill="var(--metal-line)" />
      <rect x={w - 7} y={h / 2 - 2} width="4" height="4" rx="1" fill="var(--metal-line)" />
    </>
  );
}

function Label({ x, y, text, size = 6.5, anchor = "start", fill = LABEL }: { x: number; y: number; text: string; size?: number; anchor?: "start" | "middle" | "end"; fill?: string }) {
  if (!text) return null;
  return <text x={x} y={y} textAnchor={anchor} fontFamily={MONO} fontSize={size} fill={fill} letterSpacing="0.04em">{text}</text>;
}

function StatusLeds({ x, y, state }: { x: number; y: number; state: Lamp }) {
  return (
    <>
      <circle cx={x} cy={y} r="1.8" fill={LED[state]} />
      <circle cx={x + 7} cy={y} r="1.8" fill={state === "off" ? LED.off : LED.ok} />
    </>
  );
}

export interface FrontProps {
  model: DeviceModel;
  brand: string;
  name: string;
  state: Lamp;
  ports: PortLamp[];
  groups?: number[][];
  w: number;
  h: number;
}

// Rack server fronts follow the three big brands; names are parodies.
function Dwell({ w, h, state, name }: FrontProps) {
  const fs = fsz(Math.min(h, 24));
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.22 0.006 255)" />
      <rect x="11" y="1.5" width={w - 22} height={h - 3} rx="1.5" fill="url(#bb-hex)" />
      {name && <rect x="14" y="2.5" width={tw(name, fs) + 10} height={h - 5} rx="1" fill="oklch(0.14 0.004 255)" />}
      <Label x={19} y={h / 2 + fs * 0.35} text={name} size={fs} />
      <rect x={w / 2 - 9} y={h / 2 - Math.min(h, 24) * 0.16} width="18" height={Math.min(h, 24) * 0.32} rx="1" fill="oklch(0.7 0.01 255)" />
      <rect x={w - 28} y="2.5" width="18" height={h - 5} rx="1" fill="oklch(0.14 0.004 255)" />
      <StatusLeds x={w - 22} y={h / 2} state={state} />
    </>
  );
}

function HewlettPacket({ w, h, state, name, model }: FrontProps) {
  const fs = fsz(Math.min(h, 24)), tab = name ? tw(name, fs) + 10 : 20, bx = 14 + tab;
  const bays = Math.min(8, model.server?.bays ?? 4), rows = h > 30 ? 2 : 1, perRow = Math.ceil(bays / rows), bw = w * 0.075, bh = (h - 4 - (rows - 1) * 1.5) / rows;
  const trays: ReactNode[] = [];
  for (let i = 0; i < bays; i++) {
    const x = bx + (i % perRow) * (bw + 1.5), y = 2 + Math.floor(i / perRow) * (bh + 1.5);
    trays.push(
      <g key={i}>
        <rect x={x} y={y} width={bw} height={bh} rx="0.8" fill="oklch(0.3 0.006 255)" />
        <circle cx={x + 3.2} cy={y + bh / 2} r="1.3" fill="none" stroke={state === "off" ? LED.off : LED.ok} strokeWidth="0.8" />
      </g>,
    );
  }
  const px = bx + perRow * (bw + 1.5) + 3;
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.7 0.005 255)" />
      <rect x="10" y={h / 2 - Math.min(h, 24) * 0.36} width={tab} height={Math.min(h, 24) * 0.72} rx="1" fill="oklch(0.9 0.004 255)" />
      <Label x={15} y={h / 2 + fs * 0.35} text={name} size={fs} fill="oklch(0.3 0.01 255)" />
      {trays}
      <rect x={px} y="2" width={Math.max(0, w - 30 - px)} height={h - 4} rx="0.8" fill="url(#bb-perf)" />
      <StatusLeds x={w - 22} y={h / 2} state={state} />
    </>
  );
}

function SuperMacro({ w, h, state, name, model }: FrontProps) {
  const bays = Math.min(12, model.server?.bays ?? 4), rows = h > 30 ? Math.min(3, Math.ceil(bays / 4)) : 1, perRow = Math.ceil(bays / rows);
  const bw = w * 0.09, bh = (h - 4 - (rows - 1) * 1.5) / rows;
  const trays: ReactNode[] = [];
  for (let i = 0; i < bays; i++) {
    const x = 12 + (i % perRow) * (bw + 1.5), y = 2 + Math.floor(i / perRow) * (bh + 1.5);
    trays.push(
      <g key={i}>
        <rect x={x} y={y} width={bw} height={bh} rx="0.6" fill="oklch(0.6 0.006 255)" />
        <rect x={x + 2} y={y + bh / 2 - 0.8} width={bw - 8} height="1.6" fill="oklch(0.2 0.004 255)" />
        <circle cx={x + bw - 3} cy={y + bh / 2} r="1.1" fill={state === "off" ? LED.off : LED.act} />
      </g>,
    );
  }
  const fs = fsz(Math.min(h, 24));
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.15 0.004 255)" />
      {trays}
      <Label x={w - 30} y={h / 2 + fs * 0.35} text={name} size={fs} anchor="end" />
      <StatusLeds x={w - 22} y={h / 2} state={state} />
    </>
  );
}

const SERVER_FRONTS: Record<string, (p: FrontProps) => ReactNode> = { Dwell, "Hewlett-Packet": HewlettPacket, SuperMacro };

// Ports sit in pairs (top and bottom) in blocks of six columns; a short run of SFP cages follows in one row.
export function switchLayout(model: DeviceModel, w: number, h: number, x0: number) {
  const runs = (["rj45", "sfp"] as const).map((media) => model.ports.flatMap((p, i) => (p.media === media ? [i] : []))).filter((r) => r.length);
  const colsOf = (r: number[]) => (r.length > 8 ? Math.ceil(r.length / 2) : r.length);
  const pw = (w - x0 - 32) / Math.max(28, runs.reduce((n, r) => n + colsOf(r), 0) + 4), ph = (h - 6) / 2;
  const at = new Map<number, { x: number; y: number; w: number; h: number; sfp: boolean; top: boolean }>();
  let x = x0;
  for (const r of runs) {
    const paired = r.length > 8, sfp = model.ports[r[0]].media === "sfp";
    r.forEach((p, k) => {
      const col = paired ? Math.floor(k / 2) : k, px = x + col * pw + Math.floor(col / 6) * 2;
      at.set(p, paired ? { x: px, y: 3 + (k % 2) * ph, w: pw - 1.6, h: ph - 1, sfp, top: k % 2 === 0 } : { x: px, y: 3.5, w: pw * 0.85, h: h - 7, sfp, top: true });
    });
    x += colsOf(r) * pw + Math.floor((colsOf(r) - 1) / 6) * 2 + 10;
  }
  return at;
}

function Switch({ w, h, name, model, ports, groups = [] }: FrontProps) {
  const fs = fsz(Math.min(h, 24)) * 0.9, x0 = name ? 18 + tw(name, fs) : 16, at = switchLayout(model, w, h, x0);
  const cells: ReactNode[] = [];
  for (const [i, p] of at) {
    const st = ports[i] ?? "off";
    if (p.sfp) {
      cells.push(
        <g key={i}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill="oklch(0.14 0.005 255)" stroke="var(--metal-3)" strokeWidth="0.5" />
          {st !== "off" && <rect x={p.x + p.w * 0.22} y={p.y + p.h * 0.25} width={p.w * 0.22} height={p.h * 0.5} fill={CABLE.fiber} />}
          {st !== "off" && <rect x={p.x + p.w * 0.56} y={p.y + p.h * 0.25} width={p.w * 0.22} height={p.h * 0.5} fill={CABLE.fiber} />}
        </g>,
      );
      continue;
    }
    cells.push(
      <g key={i}>
        <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill={st === "off" ? "var(--metal-line)" : "oklch(0.14 0.005 255)"} />
        {st !== "off" && <rect x={p.x + p.w * 0.12} y={p.top ? p.y + p.h * 0.06 : p.y + p.h * 0.82 - 1.4} width={p.w * 0.26} height={Math.max(1.4, p.h * 0.12)} fill={LED[st]} />}
      </g>,
    );
  }
  const outlines = groups.map((g, k) => {
    const ps = g.map((i) => at.get(i)).filter((p) => p !== undefined);
    if (!ps.length) return null;
    const x1 = Math.min(...ps.map((p) => p.x)), y1 = Math.min(...ps.map((p) => p.y));
    const x2 = Math.max(...ps.map((p) => p.x + p.w)), y2 = Math.max(...ps.map((p) => p.y + p.h));
    return <rect key={`g${k}`} x={x1 - 1.2} y={y1 - 1.2} width={x2 - x1 + 2.4} height={y2 - y1 + 2.4} rx="2" fill="none" stroke={GROUP} strokeWidth="1.2" strokeDasharray="3 2" />;
  });
  return (
    <>
      <Ears w={w} h={h} />
      <Label x={10} y={h / 2 + fs * 0.35} text={name} size={fs} />
      {cells}
      {outlines}
    </>
  );
}

export function gatewayLayout(model: DeviceModel, name: string, w: number, h: number) {
  const fs = fsz(Math.min(h, 24)), x0 = Math.max(w * 0.42, 18 + tw(name, fs)), step = Math.min(11, (w - x0 - 34) / Math.max(1, model.ports.length));
  return new Map(model.ports.map((_, i) => [i, { x: x0 + i * step, y: 3.5, w: step - 2, h: h - 7 }]));
}

function Gateway({ w, h, name, model, ports, state }: FrontProps) {
  const fs = fsz(Math.min(h, 24));
  return (
    <>
      <Ears w={w} h={h} />
      <Label x={12} y={h / 2 + fs * 0.35} text={name} size={fs} />
      {[...gatewayLayout(model, name, w, h)].map(([i, p]) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill="oklch(0.14 0.005 255)"
          stroke={ports[i] && ports[i] !== "off" ? LED[ports[i]] : "var(--metal-line)"} strokeWidth="0.6" />
      ))}
      <StatusLeds x={w - 22} y={h / 2} state={state} />
    </>
  );
}

// Keystone jacks; a plugged jack shows its cable boot in the cable's colour.
// Jack k of a side sits at the same place on the front (port k) and the back (port 24 + k).
export function patchLayout(name: string, w: number, h: number) {
  const fs = fsz(Math.min(h, 24)) * 0.9, x0 = name ? 18 + tw(name, fs) : 16, pw = (w - x0 - 14) / PATCH_JACKS;
  return Array.from({ length: PATCH_JACKS }, (_, k) => ({ x: x0 + k * pw + Math.floor(k / 6) * 0.8, y: 3, w: pw - 1.4, h: h - 6 }));
}

export function Jacks({ w, h, name, ports, offset }: { w: number; h: number; name: string; ports: PortLamp[]; offset: number }) {
  return (
    <>
      {patchLayout(name, w, h).map((p, k) => {
        const st = ports[offset + k] ?? "off";
        return (
          <g key={k}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill="oklch(0.12 0.004 255)" />
            {st !== "off" && <rect x={p.x + p.w * 0.15} y={h * 0.3} width={p.w * 0.7} height={h * 0.4} rx="0.6" fill={st === "fiber" ? CABLE.fiber : CABLE.copper} />}
          </g>
        );
      })}
    </>
  );
}

function Patch({ w, h, name, ports }: FrontProps) {
  const fs = fsz(Math.min(h, 24)) * 0.9;
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.2 0.005 255)" />
      <Label x={10} y={h / 2 + fs * 0.35} text={name} size={fs} />
      <Jacks w={w} h={h} name={name} ports={ports} offset={0} />
    </>
  );
}

export function Front(p: FrontProps) {
  if (p.model.kind === "server") return (SERVER_FRONTS[p.brand] ?? SuperMacro)(p);
  if (p.model.kind === "switch") return <Switch {...p} />;
  if (p.model.kind === "gateway") return <Gateway {...p} />;
  return <Patch {...p} />;
}

// One device front as a standalone <svg>; panel gateways (height 0) are drawn as one unit.
export function DeviceSvg({ w, u, back, ...p }: Omit<FrontProps, "h" | "w"> & { w: number; u: number; back?: boolean }) {
  const h = Math.max(1, p.model.height) * u;
  return (
    <svg className="device-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={p.name || p.model.name}>
      <Defs />
      {back ? <Back {...p} w={w} h={h} /> : <Front {...p} w={w} h={h} />}
    </svg>
  );
}
