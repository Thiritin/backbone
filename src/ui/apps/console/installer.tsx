import type { ReactNode } from "react";
import { useState } from "react";
import { nowHours } from "../../../sim/00-core/time";
import { softwareById } from "../../../sim/10-catalog/platforms";
import { serverOsById, type ServerOsId } from "../../../sim/10-catalog/server-os";
import type { Device, GameState, NetFail } from "../../../sim/50-state";
import type { Workload } from "../../../sim/60-infra/cluster";
import { machineNet } from "../../../sim/60-infra/oob";
import { drivesOf, raidUsable } from "../../../sim/60-infra/status";
import { eraseDisk, installCase, installOs, setMedia, upgradeHours, upgradeOs, upgradeTarget } from "../../../sim/90-actions/console";
import { reboot } from "../../../sim/90-actions/hardware";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { disk } from "../hw";
import { vmLabel } from "../products/parts";

export type Machine = Device | Workload;
export const isDevice = (m: Machine): m is Device => "components" in m;
export const hostOf = (m: Machine) => (isDevice(m) ? m.hostname ?? m.label ?? m.name : m.hostname ?? m.id);
// A screen's view, the keys it handles and the soft keys it shows.
export interface Keyed { view: ReactNode; onKey: (key: string) => void; keys: string[]; look?: string }

interface Row { label: string; dim?: boolean; run?: () => void }
interface Page { title: string; body?: ReactNode; rows: Row[]; keys?: Record<string, () => void>; foot?: string; err?: boolean }
const pct = (x: number) => `${Math.floor(x * 100)}%`;
const bar = (x: number) => <div className="inst-bar"><span style={{ width: pct(x) }} /></div>;
// Windoors Setup and the screens after it come in eras: 2003, 2008 to 2012 R2, 2016 and later.
export const winEra = (version: string): 0 | 1 | 2 => (version === "2003" ? 0 : Number(version.slice(0, 4)) < 2016 ? 1 : 2);

// What the installer finds on the disks and what erasing them costs, typed confirmation included.
function useTarget(game: GameState, m: Machine) {
  const act = useStore((s) => s.act);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const found = installCase(game, m.id), busy = found.kind === "busy", drives = isDevice(m) ? drivesOf(m) : [];
  const array = isDevice(m) ? `${drives.length} x ${disk(drives[0]?.size ?? 0)}${m.raid === "none" ? "" : ` RAID ${m.raid}`}, ${disk(raidUsable(m))}` : `${disk(m.diskGb)} virtual disk`;
  const had = found.kind === "empty" ? null : softwareById(found.cluster.panel ?? found.cluster.platform ?? found.cluster.switching?.to ?? "").name;
  const dies = found.kind === "busy" ? [...new Set([...found.workloads, ...found.lost])] : [];
  const customers = found.kind === "busy" ? new Set(found.lost.map((w) => game.services.find((v) => v.id === w.serviceId)?.customerId).filter(Boolean)).size : 0;
  const backed = found.kind === "busy" ? found.lost.filter((w) => w.backupAt !== null).length : 0;
  const what = (
    <>
      {found.kind === "empty" && !m.os && <div>The disks are empty.</div>}
      {found.kind === "empty" && m.os && <div>The disks hold {serverOsById(m.os.id).name} {m.os.version}. It will be erased.</div>}
      {found.kind === "idle" && <div>The disks hold {had} ({found.cluster.name}). It will be erased.</div>}
      {busy && <>
        <div>{found.cluster.name} runs {had} and will be erased with everything on it:</div>
        <ul>{dies.map((w) => <li key={w.id}>{w.hostname ?? vmLabel(game, w).name}</li>)}</ul>
        <div>{customers} {customers === 1 ? "customer" : "customers"}, {backed} with a backup.</div>
        <div>Type {hostOf(m)} to confirm: <b>{typed}</b>_</div>
      </>}
    </>
  );
  const run = (r: { ok: boolean; error?: string }) => { setNote(r.ok ? "" : t(r.error ?? "")); setTyped(""); };
  const install = (os: ServerOsId) => { const r = act(installOs, m.id, os, busy ? typed : undefined); run(r); return r.ok; };
  const erase = () => run(act(eraseDisk, m.id, busy ? typed : undefined));
  const leave = () => (isDevice(m) ? act(reboot, m.id) : act(setMedia, m.id, null));
  const type = (key: string) => {
    if (!busy) return false;
    if (key === "Backspace") setTyped((v) => v.slice(0, -1));
    else if (key.length === 1) setTyped((v) => v + key);
    else return false;
    return true;
  };
  return { found, empty: found.kind === "empty" && !m.os, array, what, note, setNote, install, erase, leave, type, setTyped };
}

