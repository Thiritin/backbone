// Code-drawn device fronts, ported from docs/design/mockups/shell.js. Sizes are px; u is one rack unit.
import type { ReactNode } from "react";
import { bayCount, isOobPort, jacksOf, type DeviceModel } from "../../sim/10-catalog/hardware";
import { isMgmtModel, MgmtFront, oobLabel } from "./mgmt";
import { Back, Cord, psuInlets, SwitchRear } from "./backs";
import { BrandMark } from "./logos";

export type Lamp = "ok" | "warn" | "bad" | "off";
export type PortLamp = "off" | "ok" | "warn" | "bad" | "fiber";
export type PartLamp = Lamp | "rebuild";
export interface Parts { drives: PartLamp[]; psus: PartLamp[]; fans: PartLamp[] }
// A port's link light: amber for a link slower than the port, load the share of the link in use. null is no link.
export type PortLight = { lamp: "ok" | "warn"; load: number } | null;

export const LED = { ok: "oklch(0.78 0.2 145)", warn: "oklch(0.83 0.17 80)", bad: "oklch(0.66 0.23 27)", off: "oklch(0.4 0.01 255)", act: "oklch(0.8 0.14 225)", fiber: "oklch(0.8 0.12 195)" };
export const CABLE = { copper: "oklch(0.62 0.14 250)", dac: "oklch(0.7 0.02 255)", fiber: LED.fiber, rollover: "oklch(0.84 0.07 220)", uplink: "oklch(0.82 0.15 90)" };
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
// Asset tag text: small, like a printed label on a bezel, not the headline of the device.
export const fsz = (h: number) => Math.max(4.6, Math.min(6, h * 0.26));
export const tw = (t: string, fs: number) => t.length * fs * 0.62;
// Port numbers print in a band above and below the ports.
export const numSize = (h: number) => Math.min(6, Math.max(3.8, Math.min(h, 32) * 0.19));
export const numBand = (h: number) => numSize(h) * 0.85 + 1.3;
export const portNo = (m: DeviceModel, i: number) => (isOobPort(i) ? oobLabel(m, i) : m.kind === "server" ? i : m.kind === "patch" ? (i % jacksOf(m)) + 1 : i + 1);

// Activity flickers faster the busier the link; each port starts at its own point so neighbours never flicker in step.
const phaseOf = (name: string, i: number) => ([...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7) / 997 + i * 0.618) % 1;
export function ledProps(light: PortLight | undefined, name: string, i: number) {
  if (!light) return { fill: LED.off };
  if (light.load <= 0) return { fill: LED[light.lamp] };
  // Logarithmic from a millionth of the link to all of it: a hobby site flickers slowly, a full link five times a second.
  const d = 1.5 - 1.3 * Math.min(1, Math.max(0, (Math.log10(light.load) + 6) / 6));
  return { fill: LED[light.lamp], className: "port-act", style: { animationDuration: `${d.toFixed(2)}s`, animationDelay: `${(-phaseOf(name, i) * d).toFixed(2)}s` } };
}
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

// A printed asset tag: a light sticker with the device name, centred on y.
export function AssetTag({ x, y, text, h, anchor = "start" }: { x: number; y: number; text: string; h: number; anchor?: "start" | "end" }) {
  if (!text) return null;
  const fs = fsz(Math.min(h, 24)) * 0.9, tw0 = tw(text, fs) + 4, x0 = anchor === "end" ? x - tw0 : x;
  return (
    <g aria-label={text}>
      <rect x={x0} y={y - fs * 0.75} width={tw0} height={fs * 1.5} rx="0.6" fill="oklch(0.9 0.01 90)" />
      <text x={x0 + 2} y={y + fs * 0.35} fontFamily={MONO} fontSize={fs} fill="oklch(0.25 0.01 255)">{text}</text>
    </g>
  );
}
// Older call sites give the text baseline; the tag centres on the line.
function Label({ x, y, text, size = 6.5, anchor = "start" }: { x: number; y: number; text: string; size?: number; anchor?: "start" | "middle" | "end"; fill?: string }) {
  return <AssetTag x={x} y={y - size * 0.35} text={text} h={24} anchor={anchor === "end" ? "end" : "start"} />;
}

// A part's light: idle is the brand's colour for a healthy part; a rebuild blinks amber.
export const partLed = (lamp: PartLamp | undefined, idle: string) =>
  lamp === "rebuild" ? { fill: LED.warn, className: "led-blink" } : { fill: !lamp || lamp === "ok" ? idle : LED[lamp] };
// Bay i holds drive i; a bay past the fitted drives is empty and dark.
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
  lights?: PortLight[];
  groups?: number[][];
  parts?: Parts;
  blink?: boolean;
  onPower?: () => void;
  w: number;
  h: number;
}

