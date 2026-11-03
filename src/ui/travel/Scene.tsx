import { useEffect, useRef, useState } from "react";
import { dateOf } from "../../sim/00-core/time";
import { datacenterById, dcProvider } from "../../sim/20-world/datacenters";
import type { Location } from "../../sim/50-state";
import { hasMark, Logo } from "../art/logos";
import { useStore } from "../store";
import { useTrip } from "./route";
import { carDoor, engineStart, engineStop } from "./sounds";

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

const INK = "oklch(0.2 0.015 260)";
const LEAVE_MS = 4000, ARRIVE_MS = 3900, KERB = 196, GROUND = 146;
const ease = (a: number, b: number, e: number) => Math.max(0, Math.min(1, (e - a) / (b - a)));

// Sky bands top to bottom by the hour of day.
function sky(h: number): [string, string, boolean] {
  if (h < 5 || h >= 21) return ["oklch(0.18 0.05 270)", "oklch(0.21 0.055 268)", true];
  if (h < 8) return ["oklch(0.55 0.08 270)", "oklch(0.78 0.1 50)", false];
  if (h < 18) return ["oklch(0.74 0.08 240)", "oklch(0.84 0.05 230)", false];
  return ["oklch(0.42 0.1 300)", "oklch(0.68 0.14 40)", false];
}

// Side view of the street: the building, the company car at the kerb and the avatar.
export function Scene({ place, leaving }: { place: Location; leaving: boolean }) {
  const e = useElapsed(), send = useTrip((s) => s.send), hour = useStore((s) => dateOf(s.game.hour).getUTCHours());
  const fired = useRef(new Set<string>());
  const end = () => {
    if (!leaving) { const s = useStore.getState(), trip = useTrip.getState().trip; if (trip && !s.alert) s.setSpeed(trip.resume); }
    send("done");
  };
  useSkip(end);
  const cues: [string, number, () => void][] = leaving
    ? [["shut", 1650, carDoor], ["start", 1900, engineStart]]
    : [["stop", 1500, engineStop], ["open", 1700, carDoor], ["shut", 2350, carDoor]];
  for (const [id, at, play] of cues) if (e >= at && !fired.current.has(id)) { fired.current.add(id); play(); }
  useEffect(() => { if (e >= (leaving ? LEAVE_MS : ARRIVE_MS)) end(); });

  const house = place.space === "basement", door = house ? 84 : 38, seat = KERB + 16;
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
  const [top, low, night] = sky(hour), lights = hour < 7 || hour >= 19;
  const puffs = leaving ? [0, 1, 2, 3].map((i) => ease(1950 + i * 220, 2650 + i * 220, e)).filter((p) => p > 0 && p < 1) : [];

  return (
    <div className="travel travel-scene" role="dialog" aria-label={place.name}>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges">
        <defs>
          <pattern id="tr-brick" width="8" height="4" patternUnits="userSpaceOnUse">
            <rect width="8" height="4" fill="oklch(0.56 0.11 38)" />
            <rect y="3" width="8" height="1" fill="oklch(0.74 0.03 70)" />
            <rect x="3" width="1" height="3" fill="oklch(0.74 0.03 70)" />
            <rect x="5" y="1" width="2" height="1" fill="oklch(0.6 0.11 38)" />
          </pattern>
          <pattern id="tr-plaster" width="6" height="5" patternUnits="userSpaceOnUse">
            <rect width="6" height="5" fill="oklch(0.66 0.006 255)" />
            <rect x="1" y="1" width="1" height="1" fill="oklch(0.62 0.006 255)" />
            <rect x="4" y="3" width="1" height="1" fill="oklch(0.7 0.006 255)" />
          </pattern>
        </defs>
        <rect width="320" height="70" fill={top} />
        <rect y="70" width="320" height="76" fill={low} />
        {night && [[20, 12], [70, 30], [130, 8], [190, 24], [250, 14], [300, 40], [160, 50], [40, 56]].map(([x, y]) => <rect key={x} x={x} y={y} width="1" height="1" fill="oklch(0.95 0.02 90)" />)}
        {house ? <House door={door} night={night} /> : <Datacenter door={door} name={place.dc ? dcProvider(datacenterById(place.dc).provider).name : place.name} provider={place.dc ? datacenterById(place.dc).provider : null} />}
        <rect y={GROUND - 6} width="320" height="6" fill="oklch(0.7 0.006 255)" />
        {Array.from({ length: 20 }, (_, i) => <rect key={i} x={i * 16} y={GROUND - 6} width="1" height="6" fill="oklch(0.62 0.006 255)" />)}
        <rect y={GROUND} width="320" height="2" fill="oklch(0.55 0.006 255)" />
        <rect y={GROUND + 2} width="320" height={178 - GROUND} fill="oklch(0.3 0.008 255)" />
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x={i * 44 + 8} y="164" width="18" height="2" fill="oklch(0.82 0.03 90)" />)}
        <Lamp x={168} on={lights} />
        <Car x={Math.round(carX)} open={open} lights={lights} />
        {puffs.map((p, i) => { const s = 2 + Math.round(p * 4); return <rect key={i} x={Math.round(carX - 3 - p * 14 - s)} y={Math.round(GROUND - 6 - p * 10)} width={s} height={s} fill={`oklch(0.85 0.005 255 / ${1 - p})`} />; })}
        {me !== null && <Avatar x={Math.round(me)} step={walking ? Math.floor(e / 140) % 2 : 0} />}
      </svg>
      <div className="travel-fade" style={{ opacity: fade }} />
    </div>
  );
}

