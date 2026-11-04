import { useEffect, useRef, useState } from "react";
import { dateOf } from "../../sim/00-core/time";
import { datacenterById, dcProvider } from "../../sim/20-world/datacenters";
import type { Location } from "../../sim/50-state";
import { hasMark, Logo } from "../art/logos";
import { useStore } from "../store";
import { useTrip } from "./route";
import { carDoor, engineStart, engineStop, taxiDoor } from "./sounds";

// Any key or click calls fn once.
export function useSkip(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let done = false;
    const go = (e: Event) => { e.preventDefault(); e.stopPropagation(); if (!done) { done = true; ref.current(); } };
    window.addEventListener("keydown", go, true);
    window.addEventListener("pointerdown", go, true);
    return () => { window.removeEventListener("keydown", go, true); window.removeEventListener("pointerdown", go, true); };
  }, []);
}

// Real milliseconds since mount, frame by frame.
export function useElapsed(): number {
  const [e, setE] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = requestAnimationFrame(function frame(now) { setE(now - t0); raf = requestAnimationFrame(frame); });
    return () => cancelAnimationFrame(raf);
  }, []);
  return e;
}

const LEAVE_MS = 4000, ARRIVE_MS = 3900, KERB = 196, GROUND = 146;
const ease = (a: number, b: number, e: number) => Math.max(0, Math.min(1, (e - a) / (b - a)));

// Sky bands top to bottom by the hour of day, the lowest one the horizon.
function sky(h: number): [string, string, string, boolean] {
  if (h < 5 || h >= 21) return ["oklch(0.18 0.05 270)", "oklch(0.21 0.055 268)", "oklch(0.25 0.05 262)", true];
  if (h < 8) return ["oklch(0.55 0.08 270)", "oklch(0.68 0.09 330)", "oklch(0.8 0.1 55)", false];
  if (h < 18) return ["oklch(0.72 0.08 240)", "oklch(0.79 0.065 236)", "oklch(0.86 0.045 228)", false];
  return ["oklch(0.42 0.1 300)", "oklch(0.56 0.13 10)", "oklch(0.72 0.13 50)", false];
}

// Side view of the street: the building, the company car or a taxi at the kerb and the avatar.
export function Scene({ place, leaving, taxi = false }: { place: Location; leaving: boolean; taxi?: boolean }) {
  const e = useElapsed(), send = useTrip((s) => s.send), hour = useStore((s) => dateOf(s.game.hour).getUTCHours());
  const fired = useRef(new Set<string>());
  const end = () => {
    if (!leaving) { const s = useStore.getState(), trip = useTrip.getState().trip; if (trip && !s.alert) s.setSpeed(trip.resume); }
    send("done");
  };
  useSkip(end);
  const doorSound = taxi ? taxiDoor : carDoor;
  const cues: [string, number, () => void][] = leaving
    ? [["shut", 1650, doorSound], ["start", 1900, engineStart]]
    : [["stop", 1500, engineStop], ["open", 1700, doorSound], ["shut", 2350, doorSound]];
  for (const [id, at, play] of cues) if (e >= at && !fired.current.has(id)) { fired.current.add(id); play(); }
  useEffect(() => { if (e >= (leaving ? LEAVE_MS : ARRIVE_MS)) end(); });

  const house = place.space === "basement", office = place.space === "office", door = house ? 84 : office ? 60 : 38, seat = KERB + 16;
  const company = useStore((s) => s.game.company.name);
  let carX: number, open: boolean, me: number | null, fade: number;
  if (leaving) {
    carX = KERB + 200 * ease(2600, 3500, e) ** 2;
    open = e >= 1150 && e < 1650;
    me = e < 1500 ? door + (seat - door) * ease(0, 1200, e) : null;
    fade = ease(3400, LEAVE_MS, e);
  } else {
    carX = KERB - 240 * (1 - ease(0, 1500, e)) ** 2;
    open = e >= 1700 && e < 2350;
    me = e >= 1900 && e < 3500 ? seat + (door - seat) * ease(2300, 3400, e) : null;
    fade = 1 - ease(0, 500, e);
  }
  const walking = me !== null && (leaving ? e < 1200 : e >= 2300);
  const [top, mid, low, night] = sky(hour), lights = hour < 7 || hour >= 19;
  const puffs = leaving ? [0, 1, 2, 3].map((i) => ease(1950 + i * 220, 2650 + i * 220, e)).filter((p) => p > 0 && p < 1) : [];

  return (
    <div className="travel travel-scene" role="dialog" aria-label={place.name}>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="60" fill={top} />
        <rect y="60" width="320" height="86" fill={mid} />
        <rect y="104" width="320" height="42" fill={low} />
        <rect y="52" width="320" height="8" fill={mid} opacity="0.5" />
        <rect y="96" width="320" height="8" fill={low} opacity="0.5" />
        {night && [[20, 12], [70, 30], [130, 8], [190, 24], [250, 14], [300, 40], [160, 50], [40, 56], [225, 44], [95, 18]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={x % 3 ? 0.6 : 0.9} fill="oklch(0.95 0.02 90)" />)}
        {house ? <House door={door} night={night} /> : office ? <OfficeFront door={door} name={company} building={place.name} night={night} /> : <Datacenter door={door} name={place.dc ? dcProvider(datacenterById(place.dc).provider).name : place.name} provider={place.dc ? datacenterById(place.dc).provider : null} night={night} />}
        <Street night={night} />
        <Lamp x={168} on={lights} />
        <Car x={carX} open={open} lights={lights} taxi={taxi} night={night} />
        {puffs.map((p, i) => <circle key={i} cx={carX - 4 - p * 14} cy={GROUND - 8 - p * 10} r={1.5 + p * 3} fill="oklch(0.88 0.005 255)" opacity={0.7 * (1 - p)} />)}
        {me !== null && <Avatar x={me} step={walking ? Math.floor(e / 140) % 2 : -1} dir={leaving ? 1 : -1} night={night} />}
      </svg>
      <div className="travel-fade" style={{ opacity: fade }} />
    </div>
  );
}

