import { Beer, Car, Headset, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { nextSlot, taskFor, urgent, type OpKind } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { FAVOURS_PER_YEAR, handWork, MISHAP_CHANCE, type How } from "../../../sim/60-infra/handwork";
import { locationOf } from "../../../sim/60-infra/status";
import { queueOperation } from "../../../sim/90-actions/staff";
import type { ActionResult } from "../../../sim/90-actions/hardware";
import { useStore } from "../../store";
import { slotTime } from "./TechButton";
import { Sheet } from "./ui";

export interface HandTask {
  title: string;
  deviceId: string;
  // The action and its arguments; the way the work gets done (hands, self, friend) is appended as the last argument.
  action: (g: GameState, ...args: any[]) => ActionResult;
  args: unknown[];
  // The technician operation that does the same work, when there is one.
  tech?: { kind: OpKind; componentId?: string | null; partId?: string | null };
}

const hours = (h: number) => `${+h.toFixed(1)} h`;

// Whether the device sits in a datacenter, where hand work has more than one way to get done.
export const atDatacenter = (game: GameState, deviceId: string): boolean => {
  const d = game.devices.find((x) => x.id === deviceId), loc = d && locationOf(game, d);
  return !!loc && !!handWork(game, loc.id);
};

// Runs a hand task at once in the basement, or opens the sheet that picks who does it in a datacenter.
export function useHandWork() {
  const act = useStore((s) => s.act);
  const [task, setTask] = useState<HandTask | null>(null);
  const start = (game: GameState, t: HandTask) => {
    if (atDatacenter(game, t.deviceId)) setTask(t);
    else act(t.action, ...t.args, "hands");
  };
  return { start, dialog: task && <HandSheet task={task} onClose={() => setTask(null)} /> };
}

function Option({ icon, label, rows, onClick, disabled }: { icon: ReactNode; label: string; rows: [string, ReactNode][]; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="hand-opt" disabled={disabled} onClick={onClick}>
      <span className="hand-opt-h">{icon}{label}</span>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
    </button>
  );
}

export function HandSheet({ task, onClose }: { task: HandTask; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const device = game.devices.find((d) => d.id === task.deviceId), loc = device && locationOf(game, device), w = loc && handWork(game, loc.id);
  if (!device || !loc || !w) return null;
  const go = (how: How) => { if (act(task.action, ...task.args, how).ok) onClose(); };
  const t = task.tech, queued = !!t && game.techOps.some((o) => o.deviceId === device.id && o.kind === t.kind && o.componentId === (t.componentId ?? null) && (o.partId ?? null) === (t.partId ?? null));
  const slot = t && !queued ? nextSlot(game, loc.id, taskFor(game, t.kind, t.componentId ?? null), urgent(game, { kind: t.kind, deviceId: device.id, componentId: t.componentId ?? null })) : null;
  return (
    <Sheet title={task.title} onClose={onClose}>
      <div className="hand-opts">
        <Option icon={<Headset />} label="Remote hands" onClick={() => go("hands")} rows={[["Starts", hours(w.hands.wait)], ["Cost", `${euro(w.hands.fee)}/h`]]} />
        {slot && t && (
          <Option icon={<Wrench />} label={`Technician ${slot.name.split(" ")[0]}`} onClick={() => { if (act(queueOperation, t.kind, device.id, t.componentId ?? null, t.partId ?? null).ok) onClose(); }}
            rows={[["Starts", slotTime(game.hour, slot.hour)], ["Cost", euro(0)]]} />
        )}
        {w.self && <Option icon={<Car />} label="Do it yourself" onClick={() => go("self")} rows={[["Starts", hours(w.self.wait)], ["Cost", euro(w.self.fee)]]} />}
        {w.friend && (
          <Option icon={<Beer />} label="Send a friend" disabled={w.friend.left < 1} onClick={() => go("friend")}
            rows={[["Starts", hours(w.friend.wait)], ["Cost", euro(w.friend.fee)], ["Left", `${w.friend.left} of ${FAVOURS_PER_YEAR}`], ["Mishap", `${MISHAP_CHANCE * 100}%`]]} />
        )}
      </div>
    </Sheet>
  );
}