function Window({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g>
      <rect x={x - 1} y={y - 1} width="16" height="16" fill="oklch(0.95 0.01 90)" />
      <rect x={x} y={y} width="14" height="14" fill={lit ? "oklch(0.86 0.13 85)" : "oklch(0.45 0.05 240)"} />
      {!lit && <rect x={x + 1} y={y + 1} width="3" height="3" fill="oklch(0.6 0.05 240)" />}
      <rect x={x + 6} y={y} width="2" height="14" fill="oklch(0.95 0.01 90)" />
      <rect x={x} y={y + 6} width="14" height="2" fill="oklch(0.95 0.01 90)" />
      <rect x={x - 2} y={y + 15} width="18" height="2" fill="oklch(0.8 0.01 90)" />
    </g>
  );
}

function House({ door, night }: { door: number; night: boolean }) {
  return (
    <g>
      <rect x="111" y="56" width="8" height="16" fill="url(#tr-brick)" stroke={INK} />
      <polygon points="34,86 85,56 136,86" fill="oklch(0.42 0.08 30)" stroke={INK} />
      {[64, 70, 76, 82].map((y) => <rect key={y} x={85 - (y - 56) * 1.7} y={y} width={(y - 56) * 3.4} height="1" fill="oklch(0.36 0.08 30)" />)}
      <rect x="40" y="86" width="90" height={GROUND - 6 - 86} fill="url(#tr-brick)" stroke={INK} />
      <Window x={50} y={96} lit={false} />
      <Window x={106} y={96} lit />
      <rect x="48" y="130" width="14" height="6" fill={INK} />
      <rect x="49" y="131" width="12" height="4" fill={night ? "oklch(0.6 0.15 262)" : "oklch(0.4 0.08 262)"} />
      <rect x={door - 7} y="113" width="14" height="27" fill="oklch(0.95 0.01 90)" />
      <rect x={door - 6} y="114" width="12" height="26" fill="oklch(0.45 0.08 50)" stroke={INK} strokeWidth="0.5" />
      <rect x={door - 4} y="117" width="8" height="6" fill="oklch(0.4 0.07 50)" />
      <rect x={door - 4} y="126" width="8" height="10" fill="oklch(0.4 0.07 50)" />
      <rect x={door + 3} y="126" width="2" height="1" fill="oklch(0.85 0.12 90)" />
      <rect x={door - 9} y={GROUND - 7} width="18" height="1" fill="oklch(0.6 0.006 255)" />
    </g>
  );
}

function Datacenter({ door, name, provider }: { door: number; name: string; provider: string | null }) {
  return (
    <g>
      <rect x="6" y="66" width="150" height={GROUND - 6 - 66} fill="url(#tr-plaster)" stroke={INK} />
      <rect x="6" y="66" width="150" height="4" fill="oklch(0.58 0.006 255)" stroke={INK} />
      {[80, 92].map((y) => [100, 112, 124, 136].map((x) => <g key={`${x}-${y}`}><rect x={x} y={y} width="10" height="8" fill="oklch(0.5 0.006 255)" />{[1, 3, 5, 7].map((d) => <rect key={d} x={x} y={y + d} width="10" height="1" fill="oklch(0.4 0.006 255)" />)}</g>))}
      <rect x="20" y="78" width="66" height="14" fill="oklch(0.96 0.005 255)" stroke={INK} />
      {provider && hasMark(provider) ? <g transform="translate(22 80)"><Logo provider={provider} size={10} /></g> : <rect x="22" y="80" width="4" height="10" fill="oklch(0.53 0.19 262)" />}
      <text x="57" y="88.5" textAnchor="middle" className="tr-plate">{name}</text>
      <rect x={door - 11} y="110" width="22" height="30" fill="oklch(0.42 0.01 255)" stroke={INK} />
      <rect x={door - 9} y="112" width="8" height="28" fill="oklch(0.55 0.05 225)" />
      <rect x={door + 1} y="112" width="8" height="28" fill="oklch(0.55 0.05 225)" />
      <rect x={door - 8} y="113" width="2" height="8" fill="oklch(0.7 0.05 225)" />
      <rect x={door + 2} y="113" width="2" height="8" fill="oklch(0.7 0.05 225)" />
      <rect x={door + 14} y="122" width="4" height="6" fill={INK} />
      <rect x={door + 15} y="123" width="2" height="2" fill="oklch(0.75 0.17 145)" />
      <rect x={door + 15} y="126" width="2" height="1" fill="oklch(0.45 0.01 255)" />
      {[[10, 1], [150, -1]].map(([x, d]) => (
        <g key={x}>
          <rect x={d > 0 ? x : x - 3} y="72" width="3" height="1" fill={INK} />
          <rect x={d > 0 ? x + 1 : x - 7} y="73" width="6" height="3" fill="oklch(0.88 0.005 255)" stroke={INK} strokeWidth="0.5" />
          <rect x={d > 0 ? x + 6 : x - 7} y="74" width="1" height="1" fill="oklch(0.6 0.2 25)" />
        </g>
      ))}
    </g>
  );
}

