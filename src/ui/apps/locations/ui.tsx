import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BASEMENT, CONTINUOUS, datacenterById, SHARE_RACKS, type Datacenter } from "../../../sim/20-world/datacenters";
import type { GameState, Location } from "../../../sim/50-state";
import { rackPower } from "../../../sim/60-infra/status";
import type { Usage } from "../../../sim/60-infra/usage";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";

export const dcOf = (l: Location): Datacenter | null => (l.dc ? datacenterById(l.dc) : null);
export const providerOf = (l: Location) => dcOf(l)?.provider ?? null;
export const Zone = ({ loc }: { loc: Location }) => <span className="loc-az num">{loc.az}</span>;
export const LocName = ({ loc }: { loc: Location }) => <span className="loc-name">{loc.name}<Zone loc={loc} /></span>;
export const positionsLabel = (n: number) => t("locations-2.nPositions", { n });
export const SPACE_NAME = { basement: t("locations-2.space.basement"), share: t("locations-2.space.share"), cage: t("locations-2.space.cage"), suite: t("locations-2.space.suite") };
// A share of size n is 1/n of a rack.
export const shareLabel = (n: number) => (n === 1 ? t("locations-2.fullRack") : t("locations-2.shareRack", { n }));
// A rented space and its size, as offered: "1/4 rack", "Cage, 8 positions".
export const spaceSize = (space: Exclude<Location["space"], "basement">, size: number) =>
  space === "share" ? shareLabel(size) : t("locations-2.spaceSize", { space: SPACE_NAME[space], positions: positionsLabel(size) });
export const shareUnits = (n: number) => SHARE_RACKS.find((m) => m.size === n)?.units ?? 0;
const shareOf = (g: GameState, l: Location) => SHARE_RACKS.find((m) => g.racks.some((r) => r.locationId === l.id && r.model === m.id));
export function spaceLabel(l: Location, g?: GameState) {
  if (l.space === "basement") return SPACE_NAME.basement;
  if (l.space === "share") { const m = g && shareOf(g, l); return m ? t("locations-2.shareUnits", { share: shareLabel(m.size), units: m.units }) : SPACE_NAME.share; }
  return t("locations-2.spaceSize", { space: SPACE_NAME[l.space], positions: positionsLabel(l.positions) });
}

export function locationPower(g: GameState, locId: string) {
  const loc = g.locations.find((l) => l.id === locId)!, dc = dcOf(loc);
  const racks = g.racks.filter((r) => r.locationId === locId).map((r) => rackPower(g, r.id));
  const limit = loc.space === "share" ? racks.reduce((n, p) => n + p.limitWatts, 0) : 1000 * loc.positions * (dc ? dc.kwPerPosition : BASEMENT.kw);
  return { watts: racks.reduce((n, p) => n + p.watts, 0), limit, tripped: racks.some((p) => p.tripped) };
}

export const exchangeLabel = (dc: Datacenter | null) => (!dc?.exchange ? t("locations-2.none") : t("locations-2.exchangeAt", { name: dc.exchange.name, onSite: dc.exchange.onSite ? 1 : 0 }));
export const feedsLabel = (dc: Datacenter | null) => (dc?.feeds === "ab" ? t("locations-2.feedsAb") : t("locations-2.feedSingle"));
export const backupLabel = (dc: Datacenter | null) => (dc?.backup === "ups+generator" ? t("locations-2.backupUpsGen") : dc?.backup === "ups" ? t("locations-2.backupUps") : t("locations-2.noBackup"));

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
        <div className="loc-sheet-h"><h2>{title}</h2><span className="grow" /><button className="btn ghost icon" aria-label={t("locations-2.close")} onClick={onClose}><X /></button></div>
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
// Twenty LEDs: the last 2 red, the 4 before them orange; lit up to the share in use.
export function LedBar({ value }: { value: number }) {
  const lit = Math.ceil(value * 20 - 1e-9);
  return (
    <span className="led-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      {Array.from({ length: 20 }, (_, i) => <span key={i} className={`${i >= 18 ? "r" : i >= 14 ? "o" : "g"}${i < lit ? " on" : ""}`} />)}
    </span>
  );
}

const USAGE_ROWS: [string, keyof Usage][] = [[t("locations-2.usage.cpu"), "cpu"], [t("locations-2.usage.ram"), "ram"], [t("locations-2.usage.disk"), "disk"], [t("locations-2.usage.net"), "net"]];
export function UsageBars({ usage, only, wide }: { usage: Usage; only?: (keyof Usage)[]; wide?: boolean }) {
  return (
    <div className={`usage${wide ? " wide" : ""}`}>
      {USAGE_ROWS.filter(([, k]) => !only || only.includes(k)).map(([label, k]) => (
        <div className="usage-row" key={k}>
          <span className="loc-k">{label}</span>
          <LedBar value={usage[k]} />
          <span className="num">{Math.ceil(usage[k] * 100 - 1e-9)}%</span>
        </div>
      ))}
    </div>
  );
}

export function PowerMeter({ watts, limit, tripped }: { watts: number; limit: number; tripped?: boolean }) {
  const f = limit ? Math.min(1, watts / limit) : 0;
  return (
    <span className={`loc-meter${tripped ? " tripped" : f > CONTINUOUS.share ? " over" : ""}`}>
      <span className="loc-meter-bar"><span style={{ width: `${f * 100}%` }} /><i style={{ left: `${CONTINUOUS.share * 100}%` }} /></span>
      <span className="num">{Math.round(watts).toLocaleString(LOCALE)} / {Math.round(limit).toLocaleString(LOCALE)} W</span>
    </span>
  );
}