// Night makes every surface one flat step darker.
const dim = (night: boolean) => (night ? 0.72 : 1);

// Pavement slabs, the kerb stone and the road with its centre line.
function Street({ night }: { night: boolean }) {
  return (
    <g style={{ filter: `brightness(${dim(night)})` }}>
      <rect y={GROUND - 6} width="320" height="6" fill="oklch(0.74 0.006 255)" />
      {Array.from({ length: 20 }, (_, i) => <rect key={i} x={i * 16} y={GROUND - 6} width="0.6" height="6" fill="oklch(0.66 0.006 255)" />)}
      <rect y={GROUND - 1} width="320" height="1" fill="oklch(0.68 0.006 255)" />
      <rect y={GROUND} width="320" height="2" fill="oklch(0.58 0.006 255)" />
      <rect y={GROUND + 2} width="320" height={180 - GROUND} fill="oklch(0.34 0.008 255)" />
      <rect y={GROUND + 2} width="320" height="1" fill="oklch(0.29 0.008 255)" />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x={i * 44 + 8} y="164" width="18" height="2" rx="0.5" fill="oklch(0.84 0.03 90)" />)}
    </g>
  );
}

// Drawn outside the dimmed wall so a lit pane keeps its glow at night.
function Window({ x, y, lit, night }: { x: number; y: number; lit: boolean; night: boolean }) {
  const frame = "oklch(0.95 0.01 90)", d = { filter: `brightness(${dim(night)})` };
  return (
    <g>
      <rect x={x - 1} y={y - 1} width="16" height="16" fill={frame} style={d} />
      <rect x={x} y={y} width="14" height="14" fill={lit ? "oklch(0.86 0.12 85)" : "oklch(0.62 0.06 235)"} style={lit ? undefined : d} />
      <g style={d}>
        {!lit && <path d={`M${x + 2},${y + 5} L${x + 5},${y + 2} M${x + 9},${y + 13} L${x + 13},${y + 9}`} stroke="white" strokeWidth="0.6" opacity="0.7" />}
        <rect x={x + 6.5} y={y} width="1" height="14" fill={frame} />
        <rect x={x} y={y + 6.5} width="14" height="1" fill={frame} />
        <rect x={x - 1} y={y - 1} width="16" height="0.6" fill="oklch(0.82 0.01 90)" />
        <rect x={x - 2} y={y + 15} width="18" height="1.4" fill="oklch(0.86 0.01 90)" />
        <rect x={x - 2} y={y + 16.4} width="18" height="0.6" fill="oklch(0.7 0.01 90)" />
      </g>
    </g>
  );
}

