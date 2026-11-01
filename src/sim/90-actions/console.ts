// The server's own screen (docs/design/console.md): the BIOS setup a key during POST or at the firmware prompt opens,
// and the installer on the USB stick the boot menu starts. While a server sits in setup its boot waits, so its workloads
// stay down.
import { nowHours, yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import type { Device, GameState, IfaceConfig } from "../50-state";
import { clustersOn, dropCluster, insideVm, isOwnVm, machineOf, setMachine, vmById, workloadsOn, type Cluster, type Workload } from "../60-infra/cluster";
import { imageOf, imageParts, nextVersion, SERVER_OS, serverOsById, type OsImage, type ServerOsId, type ServerOsVersion } from "../10-catalog/server-os";
import { machineNet, osUp, stickOs } from "../60-infra/oob";
import { pushLog } from "../60-infra/power";
import { BOOT_HOURS, bootHours, booting, powered } from "../60-infra/status";
import { reportLoss } from "../85-products/products";
import { installKeyBlock, licenseInstall, releaseMachine, upgradeKey, upgradeKeyBlock } from "../60-infra/licence";
import { softwareById } from "../10-catalog/platforms";
import { nextMajor, type SoftwareVersion } from "../10-catalog/software-versions";
import { leave } from "./clusters";
import type { ActionResult } from "./hardware";
import { staticRouter } from "../60-infra/lan";
import { installSoftware, uninstallSoftware } from "./software";

const fail = (error: string): ActionResult => ({ ok: false, error });
// A machine is a server or one of the player's own VMs; a VM has no label, so its hostname is the vmNNN it got at birth.
type Machine = Device | Workload;
const isDevice = (m: Machine): m is Device => "components" in m;
const hostOf = (m: Machine) => (isDevice(m) ? m.hostname ?? m.label ?? m.name : m.hostname ?? m.id);

const server = (s: GameState, deviceId: string): Device | string => {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return "error.unknownDevice";
  if (modelById(d.model).kind !== "server") return "error.notServer";
  if (!d.on || !powered(s, d.id)) return "error.serverOff";
  return d;
};

// Del during POST, or at the firmware prompt a stuck boot waits at. The key counts for the whole boot, which is the time
// the console shows the splash.
export function enterSetup(s: GameState, deviceId: string): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (d.setup) return { ok: true };
  if ((!booting(s, d) && !d.stuck) || (d.os && d.os.installedAt > nowHours(s))) return fail("error.notAtPost");
  d.setup = true;
  d.stuck = false;
  pushLog(d, s.hour, "ipmi.log.setup");
  return { ok: true };
}

// Leaving setup, saved or discarded, lets the boot run on; every setting applied on the spot.
export function exitSetup(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.setup) return fail("error.notInSetup");
  d.setup = false;
  d.bootUntil = nowHours(s) + bootHours(s, d);
  pushLog(d, s.hour, "ipmi.log.setupLeft");
  return { ok: true };
}

// The boot menu's USB entry, there while the stick is in the server and written with an OS. The operating system on the disks is not running while the server is booted from the stick, so this is also the one way to erase it.
export function bootFromUsb(s: GameState, deviceId: string): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (d.setup) return fail("error.notAtPost");
  if (!stickOs(s, d.id)) return fail("error.noBootDevice");
  d.bootFrom = "usb";
  d.stuck = false;
  // Picking a boot device ends POST.
  d.bootUntil = Math.min(d.bootUntil ?? 0, nowHours(s));
  pushLog(d, s.hour, "ipmi.log.usbBoot");
  return { ok: true };
}

// What the installer finds on the disks: nothing, software nobody uses, or software with customers on it. workloads is
// what sits on the server (nothing for a VM), lost what dies with it: the customers' workloads, those inside the player's
// own VMs included.
export type InstallCase = { kind: "empty" } | { kind: "idle"; cluster: Cluster } | { kind: "busy"; cluster: Cluster; workloads: Workload[]; lost: Workload[] };
export function installCase(s: GameState, machineId: string): InstallCase {
  const vm = !s.devices.some((d) => d.id === machineId);
  const cluster = clustersOn(s, machineId)[0];
  if (!cluster) return { kind: "empty" };
  const workloads = vm ? [] : workloadsOn(s, machineId);
  const lost = vm ? insideVm(s, machineId) : workloads.flatMap((w) => (isOwnVm(w) ? insideVm(s, w.id) : [w]));
  if (!workloads.length && !lost.length) return { kind: "idle", cluster };
  return { kind: "busy", cluster, workloads, lost };
}

