// Rear panels, power supplies and the place of every port on either side, so cables can be drawn to them.
// Switches and firewalls mount reversed, as in real racks: their port face looks to the rack back, where the
// server NICs are, and their power supplies and fans look to the rack front.
import type { DeviceModel } from "../../sim/10-catalog/hardware";
import { BrandMark } from "./logos";
import { AssetTag, fsz, gatewayLayout, Jacks, LED, ledProps, numBand, numSize, partLed, patchLayout, Pdu, portNo, switchLayout, SwitchPorts, switchX0, tw, type FrontProps, type PartLamp } from "./fronts";

const MONO = "JetBrains Mono, monospace", NUM = "oklch(0.74 0.01 255)";

// Port numbers as printed on the bezel: above each port, or below it for a switch's or patch panel's bottom row.
function PortNums({ model, spots, h, below }: { model: DeviceModel; spots: Map<number, Spot>; h: number; below: (i: number, s: Spot) => boolean }) {
  const fs = numSize(h);
  return (
    <g fontFamily={MONO} fontSize={fs} fill={NUM} textAnchor="middle" aria-hidden="true">
      {[...spots].map(([i, s]) => <text key={i} x={s.x + s.w / 2} y={below(i, s) ? s.y + s.h + fs * 0.75 + 0.4 : s.y - 0.6}>{portNo(model, i)}</text>)}
    </g>
  );
}

export type Side = "front" | "back";
export interface Spot { x: number; y: number; w: number; h: number }

// Millimetres to drawing units: a rack unit is 44.45 mm.
const mmOf = (model: DeviceModel, h: number) => h / Math.max(1, model.height) / 44.45;

// Server NICs sit in the lowest unit on the left; PSUs stand at the right edge.
function nicLayout(model: DeviceModel, w: number, h: number): Map<number, Spot> {
  const u = h / model.height, ph = Math.min(u - 2 * numBand(u), 10), y = h - u + (u - ph) / 2;
  let x = w * 0.3;
  return new Map(model.ports.map((p, i) => {
    const pw = p.media === "sfp" ? 12 : 9, at = { x, y, w: pw, h: ph };
    x += pw + 3;
    return [i, at];
  }));
}

// A switch's port face: the asset tag and console port on the left, ports, then status lights and the maker mark.
const portFace = (model: DeviceModel, name: string, w: number, h: number) => switchLayout(model, w - 30, h, switchX0(model, name, h) + 12);

// A server's rear is the front seen from behind, so its parts are laid out in front coordinates and mirrored.
const mirror = <T extends Spot>(spots: Map<number, T>, w: number) => new Map([...spots].map(([i, s]) => [i, { ...s, x: w - s.x - s.w }]));
const mirroredLayout = (model: DeviceModel, name: string, w: number, h: number): Map<number, Spot> => {
  if (model.kind === "server") return nicLayout(model, w, h);
  if (model.kind === "gateway") return gatewayLayout(model, name, w, h);
  return new Map(patchLayout(name, w, h, model.ports.length, 2).map((p, k) => [k, p]));
};
const reversed = (model: DeviceModel) => model.kind === "switch" || model.kind === "firewall";

// Every port is on the back.
export const portSpots = (model: DeviceModel, name: string, side: Side, w: number, h: number): Map<number, Spot> =>
  side !== "back" ? new Map() : reversed(model) ? portFace(model, name, w, h) : mirror(mirroredLayout(model, name, w, h), w);

// Power supplies stand at the left end of the face they are on, in the lowest unit, true to size: a 1U module is
// about 70 by 38 mm with an IEC C14 inlet of 24 by 16 mm.
export function psuBoxes(model: DeviceModel, w: number, h: number) {
  if (model.kind === "gateway" || model.kind === "patch" || model.kind === "pdu") return [];
  const mm =mmOf(model, h), u = h / Math.max(1, model.height), ph = Math.min(u - 3, 38 * mm), pw = Math.min(70 * mm, (w * 0.4) / Math.max(1, model.psus));
  const iw = 24 * mm, ih = 16 * mm;
  return Array.from({ length: model.psus }, (_, k) => {
    const x = 13 + k * (pw + 3), y = h - u + (u - ph) / 2;
    return { x, y, w: pw, h: ph, inlet: { x: x + 2.5 * mm + 2, y: y + (ph - ih) / 2, w: iw, h: ih } };
  });
}

// The face that carries the power inlets, and each inlet's centre on it.
export const psuSide = (model: DeviceModel): Side => (reversed(model) ? "front" : "back");
export const psuInlets = (model: DeviceModel, side: Side, w: number, h: number) =>
  side === psuSide(model) ? psuBoxes(model, w, h).map((b) => ({ x: b.inlet.x + b.inlet.w / 2, y: b.inlet.y + b.inlet.h / 2, mm: mmOf(model, h) })) : [];

