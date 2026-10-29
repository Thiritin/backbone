import type { ReactNode } from "react";
import { useState } from "react";
import { nowHours, yearOf } from "../../../sim/00-core/time";
import { SOFTWARE, softwareById, type Software, type SoftwareKind } from "../../../sim/10-catalog/platforms";
import type { Device, GameState } from "../../../sim/50-state";
import { installingOn } from "../../../sim/60-infra/cluster";
import { drivesOf, raidUsable } from "../../../sim/60-infra/status";
import { eraseDisk, installCase, installFromUsb } from "../../../sim/90-actions/console";
import { reboot } from "../../../sim/90-actions/hardware";
import { installBlock } from "../../../sim/90-actions/software";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { disk } from "../hw";
import { KIND_NAME, licenseText, vmLabel } from "../products/parts";

const KINDS: SoftwareKind[] = ["cloud", "panel", "game", "mail"];
const STAGES = ["Partitioning disks", "Installing the base system", "Installing software", "Configuring the system", "Finishing the installation"];
const hostOf = (d: Device) => d.hostname ?? d.label ?? d.name;

interface Row { label: string; dim?: boolean; run?: () => void }
type Step = { kind: "menu" } | { kind: "target"; sw: Software | null };

// The installer on the USB stick: the catalog, the target screen with its three cases, and the progress screen while the
// install runs. Keys come from the screen.
export function useInstaller(game: GameState, d: Device): { view: ReactNode; onKey: (key: string) => void } {
  const act = useStore((s) => s.act);
  const [step, setStep] = useState<Step>({ kind: "menu" });
  const [row, setRow] = useState(0);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const year = yearOf(game.hour), found = installCase(game, d.id), drives = drivesOf(d);
  const running = installingOn(game, d.id);
  const back = () => { setStep({ kind: "menu" }); setRow(0); setTyped(""); setNote(""); };
  const run = (r: { ok: boolean; error?: string }) => { if (r.ok) back(); else setNote(t(r.error ?? "")); };
  const array = `${drives.length} x ${disk(drives[0]?.size ?? 0)}${d.raid === "none" ? "" : ` RAID ${d.raid}`}, ${disk(raidUsable(d))} usable`;

  let rows: Row[], body: ReactNode;
  if (step.kind === "menu") {
    const items = KINDS.flatMap((kind) => SOFTWARE.filter((sw) => sw.kind === kind && sw.from <= year).map((sw): Row => {
      const block = installBlock(game, d.id, sw.id, true);
      return { label: `${sw.name}  (${KIND_NAME[kind]}, ${licenseText(sw)}, ${sw.installHours} h)`, dim: !!block, run: () => { if (block) setNote(t(block)); else { setStep({ kind: "target", sw }); setRow(0); setNote(""); } } };
    }));
    rows = [...items, { label: "Erase disk", dim: found.kind === "empty", run: () => { if (found.kind === "empty") setNote(t("error.noSoftware")); else { setStep({ kind: "target", sw: null }); setRow(0); setNote(""); } } }, { label: "Reboot", run: () => act(reboot, d.id) }];
    body = <div className="inst-box"><div className="inst-t">Select software to install</div>{rows.map((r, i) => <div key={r.label} className={`inst-row${i === row ? " on" : ""}${r.dim ? " dim" : ""}`}>{r.label}</div>)}</div>;
  } else {
    const sw = step.sw, verb = sw ? `Install ${sw.name}` : "Erase disk", busy = found.kind === "busy";
    const go = () => run(sw ? act(installFromUsb, d.id, sw.id, busy ? typed : undefined) : act(eraseDisk, d.id, busy ? typed : undefined));
    rows = [{ label: busy ? (sw ? "Erase and install" : "Erase") : (sw ? "Install" : "Erase"), run: go }, { label: "Back", run: back }];
    const had = found.kind === "empty" ? null : softwareById(found.cluster.panel ?? found.cluster.platform ?? found.cluster.switching?.to ?? "").name;
    const dies = found.kind === "busy" ? [...new Set([...found.workloads, ...found.lost])] : [];
    const customers = found.kind === "busy" ? new Set(found.lost.map((w) => game.services.find((v) => v.id === w.serviceId)?.customerId).filter(Boolean)).size : 0;
    const backed = found.kind === "busy" ? found.lost.filter((w) => w.backupAt !== null).length : 0;
    body = (
      <div className="inst-box">
        <div className="inst-t">{verb}</div>
        <div>Target: {array}</div>
        {found.kind === "empty" && <div>The disks are empty.</div>}
        {found.kind === "idle" && <div>The disks hold {had} ({found.cluster.name}). It will be erased.</div>}
        {found.kind === "busy" && <>
          <div>{found.cluster.name} runs {had} and will be erased with everything on it:</div>
          <ul>{dies.map((w) => <li key={w.id}>{w.hostname ?? vmLabel(game, w).name}</li>)}</ul>
          <div>{customers} {customers === 1 ? "customer" : "customers"}, {backed} with a backup.</div>
          <div>Type {hostOf(d)} to confirm: <b>{typed}</b>_</div>
        </>}
        {rows.map((r, i) => <div key={r.label} className={`inst-row${i === row ? " on" : ""}`}>{r.label}</div>)}
      </div>
    );
  }
  if (running) {
    const sw = softwareById(running.switching!.to), done = Math.max(0, Math.min(1, 1 - (running.switching!.doneAt - nowHours(game)) / sw.installHours));
    const stage = Math.min(STAGES.length - 1, Math.floor(done * STAGES.length));
    body = (
      <div className="inst-box">
        <div className="inst-t">Installing {sw.name}</div>
        <div>{STAGES[stage]}</div>
        <div className="inst-bar"><span style={{ width: `${Math.round(done * 100)}%` }} /></div>
        <div>{Math.round(done * 100)}%</div>
      </div>
    );
  }
  const at = Math.min(row, rows.length - 1);
  const onKey = (key: string) => {
    if (running) return;
    if (key === "ArrowUp") setRow(Math.max(0, at - 1));
    else if (key === "ArrowDown") setRow(Math.min(rows.length - 1, at + 1));
    else if (key === "Enter") rows[at].run?.();
    else if (key === "Escape") back();
    else if (step.kind === "target" && found.kind === "busy") {
      if (key === "Backspace") setTyped((v) => v.slice(0, -1));
      else if (key.length === 1) setTyped((v) => v + key);
    }
  };
  const view = (
    <div className="inst">
      <div className="inst-h">Backbone Installer {year}</div>
      {body}
      {note && <div className="inst-note">{note}</div>}
      <div className="inst-f"><span>&uarr;&darr; Select</span><span>Enter Choose</span><span>Esc Back</span></div>
    </div>
  );
  return { view, onKey };
}