// Erasing a machine with customers on it loses their data the way a dead array does: the same loss report, refund tickets
// and reputation hit. Their services end with it, since nothing is left to restore to. A VM's loss is booked on its host.
// ponytail: no restore from backup onto the reinstalled machine; add when a player asks for it.
function wipe(s: GameState, m: Machine, ws: Workload[], lost: Workload[]): void {
  const d = isDevice(m) ? m : s.devices.find((x) => x.id === m.deviceId);
  if (isDevice(m)) m.dataLost = s.hour;
  if (d) reportLoss(s, d, lost, s.hour, []);
  const gone = new Set([...ws, ...lost].map((w) => w.id)), services = new Set(lost.map((w) => w.serviceId));
  for (const nested of s.clusters.filter((x) => x.vm && gone.has(x.vm))) dropCluster(s, nested.id);
  s.workloads = s.workloads.filter((w) => !gone.has(w.id));
  s.services = s.services.map((v) => (services.has(v.id) && v.endedAt === null ? { ...v, endedAt: s.hour } : v));
  for (const c of clustersOn(s, m.id)) if (isDevice(m) && c.nodes.length > 1) leave(s, c.id, m.id); else dropCluster(s, c.id);
  if (isDevice(m)) pushLog(m, s.hour, "ipmi.log.erased");
}

// Clears the disks for the installer: software nobody uses goes quietly, software with customers on it needs the machine's
// hostname typed.
function clear(s: GameState, m: Machine, confirm: string | undefined): ActionResult {
  const c = installCase(s, m.id);
  if (c.kind === "empty") return { ok: true };
  if (c.kind === "idle") {
    for (const x of clustersOn(s, m.id)) { const r = uninstallSoftware(s, m.id, x.panel ?? x.platform ?? x.switching?.to); if (!r.ok) return r; }
    return { ok: true };
  }
  if (confirm !== hostOf(m)) return fail("error.confirmHostname");
  wipe(s, m, c.workloads, c.lost);
  return { ok: true };
}

// The machine booted into its installer: a server from the stick, a VM from the ISO, or why not.
const atInstaller = (s: GameState, machineId: string): Machine | string => {
  const vm = vmById(s, machineId);
  if (vm) return !isOwnVm(vm) ? "error.notOwnVm" : vm.stopped ? "error.alreadyStopped" : !vm.media ? "error.noMedia" : vm;
  const d = server(s, machineId);
  return typeof d === "string" ? d : d.bootFrom !== "usb" ? "error.notFromUsb" : !stickOs(s, d.id) ? "error.noBootDevice" : d;
};

// The installer's Install: whatever the disks held goes first, then the OS installs for its install hours, the version
// on the media. os.installedAt is the hour it is done; a server is held in its boot until then and boots from its disk
// after, a VM ejects its ISO. The stick and an ISO each hold one version of one OS. A server keeps the network
// setting the installer chose, and its old files go with the old disk contents. A licensed OS takes the typed key or
// runs its trial.
// The error key for a hostname the installer cannot take: RFC 1123 labels, lowercase, unique among servers and VMs.
export function badHostname(s: GameState, machineId: string, name: string): string | null {
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) return "error.badHostname";
  const taken = [...s.devices, ...s.workloads].some((x) => x.id !== machineId && x.hostname === name);
  return taken ? "error.hostnameTaken" : null;
}

