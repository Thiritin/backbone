import type { ReactNode } from "react";
import { useState } from "react";
import { yearOf } from "../../../sim/00-core/time";
import { softwareById } from "../../../sim/10-catalog/platforms";
import { SERVER_OS, serverOsAt, type ServerOs } from "../../../sim/10-catalog/server-os";
import type { Device, GameState } from "../../../sim/50-state";
import type { Workload } from "../../../sim/60-infra/cluster";
import { drivesOf, raidUsable } from "../../../sim/60-infra/status";
import { eraseDisk, installCase, installOs, setMedia } from "../../../sim/90-actions/console";
import { reboot } from "../../../sim/90-actions/hardware";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { disk } from "../hw";
import { vmLabel } from "../products/parts";

type Machine = Device | Workload;
const isDevice = (m: Machine): m is Device => "components" in m;
const hostOf = (m: Machine) => (isDevice(m) ? m.hostname ?? m.label ?? m.name : m.hostname ?? m.id);

interface Row { label: string; dim?: boolean; run?: () => void }
type Step = { kind: "menu" } | { kind: "target"; sw: ServerOs | null };

// The installer on the USB stick or the ISO: the operating systems it holds and the target screen with its three cases.
// Keys come from the screen.
export function useInstaller(game: GameState, d: Machine): { view: ReactNode; onKey: (key: string) => void } {
  const act = useStore((s) => s.act);
  const [step, setStep] = useState<Step>({ kind: "menu" });
  const [row, setRow] = useState(0);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const year = yearOf(game.hour), found = installCase(game, d.id), drives = isDevice(d) ? drivesOf(d) : [];
  const back = () => { setStep({ kind: "menu" }); setRow(0); setTyped(""); setNote(""); };
  const run = (r: { ok: boolean; error?: string }) => { if (r.ok) back(); else setNote(t(r.error ?? "")); };
  const array = isDevice(d) ? `${drives.length} x ${disk(drives[0]?.size ?? 0)}${d.raid === "none" ? "" : ` RAID ${d.raid}`}, ${disk(raidUsable(d))} usable` : `${disk(d.diskGb)} virtual disk`;

  let rows: Row[], body: ReactNode;
  if (step.kind === "menu") {
    const items = SERVER_OS.filter((os) => isDevice(d) || d.media === os.id).map((sw): Row => (
      { label: `${sw.name} ${serverOsAt(sw.id, year).version}  (${sw.installHours} h)`, run: () => { setStep({ kind: "target", sw }); setRow(0); setNote(""); } }
    ));
    rows = [...items, { label: "Erase disk", dim: found.kind === "empty", run: () => { if (found.kind === "empty") setNote(t("error.noSoftware")); else { setStep({ kind: "target", sw: null }); setRow(0); setNote(""); } } }, isDevice(d) ? { label: "Reboot", run: () => act(reboot, d.id) } : { label: "Eject and reboot", run: () => act(setMedia, d.id, null) }];
    body = <div className="inst-box"><div className="inst-t">Select an operating system to install</div>{rows.map((r, i) => <div key={r.label} className={`inst-row${i === row ? " on" : ""}${r.dim ? " dim" : ""}`}>{r.label}</div>)}</div>;
  } else {
    const sw = step.sw, verb = sw ? `Install ${sw.name}` : "Erase disk", busy = found.kind === "busy";
    const go = () => run(sw ? act(installOs, d.id, sw.id, busy ? typed : undefined) : act(eraseDisk, d.id, busy ? typed : undefined));
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
  const at = Math.min(row, rows.length - 1);
  const onKey = (key: string) => {
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
      <div className="inst-h">Backbone Installer {year}{isDevice(d) ? "" : " (ISO)"}</div>
      {body}
      {note && <div className="inst-note">{note}</div>}
      <div className="inst-f"><span>&uarr;&darr; Select</span><span>Enter Choose</span><span>Esc Back</span></div>
    </div>
  );
  return { view, onKey };
}