function House({ door, night }: { door: number; night: boolean }) {
  const brick = "oklch(0.58 0.1 38)", brickDark = "oklch(0.5 0.1 36)", course = "oklch(0.54 0.09 37)";
  return (
    <>
      <g style={{ filter: `brightness(${dim(night)})` }}>
        <rect x="111" y="56" width="8" height="18" fill={brick} />
        <rect x="116" y="56" width="3" height="18" fill={brickDark} />
        <rect x="110" y="54" width="10" height="2.5" fill="oklch(0.62 0.01 255)" />
        <polygon points="34,86 85,56 136,86" fill="oklch(0.44 0.09 30)" />
        <polygon points="85,56 136,86 85,86" fill="oklch(0.39 0.085 29)" />
        {[64, 70, 76, 82].map((y) => <rect key={y} x={85 - (y - 56) * 1.7} y={y} width={(y - 56) * 3.4} height="0.6" fill="oklch(0.35 0.08 29)" />)}
        <rect x="40" y="86" width="90" height={GROUND - 6 - 86} fill={brick} />
        <rect x="126" y="86" width="4" height={GROUND - 6 - 86} fill={brickDark} />
        {[95, 104, 113, 122, 131].map((y) => <rect key={y} x="40" y={y} width="86" height="0.5" fill={course} />)}
        <rect x="40" y="86" width="90" height="3" fill={brickDark} />
        <rect x="32" y="85" width="106" height="1.8" fill="oklch(0.92 0.01 90)" />
        <rect x="40" y={GROUND - 10} width="90" height="4" fill="oklch(0.6 0.008 255)" />
        <rect x="47" y="129" width="16" height="7" fill="oklch(0.66 0.008 255)" />
        <rect x={door - 7} y="113" width="14" height="27" fill="oklch(0.95 0.01 90)" />
        <rect x={door - 6} y="114" width="12" height="26" fill="oklch(0.46 0.08 50)" />
        <rect x={door + 4} y="114" width="2" height="26" fill="oklch(0.4 0.07 48)" />
        <rect x={door - 4} y="117" width="7" height="6" fill="oklch(0.41 0.07 49)" />
        <rect x={door - 4} y="126" width="7" height="10" fill="oklch(0.41 0.07 49)" />
        <circle cx={door + 3} cy="127" r="0.9" fill="oklch(0.84 0.12 90)" />
        <rect x={door - 9} y={GROUND - 7.5} width="18" height="1.5" fill="oklch(0.66 0.006 255)" />
      </g>
      <Window x={50} y={96} lit={false} night={night} />
      <Window x={106} y={96} lit night={night} />
      <rect x="48" y="130" width="14" height="5" fill={night ? "oklch(0.7 0.13 262)" : "oklch(0.45 0.07 250)"} />
    </>
  );
}

