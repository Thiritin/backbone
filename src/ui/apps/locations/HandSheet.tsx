import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t as tr } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { SKIP } from "../../../sim/00-core/time";
import { nextSlot, taskFor, urgent, type OpKind } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { FAVOURS_PER_YEAR, handWork, present } from "../../../sim/60-infra/handwork";
import { locationOf } from "../../../sim/60-infra/status";
import { queueOperation } from "../../../sim/90-actions/staff";
import { drive } from "../../../sim/90-actions/travel";
import type { ActionResult } from "../../../sim/90-actions/hardware";
import { place } from "../../desktop/menu";
import { useStore } from "../../store";
import { slotTime } from "./TechButton";

export interface HandTask {
  title: string;
  deviceId: string;
  // The action and its arguments; the way the work gets done (hands, self, friend) is appended as the last argument.
  action: (g: GameState, ...args: any[]) => ActionResult;
  args: unknown[];
  // The location the hands work at when it is not the device's own, like the far end of a server move.
  at?: string;
  // The technician operation that does the same work, when there is one.
  tech?: { kind: OpKind; componentId?: string | null; partId?: string | null; slot?: number; count?: number };
  onDone?: () => void;
}

// Whether the device sits in a datacenter, where hand work has more than one way to get done.
export const atDatacenter = (game: GameState, deviceId: string): boolean => {
  const d = game.devices.find((x) => x.id === deviceId), loc = d && locationOf(game, d);
  return !!loc && !!handWork(game, loc.id);
};

const workLocation = (game: GameState, t: HandTask) => {
  const d = game.devices.find((x) => x.id === t.deviceId);
  return game.locations.find((l) => l.id === t.at) ?? (d && (locationOf(game, d) ?? game.locations.find((l) => l.id === d.store)));
};

// The last click, where the remote hands popover opens; callers start hand work from a click.
let pointer = { x: 0, y: 0 };
if (typeof window !== "undefined") window.addEventListener("pointerdown", (e) => { pointer = { x: e.clientX, y: e.clientY }; }, true);

// Runs the task and skips time to the end of the work it started.
function run(t: HandTask, how: string): ActionResult {
  const { act, setSpeed } = useStore.getState(), r = act(t.action, ...t.args, how);
  if (r.ok && useStore.getState().game.devices.find((d) => d.id === t.deviceId)?.maintenance) setSpeed(SKIP);
  if (r.ok) t.onDone?.();
  return r;
}

// Runs a hand task at once where the player stands, or asks before paying remote hands elsewhere. remote always asks for remote hands.
export function useHandWork(remote = false) {
  const [task, setTask] = useState<{ t: HandTask; x: number; y: number } | null>(null);
  const start = (game: GameState, t: HandTask) => {
    const loc = workLocation(game, t), w = loc && handWork(game, loc.id);
    if (!w) { if (!remote) run(t, "hands"); }
    else if (w.here && !t.at && !remote) run(t, "self");
    else setTask({ t, ...pointer });
  };
  return { start, dialog: task && <HandPopover task={task.t} x={task.x} y={task.y} onClose={() => setTask(null)} /> };
}

function HandPopover({ task, x, y, onClose }: { task: HandTask; x: number; y: number; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setAt(place(x + 4, y + 4, r.width, r.height, innerWidth, innerHeight));
  }, [x, y]);
  useEffect(() => {
    const outside = (e: Event) => { if (!(e.target as Element).closest?.(".hand-pop")) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", esc); };
  }, [onClose]);
  // The remote hands bill, read from a trial run on a copy of the game.
  const trial = useMemo((): { cost: number } | { error: string } => {
    const g = structuredClone(game), r = task.action(g, ...task.args, "hands");
    return r.ok ? { cost: Math.round((game.cash - g.cash) * 100) / 100 } : { error: r.error };
  }, [game, task]);
  const device = game.devices.find((d) => d.id === task.deviceId), loc = workLocation(game, task), w = loc && handWork(game, loc.id);
  if (!device || !loc || !w) return null;
  const from = locationOf(game, device), fare = task.at && from && present(game, from.id) && game.player.until <= game.hour ? drive(game, loc.id) : null;
  const go = (how: "hands" | "friend" | "self") => { if (run(task, how).ok) onClose(); };
  const t = task.tech, queued = !!t && game.techOps.some((o) => o.deviceId === device.id && o.kind === t.kind && o.componentId === (t.componentId ?? null) && (o.partId ?? null) === (t.partId ?? null));
  const slot = t && !queued ? nextSlot(game, loc.id, taskFor(game, t.kind, t.componentId ?? null), urgent(game, { kind: t.kind, deviceId: device.id, componentId: t.componentId ?? null })) : null;
  return createPortal(
    <div ref={ref} className="hand-pop" role="dialog" aria-label={task.title} style={at ?? { visibility: "hidden" }}>
      <strong>{task.title}</strong>
      <p>{"cost" in trial ? tr("locations-1.remoteHandsQuote", { loc: loc.name, cost: euro(trial.cost), wait: w.hands.wait }) : tr(trial.error)}</p>
      {slot && t && <button className="hand-pop-alt" onClick={() => { if (act(queueOperation, t.kind, device.id, t.componentId ?? null, t.partId ?? null, t.slot ?? 0, t.count ?? 1).ok) onClose(); }}>{tr("locations-1.technician", { name: slot.name.split(" ")[0], time: slotTime(game.hour, slot.hour) })}</button>}
      {fare && <button className="hand-pop-alt" onClick={() => go("self")}>{tr("locations-1.driveYourself", { hours: fare.hours, fee: euro(fare.fee) })}</button>}
      {w.friend && w.friend.left > 0 && <button className="hand-pop-alt" onClick={() => go("friend")}>{tr("locations-1.sendFriend", { fee: euro(w.friend.fee), left: w.friend.left, total: FAVOURS_PER_YEAR })}</button>}
      <div className="hand-pop-actions">
        <button className="btn" onClick={onClose}>{tr("locations-1.decline")}</button>
        <button className="btn primary" disabled={!("cost" in trial)} onClick={() => go("hands")}>{tr("locations-1.accept")}</button>
      </div>
    </div>,
    document.querySelector(".desktop") ?? document.body,
  );
}