// The cursor over a page's rows; Tab moves like the arrow, Enter runs the row, the page's own keys come first.
function usePager(page: Page, onType: (key: string) => boolean): { at: number; onKey: (key: string) => void; pick: (i: number) => void } {
  const [row, setRow] = useState(0);
  const at = Math.min(row, Math.max(0, page.rows.length - 1));
  const onKey = (key: string) => {
    if (page.keys?.[key]) { page.keys[key](); setRow(0); return; }
    if (onType(key)) return;
    const n = page.rows.length;
    if (!n) return;
    if (key === "ArrowUp") setRow((at + n - 1) % n);
    else if (key === "ArrowDown" || key === "Tab") setRow((at + 1) % n);
    else if (key === "Enter") { page.rows[at].run?.(); setRow(0); }
  };
  return { at, onKey, pick: (i) => { page.rows[i].run?.(); setRow(0); } };
}
const keysOf = (page: Page, typing: boolean) => [...(page.rows.length ? ["ArrowUp", "ArrowDown", "Tab", "Enter"] : []), ...Object.keys(page.keys ?? {}), ...(typing ? ["Backspace"] : [])];

function Rows({ rows, at, pick }: { rows: Row[]; at: number; pick: (i: number) => void }) {
  return <>{rows.map((r, i) => <div key={r.label} className={`inst-row${i === at ? " on" : ""}${r.dim ? " dim" : ""}`} onClick={() => pick(i)}>{r.label}</div>)}</>;
}

type LunixStep = "boot" | "language" | "hostname" | "fetch" | "disks" | "write" | "erase";
const LANGUAGES = ["English", "Deutsch", "Français", "Español", "Nederlands"];

// The Debiant text-mode installer: the boot menu, language, hostname, the partitioner with its erase confirmation; the
// install itself and the reboot follow from the simulation.
function useLunixSetup(game: GameState, m: Machine, version: string): Keyed {
  const [step, setStep] = useState<LunixStep>("boot");
  const tg = useTarget(game, m), net = machineNet(game, m.id);
  const go = (to: LunixStep) => () => { setStep(to); tg.setNote(""); tg.setTyped(""); };
  const back = (to: LunixStep): Row => ({ label: "<Go Back>", run: go(to) });
  const pages: Record<LunixStep, Page> = {
    boot: { title: `Debiant GNU/Lunix ${version} installer boot menu`, rows: [
      { label: "Install", run: go("language") },
      { label: "Erase disk", dim: tg.empty, run: tg.empty ? () => tg.setNote(t("error.noSoftware")) : go("erase") },
      { label: isDevice(m) ? "Reboot" : "Eject and reboot", run: tg.leave },
    ] },
    language: { title: "Select a language", rows: [...LANGUAGES.map((l) => ({ label: l, run: go("hostname") })), back("boot")] },
    hostname: net
      ? { title: "Configure the network", err: true, body: <div>{t(net === "noInterfaces" ? "error.noInterfaces" : "error.noAutoconf")}</div>, rows: [{ label: "<Continue>", run: go("fetch") }] }
      : { title: "Configure the network", body: <div>Hostname: {hostOf(m)}</div>, rows: [{ label: "<Continue>", run: go("disks") }, back("language")] },
    fetch: { title: "Retrieving packages", err: true, body: <div>{t("term.console.osInstallFailed")} Check your network connection.</div>, rows: [{ label: "<Abort installation>", run: () => { go("boot")(); tg.leave(); } }] },
    disks: { title: "Partition disks", body: <div>Partitioning method:</div>, rows: [{ label: `Guided - use entire disk (${tg.array})`, run: go("write") }, back("hostname")] },
    write: { title: "Partition disks", body: <>{tg.what}<div>Write the changes to disks?</div></>, rows: [{ label: "<Yes>", run: () => tg.install("lunix") && setStep("boot") }, { label: "<No>", run: go("disks") }] },
    erase: { title: "Erase disk", body: tg.what, rows: [{ label: "<Erase>", run: tg.erase }, back("boot")] },
  };
  const page = pages[step], typing = (step === "write" || step === "erase") && tg.found.kind === "busy";
  const pager = usePager({ ...page, keys: { Escape: go("boot") } }, (k) => typing && tg.type(k));
  const view = <Debiant title={page.title} body={page.body} note={tg.note} err={page.err}><Rows rows={page.rows} at={pager.at} pick={pager.pick} /></Debiant>;
  return { view, onKey: pager.onKey, keys: [...keysOf(page, typing), "Escape"] };
}

