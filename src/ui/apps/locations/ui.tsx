import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BASEMENT, datacenterById, type Datacenter } from "../../../sim/20-world/datacenters";
import type { GameState, Location } from "../../../sim/50-state";
import { rackPower } from "../../../sim/60-infra/status";

export const dcOf = (l: Location): Datacenter | null => (l.dc ? datacenterById(l.dc) : null);
export const providerOf = (l: Location) => dcOf(l)?.provider ?? null;
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
export const positionsLabel = (n: number) => plural(n, "position");
export const SPACE_NAME = { basement: "Basement", positions: "Rack positions", cage: "Cage", suite: "Private suite" };
export const spaceLabel = (l: Location) => (l.space === "basement" ? "Basement" : l.space === "positions" ? positionsLabel(l.positions) : `${SPACE_NAME[l.space]}, ${positionsLabel(l.positions)}`);

export function locationPower(g: GameState, locId: string) {
  const loc = g.locations.find((l) => l.id === locId)!, dc = dcOf(loc);
  const racks = g.racks.filter((r) => r.locationId === locId).map((r) => rackPower(g, r.id));
  return { watts: racks.reduce((n, p) => n + p.watts, 0), limit: 1000 * loc.positions * (dc ? dc.kwPerPosition : BASEMENT.kw), tripped: racks.some((p) => p.tripped) };
}

export const exchangeLabel = (dc: Datacenter | null) => (!dc?.exchange ? "None" : `${dc.exchange.name} ${dc.exchange.onSite ? "on site" : "by cross-connect"}`);
export const feedsLabel = (dc: Datacenter | null) => (dc?.feeds === "ab" ? "A+B feeds" : "Single feed");
export const backupLabel = (dc: Datacenter | null) => (dc?.backup === "ups+generator" ? "UPS and generator" : dc?.backup === "ups" ? "UPS" : "No backup");

export function useDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [ref, onClose]);
}

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div ref={ref} className={`loc-sheet${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="loc-sheet-h"><h2>{title}</h2><span className="grow" /><button className="btn ghost icon" aria-label="Close" onClick={onClose}><X /></button></div>
        {children}
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="loc-facts">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

// Power against its limit; a tripped breaker turns the bar red.
export function PowerMeter({ watts, limit, tripped }: { watts: number; limit: number; tripped?: boolean }) {
  const f = limit ? Math.min(1, watts / limit) : 0;
  return (
    <span className={`loc-meter${tripped ? " tripped" : ""}`}>
      <span className="loc-meter-bar"><span style={{ width: `${f * 100}%` }} /></span>
      <span className="num">{Math.round(watts).toLocaleString("en-GB")} / {Math.round(limit).toLocaleString("en-GB")} W</span>
    </span>
  );
}
