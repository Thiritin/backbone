// Rear panels and the place of every port on either side, so cables can be drawn to them.
import type { DeviceModel } from "../../sim/10-catalog/hardware";
import { fsz, gatewayLayout, Jacks, LED, partLed, patchLayout, switchLayout, SwitchPorts, tw, type FrontProps, type PartLamp } from "./fronts";

export type Side = "front" | "back";
export interface Spot { x: number; y: number; w: number; h: number }

const MONO = "JetBrains Mono, monospace";

// Server NICs sit in the lowest unit on the left; PSUs stand at the right edge.
function nicLayout(model: DeviceModel, w: number, h: number): Map<number, Spot> {
  const u = h / model.height, ph = Math.min(u - 6, 10), y = h - u + (u - ph) / 2;
  let x = w * 0.3;
  return new Map(model.ports.map((p, i) => {
    const pw = p.media === "sfp" ? 12 : 9, at = { x, y, w: pw, h: ph };
    x += pw + 3;
    return [i, at];
  }));
}

// Switch ports run from the name to a fan grille beside the PSUs.
const fanX = (model: DeviceModel, w: number) => w - 40 - model.psus * 33;
const switchRear = (model: DeviceModel, name: string, w: number, h: number) =>
  switchLayout(model, fanX(model, w) + 30, h, name ? 18 + tw(name, fsz(Math.min(h, 24)) * 0.9) : 12);

// The rear is the front seen from behind, so rear parts are laid out in front coordinates and mirrored.
const mirror = <T extends Spot>(spots: Map<number, T>, w: number) => new Map([...spots].map(([i, s]) => [i, { ...s, x: w - s.x - s.w }]));
const rearLayout = (model: DeviceModel, name: string, w: number, h: number): Map<number, Spot> => {
  if (model.kind === "server") return nicLayout(model, w, h);
  if (model.kind === "switch" || model.kind === "firewall") return switchRear(model, name, w, h);
  if (model.kind === "gateway") return gatewayLayout(model, name, w, h);
  return new Map(patchLayout(name, w, h, model.ports.length, 2).map((p, k) => [k, p]));
};

// Every port is on the back.
export const portSpots = (model: DeviceModel, name: string, side: Side, w: number, h: number): Map<number, Spot> =>
  side === "back" ? mirror(rearLayout(model, name, w, h), w) : new Map();

// The centre of each power supply's inlet as seen from the back, so power cords can be drawn to it.
export function psuInlets(model: DeviceModel, w: number, h: number): { x: number; y: number }[] {
  if (model.kind === "gateway" || model.kind === "patch") return [];
  const u = h / model.height, ph = u - 4, pw = Math.min(30, ph * 2.2);
  return Array.from({ length: model.psus }, (_, k) => ({ x: w - (w - 6 - (k + 1) * (pw + 3) + pw - 5.5), y: h - u + 2 + ph / 2 }));
}

function Psus({ model, w, h, on, lamps }: { model: DeviceModel; w: number; h: number; on: boolean; lamps?: PartLamp[] }) {
  const u = h / model.height, ph = u - 4, pw = Math.min(30, ph * 2.2);
  return (
    <>
      {Array.from({ length: model.psus }, (_, k) => {
        const x = w - 6 - (k + 1) * (pw + 3), y = h - u + 2;
        return (
          <g key={k} aria-label={`PSU ${k + 1}`}>
            <rect x={x} y={y} width={pw} height={ph} rx="1" fill="oklch(0.2 0.005 255)" stroke="var(--metal-line)" strokeWidth="0.6" />
            <circle cx={x + ph / 2 + 1} cy={y + ph / 2} r={ph * 0.36} fill="url(#bb-hex)" />
            <rect x={x + pw - 8} y={y + ph / 2 - 2.5} width="5" height="5" rx="0.8" fill="oklch(0.1 0.004 255)" />
            <circle cx={x + pw - 10.5} cy={y + 2.5} r="1" {...(on ? partLed(lamps?.[k], LED.ok) : { fill: LED.off })} />
          </g>
        );
      })}
    </>
  );
}

// Fans sit in the grille between the NICs and the power supplies, each with its own light.
function Fans({ x, w, h, lamps, on }: { x: number; w: number; h: number; lamps: PartLamp[]; on: boolean }) {
  const r = Math.min(h / 2 - 3, w / lamps.length / 2 - 2);
  if (r < 3) return null;
  const step = w / lamps.length;
  return (
    <>
      {lamps.map((l, k) => {
        const cx = x + step * (k + 0.5);
        return (
          <g key={k} aria-label={`Fan ${k + 1}`}>
            <circle cx={cx} cy={h / 2} r={r} fill="oklch(0.16 0.004 255)" stroke="var(--metal-line)" strokeWidth="0.6" />
            <circle cx={cx} cy={h / 2} r={r * 0.3} fill="oklch(0.3 0.005 255)" />
            <circle cx={cx + r * 0.8} cy={h / 2 - r * 0.8} r="1" {...(on ? partLed(l, LED.ok) : { fill: LED.off })} />
          </g>
        );
      })}
    </>
  );
}

export function Back(p: FrontProps) {
  const { model, w, h, name, ports, state } = p, fs = fsz(Math.min(h, 24)) * 0.9;
  const sw = model.kind === "switch" || model.kind === "firewall";
  const spots = model.kind === "server" || model.kind === "gateway" ? rearLayout(model, name, w, h) : new Map<number, Spot>();
  const gx = sw ? fanX(model, w) : w * 0.5, grille = sw ? 28 : Math.max(0, w * 0.5 - 12 - model.psus * 34);
  return (
    <>
      <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill="oklch(0.24 0.006 255)" stroke="var(--metal-line)" />
      <g transform={`matrix(-1 0 0 1 ${w} 0)`}>
        {model.kind === "patch" && <Jacks w={w} h={h} name={name} ports={ports} n={model.ports.length} rows={2} />}
        {sw && <SwitchPorts at={switchRear(model, name, w, h)} ports={ports} groups={p.groups} />}
        {model.kind !== "gateway" && model.kind !== "patch" && <rect x={gx} y="3" width={grille} height={h - 6} rx="1" fill="url(#bb-perf)" opacity="0.35" />}
        {p.parts && p.parts.fans.length > 0 && <Fans x={gx} w={grille} h={model.kind === "server" && model.height > 1 ? h - h / model.height : h} lamps={p.parts.fans} on={state !== "off"} />}
        {[...spots].map(([i, s]) => {
          const st = ports[i] ?? "off";
          return (
            <g key={i}>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="0.6" fill="oklch(0.12 0.004 255)" stroke="var(--metal-3)" strokeWidth="0.5" />
              {st !== "off" && <rect x={s.x + 1.5} y={s.y + 1} width={s.w - 3} height="1.4" fill={LED[st === "fiber" ? "fiber" : st]} />}
            </g>
          );
        })}
        {model.kind === "gateway"
          ? <rect x={w - 20} y={h / 2 - 3} width="8" height="6" rx="1" fill="oklch(0.1 0.004 255)" />
          : model.kind !== "patch" && <Psus model={model} w={w} h={h} on={state !== "off"} lamps={p.parts?.psus} />}
      </g>
      {name && <text x={w - 8} y={h / 2 + fs * 0.35} textAnchor="end" fontFamily={MONO} fontSize={fs} fill="oklch(0.7 0.01 255)">{name}</text>}
    </>
  );
}
