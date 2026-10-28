// Code-drawn device fronts, ported from docs/design/mockups/shell.js. Sizes are px; u is one rack unit.
import type { ReactNode } from "react";
import { jacksOf, type DeviceModel } from "../../sim/10-catalog/hardware";
import { Back } from "./backs";
import { BrandMark, brandColor } from "./logos";

export type Lamp = "ok" | "warn" | "bad" | "off";
export type PortLamp = "off" | "ok" | "warn" | "bad" | "fiber";
export type PartLamp = Lamp | "rebuild";
export interface Parts { drives: PartLamp[]; psus: PartLamp[]; fans: PartLamp[] }

export const LED = { ok: "oklch(0.78 0.2 145)", warn: "oklch(0.83 0.17 80)", bad: "oklch(0.66 0.23 27)", off: "oklch(0.4 0.01 255)", act: "oklch(0.8 0.14 225)", fiber: "oklch(0.8 0.12 195)" };
export const CABLE = { copper: "oklch(0.62 0.14 250)", dac: "oklch(0.7 0.02 255)", fiber: LED.fiber, uplink: "oklch(0.82 0.15 90)" };
// Custom cable colours; a cable without one takes its kind's colour.
export const SWATCHES: [string, string][] = [
  ["Red", "#d9453b"], ["Orange", "#e8862d"], ["Yellow", "#e9c53a"], ["Green", "#3fa45b"],
  ["Blue", "#3b7fd9"], ["Purple", "#8a5cd1"], ["Black", "#2a2d33"], ["White", "#eef0f2"],
];
export const cableColor = (c: { kind: keyof typeof CABLE; color: string | null }) => c.color ?? CABLE[c.kind];
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

// A part's light: idle is the brand's colour for a healthy part; a rebuild blinks amber.
export const partLed = (lamp: PartLamp | undefined, idle: string) =>
  lamp === "rebuild" ? { fill: LED.warn, className: "led-blink" } : { fill: !lamp || lamp === "ok" ? idle : LED[lamp] };
// Bay i holds drive i; a bay past the fitted drives is empty and dark.
const strokeOf = ({ fill, className }: { fill: string; className?: string }) => ({ stroke: fill, className });
const bayLed = (p: FrontProps, i: number, idle: string) =>
  p.state === "off" || (p.parts && i >= p.parts.drives.length) ? { fill: LED.off } : partLed(p.parts?.drives[i], idle);

function StatusLeds({ x, y, state, blink }: { x: number; y: number; state: Lamp; blink?: boolean }) {
  return (
    <>
      <circle cx={x} cy={y} r="1.8" fill={LED[state]} className={blink ? "led-blink" : undefined} />
      <circle cx={x + 7} cy={y} r="1.8" fill={state === "off" ? LED.off : LED.ok} />
    </>
  );
}

// Server line from the model id, e.g. "g3-backup" is "backup".
export const lineOf = (m: DeviceModel) => (m.kind === "server" ? m.id.replace(/^g\d+-/, "") : null);

const markSize = (h: number) => Math.min(12, Math.min(h, 24) - 8);
// Maker mark with its right edge at x; plate puts a dark backing behind it for coloured bezels.
function Mark({ brand, x, h, plate }: { brand: string; x: number; h: number; plate?: boolean }) {
  const s = markSize(h);
  if (s < 6) return null;
  return (
    <>
      {plate && <rect x={x - s - 2} y={h / 2 - s / 2 - 2} width={s + 4} height={s + 4} rx="1.5" fill="oklch(0.14 0.004 255)" />}
      <BrandMark brand={brand} x={x - s} y={h / 2 - s / 2} size={s} />
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
  parts?: Parts;
  blink?: boolean;
  w: number;
  h: number;
}

// Rack server fronts follow the three big brands; names are parodies.
function Dwell(p: FrontProps) {
  const { w, h, state, name, blink, model } = p;
  const fs = fsz(Math.min(h, 24)), x0 = 18 + (name ? tw(name, fs) + 10 : 0), bays = Math.min(8, model.server?.bays ?? 4), bw = Math.min(w * 0.035, (w / 2 - 14 - x0) / bays - 1);
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.22 0.006 255)" />
      <rect x="11" y="1.5" width={w - 22} height={h - 3} rx="1.5" fill="url(#bb-hex)" />
      {name && <rect x="14" y="2.5" width={tw(name, fs) + 10} height={h - 5} rx="1" fill="oklch(0.14 0.004 255)" />}
      {bw > 2 && Array.from({ length: bays }, (_, i) => (
        <g key={i}>
          <rect x={x0 + i * (bw + 1)} y="2.5" width={bw} height={h - 5} rx="0.6" fill="oklch(0.16 0.004 255)" />
          <rect x={x0 + i * (bw + 1) + bw / 2 - 0.8} y={h - 6} width="1.6" height="1.6" {...bayLed(p, i, LED.ok)} />
        </g>
      ))}
      <Label x={19} y={h / 2 + fs * 0.35} text={name} size={fs} />
      <rect x={w / 2 - 9} y={h / 2 - Math.min(h, 24) * 0.16} width="18" height={Math.min(h, 24) * 0.32} rx="1" fill="oklch(0.7 0.01 255)" />
      <rect x={w - 48} y="2.5" width="38" height={h - 5} rx="1" fill="oklch(0.14 0.004 255)" />
      <Mark brand="Dwell" x={w - 31} h={h} />
      <StatusLeds x={w - 22} y={h / 2} state={state} blink={blink} />
    </>
  );
}