// Rack server fronts, drawn after real 1U and 2U servers: ears with handles, a row of hot-swap drive caddies with
// activity lights, a vented bezel and a control panel with the power button, status lights and the maker mark.
// The makers differ in colour and trim; names are parodies.
const STYLE: Record<string, { ear: string; bay: string; trim: string; vent: string }> = {
  Dwell: { ear: "oklch(0.22 0.006 255)", bay: "oklch(0.3 0.005 255)", trim: "oklch(0.55 0.01 255)", vent: "url(#bb-hex)" },
  "Hewlett-Packet": { ear: "oklch(0.7 0.005 255)", bay: "oklch(0.34 0.006 255)", trim: "oklch(0.6 0.13 250)", vent: "url(#bb-perf)" },
  SuperMacro: { ear: "oklch(0.15 0.004 255)", bay: "oklch(0.28 0.004 255)", trim: "oklch(0.5 0.005 255)", vent: "url(#bb-perf)" },
  Lenovoid: { ear: "oklch(0.13 0.003 255)", bay: "oklch(0.26 0.004 255)", trim: "oklch(0.58 0.2 27)", vent: "url(#bb-hex)" },
};
const EAR: Record<string, string> = Object.fromEntries(Object.entries(STYLE).map(([b, st]) => [b, st.ear]));

function ServerFace(p: FrontProps) {
  const { w, h, state, name, model, brand, blink } = p, st = STYLE[brand] ?? STYLE.SuperMacro;
  const rows = Math.max(1, Math.min(2, model.height)), n = Math.max(2, Math.min(12, model.server ? bayCount(model.server) : 4)), per = Math.ceil(n / rows);
  const panel = Math.max(44, h * 1.8), x0 = 14, x1 = w * 0.62, bw = Math.min((x1 - x0) / per, h / rows * 3.2), bh = (h - 4) / rows;
  const cx = w - 12 - panel;
  return (
    <>
      <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill={st.ear} stroke="var(--metal-line)" />
      {[3, w - 9].map((x) => <rect key={x} x={x} y={h * 0.2} width="6" height={h * 0.6} rx="2" fill="none" stroke={st.trim} strokeWidth="0.8" aria-hidden="true" />)}
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + (i % per) * bw, y = 2 + Math.floor(i / per) * bh;
        return (
          <g key={i}>
            <rect x={x + 0.4} y={y} width={bw - 0.8} height={bh - 0.6} rx="0.6" fill={st.bay} stroke="oklch(0.18 0.004 255)" strokeWidth="0.5" />
            <rect x={x + bw * 0.12} y={y + bh * 0.62} width={bw * 0.76} height={bh * 0.2} rx="0.5" fill={st.trim} opacity="0.75" />
            <circle cx={x + 2.6} cy={y + 2.6} r="0.9" {...bayLed(p, i, LED.ok)} />
            <circle cx={x + 5.2} cy={y + 2.6} r="0.9" fill={p.state === "off" ? LED.off : "oklch(0.55 0.1 230)"} />
          </g>
        );
      })}
      <rect x={x0 + per * bw + 3} y="2.5" width={Math.max(0, cx - x0 - per * bw - 6)} height={h - 5} rx="1" fill={st.vent} opacity="0.8" />
      <rect x={cx} y="2" width={panel} height={h - 4} rx="1" fill="oklch(0.14 0.004 255)" />
      <AssetTag x={cx + 3} y={Math.min(h / 2, 7)} text={name} h={h} />
      <circle cx={cx + panel - 8} cy={h - 6} r={Math.min(3, h * 0.14)} fill="oklch(0.2 0.004 255)" stroke={state === "off" ? LED.off : LED.act} strokeWidth="0.9" aria-label="Power button" />
      {p.onPower && (
        <circle className="svg-hit" cx={cx + panel - 8} cy={h - 6} r={Math.min(8, h * 0.3)} fill="transparent" role="button" tabIndex={0} aria-label={state === "off" ? "Power on" : "Shut down"}
          onClick={p.onPower} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onPower!(); } }}><title>{state === "off" ? "Power on" : "Shut down"}</title></circle>
      )}
      <StatusLeds x={cx + panel - 26} y={h - 6} state={state} blink={blink} />
      {h >= 18 && <BrandMark brand={brand} x={cx + 4} y={h - 11} size={8} />}
    </>
  );
}

const serverFront = (p: FrontProps) => <ServerFace {...p} />;