export function installOs(s: GameState, machineId: string, osId: ServerOsId, confirm?: string, iface: IfaceConfig = { mode: "dhcp" }, key?: string, hostname?: string): ActionResult {
  const m = atInstaller(s, machineId);
  if (typeof m === "string") return fail(m);
  const badName = hostname === undefined ? null : badHostname(s, machineId, hostname);
  if (badName) return fail(badName);
  if (!SERVER_OS.some((o) => o.id === osId)) return fail("error.unknownOs");
  const media = isDevice(m) ? stickOs(s, m.id) : m.media;
  if (!media || imageParts(media).id !== osId) return fail("error.otherMedia");
  // The Debiant image is a netinst; Windoors Setup carries everything on its image.
  const net = osId === "lunix" ? machineNet(s, machineId) : null;
  if (net) return fail(net === "noInterfaces" ? "error.noInterfaces" : "error.noAutoconf");
  // A static setting reaches the mirror only through the router of its network.
  if (osId === "lunix" && iface.mode === "static" && isDevice(m) && !staticRouter(s, m.id, iface)) return fail("error.noMirror");
  const version = imageParts(media).version, bad = installKeyBlock(s, machineId, osId, version, key);
  if (bad) return fail(bad);
  const cleared = clear(s, m, confirm);
  if (!cleared.ok) return cleared;
  const os = serverOsById(osId), done = nowHours(s) + os.installHours;
  setMachine(s, machineId, () => ({ os: { id: osId, version, installedAt: done }, software: [] }));
  releaseMachine(s, machineId);
  licenseInstall(s, machineId, osId, version, key);
  const named = hostname === undefined ? {} : { hostname };
  if (isDevice(m)) {
    Object.assign(m, { bootFrom: "disk", stuck: false, bootUntil: done + BOOT_HOURS + os.bootMinutes / 60, iface }, named);
    delete s.files[m.id];
  } else s.workloads = s.workloads.map((w) => (w.id === machineId ? { ...w, media: undefined, ...named } : w));
  return { ok: true };
}

// docs/design/software.md, section 4.4: the release an in-place upgrade takes the machine to, the next one once it is out.
export const upgradeTarget = (s: GameState, machineId: string): ServerOsVersion | null => {
  const os = machineOf(s, machineId)?.os;
  return os && os.installedAt <= nowHours(s) ? nextVersion(os.id, os.version, yearOf(s.hour)) : null;
};
// Hours the machine is down for an upgrade: the OS's install hours and its boot, after POST on a server.
export const upgradeHours = (s: GameState, machineId: string): number => {
  const os = serverOsById(machineOf(s, machineId)!.os!.id);
  return os.installHours + os.bootMinutes / 60 + (s.devices.some((d) => d.id === machineId) ? BOOT_HOURS : 0);
};

// What runs on the machine is down for the hours and counts them against its SLA; what was migrated off first stays up.
function takeDown(s: GameState, machineId: string, hours: number): void {
  const found = installCase(s, machineId), down = found.kind === "busy" ? [...found.workloads, ...found.lost] : [];
  const ids = new Set(down.map((w) => w.id)), services = new Set(down.filter((w) => !isOwnVm(w)).map((w) => w.serviceId));
  s.workloads = s.workloads.map((w) => (ids.has(w.id) ? { ...w, busyUntil: Math.max(w.busyUntil, s.hour + hours) } : w));
  // The hourly tick counts every whole hour a workload is busy; the rest is added here, as for a software update.
  const rest = hours - (Math.ceil(hours) - 1);
  for (const id of services) s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + rest };
}

// Upgrades the machine's OS in place to the next release, keeping its software: Debiant from its running shell over the
// network, Windoors from Setup on the next release's media. A key for an older major needs the key typed in Setup.
export function upgradeOs(s: GameState, machineId: string, key?: string): ActionResult {
  const m = machineOf(s, machineId);
  if (!m?.os) return fail(m ? "error.noSoftware" : "error.unknownDevice");
  const next = upgradeTarget(s, machineId);
  if (!next) return fail("error.noUpgrade");
  if (m.os.id === "lunix") {
    if (!osUp(s, machineId)) return fail("error.osNotUp");
    if (machineNet(s, machineId)) return fail("error.noDownload");
  } else {
    const at = atInstaller(s, machineId);
    if (typeof at === "string") return fail(at);
    if ((isDevice(at) ? stickOs(s, at.id) : at.media) !== imageOf(m.os.id, next.version)) return fail("error.otherMedia");
  }
  const blocked = upgradeKeyBlock(s, machineId, m.os.id, next.version, key);
  if (blocked) return fail(blocked);
  const hours = upgradeHours(s, machineId), done = nowHours(s) + serverOsById(m.os.id).installHours, from = m.os.version;
  // A VM's own console stays on and shows the upgrade.
  takeDown(s, machineId, hours);
  upgradeKey(s, machineId, m.os.id, next.version, key);
  setMachine(s, machineId, (x) => ({ os: { ...x.os!, version: next.version, installedAt: done, from } }));
  if (isDevice(m)) {
    Object.assign(m, { bootFrom: "disk", stuck: false, bootUntil: nowHours(s) + hours });
    pushLog(m, s.hour, "ipmi.log.upgrade");
  } else s.workloads = s.workloads.map((w) => (w.id === machineId ? { ...w, media: undefined } : w));
  return { ok: true };
}