function HewlettPacket(p: FrontProps) {
  const { w, h, state, name, model, blink } = p;
  const fs = fsz(Math.min(h, 24)), tab = name ? tw(name, fs) + 10 : 20, bx = 14 + tab;
  const bays = Math.min(8, model.server?.bays ?? 4), rows = h > 30 ? 2 : 1, perRow = Math.ceil(bays / rows), bw = w * 0.075, bh = (h - 4 - (rows - 1) * 1.5) / rows;
  const trays: ReactNode[] = [];
  for (let i = 0; i < bays; i++) {
    const x = bx + (i % perRow) * (bw + 1.5), y = 2 + Math.floor(i / perRow) * (bh + 1.5);
    trays.push(
      <g key={i}>
        <rect x={x} y={y} width={bw} height={bh} rx="0.8" fill="oklch(0.3 0.006 255)" />
        <circle cx={x + 3.2} cy={y + bh / 2} r="1.3" fill="none" strokeWidth="0.8" {...strokeOf(bayLed(p, i, LED.ok))} />
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
      <rect x={px} y="2" width={Math.max(0, w - 48 - px)} height={h - 4} rx="0.8" fill="url(#bb-perf)" />
      <Mark brand="Hewlett-Packet" x={w - 31} h={h} />
      <StatusLeds x={w - 22} y={h / 2} state={state} blink={blink} />
    </>
  );
}

function SuperMacro(p: FrontProps) {
  const { w, h, state, name, model, blink } = p;
  const bays = Math.min(12, model.server?.bays ?? 4), rows = h > 30 ? Math.min(3, Math.ceil(bays / 4)) : 1, perRow = Math.ceil(bays / rows);
  const bw = w * 0.09, bh = (h - 4 - (rows - 1) * 1.5) / rows;
  const trays: ReactNode[] = [];
  for (let i = 0; i < bays; i++) {
    const x = 12 + (i % perRow) * (bw + 1.5), y = 2 + Math.floor(i / perRow) * (bh + 1.5);
    trays.push(
      <g key={i}>
        <rect x={x} y={y} width={bw} height={bh} rx="0.6" fill="oklch(0.6 0.006 255)" />
        <rect x={x + 2} y={y + bh / 2 - 0.8} width={bw - 8} height="1.6" fill="oklch(0.2 0.004 255)" />
        <circle cx={x + bw - 3} cy={y + bh / 2} r="1.1" {...bayLed(p, i, LED.act)} />
      </g>,
    );
  }
  const fs = fsz(Math.min(h, 24));
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.15 0.004 255)" />
      {trays}
      <Label x={w - 48} y={h / 2 + fs * 0.35} text={name} size={fs} anchor="end" />
      <Mark brand="SuperMacro" x={w - 31} h={h} />
      <StatusLeds x={w - 22} y={h / 2} state={state} blink={blink} />
    </>
  );
}