// An office building: rows of windows over a glass entrance, the company's plate beside the door and the building's name above it.
function OfficeFront({ door, name, building, night }: { door: number; name: string; building: string; night: boolean }) {
  const wall = "oklch(0.8 0.012 80)", edge = "oklch(0.7 0.014 75)";
  return (
    <g>
      <g style={{ filter: `brightness(${dim(night)})` }}>
        <rect x="10" y="30" width="140" height={GROUND - 6 - 30} fill={wall} />
        <rect x="145" y="30" width="5" height={GROUND - 6 - 30} fill={edge} />
        <rect x="8" y="27" width="144" height="4" fill="oklch(0.86 0.01 80)" />
        <rect x="8" y="30.4" width="144" height="0.6" fill={edge} />
        {[54, 74, 94].map((y) => <rect key={y} x="10" y={y} width="135" height="0.6" fill={edge} />)}
        <rect x="10" y={GROUND - 12} width="140" height="6" fill="oklch(0.6 0.008 255)" />
        <rect x="36" y="96" width="48" height="8" fill="oklch(0.96 0.005 255)" />
        <rect x="36" y="103.4" width="48" height="0.6" fill="oklch(0.8 0.005 255)" />
        <text x="60" y="102" textAnchor="middle" className="tr-plate">{building}</text>
        <rect x={door - 13} y="108" width="26" height="32" fill="oklch(0.48 0.01 255)" />
        <rect x={door - 11} y="110" width="10" height="30" fill="oklch(0.66 0.05 225)" />
        <rect x={door + 1} y="110" width="10" height="30" fill="oklch(0.66 0.05 225)" />
        <path d={`M${door - 10},${116} L${door - 5},${111} M${door + 2},${116} L${door + 7},${111}`} stroke="white" strokeWidth="0.6" opacity="0.7" />
        <rect x={door - 2.5} y="122" width="1" height="6" rx="0.5" fill="oklch(0.88 0.01 255)" />
        <rect x={door + 1.5} y="122" width="1" height="6" rx="0.5" fill="oklch(0.88 0.01 255)" />
        <rect x={door + 17} y="114" width="34" height="12" fill="oklch(0.82 0.07 80)" />
        <rect x={door + 17} y="125.4" width="34" height="0.6" fill="oklch(0.68 0.07 75)" />
        <text x={door + 34} y="122" textAnchor="middle" className="tr-plate" textLength="30" lengthAdjust="spacingAndGlyphs">{name}</text>
        {[124, 128, 132].map((y) => <g key={y}><rect x={door + 19} y={y} width="6" height="2.4" fill="oklch(0.62 0.01 255)" /><rect x={door + 20} y={y + 0.8} width="4" height="0.6" fill="oklch(0.4 0.01 255)" /></g>)}
      </g>
      {[38, 58, 78].map((y) => [18, 40, 62, 84, 106, 128].map((x, i) => {
        const lit = night && (x + y + i) % 3 === 0;
        return (
          <g key={`${x}-${y}`}>
            <rect x={x - 1} y={y - 1} width="18" height="14" fill="oklch(0.92 0.005 255)" style={{ filter: `brightness(${dim(night)})` }} />
            <rect x={x} y={y} width="16" height="12" fill={lit ? "oklch(0.86 0.12 85)" : night ? "oklch(0.4 0.05 240)" : "oklch(0.62 0.06 235)"} />
            <rect x={x + 7.6} y={y} width="0.8" height="12" fill="oklch(0.92 0.005 255)" />
            {!lit && <path d={`M${x + 2},${y + 5} L${x + 5},${y + 2}`} stroke="white" strokeWidth="0.6" opacity="0.6" />}
          </g>
        );
      }))}
    </g>
  );
}