// Backup and archive chassis: a wall of drive caddies, 3 rows for backup and 5 for archive.
function Caddies(p: FrontProps) {
  const { w, h, state, name, model, brand, blink } = p;
  const n = model.server ? bayCount(model.server) : 36, rows = n > 40 ? 5 : 3, per = Math.ceil(n / rows), fs = fsz(Math.min(h, 24)) * 0.8, top = fs + 5;
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
  const band = numBand(h), pw = (w - x0 - 32) / Math.max(28, runs.reduce((n, r) => n + colsOf(r), 0) + 4), ph = (h - 2 * band) / 2;
  // A single row of jacks is true to size: an RJ45 jack is about 14 of a unit's 44.45 mm.
  const one = Math.min(h - 7, Math.max(6, h * 0.34));
  const at = new Map<number, { x: number; y: number; w: number; h: number; sfp: boolean; top: boolean }>();
  let x = x0;
  for (const r of runs) {
    const paired = r.length > 8, sfp = model.ports[r[0]].media === "sfp";
    r.forEach((p, k) => {
      const col = paired ? Math.floor(k / 2) : k, px = x + col * pw + Math.floor(col / 6) * 2;
      at.set(p, paired ? { x: px, y: band + (k % 2) * ph, w: pw - 1.6, h: ph - 1, sfp, top: k % 2 === 0 } : { x: px, y: (h - one) / 2, w: pw * 0.85, h: one, sfp, top: true });
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

// Rear switch ports with their link lights and the dashed outline of each port group.
export function SwitchPorts({ at, ports, lights = [], name, groups = [] }: { at: ReturnType<typeof switchLayout>; ports: PortLamp[]; lights?: PortLight[]; name: string; groups?: number[][] }) {
  const cells: ReactNode[] = [];
  for (const [i, p] of at) {
    const st = ports[i] ?? "off";
    const led = lights[i] && <rect x={p.x + p.w * 0.1} y={p.top ? p.y + p.h * 0.06 : p.y + p.h * 0.88 - Math.max(1.4, p.h * 0.14)} width={p.w * 0.24} height={Math.max(1.4, p.h * 0.14)} {...ledProps(lights[i], name, i)} />;
    if (p.sfp) {
      cells.push(
        <g key={i}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill="oklch(0.14 0.005 255)" stroke="var(--metal-3)" strokeWidth="0.5" />
          {st !== "off" && <rect x={p.x + p.w * 0.22} y={p.y + p.h * 0.3} width={p.w * 0.22} height={p.h * 0.4} fill={CABLE.fiber} />}
          {st !== "off" && <rect x={p.x + p.w * 0.56} y={p.y + p.h * 0.3} width={p.w * 0.22} height={p.h * 0.4} fill={CABLE.fiber} />}
          {led}
        </g>,
      );
      continue;
    }
    cells.push(
      <g key={i}>
        <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="0.6" fill={st === "off" ? "var(--metal-line)" : "oklch(0.14 0.005 255)"} />
        {led}
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
  return <>{cells}{outlines}</>;
}

export function gatewayLayout(model: DeviceModel, name: string, w: number, h: number) {
  const fs = fsz(Math.min(h, 24)), x0 = Math.max(w * 0.42, 18 + tw(name, fs)), step = Math.min(11, (w - x0 - 34) / Math.max(1, model.ports.length));
  return new Map(model.ports.map((_, i) => [i, { x: x0 + i * step, y: numBand(h), w: step - 2, h: h - numBand(h) - 3.5 }]));
}

function Gateway(p: FrontProps) {
  const { w, h, name, model, lights = [], state, blink } = p;
  const fs = fsz(Math.min(h, 24));
  return (
    <>
      <Ears w={w} h={h} />
      <Label x={12} y={h / 2 + fs * 0.35} text={name} size={fs} />
      {[...gatewayLayout(model, name, w, h)].map(([i, p]) => <circle key={i} cx={p.x + p.w / 2} cy={h / 2} r="1.3" {...ledProps(lights[i], name, i)} />)}
      <StatusLeds x={w - 22} y={h / 2} state={state} blink={blink} />
    </>
  );
}

// Keystone jacks; a plugged jack shows its cable boot in the cable's colour.
// Jacks fill the rows in order; the rear of a panel puts jacks 1 to n on the top row and n + 1 to 2n below.
export function patchLayout(name: string, w: number, h: number, n: number, rows = n > 24 ? 2 : 1) {
  const per = n / rows, fs = fsz(Math.min(h, 24)) * 0.9, x0 = name ? 18 + tw(name, fs) : 16, pw = (w - x0 - 14) / per;
  const top = numBand(h), ph = (h - top - (rows > 1 ? top : 3)) / rows;
  return Array.from({ length: n }, (_, k) => {
    const c = k % per;
    return { x: x0 + c * pw + Math.floor(c / 6) * 0.8, y: top + Math.floor(k / per) * ph, w: pw - 1.4, h: ph - (rows > 1 ? 0.8 : 0) };
  });
}

export function Jacks({ w, h, name, ports, n, rows }: { w: number; h: number; name: string; ports: PortLamp[]; n: number; rows?: number }) {
  return (
    <>
      {patchLayout(name, w, h, n, rows).map((p, k) => {
        const st = ports[k] ?? "off";
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

function Patch({ w, h, name }: FrontProps) {
  const fs = fsz(Math.min(h, 24)) * 0.9;
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.2 0.005 255)" />
      <Label x={10} y={h / 2 + fs * 0.35} text={name} size={fs} />
    </>
  );
}

// A UPS: the name, a battery gauge and a green mains light.
function Ups({ w, h, name }: FrontProps) {
  const fs = fsz(Math.min(h, 24)) * 0.9;
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.24 0.005 255)" />
      <Label x={10} y={h / 2 + fs * 0.35} text={name} size={fs} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={w * 0.62 + i * 7} y={h * 0.32} width={5} height={h * 0.36} rx={1} fill="oklch(0.72 0.17 145)" />)}
      <circle cx={w - 22} cy={h / 2} r={Math.min(3, h * 0.18)} fill="oklch(0.78 0.18 145)" />
    </>
  );
}

// A switched PDU: the name and a row of outlets, each with a lamp.
export function Pdu({ w, h, name, model, state }: FrontProps) {
  const fs = fsz(Math.min(h, 24)) * 0.9, n = model.outlets ?? 8, x0 = Math.max(w * 0.34, 18 + tw(name, fs)), step = (w - x0 - 30) / n;
  return (
    <>
      <Ears w={w} h={h} fill="oklch(0.24 0.005 255)" />
      <Label x={10} y={h / 2 + fs * 0.35} text={name} size={fs} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={x0 + i * step} y={h * 0.3} width={Math.max(2, step - 2)} height={h * 0.4} rx={1} fill="oklch(0.12 0.004 255)" />
          <circle cx={x0 + i * step + Math.max(2, step - 2) / 2} cy={h * 0.5} r={Math.min(1.2, step * 0.18)} fill={state === "off" ? "oklch(0.35 0.01 255)" : "oklch(0.78 0.18 145)"} />
        </g>
      ))}
    </>
  );
}

export function Front(p: FrontProps) {
  if (p.model.kind === "server") {
    const line = lineOf(p.model);
    return line === "backup" || line === "archive" ? <Caddies {...p} /> : line === "gpu" ? <Gpu {...p} /> : serverFront(p);
  }
  if (p.model.kind === "switch" || p.model.kind === "firewall") return <SwitchRear {...p} />;
  if (p.model.kind === "gateway") return <Gateway {...p} />;
  if (p.model.kind === "ups") return <Ups {...p} />;
  if (p.model.kind === "pdu") return <Pdu {...p} />;
  if (isMgmtModel(p.model)) return <MgmtFront {...p} />;
  return <Patch {...p} />;
}

// One device front as a standalone <svg>; panel gateways (height 0) are drawn as one unit.
// plugs and onInlet draw the cord in each plugged inlet and let a click on an inlet plug it in or pull it.
export function DeviceSvg({ w, u, back, plugs, onInlet, ...p }: Omit<FrontProps, "h" | "w"> & { w: number; u: number; back?: boolean; plugs?: boolean[]; onInlet?: (psu: number) => void }) {
  const h = Math.max(1, p.model.height) * u, inlets = psuInlets(p.model, back ? "back" : "front", w, h);
  return (
    <svg className="device-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={p.name || p.model.name}>
      <Defs />
      {back ? <Back {...p} w={w} h={h} /> : <Front {...p} w={w} h={h} />}
      {inlets.map((c, k) => plugs?.[k] && <Cord key={`c${k}`} x={c.x} y={c.y} mm={c.mm} x0={c.x - 30 * c.mm} />)}
      {onInlet && inlets.map((c, k) => {
        const label = `${plugs?.[k] ? "Unplug" : "Plug in"} power supply ${k + 1}`;
        return (
          <rect key={`i${k}`} className="rack-port rack-inlet" role="button" tabIndex={0} aria-label={label} x={c.x - 15 * c.mm - 1} y={c.y - 11 * c.mm - 1} width={30 * c.mm + 2} height={22 * c.mm + 2} rx="1"
            onClick={() => onInlet(k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onInlet(k); } }}><title>{label}</title></rect>
        );
      })}
    </svg>
  );
}
