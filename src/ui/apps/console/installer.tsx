import type { ReactNode } from "react";
import { useState } from "react";
import { nowHours } from "../../../sim/00-core/time";
import { softwareById } from "../../../sim/10-catalog/platforms";
import { serverOsById, type ServerOsId } from "../../../sim/10-catalog/server-os";
import type { Device, GameState, NetFail } from "../../../sim/50-state";
import type { Workload } from "../../../sim/60-infra/cluster";
import { machineNet } from "../../../sim/60-infra/oob";
import { drivesOf, raidUsable } from "../../../sim/60-infra/status";
import { badHostname, eraseDisk, installCase, installOs, setMedia, upgradeHours, upgradeOs, upgradeTarget } from "../../../sim/90-actions/console";
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
  const array = isDevice(m) ? `${drives.length} x ${disk(drives[0]?.size ?? 0)}${m.raid === "none" ? "" : ` RAID ${m.raid}`}, ${disk(raidUsable(m))}` : t("console.virtualDisk", { size: disk(m.diskGb) });
  const had = found.kind === "empty" ? null : softwareById(found.cluster.panel ?? found.cluster.platform ?? found.cluster.switching?.to ?? "").name;
  const dies = found.kind === "busy" ? [...new Set([...found.workloads, ...found.lost])] : [];
  const customers = found.kind === "busy" ? new Set(found.lost.map((w) => game.services.find((v) => v.id === w.serviceId)?.customerId).filter(Boolean)).size : 0;
  const backed = found.kind === "busy" ? found.lost.filter((w) => w.backupAt !== null).length : 0;
  const what = (
    <>
      {found.kind === "empty" && !m.os && <div>{t("console.disksEmpty")}</div>}
      {found.kind === "empty" && m.os && <div>{t("console.disksHoldOs", { os: serverOsById(m.os.id).name, version: m.os.version })}</div>}
      {found.kind === "idle" && <div>{t("console.disksHoldSoftware", { name: had ?? "", cluster: found.cluster.name })}</div>}
      {busy && <>
        <div>{t("console.clusterRuns", { cluster: found.cluster.name, name: had ?? "" })}</div>
        <ul>{dies.map((w) => <li key={w.id}>{w.hostname ?? vmLabel(game, w).name}</li>)}</ul>
        <div>{t("console.customers", { n: customers, backed })}</div>
        <div>{t("console.typeToConfirm", { host: hostOf(m) })} <b>{typed}</b>_</div>
      </>}
    </>
  );
  const run = (r: { ok: boolean; error?: string }) => { setNote(r.ok ? "" : t(r.error ?? "")); setTyped(""); };
  const install = (os: ServerOsId, hostname?: string) => { const r = act(installOs, m.id, os, busy ? typed : undefined, hostname); run(r); return r.ok; };
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
  const [host, setHost] = useState(() => hostOf(m));
  const go = (to: LunixStep) => () => { setStep(to); tg.setNote(""); tg.setTyped(""); };
  const named = () => { const bad = badHostname(game, m.id, host); if (bad) tg.setNote(t(bad)); else go("disks")(); };
  const typeHost = (key: string) => {
    if (key === "Backspace") setHost((v) => v.slice(0, -1));
    else if (key.length === 1) setHost((v) => v + key.toLowerCase());
    else return false;
    return true;
  };
  const back = (to: LunixStep): Row => ({ label: t("console.goBack"), run: go(to) });
  const pages: Record<LunixStep, Page> = {
    boot: { title: t("console.debBoot", { version }), rows: [
      { label: t("console.install"), run: go("language") },
      { label: t("console.eraseDisk"), dim: tg.empty, run: tg.empty ? () => tg.setNote(t("error.noSoftware")) : go("erase") },
      { label: isDevice(m) ? t("console.reboot") : t("console.ejectReboot"), run: tg.leave },
    ] },
    language: { title: t("console.selectLanguage"), rows: [...LANGUAGES.map((l) => ({ label: l, run: go("hostname") })), back("boot")] },
    hostname: net
      ? { title: t("console.configureNetwork"), err: true, body: <div>{t(net === "noInterfaces" ? "error.noInterfaces" : "error.noAutoconf")}</div>, rows: [{ label: t("console.continue"), run: go("fetch") }] }
      : { title: t("console.configureNetwork"), body: <div>{t("console.hostname", { host })}_</div>, rows: [{ label: t("console.continue"), run: named }, back("language")] },
    fetch: { title: t("console.retrievingPackages"), err: true, body: <div>{t("term.console.osInstallFailed")} {t("console.checkNetwork")}</div>, rows: [{ label: t("console.abort"), run: () => { go("boot")(); tg.leave(); } }] },
    disks: { title: t("console.partitionDisks"), body: <div>{t("console.partitioningMethod")}</div>, rows: [{ label: t("console.guided", { array: tg.array }), run: go("write") }, back("hostname")] },
    write: { title: t("console.partitionDisks"), body: <>{tg.what}<div>{t("console.writeChanges")}</div></>, rows: [{ label: t("console.yes"), run: () => tg.install("lunix", host) && setStep("boot") }, { label: t("console.no"), run: go("disks") }] },
    erase: { title: t("console.eraseDisk"), body: tg.what, rows: [{ label: t("console.erase"), run: tg.erase }, back("boot")] },
  };
  const page = pages[step], naming = step === "hostname" && !net, typing = naming || ((step === "write" || step === "erase") && tg.found.kind === "busy");
  const pager = usePager({ ...page, keys: { Escape: go("boot") } }, (k) => typing && (naming ? typeHost(k) : tg.type(k)));
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
      <div className="deb-f">{t("console.debFoot")}</div>
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
  const part = tg.empty ? t("console.winUnpartitioned", { array: tg.array }) : `C:  Partition1 [NTFS]   ${tg.array}`;
  const suffix = era === 2 ? t("console.winDesktopExperience") : version.startsWith("2008") ? t("console.winFullInstallation") : t("console.winServerGui");
  const pages: Record<WinStep, Page> = era === 0 ? {
    start: { title: t("console.winWelcome"), body: <div>{t("console.winWelcomeBody")}</div>, rows: [], keys: { Enter: go("license"), F3: tg.leave }, foot: t("console.winWelcomeFoot") },
    edition: { title: "", rows: [] },
    type: { title: "", rows: [] },
    upgrade: { title: "", rows: [] },
    license: { title: t("console.winLicenseTitle"), body: <div>{t("console.winLicenseBody")}</div>, rows: [], keys: { F8: go("where"), Escape: go("start") }, foot: t("console.winLicenseFoot") },
    where: { title: t("console.winPartitions"), rows: [{ label: part, run: install }], keys: { d: del, D: del, F3: tg.leave }, foot: t("console.winWhereFoot") },
    install: { title: t("console.winFormat"), body: tg.what, rows: [], keys: { Enter: setup, Escape: go("where") }, foot: t("console.winFormatFoot") },
    delete: { title: t("console.winDeletePartition"), body: tg.what, rows: [], keys: { Enter: tg.erase, Escape: go("where") }, foot: t("console.winDeleteFoot") },
  } : {
    start: { title: `Windoors Server ${version}`, rows: [{ label: t("console.winInstallNow"), run: go("edition") }] },
    edition: { title: t("console.winSelectOs"), rows: ["Standard", "Datacenter"].map((e) => ({ label: `Windoors Server ${version} ${e}${suffix}`, run: go("license") })) },
    license: { title: t("console.winLicenseTerms"), rows: [{ label: t("console.winAccept"), run: go(upgrade ? "type" : "where") }, { label: t("console.back"), run: go("edition") }] },
    type: { title: t("console.winInstallType"), rows: [{ label: t("console.winTypeUpgrade"), run: go("upgrade") }, { label: t("console.winTypeCustom"), run: go("where") }, { label: t("console.back"), run: go("license") }] },
    upgrade: { title: t("console.winUpgradeTo", { version }), body: <div>{t("term.apt.downtime", { minutes: upgrade ? Math.round(upgradeHours(game, m.id) * 60) : 0 })}</div>, rows: [{ label: t("console.upgrade"), run: upgradeNow }, { label: t("console.back"), run: go("type") }] },
    where: { title: t("console.winWhere"), body: <div className="win-disk">{t("console.winDrive", { space: tg.empty ? t("console.winUnallocated") : t("console.winPartition1") })}<span>{tg.array}</span></div>, rows: [{ label: t("console.next"), run: install }, { label: t("console.delete"), dim: tg.empty, run: del }, { label: t("console.back"), run: go("license") }] },
    install: { title: t("console.winUnableBoot"), body: tg.what, rows: [{ label: t("console.ok"), run: setup }, { label: t("console.cancel"), run: go("where") }] },
    delete: { title: t("console.winDeleteTitle"), body: tg.what, rows: [{ label: t("console.ok"), run: tg.erase }, { label: t("console.cancel"), run: go("where") }] },
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
      <div className="wt-h">{t("console.winSetupTitle", { version })}</div>
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
        <div className="ws-bar">{t("console.winInstallWindow")}</div>
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

const LUNIX_STAGES = [t("console.lxStage1"), t("console.lxStage2"), t("console.lxStage3"), t("console.lxStage4")];
const WIN_STEPS = [t("console.winStep1"), t("console.winStep2"), t("console.winStep3"), t("console.winStep4"), t("console.winStep5")];
const GUI_STEPS = [t("console.guiStep1"), t("console.guiStep2"), t("console.guiStep3"), t("console.guiStep4"), t("console.guiStep5")];

// The install running over its hours: the Debiant progress bar, or Setup's percentages with its two reboots.
export function OsInstalling({ m, os, progress }: { m: Machine; os: ServerOsId; progress: number }) {
  const version = m.os?.version ?? "";
  if (m.os?.from) return <OsUpgrading os={os} version={version} progress={progress} />;
  if (os === "lunix") {
    if (progress >= 0.95) return <Debiant title={t("console.finishInstall")} body={<div>{t("console.installComplete")}</div>} />;
    const stage = LUNIX_STAGES[Math.min(LUNIX_STAGES.length - 1, Math.floor((progress / 0.95) * LUNIX_STAGES.length))];
    return <Debiant title={t("console.installSystem")} body={<><div>{stage}...</div>{bar(progress / 0.95)}<div>{pct(progress / 0.95)}</div></>} />;
  }
  const era = winEra(version);
  const restarting = (progress >= 0.45 && progress < 0.5) || progress >= 0.95;
  if (restarting) return <div className="wb" data-era={era}><div className="wb-logo">Windoors</div><div>{era === 0 ? t("console.winRestartingOld") : t("console.winRestarting")}</div></div>;
  if (era === 0 && progress < 0.45) {
    return <WinText version={version} foot="" note=""><div className="wt-title">{t("console.winCopyWait")}</div><div className="wt-copy">{t("console.winCopying")} {pct(progress / 0.45)}{bar(progress / 0.45)}</div></WinText>;
  }
  if (era === 0) {
    const left = Math.max(1, Math.round((1 - progress) * serverOsById(os).installHours * 60)), at = 3 + Math.floor(((progress - 0.5) / 0.45) * 2);
    return (
      <div className="wg">
        <ul className="wg-steps">{GUI_STEPS.map((x, i) => <li key={x} className={i === at ? "on" : i < at ? "done" : ""}>{x}</li>)}</ul>
        <div className="wg-left">{t("console.winCompleteIn", { n: left })}</div>
        <div className="wg-main">{t("console.winInstalling")}{bar((progress - 0.5) / 0.45)}</div>
      </div>
    );
  }
  const share = progress < 0.45 ? progress / 0.45 : (progress - 0.5) / 0.45, at = progress < 0.45 ? Math.min(1, Math.floor(share * 2)) : 2 + Math.min(2, Math.floor(share * 3));
  return (
    <WinSetup era={era} title={t("console.winInstallingDots")}>
      <ul className="ws-check">{WIN_STEPS.map((x, i) => <li key={x} className={i === at ? "on" : i < at ? "done" : ""}>{x}{i === at && i === 1 ? ` (${pct(share)})` : ""}</li>)}</ul>
    </WinSetup>
  );
}

const LUNIX_UPGRADE = [t("console.upLx1"), t("console.upLx2"), t("console.upLx3"), t("console.upLx4")];
const WIN_UPGRADE = [t("console.upWin1"), t("console.upWin2"), t("console.upWin3")];

// An in-place upgrade running over its hours, software kept.
function OsUpgrading({ os, version, progress }: { os: ServerOsId; version: string; progress: number }) {
  const steps = os === "lunix" ? LUNIX_UPGRADE : WIN_UPGRADE, at = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  if (os === "lunix") return <Debiant title={t("console.upgradeDeb", { version })} body={<><div>{steps[at]}...</div>{bar(progress)}<div>{pct(progress)}</div></>} />;
  return (
    <WinSetup era={winEra(version) === 2 ? 2 : 1} title={t("console.upgradingWin", { version })}>
      <ul className="ws-check">{steps.map((x, i) => <li key={x} className={i === at ? "on" : i < at ? "done" : ""}>{x}{i === at ? ` (${pct(progress)})` : ""}</li>)}</ul>
    </WinSetup>
  );
}

// An install the network dropped out of; any key goes on to the empty disk.
export function NetFailed({ reason }: { reason: NetFail }) {
  return (
    <Debiant title={t("console.retrievingPackages")} err body={<><div>{t(reason === "noInterfaces" ? "error.noInterfaces" : "error.noAutoconf")}</div><div>{t("term.console.osInstallFailed")} {t("console.checkNetwork")}</div></>}>
      <Rows rows={[{ label: t("console.continue") }]} at={0} pick={() => {}} />
    </Debiant>
  );
}

// Hours left on whatever finishes at doneAt.
export const hoursLeft = (game: GameState, doneAt: number) => Math.max(0, Math.ceil(doneAt - nowHours(game)));
