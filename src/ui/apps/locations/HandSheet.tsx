import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { actionName } from "../../../sim/90-actions/index";
import { cancelHandsJob, handsJobs, hands, jobKind, jobQuote, type HandsAction } from "../../../sim/90-actions/presence";
import { euroPrice } from "../../../sim/00-core/money";
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
  // Whose hands do hands-on work, as the button pressed chose: the player's own or remote hands.
  how?: HandsHow;
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
    // Hands-on work queues remote hands at once; its button shows the price.
    if (!t.at && handsAction(t.action)) run(t, t.how ?? "hands");
    else if (!w) { if (!remote) run(t, "hands"); }
    else if (present(game, loc!.id) && !t.at && !remote) run(t, "self");
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

const HANDS: string[] = ["mountDevice", "mountStack", "unmountDevice", "moveInRack", "installPart", "removePart", "replaceComponent", "connect", "disconnect", "setPlugged"] satisfies HandsAction[];
const handsAction = (fn: unknown): HandsAction | null => { const n = actionName(fn); return n && HANDS.includes(n) ? n as HandsAction : null; };

export type HandsHow = "self" | "hands";
export interface HandsWay { how: HandsHow; label: string }

// The ways to do hands-on work at a location, one button each: at once on site, else the player's own hands and remote hands where the site has them.
export function handsWays(game: GameState, locationId: string | undefined, action: HandsAction): HandsWay[] {
  const h = locationId ? hands(game, locationId) : "own";
  if (h === "own") return [{ how: "self", label: "" }];
  const self: HandsWay = { how: "self", label: tr("locations-2.handsOwn") };
  if (h === "none") return [self];
  const q = jobQuote(game, locationId!, jobKind(action))!;
  return [self, { how: "hands", label: tr("locations-2.handsRemote", { cost: euroPrice(q.fee), time: slotTime(game.hour, game.hour + q.wait) }) }];
}
export const wayLabel = (label: string, w: HandsWay) => (w.label ? `${label} · ${w.label}` : label);

// One button per way of doing a hands-on action.
export function HandsButtons({ ways, className = "btn", disabled, onRun, children }: { ways: HandsWay[]; className?: string; disabled?: boolean; onRun: (how: HandsHow) => void; children: ReactNode }) {
  return <>{ways.map((w) => <button key={w.how} className={className} disabled={disabled} onClick={() => onRun(w.how)}>{children}{w.label && <span className="hands-mode">{w.label}</span>}</button>)}</>;
}

// The badge of a queued job on the unit: its due time.
export const jobBadge = (game: GameState, deviceId: string): string | undefined => {
  const j = handsJobs(game).find((x) => x.deviceId === deviceId);
  return j && slotTime(game.hour, j.dueAt);
};

// The hands-on jobs queued at a location, own and remote, each with a Cancel.
export function HandsJobs({ game, locationId }: { game: GameState; locationId: string }) {
  const act = useStore((s) => s.act), jobs = handsJobs(game).filter((j) => j.locationId === locationId);
  if (!jobs.length) return null;
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3>{tr("locations-2.handJobs")}</h3></div>
      {jobs.map((j) => {
        const d = game.devices.find((x) => x.id === j.deviceId);
        return (
          <div key={j.id} className="loc-row">
            <span className="loc-k">{tr(`locations-2.job.${j.action}`)}</span>
            <span>{d?.label ?? d?.name}</span>
            <span className="grow" />
            {j.self ? <span className="num">{slotTime(game.hour, j.dueAt)}</span> : <><span>{tr("locations-2.handsJobs")}</span><span className="num">{slotTime(game.hour, j.dueAt)}</span><span className="num">{euroPrice(j.fee)}</span></>}
            <button className="btn" onClick={() => act(cancelHandsJob, j.id)}>{tr("locations-2.cancel")}</button>
          </div>
        );
      })}
    </div>
  );
}