function Debiant({ title, body, note, err, children }: { title: string; body?: ReactNode; note?: string; err?: boolean; children?: ReactNode }) {
  return (
    <div className="deb">
      <div className={`deb-box${err ? " err" : ""}`}>
        <div className="deb-t">[!!] {title}</div>
        <div className="deb-body">{body}{children}</div>
      </div>
      {note && <div className="inst-note">{note}</div>}
      <div className="deb-f">&lt;Tab&gt; moves; &lt;Enter&gt; activates buttons</div>
    </div>
  );
}

type WinStep = "start" | "edition" | "license" | "type" | "upgrade" | "where" | "install" | "delete";

// Windoors Setup: the blue text-mode first stage of 2003, or the Install Windoors window of 2008 and later. Media one
// release ahead of the Windoors on the disks offers the in-place upgrade.
function useWindoorsSetup(game: GameState, m: Machine, version: string): Keyed {
  const [step, setStep] = useState<WinStep>("start");
  const tg = useTarget(game, m), era = winEra(version), act = useStore((s) => s.act);
  const upgrade = m.os?.id === "windoors" && upgradeTarget(game, m.id)?.version === version;
  const upgradeNow = () => { const r = act(upgradeOs, m.id); tg.setNote(r.ok ? "" : t(r.error ?? "")); if (r.ok) setStep("start"); };
  const go = (to: WinStep) => () => { setStep(to); tg.setNote(""); tg.setTyped(""); };
  const setup = () => tg.install("windoors") && setStep("start");
  const install = () => (tg.found.kind === "empty" && !m.os ? setup() : go("install")());
  const del = tg.empty ? () => tg.setNote(t("error.noSoftware")) : go("delete");
  const part = tg.empty ? `Unpartitioned space   ${tg.array}` : `C:  Partition1 [NTFS]   ${tg.array}`;
  const suffix = era === 2 ? " (Desktop Experience)" : version.startsWith("2008") ? " (Full Installation)" : " (Server with a GUI)";
  const pages: Record<WinStep, Page> = era === 0 ? {
    start: { title: "Welcome to Setup.", body: <div>To set up Windoors now, press ENTER. To quit Setup, press F3.</div>, rows: [], keys: { Enter: go("license"), F3: tg.leave }, foot: "ENTER=Continue  F3=Quit" },
    edition: { title: "", rows: [] },
    type: { title: "", rows: [] },
    upgrade: { title: "", rows: [] },
    license: { title: "Windoors Licensing Agreement", body: <div>Press F8 to accept the agreement and continue Setup.</div>, rows: [], keys: { F8: go("where"), Escape: go("start") }, foot: "F8=I agree  ESC=I do not agree" },
    where: { title: "The following list shows the existing partitions and unpartitioned space on this computer.", rows: [{ label: part, run: install }], keys: { d: del, D: del, F3: tg.leave }, foot: "ENTER=Install  D=Delete Partition  F3=Quit" },
    install: { title: "Setup will format the partition and erase it.", body: tg.what, rows: [], keys: { Enter: setup, Escape: go("where") }, foot: "ENTER=Continue  ESC=Cancel" },
    delete: { title: "Setup will delete the partition.", body: tg.what, rows: [], keys: { Enter: tg.erase, Escape: go("where") }, foot: "ENTER=Delete  ESC=Cancel" },
  } : {
    start: { title: `Windoors Server ${version}`, rows: [{ label: "Install now", run: go("edition") }] },
    edition: { title: "Select the operating system you want to install", rows: ["Standard", "Datacenter"].map((e) => ({ label: `Windoors Server ${version} ${e}${suffix}`, run: go("license") })) },
    license: { title: "License terms", rows: [{ label: "I accept the license terms", run: go(upgrade ? "type" : "where") }, { label: "Back", run: go("edition") }] },
    type: { title: "Which type of installation do you want?", rows: [{ label: "Upgrade: Keep files, settings and applications", run: go("upgrade") }, { label: "Custom: Install Windoors only (advanced)", run: go("where") }, { label: "Back", run: go("license") }] },
    upgrade: { title: `Upgrade to Windoors Server ${version}`, body: <div>{t("term.apt.downtime", { minutes: upgrade ? Math.round(upgradeHours(game, m.id) * 60) : 0 })}</div>, rows: [{ label: "Upgrade", run: upgradeNow }, { label: "Back", run: go("type") }] },
    where: { title: "Where do you want to install Windoors?", body: <div className="win-disk">Drive 0 {tg.empty ? "Unallocated Space" : "Partition 1"}<span>{tg.array}</span></div>, rows: [{ label: "Next", run: install }, { label: "Delete", dim: tg.empty, run: del }, { label: "Back", run: go("license") }] },
    install: { title: "Windoors might be unable to boot", body: tg.what, rows: [{ label: "OK", run: setup }, { label: "Cancel", run: go("where") }] },
    delete: { title: "Delete partition", body: tg.what, rows: [{ label: "OK", run: tg.erase }, { label: "Cancel", run: go("where") }] },
  };
  const page = pages[step], typing = (step === "install" || step === "delete") && tg.found.kind === "busy";
  const pager = usePager(page, (k) => typing && tg.type(k));
  const rows = <Rows rows={page.rows} at={pager.at} pick={pager.pick} />;
  const view = era === 0
    ? <WinText version={version} foot={page.foot ?? ""} note={tg.note}><div className="wt-title">{page.title}</div>{page.body}<div className="wt-rows">{rows}</div></WinText>
    : <WinSetup era={era} title={page.title} note={tg.note}>{page.body}<div className="ws-rows">{rows}</div></WinSetup>;
  return { view, onKey: pager.onKey, keys: keysOf(page, typing).filter((k) => k !== "D") };
}

