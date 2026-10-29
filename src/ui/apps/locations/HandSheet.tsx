import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t as tr } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { nextSlot, taskFor, urgent, type OpKind } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { FAVOURS_PER_YEAR, handWork } from "../../../sim/60-infra/handwork";
import { locationOf } from "../../../sim/60-infra/status";
import { queueOperation } from "../../../sim/90-actions/staff";
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
  // The technician operation that does the same work, when there is one.
  tech?: { kind: OpKind; componentId?: string | null; partId?: string | null };
}

// Whether the device sits in a datacenter, where hand work has more than one way to get done.
export const atDatacenter = (game: GameState, deviceId: string): boolean => {
  const d = game.devices.find((x) => x.id === deviceId), loc = d && locationOf(game, d);
  return !!loc && !!handWork(game, loc.id);
};

// The last click, where the remote hands popover opens; callers start hand work from a click.
let pointer = { x: 0, y: 0 };
if (typeof window !== "undefined") window.addEventListener("pointerdown", (e) => { pointer = { x: e.clientX, y: e.clientY }; }, true);

// Runs a hand task at once where the player stands, or asks before paying remote hands elsewhere.
export function useHandWork() {
  const act = useStore((s) => s.act);
  const [task, setTask] = useState<{ t: HandTask; x: number; y: number } | null>(null);
  const start = (game: GameState, t: HandTask) => {
    const d = game.devices.find((x) => x.id === t.deviceId), loc = d && locationOf(game, d), w = loc && handWork(game, loc.id);
    if (!w) act(t.action, ...t.args, "hands");
    else if (w.here) act(t.action, ...t.args, "self");
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
  const device = game.devices.find((d) => d.id === task.deviceId), loc = device && locationOf(game, device), w = loc && handWork(game, loc.id);
  if (!device || !loc || !w) return null;
  const go = (how: "hands" | "friend") => { if (act(task.action, ...task.args, how).ok) onClose(); };
  const t = task.tech, queued = !!t && game.techOps.some((o) => o.deviceId === device.id && o.kind === t.kind && o.componentId === (t.componentId ?? null) && (o.partId ?? null) === (t.partId ?? null));
  const slot = t && !queued ? nextSlot(game, loc.id, taskFor(game, t.kind, t.componentId ?? null), urgent(game, { kind: t.kind, deviceId: device.id, componentId: t.componentId ?? null })) : null;
  return createPortal(
    <div ref={ref} className="hand-pop" role="dialog" aria-label={task.title} style={at ?? { visibility: "hidden" }}>
      <strong>{task.title}</strong>
      <p>{"cost" in trial ? <>Remote hands at {loc.name} will do this for <span className="num">{euro(trial.cost)}</span>, starting in <span className="num">{w.hands.wait} h</span>.</> : tr(trial.error)}</p>
      {slot && t && <button className="hand-pop-alt" onClick={() => { if (act(queueOperation, t.kind, device.id, t.componentId ?? null, t.partId ?? null).ok) onClose(); }}>Technician {slot.name.split(" ")[0]}, {slotTime(game.hour, slot.hour)}</button>}
      {w.friend && w.friend.left > 0 && <button className="hand-pop-alt" onClick={() => go("friend")}>Send a friend for <span className="num">{euro(w.friend.fee)}</span>, {w.friend.left} of {FAVOURS_PER_YEAR} left</button>}
      <div className="hand-pop-actions">
        <button className="btn" onClick={onClose}>Decline</button>
        <button className="btn primary" disabled={!("cost" in trial)} onClick={() => go("hands")}>Accept</button>
      </div>
    </div>,
    document.querySelector(".desktop") ?? document.body,
  );
}