function Lenovoid(p: FrontProps) {
  const { w, h, state, name, model, blink } = p;
  const fs = fsz(Math.min(h, 24)), bays = Math.min(10, model.server?.bays ?? 4), x0 = 18 + (name ? tw(name, fs) + 6 : 0);
  const bw = Math.min(w * 0.05, (w - 52 - x0) / bays - 1.2);
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.13 0.003 255)" />
      <rect x="9" y="1.5" width="2.5" height={h - 3} fill={brandColor("Lenovoid")} />
      <Label x={15} y={h / 2 + fs * 0.35} text={name} size={fs} />
      {Array.from({ length: bays }, (_, i) => (
        <g key={i}>
          <rect x={x0 + i * (bw + 1.2)} y="2.5" width={bw} height={h - 5} rx="0.6" fill="oklch(0.25 0.004 255)" />
          <rect x={x0 + i * (bw + 1.2) + bw / 2 - 0.7} y="4" width="1.4" height="1.4" {...bayLed(p, i, LED.ok)} />
        </g>
      ))}
      <Mark brand="Lenovoid" x={w - 31} h={h} />
      <StatusLeds x={w - 22} y={h / 2} state={state} blink={blink} />
    </>
  );
}

const SERVER_FRONTS: Record<string, (p: FrontProps) => ReactNode> = { Dwell, "Hewlett-Packet": HewlettPacket, SuperMacro, Lenovoid };
const EAR: Record<string, string> = { Dwell: "oklch(0.22 0.006 255)", "Hewlett-Packet": "oklch(0.7 0.005 255)", SuperMacro: "oklch(0.15 0.004 255)", Lenovoid: "oklch(0.13 0.003 255)" };
const serverFront = (p: FrontProps) => (SERVER_FRONTS[p.brand] ?? SuperMacro)(p);

// Backup and archive chassis: a wall of drive caddies, 3 rows for backup and 5 for archive.
function Caddies(p: FrontProps) {
  const { w, h, state, name, model, brand, blink } = p;
  const n = model.server?.bays ?? 36, rows = n > 40 ? 5 : 3, per = Math.ceil(n / rows), fs = fsz(Math.min(h, 24)) * 0.8, top = fs + 5;
  const x1 = w - 36 - markSize(h), cw = (x1 - 12) / per, ch = (h - top - 3) / rows, dark = brand !== "Hewlett-Packet";
  return (
    <>
      <Ears w={w} h={h} fill={EAR[brand] ?? EAR.SuperMacro} />
      <Label x={12} y={fs + 1.5} text={name} size={fs} fill={dark ? LABEL : "oklch(0.3 0.01 255)"} />
      {Array.from({ length: n }, (_, i) => {
        const x = 12 + (i % per) * cw, y = top + Math.floor(i / per) * ch;
        return (
          <g key={i}>
            <rect x={x} y={y} width={cw - 1} height={ch - 1} rx="0.5" fill="oklch(0.28 0.005 255)" />
            <circle cx={x + cw / 2 - 0.5} cy={y + ch - 2.5} r="0.8" {...bayLed(p, i, LED.act)} />
          </g>
        );
      })}
      <Mark brand={brand} x={w - 31} h={h} />
      <StatusLeds x={w - 22} y={h / 2} state={state} blink={blink} />
    </>
  );
}

// GPU chassis: the brand's 1U face on top over a full-width intake grille.
function Gpu(p: FrontProps) {
  const top = p.h / 4;
  return (
    <>
      <Ears w={p.w} h={p.h} fill={EAR[p.brand] ?? EAR.SuperMacro} />
      <rect x="11" y={top + 1} width={p.w - 22} height={p.h - top - 3} rx="1.5" fill="url(#bb-hex)" />
      {serverFront({ ...p, h: top })}
    </>
  );
}

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

// Where switch ports start: after the name and, on layer 3 models, the L3 badge.
export function switchX0(model: DeviceModel, name: string, h: number) {
  const fs = fsz(Math.min(h, 24)) * 0.9;
  return (name ? 18 + tw(name, fs) : 16) + (model.layer === 3 ? 17 : 0);
}

