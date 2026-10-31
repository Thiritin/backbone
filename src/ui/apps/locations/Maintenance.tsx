import { Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import { dateOf } from "../../../sim/00-core/time";
import type { Device, GameState } from "../../../sim/50-state";
import { clusterOf } from "../../../sim/60-infra/cluster";
import { impact, LENGTHS, NOTICE_HOURS, START_CHOICES, startOf, targetName, type Maintenance, type MaintenanceTarget, type Reaction, type StartChoice } from "../../../sim/60-infra/maintenance";
import { locationOf } from "../../../sim/60-infra/status";
import { cancelMaintenance, moveMaintenance, planMaintenance } from "../../../sim/90-actions/maintenance";
import type { MenuEntry } from "../../desktop/menu";
import { useStore } from "../../store";
import { t } from "../../../i18n/en";
import { stamp } from "../support/labels";
import { Facts, Sheet } from "./ui";

const START_LABEL = (c: StartChoice): string => t(`locations-2.mntStart.${c}`);
const ANSWER = (r: Reaction): string => t(`locations-2.mntAnswer.${r}`);
const when = (hour: number) => `${t(`locations-2.day.${dateOf(hour).getUTCDay()}`)} ${stamp(hour)}`;

// The location a window's target is in.
const locationId = (game: GameState, t: MaintenanceTarget): string | undefined => {
  if (t.kind === "location") return t.id;
  const d = game.devices.find((x) => x.id === (t.kind === "device" ? t.id : game.clusters.find((c) => c.id === t.id)?.nodes[0]?.deviceId));
  return d && locationOf(game, d)?.id;
};
export const windowsAtLocation = (game: GameState, locId: string): Maintenance[] => game.maintenance.filter((m) => locationId(game, m.target) === locId);
export const windowsOnDevice = (game: GameState, d: Device): Maintenance[] =>
  game.maintenance.filter((m) => (m.target.kind === "device" ? m.target.id === d.id : m.target.kind === "cluster" ? clusterOf(game, d.id)?.id === m.target.id : locationOf(game, d)?.id === m.target.id));

// The plan sheet's state: open(target) plans a window, open(target, window) moves one.
export function useMaintenance() {
  const [open, setOpen] = useState<{ target: MaintenanceTarget; windowId?: string } | null>(null);
  return {
    plan: (target: MaintenanceTarget, windowId?: string) => setOpen({ target, windowId }),
    dialog: open && <MaintenanceSheet target={open.target} windowId={open.windowId} onClose={() => setOpen(null)} />,
  };
}

export const planEntry = (target: MaintenanceTarget, plan: (t: MaintenanceTarget) => void): MenuEntry => ({ label: t("locations-2.planMaintenanceMenu"), run: () => plan(target) });

export function PlanButton({ target, plan }: { target: MaintenanceTarget; plan: (t: MaintenanceTarget) => void }) {
  return <button className="btn ghost icon" aria-label={t("locations-2.planMaintenance")} title={t("locations-2.planMaintenance")} onClick={() => plan(target)}><Wrench /></button>;
}

// Start and length of each planned window with its customers, and the buttons to move or cancel it.
export function Windows({ game, windows, plan }: { game: GameState; windows: Maintenance[]; plan: (t: MaintenanceTarget, windowId?: string) => void }) {
  const act = useStore((s) => s.act);
  return (
    <>
      {windows.map((m) => (
        <div key={m.id} className="loc-row">
          <span className="loc-k">{targetName(game, m.target)}</span>
          <span className="num">{when(m.from)}</span>
          <span className="num">{m.hours} h</span>
          <span className="num">{t("locations-2.nCustomers", { n: m.customerIds.length })}</span>
          <span className="grow" />
          {m.from > game.hour && <button className="btn" onClick={() => plan(m.target, m.id)}>{t("locations-2.move")}</button>}
          <button className="btn ghost" onClick={() => act(cancelMaintenance, m.id)}>{t("locations-2.cancel")}</button>
        </div>
      ))}
    </>
  );
}

function MaintenanceSheet({ target, windowId, onClose }: { target: MaintenanceTarget; windowId?: string; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const current = game.maintenance.find((m) => m.id === windowId);
  const [choice, setChoice] = useState<StartChoice>("tonight");
  const [hours, setHours] = useState<number>(current?.hours ?? 4);
  const from = startOf(choice, game.hour), notice = from - game.hour;
  const rows = impact(game, target, from, hours);
  const customers = new Set(rows.map((r) => r.customer.id)).size;
  const go = () => {
    const r = windowId ? act(moveMaintenance, windowId, from, hours) : act(planMaintenance, target, from, hours);
    if (r.ok) onClose();
  };
  const row = (k: string, v: ReactNode): [string, ReactNode] => [k, v];

  return (
    <Sheet title={windowId ? t("locations-2.moveMaintenance") : t("locations-2.planMaintenance")} onClose={onClose}>
      <div className="loc-sheet-bar">
        <div className="seg" role="group" aria-label={t("locations-2.mntStartLabel")}>
          {START_CHOICES.map((c) => <button key={c} aria-pressed={choice === c} onClick={() => setChoice(c)}>{START_LABEL(c)}</button>)}
        </div>
        <div className="seg" role="group" aria-label={t("locations-2.mntLength")}>
          {LENGTHS.map((h) => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}><span className="num">{h} h</span></button>)}
        </div>
      </div>
      <div className="mnt-body">
        <Facts rows={[
          row(t("locations-2.mntTarget"), targetName(game, target)),
          row(t("locations-2.mntStartLabel"), <span className="num">{when(from)}</span>),
          row(t("locations-2.mntEnd"), <span className="num">{when(from + hours)}</span>),
          row(t("locations-2.mntNotice"), <span className={`num${notice < NOTICE_HOURS ? " mnt-short" : ""}`}>{notice} h</span>),
          row(t("locations-2.mntServices"), <span className="num">{rows.length}</span>),
          row(t("locations-2.mntCustomers"), <span className="num">{customers}</span>),
        ]} />
        {rows.length > 0 && (
          <div className="mnt-list">
            <table className="table">
              <thead><tr><th>{t("locations-2.mntService")}</th><th>{t("locations-2.mntCustomer")}</th><th>{t("locations-2.mntAnswerHead")}</th></tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.service.id}><td>{r.service.label}</td><td>{r.customer.name}</td><td>{ANSWER(r.reaction)}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="loc-sheet-foot">
        <span className="grow" />
        <button className="btn" onClick={onClose}>{t("locations-2.close")}</button>
        <button className="btn primary" onClick={go}>{windowId ? t("locations-2.move") : t("locations-2.plan")}</button>
      </div>
    </Sheet>
  );
}