// docs/design/plans/software-licences.md, Versions: the release an upgrade of installed software takes it to, the newest of
// the next major once it is out; null while it installs or upgrades.
export const softwareTarget = (s: GameState, machineId: string, product: string): SoftwareVersion | null => {
  const x = machineOf(s, machineId)?.software?.find((y) => y.id === product);
  return x && (x.doneAt === null || x.doneAt <= s.hour) ? nextMajor(product, x.version, s.hour) : null;
};

// Why the software cannot step up one major now: nothing newer, no network, or a key for an older major and no upgrade key.
export function softwareUpgradeBlock(s: GameState, machineId: string, product: string, key?: string): string | null {
  if (!machineOf(s, machineId)?.software?.some((x) => x.id === product)) return "error.noSoftware";
  const next = softwareTarget(s, machineId, product);
  if (!next) return "error.noMajorUpgrade";
  if (!osUp(s, machineId)) return "error.osNotUp";
  if (machineNet(s, machineId)) return "error.noDownload";
  return upgradeKeyBlock(s, machineId, product, next.version, key);
}

// Upgrades installed software one major in place over its install hours; what runs on the machine is down meanwhile and
// the software runs its old version until the upgrade is done. A typed key replaces the one the machine held.
export function upgradeSoftware(s: GameState, machineId: string, product: string, key?: string): ActionResult {
  const blocked = softwareUpgradeBlock(s, machineId, product, key);
  if (blocked) return fail(blocked);
  const next = softwareTarget(s, machineId, product)!, hours = softwareById(product).installHours;
  takeDown(s, machineId, hours);
  upgradeKey(s, machineId, product, next.version, key);
  setMachine(s, machineId, (m) => ({ software: m.software.map((x) => (x.id === product ? { ...x, version: next.version, from: x.version, doneAt: s.hour + hours } : x)) }));
  return { ok: true, id: next.version };
}

// Any key on the failure an abandoned install left on the console.
export function dismissInstallFail(s: GameState, machineId: string): ActionResult {
  if (!vmById(s, machineId) && !s.devices.some((d) => d.id === machineId)) return fail("error.unknownDevice");
  setMachine(s, machineId, () => ({ installFailed: undefined }));
  return { ok: true };
}

// Software whose installer comes from its website: Server Manager, Add or Remove Programs, apt and the script lines.
export function installFromSite(s: GameState, machineId: string, softwareId: string, key?: string): ActionResult {
  return machineNet(s, machineId) ? fail("error.noDownload") : installSoftware(s, machineId, softwareId, key);
}

// The installer's Erase disk: bare metal, or an empty VM, under the same confirmation as a reinstall.
export function eraseDisk(s: GameState, machineId: string, confirm?: string): ActionResult {
  const m = atInstaller(s, machineId);
  if (typeof m === "string") return fail(m);
  if (installCase(s, machineId).kind === "empty" && !m.os) return fail("error.noSoftware");
  const cleared = clear(s, m, confirm);
  if (cleared.ok) setMachine(s, machineId, () => ({ os: null, software: [] }));
  if (cleared.ok) releaseMachine(s, machineId);
  return cleared;
}

// The ISO of an OS in one of the player's own VMs: loaded, the VM boots its installer; ejected, or once the installer
// starts, its own disk again. A VM has no BIOS and no boot menu, the media decides.
export function setMedia(s: GameState, vmId: string, media: OsImage | null): ActionResult {
  const vm = vmById(s, vmId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  if (media && !s.media.images.includes(media)) return fail("error.noImage");
  s.workloads = s.workloads.map((w) => (w.id === vmId ? { ...w, media: media ?? undefined } : w));
  return { ok: true };
}