function Switch({ w, h, name, model, ports, brand, groups = [], ear, state, blink }: FrontProps & { ear?: string }) {
  const fs = fsz(Math.min(h, 24)) * 0.9, x0 = switchX0(model, name, h), at = switchLayout(model, w, h, x0);
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
      <Ears w={w} h={h} fill={ear} />
      <Label x={10} y={h / 2 + fs * 0.35} text={name} size={fs} fill={ear ? "oklch(0.97 0 0)" : LABEL} />
      {model.layer === 3 && (
        <>
          <rect x={x0 - 16} y={h / 2 - 4.5} width="13" height="9" rx="1.5" fill="oklch(0.9 0.005 255)" stroke="oklch(0.3 0.01 255)" strokeWidth="0.6" />
          <text x={x0 - 9.5} y={h / 2 + 2.3} textAnchor="middle" fontFamily={MONO} fontSize="6.5" fontWeight="700" fill="oklch(0.2 0.01 255)">L3</text>
        </>
      )}
      {cells}
      {outlines}
      <circle cx={w - 14 - markSize(h)} cy={h / 2} r="1.6" fill={LED[state]} className={blink ? "led-blink" : undefined} />
      <Mark brand={brand} x={w - 10} h={h} plate={!!ear} />
    </>
  );
}

export function gatewayLayout(model: DeviceModel, name: string, w: number, h: number) {
  const fs = fsz(Math.min(h, 24)), x0 = Math.max(w * 0.42, 18 + tw(name, fs)), step = Math.min(11, (w - x0 - 34) / Math.max(1, model.ports.length));
  return new Map(model.ports.map((_, i) => [i, { x: x0 + i * step, y: 3.5, w: step - 2, h: h - 7 }]));
}

function Gateway(p: FrontProps) {
  const { w, h, name, model, ports, state, blink } = p;
  const fs = fsz(Math.min(h, 24));
  return (
    <>
      <Ears w={w} h={h} />
      <Label x={12} y={h / 2 + fs * 0.35} text={name} size={fs} />
      {[...gatewayLayout(model, name, w, h)].map(([i, p]) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill="oklch(0.14 0.005 255)"
          stroke={ports[i] && ports[i] !== "off" ? LED[ports[i]] : "var(--metal-line)"} strokeWidth="0.6" />
      ))}
      <StatusLeds x={w - 22} y={h / 2} state={state} blink={blink} />
    </>
  );
}

// Keystone jacks; a plugged jack shows its cable boot in the cable's colour.
// Jack k of a side sits at the same place on the front (port k) and the back (port n + k); 48 jacks take two rows.
export function patchLayout(name: string, w: number, h: number, n: number) {
  const rows = n > 24 ? 2 : 1, per = n / rows, fs = fsz(Math.min(h, 24)) * 0.9, x0 = name ? 18 + tw(name, fs) : 16, pw = (w - x0 - 14) / per, ph = (h - 6) / rows;
  return Array.from({ length: n }, (_, k) => {
    const c = k % per;
    return { x: x0 + c * pw + Math.floor(c / 6) * 0.8, y: 3 + Math.floor(k / per) * ph, w: pw - 1.4, h: ph - (rows > 1 ? 0.8 : 0) };
  });
}

export function Jacks({ w, h, name, ports, offset, n }: { w: number; h: number; name: string; ports: PortLamp[]; offset: number; n: number }) {
  return (
    <>
      {patchLayout(name, w, h, n).map((p, k) => {
        const st = ports[offset + k] ?? "off";
        return (
          <g key={k}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill="oklch(0.12 0.004 255)" />
            {st !== "off" && <rect x={p.x + p.w * 0.15} y={p.y + p.h * 0.25} width={p.w * 0.7} height={p.h * 0.5} rx="0.6" fill={st === "fiber" ? CABLE.fiber : CABLE.copper} />}
          </g>
        );
      })}
    </>
  );
}

function Patch({ w, h, name, ports, model }: FrontProps) {
  const fs = fsz(Math.min(h, 24)) * 0.9;
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.2 0.005 255)" />
      <Label x={10} y={h / 2 + fs * 0.35} text={name} size={fs} />
      <Jacks w={w} h={h} name={name} ports={ports} offset={0} n={jacksOf(model)} />
    </>
  );
}

export function Front(p: FrontProps) {
  if (p.model.kind === "server") {
    const line = lineOf(p.model);
    return line === "backup" || line === "archive" ? <Caddies {...p} /> : line === "gpu" ? <Gpu {...p} /> : serverFront(p);
  }
  if (p.model.kind === "switch") return <Switch {...p} />;
  if (p.model.kind === "firewall") return <Switch {...p} ear={brandColor(p.brand)} />;
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
