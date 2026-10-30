import type { ReactNode } from "react";
import { stickOs } from "../../../sim/60-infra/oob";
import { useState } from "react";
import { dateOf } from "../../../sim/00-core/time";
import { modelById, modelName } from "../../../sim/10-catalog/hardware";
import type { Device, GameState, RaidLevel, RebuildRate } from "../../../sim/50-state";
import { drivesOf, holdsData, raidTolerance, raidUsable } from "../../../sim/60-infra/status";
import { rebuildHours } from "../../../sim/88-tick/tick";
import { setRaid, setRebuildRate } from "../../../sim/90-actions/hardware";
import { exitSetup } from "../../../sim/90-actions/console";
import { useStore } from "../../store";
import { cores, disk, ram } from "../hw";

const PAGES = ["Main", "Storage", "Exit"] as const;
const LEVELS: [RaidLevel, string][] = [["none", "None"], ["1", "RAID 1"], ["5", "RAID 5"], ["6", "RAID 6"], ["10", "RAID 10"]];
const FITS: Record<RaidLevel, (n: number) => boolean> = { none: (n) => n >= 1, "1": (n) => n >= 2, "5": (n) => n >= 3, "6": (n) => n >= 4, "10": (n) => n >= 4 && n % 2 === 0 };
const RATES: [RebuildRate, string][] = [["low", "Low"], ["medium", "Medium"], ["high", "High"]];
const next = <T,>(list: T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length];

interface Row { label: string; value?: string; help?: string; run?: () => void }

// The setup's pages, cursor and the one confirmation it asks, driven by the keys the screen hands it.
export function useBios(game: GameState, d: Device): { view: ReactNode; onKey: (key: string) => void } {
  const act = useStore((s) => s.act);
  const [page, setPage] = useState(0);
  const [row, setRow] = useState(0);
  const [confirm, setConfirm] = useState<RaidLevel | null>(null);
  const model = modelById(d.model), sv = model.server, drives = drivesOf(d), tol = raidTolerance(d);
  const levels = LEVELS.filter(([v]) => FITS[v](drives.length)).map(([v]) => v);
  const pickLevel = () => {
    const to = next(levels, d.raid);
    if (holdsData(game, d)) setConfirm(to); else act(setRaid, d.id, to);
  };
  const rb = d.rebuild, done = rb ? Math.max(0, Math.min(1, 1 - (rb.doneAt - game.hour) / rebuildHours(d))) : 0;
  const rows: Row[][] = [
    [
      { label: "System Time", value: dateOf(game.hour).toISOString().slice(11, 16) + ":00" },
      { label: "System Date", value: dateOf(game.hour).toISOString().slice(0, 10) },
      { label: "Product", value: `${d.brand} ${modelName(model, d.brand)}` },
      ...(sv ? [
        { label: "Processor", value: `${sv.sockets} x ${cores(sv.cores / sv.sockets)}` },
        { label: "Memory", value: ram(sv.ramGb) },
      ] : []),
      { label: "Drives", value: `${drives.length}` },
      { label: "USB Device", value: stickOs(game, d.id) ? "USB Flash Disk" : "Not Present" },
    ],
    [
      { label: "RAID Level", value: LEVELS.find(([v]) => v === d.raid)?.[1] ?? d.raid, help: "Enter cycles through the levels the drives allow. A new level deletes the array.", run: pickLevel },
      { label: "Rebuild Rate", value: RATES.find(([v]) => v === d.rebuildRate)?.[1] ?? d.rebuildRate, help: "A fast rebuild slows the server, a slow one leaves it exposed for longer.", run: () => act(setRebuildRate, d.id, next(RATES.map(([v]) => v), d.rebuildRate)) },
      { label: "Usable Capacity", value: disk(raidUsable(d)) },
      { label: "Survives", value: d.raid === "10" ? "1 drive per mirror pair" : tol ? `${tol} ${tol === 1 ? "drive" : "drives"}` : "No drive failure" },
      ...drives.map((c, i) => ({ label: `Drive ${i + 1}`, value: `${disk(c.size ?? 0)}${c.failedAt !== null ? " FAILED" : rb?.componentId === c.id ? " REBUILDING" : ""}` })),
      ...(rb ? [{ label: "Rebuild", value: `${Math.floor(done * 100)}%` }] : []),
    ],
    [
      { label: "Save Changes and Exit", help: "Every change is already written. The server boots on.", run: () => act(exitSetup, d.id) },
      { label: "Discard Changes and Exit", help: "The server boots on.", run: () => act(exitSetup, d.id) },
    ],
  ];
  const cur = rows[page], at = Math.min(row, cur.length - 1);
  const onKey = (key: string) => {
    if (confirm !== null) {
      if (key === "Enter" || key === "y" || key === "Y") { act(setRaid, d.id, confirm); setConfirm(null); }
      else if (key === "Escape" || key === "n" || key === "N") setConfirm(null);
      return;
    }
    if (key === "ArrowLeft") { setPage((p) => (p + PAGES.length - 1) % PAGES.length); setRow(0); }
    else if (key === "ArrowRight") { setPage((p) => (p + 1) % PAGES.length); setRow(0); }
    else if (key === "ArrowUp") setRow((r) => Math.max(0, Math.min(r, cur.length - 1) - 1));
    else if (key === "ArrowDown") setRow((r) => Math.min(cur.length - 1, r + 1));
    else if (key === "Enter") cur[at].run?.();
    else if (key === "F10" || key === "Escape") act(exitSetup, d.id);
  };
  const view = (
    <div className="bios">
      <div className="bios-h">BIOS SETUP UTILITY</div>
      <div className="bios-tabs">{PAGES.map((p, i) => <span key={p} className={i === page ? "on" : ""}>{p}</span>)}</div>
      <div className="bios-body">
        <div className="bios-items">
          {cur.map((r, i) => (
            <div key={r.label} className={`bios-row${i === at ? " on" : ""}${r.run ? "" : " ro"}`}>
              <span>{r.label}</span>{r.value !== undefined && <span>[{r.value}]</span>}
            </div>
          ))}
        </div>
        <div className="bios-help">{cur[at].help ?? ""}</div>
      </div>
      <div className="bios-f">
        <span>&larr;&rarr; Select Screen</span><span>&uarr;&darr; Select Item</span><span>Enter Change</span><span>F10 Save and Exit</span><span>Esc Exit</span>
      </div>
      {confirm !== null && (
        <div className="bios-dlg">
          <div>Delete the array and all data on it?</div>
          <div>{LEVELS.find(([v]) => v === d.raid)?.[1]} to {LEVELS.find(([v]) => v === confirm)?.[1]}</div>
          <div>[Enter] Yes&nbsp;&nbsp;&nbsp;[Esc] No</div>
        </div>
      )}
    </div>
  );
  return { view, onKey };
}
