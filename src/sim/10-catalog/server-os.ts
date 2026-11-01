import { SITES, type Site } from "./sites";

// docs/design/software.md, section 1: the operating systems a server or one of the player's VMs runs.
export type ServerOsId = "lunix" | "windoors";
// A license era, from its year on: one price per machine at install (once, for software per CPU socket of a server), or a
// monthly fee per physical core of the nodes (core, per vCPU of a VM for an OS), per node (server) or per web space (account).
export type LicenseKind = "once" | "core" | "server" | "account" | "free";
export interface LicenseEra { from: number; kind: LicenseKind; fee: number }
export const licensingAt = (x: { licensing: LicenseEra[] }, year: number): LicenseEra =>
  [...x.licensing].reverse().find((e) => e.from <= year) ?? x.licensing[0];
// from is the first game year the version exists; an install takes the newest one out.
export interface ServerOsVersion { version: string; name: string; from: number }
export interface ServerOs {
  id: ServerOsId; name: string; versions: ServerOsVersion[];
  licensing: LicenseEra[];
  // Days a fresh install runs without a key; null when a key is needed at install. Missing on free software.
  trialDays?: number | null;
  // Game minutes from power on to the login and from a clean shutdown to power off, and game hours the installer runs.
  bootMinutes: number; haltMinutes: number; installHours: number;
  site: Site;
}

const v = (version: string, from: number, name = ""): ServerOsVersion => ({ version, name, from });

export const SERVER_OS: ServerOs[] = [
  {
    id: "lunix", name: "Debiant GNU/Lunix", licensing: [{ from: 2005, kind: "free", fee: 0 }], bootMinutes: 20, haltMinutes: 5, installHours: 1, site: SITES.lunix,
    versions: [
      v("3.1", 2005, "Sarge"), v("4", 2007, "Etch"), v("5", 2009, "Lenny"), v("6", 2011, "Squeeze"), v("7", 2013, "Wheezy"),
      v("8", 2015, "Jessie"), v("9", 2017, "Stretch"), v("10", 2019, "Buster"), v("11", 2021, "Bullseye"), v("12", 2023, "Bookworm"),
    ],
  },
  {
    id: "windoors", name: "Windoors Server", bootMinutes: 40, haltMinutes: 10, installHours: 2, site: SITES.windoors,
    licensing: [{ from: 2005, kind: "once", fee: 600 }, { from: 2016, kind: "core", fee: 4 }], trialDays: 180,
    versions: [
      v("2003", 2005), v("2008", 2008), v("2008 R2", 2010), v("2012", 2012), v("2012 R2", 2014), v("2016", 2016), v("2019", 2019),
      v("2022", 2022), v("2025", 2025),
    ],
  },
];

// economy.md, Platforms and licenses: monthly euros per VMwhere cluster with the App Suite.
export const APP_SUITE_FEE = 25;

export const serverOsById = (id: ServerOsId): ServerOs => SERVER_OS.find((o) => o.id === id)!;
export const serverOsAt = (id: ServerOsId, year: number): ServerOsVersion => {
  const vs = serverOsById(id).versions;
  return [...vs].reverse().find((x) => x.from <= year) ?? vs[0];
};

// An ISO image or installed media: one version of one OS, as "lunix@12".
export type OsImage = `${ServerOsId}@${string}`;
export const imageOf = (id: ServerOsId, version: string): OsImage => `${id}@${version}`;
export const imageParts = (img: OsImage): { id: ServerOsId; version: string } => {
  const at = img.indexOf("@");
  return { id: img.slice(0, at) as ServerOsId, version: img.slice(at + 1) };
};
export const imageName = (img: OsImage): string => { const { id, version } = imageParts(img); return `${serverOsById(id).name} ${version}`; };
export const imageExists = (img: string): img is OsImage => {
  const { id, version } = imageParts(img as OsImage);
  return SERVER_OS.some((o) => o.id === id && o.versions.some((x) => x.version === version));
};
// Saves from before versioned images held the bare OS id, read as the newest version of the save's year.
export const asImage = (x: string, year: number): OsImage => (x.includes("@") ? (x as OsImage) : imageOf(x as ServerOsId, serverOsAt(x as ServerOsId, year).version));
// The release after the installed one, once it is out: an in-place upgrade goes one release at a time.
export const nextVersion = (id: ServerOsId, version: string, year: number): ServerOsVersion | null => {
  const vs = serverOsById(id).versions, next = vs[vs.findIndex((x) => x.version === version) + 1];
  return vs.some((x) => x.version === version) && next && next.from <= year ? next : null;
};