// An IEC C13 plug, true to size (about 30 by 22 mm over the 24 by 16 mm inlet), with a 7 mm cord leaving left to x0.
export function Cord({ x, y, mm, x0 }: { x: number; y: number; mm: number; x0: number }) {
  const bw = 30 * mm, bh = 22 * mm, cw = Math.max(2.4, 7 * mm), d = `M${x - bw / 2} ${y}H${x0}`;
  return (
    <>
      <path d={d} stroke="oklch(0.4 0.006 255)" strokeWidth={cw + 1.2} />
      <path d={d} stroke="oklch(0.1 0.004 255)" strokeWidth={cw} />
      <rect x={x - bw / 2 - 4 * mm} y={y - cw * 0.8} width={6 * mm} height={cw * 1.6} rx="1" fill="oklch(0.12 0.004 255)" />
      <rect x={x - bw / 2} y={y - bh / 2} width={bw} height={bh} rx={2.5 * mm} fill="oklch(0.13 0.004 255)" stroke="oklch(0.42 0.006 255)" strokeWidth="0.6" />
      {[0.3, 0.5, 0.7].map((f) => <line key={f} x1={x - bw / 2 + bw * f} y1={y - bh * 0.32} x2={x - bw / 2 + bw * f} y2={y + bh * 0.32} stroke="oklch(0.22 0.004 255)" strokeWidth="0.7" />)}
    </>
  );
}

// An IEC C14 inlet: a keystone-shaped socket with three flat pins.
function C14({ x, y, w, h }: Spot) {
  const c = w * 0.18;
  return (
    <g aria-label="Power inlet">
      <path d={`M${x} ${y}h${w}v${h - c}l${-c} ${c}h${-(w - 2 * c)}l${-c} ${-c}z`} fill="oklch(0.08 0.003 255)" stroke="oklch(0.45 0.006 255)" strokeWidth="0.6" />
      {[0.28, 0.72].map((f) => <rect key={f} x={x + w * f - w * 0.035} y={y + h * 0.28} width={w * 0.07} height={h * 0.3} fill="oklch(0.75 0.05 85)" />)}
      <rect x={x + w / 2 - w * 0.035} y={y + h * 0.5} width={w * 0.07} height={h * 0.3} fill="oklch(0.75 0.05 85)" />
    </g>
  );
}