function Lamp({ x, on }: { x: number; on: boolean }) {
  return (
    <g>
      {on && <polygon points={`${x - 2},94 ${x + 6},94 ${x + 16},${GROUND} ${x - 12},${GROUND}`} fill="oklch(0.9 0.12 90 / 0.18)" />}
      <rect x={x} y="92" width="2" height={GROUND - 92} fill="oklch(0.32 0.01 255)" />
      <rect x={x - 3} y="90" width="8" height="3" fill="oklch(0.32 0.01 255)" />
      <rect x={x - 2} y="93" width="6" height="1" fill={on ? "oklch(0.95 0.12 90)" : "oklch(0.7 0.02 90)"} />
      <rect x={x - 1} y={GROUND - 2} width="4" height="2" fill="oklch(0.32 0.01 255)" />
    </g>
  );
}

function Wheel({ x }: { x: number }) {
  const y = GROUND - 8;
  return (
    <g>
      <rect x={x + 1} y={y} width="6" height="8" fill="oklch(0.15 0.01 255)" />
      <rect x={x} y={y + 1} width="8" height="6" fill="oklch(0.15 0.01 255)" />
      <rect x={x + 2} y={y + 2} width="4" height="4" fill="oklch(0.7 0.006 255)" />
      <rect x={x + 3} y={y + 3} width="2" height="2" fill="oklch(0.45 0.006 255)" />
    </g>
  );
}

function Car({ x, open, lights }: { x: number; open: boolean; lights: boolean }) {
  const body = "oklch(0.93 0.01 255)", shade = "oklch(0.8 0.01 255)", glass = "oklch(0.55 0.06 235)";
  return (
    <g transform={`translate(${x} 0)`}>
      {lights && <polygon points={`44,131 76,128 76,${GROUND} 44,135`} fill="oklch(0.95 0.12 95 / 0.22)" />}
      <rect x="11" y="119" width="20" height="1" fill={INK} />
      <polygon points="7,128 11,120 31,120 37,128" fill={body} stroke={INK} />
      <polygon points="10,127 13,122 20,122 20,127" fill={glass} />
      <polygon points="22,127 22,122 30,122 34,127" fill={glass} />
      <rect x="0" y="127" width="44" height="12" fill={body} stroke={INK} />
      <rect x="1" y="134" width="42" height="4" fill={shade} />
      <rect x="1" y="132" width="42" height="1" fill="oklch(0.53 0.19 262)" />
      <rect x="0" y="129" width="2" height="3" fill="oklch(0.55 0.2 25)" />
      <rect x="42" y="129" width="2" height="3" fill={lights ? "oklch(0.97 0.12 95)" : "oklch(0.85 0.04 90)"} />
      <rect x="25" y="130" width="3" height="1" fill={INK} />
      {open
        ? <><rect x="13" y="121" width="9" height="16" fill="oklch(0.28 0.01 255)" /><rect x="9" y="120" width="4" height="18" fill={shade} stroke={INK} strokeWidth="0.5" /></>
        : <rect x="21" y="121" width="1" height="16" fill={INK} />}
      <Wheel x={5} />
      <Wheel x={31} />
    </g>
  );
}

// The world's avatar at street scale: legs a third, body two fifths, head the rest.
function Avatar({ x, step }: { x: number; step: number }) {
  const skin = "oklch(0.8 0.06 60)", hair = "oklch(0.32 0.05 50)", pants = "oklch(0.3 0.04 260)";
  return (
    <g transform={`translate(${x - 4} ${GROUND - 32})`}>
      <rect x="1" y="0" width="6" height="7" fill={skin} stroke={INK} strokeWidth="0.5" />
      <rect x="1" y="0" width="6" height="2" fill={hair} />
      <rect x="6" y="2" width="1" height="2" fill={hair} />
      <rect x="4" y="3" width="1" height="1" fill={INK} />
      <rect x="0" y="7" width="8" height="10" fill="oklch(0.53 0.19 262)" stroke={INK} strokeWidth="0.5" />
      <rect x={step ? 2 : 3} y="9" width="2" height="6" fill="oklch(0.45 0.17 262)" />
      <rect x={step ? 0 : 1} y="17" width="3" height="8" fill={pants} />
      <rect x={step ? 5 : 4} y="17" width="3" height="8" fill={pants} />
      <rect x={step ? 0 : 1} y="25" width="3" height="1" fill={INK} />
      <rect x={step ? 5 : 4} y="25" width="3" height="1" fill={INK} />
    </g>
  );
}