function WinText({ version, foot, note, children }: { version: string; foot: string; note?: string; children: ReactNode }) {
  return (
    <div className="wt">
      <div className="wt-h">Windoors Server {version} Setup</div>
      <div className="wt-body">{children}</div>
      {note && <div className="inst-note">{note}</div>}
      <div className="wt-f">{foot}</div>
    </div>
  );
}

function WinSetup({ era, title, note, children }: { era: 1 | 2; title: string; note?: string; children: ReactNode }) {
  return (
    <div className="ws" data-era={era}>
      <div className="ws-win">
        <div className="ws-bar">Install Windoors</div>
        <div className="ws-body"><div className="ws-t">{title}</div>{children}{note && <div className="ws-note">{note}</div>}</div>
      </div>
    </div>
  );
}

// The installer the machine booted into: the stick's OS and version on a server, the ISO's on a VM.
export function useInstaller(game: GameState, m: Machine, os: ServerOsId, version: string): Keyed {
  const lunix = useLunixSetup(game, m, version), windoors = useWindoorsSetup(game, m, version);
  return os === "windoors" ? windoors : lunix;
}

const LUNIX_STAGES = ["Installing the base system", "Configuring apt", "Select and install software", "Installing GRUB boot loader"];
const WIN_STEPS = ["Copying Windoors files", "Getting files ready for installation", "Installing features", "Installing updates", "Finishing up"];
const GUI_STEPS = ["Collecting information", "Dynamic Update", "Preparing installation", "Installing Windoors", "Finalizing installation"];