function Datacenter({ door, name, provider, night }: { door: number; name: string; provider: string | null; night: boolean }) {
  const wall = "oklch(0.72 0.006 255)", edge = "oklch(0.62 0.006 255)";
  return (
    <g style={{ filter: `brightness(${dim(night)})` }}>
      <rect x="6" y="66" width="150" height={GROUND - 6 - 66} fill={wall} />
      <rect x="151" y="66" width="5" height={GROUND - 6 - 66} fill={edge} />
      <rect x="4" y="64" width="154" height="5" fill="oklch(0.6 0.006 255)" />
      <rect x="4" y="64" width="154" height="1.2" fill="oklch(0.68 0.006 255)" />
      {[30, 54, 78, 102, 126].map((x) => <rect key={x} x={x} y="69" width="0.6" height={GROUND - 6 - 69} fill={edge} />)}
      <rect x="6" y={GROUND - 10} width="145" height="4" fill="oklch(0.58 0.006 255)" />
      {[80, 92].map((y) => [100, 112, 124, 136].map((x) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="10" height="8" fill="oklch(0.56 0.006 255)" />
          {[1.5, 3.5, 5.5].map((d) => <rect key={d} x={x + 0.5} y={y + d} width="9" height="1" fill="oklch(0.44 0.006 255)" />)}
        </g>
      )))}
      <rect x="20" y="78" width="66" height="14" fill="oklch(0.96 0.005 255)" />
      <rect x="20" y="91.4" width="66" height="0.6" fill="oklch(0.8 0.005 255)" />
      {provider && hasMark(provider) ? <g transform="translate(22 80)"><Logo provider={provider} size={10} /></g> : <rect x="22" y="80" width="4" height="10" fill="oklch(0.53 0.19 262)" />}
      <text x="57" y="88.5" textAnchor="middle" className="tr-plate">{name}</text>
      <rect x={door - 11} y="110" width="22" height="30" fill="oklch(0.46 0.01 255)" />
      <rect x={door - 9} y="112" width="8" height="28" fill="oklch(0.6 0.05 225)" />
      <rect x={door + 1} y="112" width="8" height="28" fill="oklch(0.6 0.05 225)" />
      <path d={`M${door - 8},${118} L${door - 4},${114} M${door + 2},${118} L${door + 6},${114}`} stroke="white" strokeWidth="0.6" opacity="0.7" />
      <rect x={door + 14} y="122" width="4" height="6" fill="oklch(0.36 0.01 255)" />
      <circle cx={door + 16} cy="124" r="0.9" fill="oklch(0.75 0.17 145)" />
      <rect x={door + 15} y="126" width="2" height="0.8" fill="oklch(0.55 0.01 255)" />
      {[[10, 1], [150, -1]].map(([x, d]) => (
        <g key={x} transform={`translate(${x} 72) scale(${d} 1)`}>
          <rect x="0" y="0" width="3" height="1" fill="oklch(0.42 0.006 255)" />
          <rect x="1" y="1" width="7" height="3.4" rx="1" fill="oklch(0.9 0.005 255)" />
          <rect x="1" y="3.6" width="7" height="0.8" fill="oklch(0.76 0.005 255)" />
          <circle cx="8" cy="2.6" r="0.9" fill="oklch(0.35 0.01 255)" />
          <circle cx="6" cy="2" r="0.4" fill="oklch(0.6 0.2 25)" />
        </g>
      ))}
    </g>
  );
}

function Lamp({ x, on }: { x: number; on: boolean }) {
  const metal = "oklch(0.4 0.01 255)", lit = "oklch(0.48 0.01 255)";
  return (
    <g>
      {on && <polygon points={`${x - 3},95 ${x + 3},95 ${x + 14},${GROUND} ${x - 20},${GROUND}`} fill="oklch(0.92 0.1 90)" opacity="0.12" />}
      <rect x={x} y="92" width="2" height={GROUND - 92} fill={metal} />
      <rect x={x} y="92" width="0.7" height={GROUND - 92} fill={lit} />
      <rect x={x - 1} y={GROUND - 9} width="4" height="7" rx="1" fill={metal} />
      <rect x={x - 1.5} y={GROUND - 2.5} width="5" height="2.5" fill="oklch(0.34 0.01 255)" />
      <path d={`M${x - 4},94 Q${x},88 ${x + 4},94 Z`} fill={lit} />
      <rect x={x - 4} y="93.4" width="8" height="0.8" fill="oklch(0.32 0.01 255)" />
      <ellipse cx={x} cy="94.6" rx="2.6" ry="1" fill={on ? "oklch(0.96 0.12 92)" : "oklch(0.76 0.02 90)"} />
    </g>
  );
}

function Wheel({ x }: { x: number }) {
  const cy = GROUND - 4;
  return (
    <g>
      <circle cx={x + 4} cy={cy} r="4.2" fill="oklch(0.22 0.01 255)" />
      <circle cx={x + 4} cy={cy} r="2.4" fill="oklch(0.76 0.006 255)" />
      <circle cx={x + 4} cy={cy} r="2.4" fill="none" stroke="oklch(0.6 0.006 255)" strokeWidth="0.5" />
      <circle cx={x + 4} cy={cy} r="0.8" fill="oklch(0.5 0.006 255)" />
    </g>
  );
}

