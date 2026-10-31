// Installation media (docs/design/software.md, section 4.1): the ISO images downloaded from the OS sites and the one USB
// stick, written with one of them and plugged into one server at a time.
import { nowHours } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { DC_BANDWIDTH } from "../10-catalog/network";
import { homeLineById } from "../20-world/datacenters";
import { imageExists, type OsImage, type ServerOsId } from "../10-catalog/server-os";
import type { GameState } from "../50-state";
import { handJob, playerAt, present, type How } from "../60-infra/handwork";
import { consoleVia } from "../60-infra/oob";
import { pushLog } from "../60-infra/power";
import { booting, locationOf } from "../60-infra/status";
import type { ActionResult } from "./hardware";

export const PLUG_HOURS = 2 / 60;
// Image sizes in MB.
export const IMAGE_MB: Record<ServerOsId, number> = { lunix: 180, windoors: 600 };

// The player's own download speed in Mbit/s: the home line at home, the datacenter's network on site, nothing on the road.
export function downloadMbps(s: GameState): number {
  const loc = playerAt(s);
  if (!present(s, loc.id)) return 0;
  return loc.dc ? DC_BANDWIDTH.mbps : homeLineById(s.homeLine.id).down;
}

const fail = (error: string): ActionResult => ({ ok: false, error });

// The images a VM's Media menu offers.
export const mountableImages = (s: GameState): OsImage[] => s.media.images;

export function downloadImage(s: GameState, image: OsImage): ActionResult {
  if (!imageExists(image)) return fail("error.unknownOs");
  if (!s.media.images.includes(image)) s.media.images = [...s.media.images, image];
  return { ok: true };
}

// Out of every server and not on its way to one, the stick sits in the player's own computer.
export const stickHome = (s: GameState): boolean => s.media.stick.in === null && !s.devices.some((d) => d.hands?.kind === "stick");

export function writeStick(s: GameState, image: OsImage): ActionResult {
  if (!s.media.images.includes(image)) return fail("error.noImage");
  if (!stickHome(s)) return fail("error.stickAway");
  s.media.stick = { ...s.media.stick, os: image };
  return { ok: true };
}

// The server the stick is in is installing an OS from it.
const stickInstalling = (s: GameState): boolean => {
  const os = s.devices.find((d) => d.id === s.media.stick.in)?.os;
  return !!os && os.installedAt > nowHours(s);
};

// At the server the stick goes in at once; at a datacenter the player is away from, hand work brings it there.
export function plugStick(s: GameState, deviceId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind !== "server" || !d.rackId) return fail("error.noController");
  if (s.media.stick.in === d.id) return fail("error.stickIn");
  if (stickInstalling(s)) return fail("error.stickInstalling");
  const loc = locationOf(s, d);
  if (!loc?.dc || present(s, loc.id)) {
    s.media.stick = { ...s.media.stick, in: d.id };
    return { ok: true };
  }
  if (d.hands) return fail("error.handsBusy");
  const job = handJob(s, d.label ?? d.name, loc, how, PLUG_HOURS, 1);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  s.media.stick = { ...s.media.stick, in: null };
  d.hands = { kind: "stick", doneAt: s.hour + job.commit() };
  return { ok: true };
}

export function unplugStick(s: GameState): ActionResult {
  const d = s.devices.find((x) => x.id === s.media.stick.in);
  if (!d) return fail("error.stickOut");
  const loc = locationOf(s, d);
  if (loc?.dc && !present(s, loc.id)) return fail("error.notThere");
  if (stickInstalling(s)) return fail("error.stickInstalling");
  s.media.stick = { ...s.media.stick, in: null };
  return { ok: true };
}

// Mounts a downloaded image through the server's management controller, or ejects it with null. A server that waits at its
// boot menu or setup takes the image as its boot source at once, as the stick does.
export function mountVirtualMedia(s: GameState, deviceId: string, image: OsImage | null): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (consoleVia(s, d.id)?.kind !== "bmc") return fail("error.noController");
  if (image === null) {
    if (!d.virtualMedia) return fail("error.noVirtualMedia");
    delete d.virtualMedia;
    pushLog(d, s.hour, "readouts.ipmi.ejected");
    return { ok: true };
  }
  if (!s.media.images.includes(image)) return fail("error.noImage");
  d.virtualMedia = image;
  if (d.on && (d.setup || d.stuck || booting(s, d))) d.bootFrom = "usb";
  pushLog(d, s.hour, "readouts.ipmi.mounted");
  return { ok: true };
}