// Hot-swap power supply modules with a handle, a fan grille, a status light and the inlet.
export function Psus({ model, w, h, on, lamps }: { model: DeviceModel; w: number; h: number; on: boolean; lamps?: PartLamp[] }) {
  return (
    <>
      {psuBoxes(model, w, h).map((b, k) => {
        const g = b.inlet.x + b.inlet.w + 3, r = Math.min(b.h * 0.36, (b.x + b.w - g - 6) / 2);
        return (
          <g key={k} aria-label={`PSU ${k + 1}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="1" fill="oklch(0.26 0.005 255)" stroke="var(--metal-line)" strokeWidth="0.6" />
            <C14 {...b.inlet} />
            {r > 2 && <circle cx={g + r} cy={b.y + b.h / 2} r={r} fill="url(#bb-hex)" />}
            <rect x={b.x + b.w - 4} y={b.y + 2} width="2.4" height={b.h - 4} rx="1" fill="oklch(0.45 0.006 255)" />
            <circle cx={b.x + b.w - 7.5} cy={b.y + 2.8} r="1" {...(on ? partLed(lamps?.[k], LED.ok) : { fill: LED.off })} />
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

// The rear of a switch or firewall as seen from the rack front: power supplies, fans and the asset tag.
export function SwitchRear(p: FrontProps) {
  const { model, w, h, name, state } = p, psus = psuBoxes(model, w, h), x1 = psus.length ? psus[psus.length - 1].x + psus[psus.length - 1].w + 8 : 14;
  const fans = p.parts?.fans ?? [], fw = Math.min(w * 0.3, fans.length * h);
  return (
    <>
      <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill="oklch(0.27 0.006 255)" stroke="var(--metal-line)" />
      <Psus model={model} w={w} h={h} on={state !== "off"} lamps={p.parts?.psus} />
      <rect x={x1} y="3" width={fw} height={h - 6} rx="1" fill="url(#bb-perf)" opacity="0.35" />
      {fans.length > 0 && <Fans x={x1} w={fw} h={h} lamps={fans} on={state !== "off"} />}
      <circle cx={x1 + fw + 10} cy={h / 2} r={Math.min(2.4, h * 0.12)} fill="oklch(0.62 0.03 85)" stroke="oklch(0.35 0.01 85)" strokeWidth="0.5" aria-label="Ground" />
      <LedPanel {...p} x={x1 + fw + 20} x2={w - 22 - (name ? tw(name, fsz(Math.min(h, 24)) * 0.9) + 4 : 0)} />
      <AssetTag x={w - 14} y={h / 2} text={name} h={h} anchor="end" />
    </>
  );
}

// The port lights repeated on the power-supply side, numbered as on the port face: odd above, even below, in blocks of six.
function LedPanel({ model, name, h, lights = [], state, x, x2 }: FrontProps & { x: number; x2: number }) {
  const cols = Math.ceil(model.ports.length / 2), gap = 1.6, cw = Math.min(10, (x2 - x - Math.floor((cols - 1) / 6) * gap - 4) / cols);
  if (cw < 4) return null;
  const fs = Math.min(numSize(h), cw / 1.3), lw = Math.min(3.2, cw * 0.5), lh = Math.min(2, h * 0.09);
  const width = cols * cw + Math.floor((cols - 1) / 6) * gap + 4;
  return (
    <g aria-label="Port lights">
      <rect x={x} y="2" width={width} height={h - 4} rx="1" fill="oklch(0.14 0.004 255)" />
      <g fontFamily={MONO} fontSize={fs} fill={NUM} textAnchor="middle" aria-hidden="true">
        {model.ports.map((_, i) => {
          const col = Math.floor(i / 2), cx = x + 2 + col * cw + Math.floor(col / 6) * gap + cw / 2, top = i % 2 === 0;
          return (
            <g key={i}>
              <rect x={cx - lw / 2} y={top ? h / 2 - lh - 0.8 : h / 2 + 0.8} width={lw} height={lh} rx="0.4" {...(state === "off" ? { fill: LED.off } : ledProps(lights[i], name, i))} />
              <text x={cx} y={top ? h / 2 - lh - 1.6 : h / 2 + lh + 1.6 + fs * 0.75}>{i + 1}</text>
            </g>
          );
        })}
      </g>
    </g>
  );
}

// The port face of a switch or firewall: asset tag, console port, ports, status lights and the maker mark.
function PortFace(p: FrontProps) {
  const { model, w, h, name, ports, state, blink, brand } = p, x0 = switchX0(model, name, h), s = Math.min(10, h * 0.42), at = portFace(model, name, w, h);
  return (
    <>
      <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill="oklch(0.24 0.006 255)" stroke="var(--metal-line)" />
      <AssetTag x={6} y={h / 2} text={name} h={h} />
      <rect x={x0} y={h / 2 - s * 0.45} width={s * 0.9} height={s * 0.8} rx="0.6" fill="oklch(0.5 0.09 230)" aria-label="Console port" />
      <SwitchPorts at={at} ports={ports} lights={p.lights} name={name} groups={p.groups} />
      <PortNums model={model} spots={at} h={h} below={(i) => !at.get(i)!.top} />
      <circle cx={w - 24} cy={h / 2 - 3} r="1.3" fill={LED[state]} className={blink ? "led-blink" : undefined} />
      <circle cx={w - 24} cy={h / 2 + 3} r="1.3" fill={state === "off" ? LED.off : LED.ok} />
      {h >= 14 && <BrandMark brand={brand} x={w - 16} y={h / 2 - 4} size={8} />}
    </>
  );
}

export function Back(p: FrontProps) {
  const { model, w, h, name, ports, state } = p;
  if (reversed(model)) return <PortFace {...p} />;
  if (model.kind === "pdu") return <Pdu {...p} />;
  const spots = model.kind === "server" || model.kind === "gateway" ? mirroredLayout(model, name, w, h) : new Map<number, Spot>();
  const psus = psuBoxes(model, w, h), used = psus.length ? psus[psus.length - 1].x + psus[psus.length - 1].w : 0;
  const gx = w * 0.5, grille = Math.max(0, w * 0.5 - 14 - used);
  const fs = fsz(Math.min(h, 24));
  return (
    <>
      <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill="oklch(0.24 0.006 255)" stroke="var(--metal-line)" />
      <g transform={`matrix(-1 0 0 1 ${w} 0)`}>
        {model.kind === "patch" && <Jacks w={w} h={h} name={name} ports={ports} n={model.ports.length} rows={2} />}
        {model.kind !== "gateway" && model.kind !== "patch" && <rect x={gx} y="3" width={grille} height={h - 6} rx="1" fill="url(#bb-perf)" opacity="0.35" />}
        {p.parts && p.parts.fans.length > 0 && <Fans x={gx} w={grille} h={model.kind === "server" && model.height > 1 ? h - h / model.height : h} lamps={p.parts.fans} on={state !== "off"} />}
        {[...spots].map(([i, s]) => (
          <g key={i}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="0.6" fill="oklch(0.12 0.004 255)" stroke="var(--metal-3)" strokeWidth="0.5" />
            {p.lights?.[i] && <rect x={s.x + s.w * 0.62} y={s.y + 1} width={s.w * 0.26} height="1.4" {...ledProps(p.lights[i], name, i)} />}
          </g>
        ))}
        {model.kind === "gateway" && <rect x={w - 20} y={h / 2 - 3} width="8" height="6" rx="1" fill="oklch(0.1 0.004 255)" />}
      </g>
      <PortNums model={model} spots={portSpots(model, name, "back", w, h)} h={model.kind === "server" ? h / model.height : h} below={(i) => model.kind === "patch" && i >= model.ports.length / 2} />
      {model.kind !== "gateway" && model.kind !== "patch" && <Psus model={model} w={w} h={h} on={state !== "off"} lamps={p.parts?.psus} />}
      <AssetTag x={w - 8} y={Math.min(h / 2, fs + 2)} text={name} h={h} anchor="end" />
    </>
  );
}