// The install running over its hours: the Debiant progress bar, or Setup's percentages with its two reboots.
export function OsInstalling({ m, os, progress }: { m: Machine; os: ServerOsId; progress: number }) {
  const version = m.os?.version ?? "";
  if (m.os?.from) return <OsUpgrading os={os} version={version} progress={progress} />;
  if (os === "lunix") {
    if (progress >= 0.95) return <Debiant title="Finish the installation" body={<div>Installation complete</div>} />;
    const stage = LUNIX_STAGES[Math.min(LUNIX_STAGES.length - 1, Math.floor((progress / 0.95) * LUNIX_STAGES.length))];
    return <Debiant title="Install the system" body={<><div>{stage}...</div>{bar(progress / 0.95)}<div>{pct(progress / 0.95)}</div></>} />;
  }
  const era = winEra(version);
  const restarting = (progress >= 0.45 && progress < 0.5) || progress >= 0.95;
  if (restarting) return <div className="wb" data-era={era}><div className="wb-logo">Windoors</div><div>{era === 0 ? "Setup is restarting" : "Windoors needs to restart to continue"}</div></div>;
  if (era === 0 && progress < 0.45) {
    return <WinText version={version} foot="" note=""><div className="wt-title">Please wait while Setup copies files to the Windoors installation folders.</div><div className="wt-copy">Setup is copying files... {pct(progress / 0.45)}{bar(progress / 0.45)}</div></WinText>;
  }
  if (era === 0) {
    const left = Math.max(1, Math.round((1 - progress) * serverOsById(os).installHours * 60)), at = 3 + Math.floor(((progress - 0.5) / 0.45) * 2);
    return (
      <div className="wg">
        <ul className="wg-steps">{GUI_STEPS.map((x, i) => <li key={x} className={i === at ? "on" : i < at ? "done" : ""}>{x}</li>)}</ul>
        <div className="wg-left">Setup will complete in approximately: {left} minutes</div>
        <div className="wg-main">Installing Windoors{bar((progress - 0.5) / 0.45)}</div>
      </div>
    );
  }
  const share = progress < 0.45 ? progress / 0.45 : (progress - 0.5) / 0.45, at = progress < 0.45 ? Math.min(1, Math.floor(share * 2)) : 2 + Math.min(2, Math.floor(share * 3));
  return (
    <WinSetup era={era} title="Installing Windoors...">
      <ul className="ws-check">{WIN_STEPS.map((x, i) => <li key={x} className={i === at ? "on" : i < at ? "done" : ""}>{x}{i === at && i === 1 ? ` (${pct(share)})` : ""}</li>)}</ul>
    </WinSetup>
  );
}

const LUNIX_UPGRADE = ["Unpacking the new release", "Setting up packages", "Removing obsolete packages", "Updating GRUB boot loader"];
const WIN_UPGRADE = ["Copying files", "Installing features and drivers", "Configuring settings"];

// An in-place upgrade running over its hours, software kept.
function OsUpgrading({ os, version, progress }: { os: ServerOsId; version: string; progress: number }) {
  const steps = os === "lunix" ? LUNIX_UPGRADE : WIN_UPGRADE, at = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  if (os === "lunix") return <Debiant title={`Upgrade to Debiant GNU/Lunix ${version}`} body={<><div>{steps[at]}...</div>{bar(progress)}<div>{pct(progress)}</div></>} />;
  return (
    <WinSetup era={winEra(version) === 2 ? 2 : 1} title={`Upgrading Windoors Server ${version}`}>
      <ul className="ws-check">{steps.map((x, i) => <li key={x} className={i === at ? "on" : i < at ? "done" : ""}>{x}{i === at ? ` (${pct(progress)})` : ""}</li>)}</ul>
    </WinSetup>
  );
}

// An install the network dropped out of; any key goes on to the empty disk.
export function NetFailed({ reason }: { reason: NetFail }) {
  return (
    <Debiant title="Retrieving packages" err body={<><div>{t(reason === "noInterfaces" ? "error.noInterfaces" : "error.noAutoconf")}</div><div>{t("term.console.osInstallFailed")} Check your network connection.</div></>}>
      <Rows rows={[{ label: "<Continue>" }]} at={0} pick={() => {}} />
    </Debiant>
  );
}

// Hours left on whatever finishes at doneAt.
export const hoursLeft = (game: GameState, doneAt: number) => Math.max(0, Math.ceil(doneAt - nowHours(game)));