// The taxi is ivory with a roof sign and no company stripe.
function Car({ x, open, lights, taxi, night }: { x: number; open: boolean; lights: boolean; taxi: boolean; night: boolean }) {
  const top = taxi ? "oklch(0.96 0.04 95)" : "oklch(0.97 0.006 255)", body = taxi ? "oklch(0.9 0.05 92)" : "oklch(0.91 0.01 255)", shade = taxi ? "oklch(0.78 0.06 88)" : "oklch(0.78 0.012 255)";
  const edge = taxi ? "oklch(0.72 0.06 86)" : "oklch(0.7 0.012 255)", glass = "oklch(0.62 0.06 235)";
  return (
    <g transform={`translate(${x} 0)`}>
      {lights && <polygon points={`44,131 80,127 80,${GROUND} 44,135`} fill="oklch(0.95 0.12 95)" opacity="0.16" />}
      <g style={{ filter: `brightness(${dim(night)})` }}>
        {taxi && <><rect x="16" y="115" width="10" height="4.5" rx="1" fill="oklch(0.88 0.14 95)" /><rect x="16" y="118" width="10" height="1.5" fill="oklch(0.76 0.13 90)" /><rect x="18" y="116.2" width="6" height="0.8" fill="oklch(0.45 0.08 85)" /></>}
        <path d="M7,128 L11.5,120.5 Q12,120 13,120 L30,120 Q31,120 31.6,120.6 L37,128 Z" fill={top} />
        <polygon points="10,127 13.4,122 20,122 20,127" fill={glass} />
        <polygon points="22,127 22,122 30,122 34,127" fill={glass} />
        <path d="M13,126 L16,122.6 M24,126 L27,122.6" stroke="white" strokeWidth="0.6" opacity="0.7" />
        <rect x="0" y="127" width="44" height="12" rx="2" fill={body} />
        <rect x="0" y="127" width="44" height="1.4" rx="0.7" fill={top} />
        <rect x="0.5" y="134" width="43" height="5" rx="1.5" fill={shade} />
        {!taxi && <rect x="1" y="132" width="42" height="1" fill="oklch(0.53 0.19 262)" />}
        <rect x="0" y="129" width="2" height="3" rx="0.6" fill="oklch(0.58 0.19 25)" />
        <rect x="42" y="129" width="2" height="3" rx="0.6" fill={lights ? "oklch(0.97 0.12 95)" : "oklch(0.86 0.04 90)"} />
        <rect x="25" y="130" width="3" height="0.8" rx="0.4" fill={edge} />
        {open
          ? <><rect x="13" y="121" width="9" height="16" fill="oklch(0.3 0.01 255)" /><rect x="9" y="120" width="4" height="18" rx="0.8" fill={shade} /><rect x="9" y="120" width="1" height="18" fill={edge} /></>
          : <rect x="21" y="121" width="0.7" height="16" fill={edge} />}
        <Wheel x={5} />
        <Wheel x={31} />
      </g>
    </g>
  );
}

// The room's figure in side view at street scale, facing the way it walks.
function Avatar({ x, step, dir, night }: { x: number; step: number; dir: 1 | -1; night: boolean }) {
  const skin = "oklch(0.82 0.06 60)", hair = "oklch(0.3 0.03 50)", pants = "oklch(0.35 0.04 255)", shirt = "oklch(0.55 0.15 262)";
  const s = step < 0 ? 0 : step ? 5 : -5;
  return (
    <g transform={`translate(${x} ${GROUND - 6}) scale(${0.5 * dir} 0.5)`} style={{ filter: `brightness(${dim(night)})` }}>
      <path stroke="oklch(0.29 0.04 255)" strokeWidth="5" strokeLinecap="round" d={`M0,-24 L${-s},-2`} />
      <path stroke={pants} strokeWidth="5" strokeLinecap="round" d={`M0,-24 L${s},-2`} />
      <rect x="-6" y="-44" width="12" height="22" rx="5.5" fill={shirt} />
      <path stroke="oklch(0.48 0.15 262)" strokeWidth="3.4" strokeLinecap="round" fill="none" d={`M0,-40 L${-s * 0.8},-27`} />
      <circle cx={-s * 0.8} cy="-26" r="1.8" fill={skin} />
      <circle cx="0" cy="-51" r="7" fill={skin} />
      <circle cx="6.8" cy="-50" r="1.4" fill={skin} />
      <path fill={hair} d="M-7,-49 A7,7 0 0 1 6,-55 L1,-54 L-1,-49.5 Z" />
      <circle cx="3.6" cy="-52" r="0.8" fill="oklch(0.25 0.02 260)" />
    </g>
  );
}
