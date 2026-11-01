import { dateOf, hourOfMonth, yearOf } from "../00-core/time";
import { SITES, type Site } from "./sites";

// docs/design/software.md, section 1: the operating systems a server or one of the player's VMs runs.
export type ServerOsId = "lunix" | "windoors";
// docs/design/plans/software-licences.md, Licence models over time: a license era runs from its year and month (January
// unless set) until the next one. A once era sells a key for the major on sale, per machine for an OS and per CPU socket of a
// server for software, and upgrade is its price for holders of the previous major's key bought within 12 months. Every other
// kind is a term paid per month, or per year with period: per physical core of a server or vCPU of a VM (core, a server billed
// for at least minCores and minCoresPerCpu per socket), per node (server), per web space (account) or per game server beyond
// the free ones (gameserver). editions lists the tiers on sale; all of them when unset.
export type LicenseKind = "once" | "core" | "server" | "account" | "gameserver" | "free";
export interface LicenseEra {
  from: number; month?: number; kind: LicenseKind; fee: number; period?: "year"; upgrade?: number;
  minCores?: number; minCoresPerCpu?: number; free?: number; editions?: string[];
}
export const licensingAt = (x: { licensing: LicenseEra[] }, year: number, month = 1): LicenseEra =>
  [...x.licensing].reverse().find((e) => e.from < year || (e.from === year && (e.month ?? 1) <= month)) ?? x.licensing[0];
export const eraAt = (x: { licensing: LicenseEra[] }, hour: number): LicenseEra =>
  licensingAt(x, yearOf(hour), dateOf(hour).getUTCMonth() + 1);
// from is the first game year the version exists; an install takes the newest one out. updatesUntil and securityUntil are
// the hours its fixes and its security fixes end (docs/design/software-versions.md).
export interface ServerOsVersion { version: string; name: string; from: number; updatesUntil: number; securityUntil: number }
export interface ServerOs {
  id: ServerOsId; name: string; versions: ServerOsVersion[];
  licensing: LicenseEra[];
  // Days a fresh install runs without a key; null when a key is needed at install. Missing on free software.
  trialDays?: number | null;
  // Game minutes from power on to the login and from a clean shutdown to power off, and game hours the installer runs.
  bootMinutes: number; haltMinutes: number; installHours: number;
  site: Site;
}

const v = (version: string, from: number, updates: string, security: string, name = ""): ServerOsVersion =>
  ({ version, name, from, updatesUntil: hourOfMonth(updates), securityUntil: hourOfMonth(security) });

export const SERVER_OS: ServerOs[] = [
  {
    id: "lunix", name: "Debiant GNU/Lunix", licensing: [{ from: 2005, kind: "free", fee: 0 }], bootMinutes: 20, haltMinutes: 5, installHours: 1, site: SITES.lunix,
    versions: [
      v("3.1", 2005, "2008-03", "2008-03", "Sarge"), v("4", 2007, "2010-02", "2010-02", "Etch"), v("5", 2009, "2012-02", "2012-02", "Lenny"),
      v("6", 2011, "2014-05", "2016-02", "Squeeze"), v("7", 2013, "2016-04", "2018-05", "Wheezy"), v("8", 2015, "2018-06", "2020-06", "Jessie"),
      v("9", 2017, "2020-07", "2022-07", "Stretch"), v("10", 2019, "2022-09", "2024-06", "Buster"), v("11", 2021, "2024-08", "2026-08", "Bullseye"),
      v("12", 2023, "2026-07", "2028-06", "Bookworm"),
    ],
  },
  {
    id: "windoors", name: "Windoors Server", bootMinutes: 40, haltMinutes: 10, installHours: 2, site: SITES.windoors,
    licensing: [{ from: 2005, kind: "once", fee: 600, upgrade: 300 }, { from: 2016, month: 10, kind: "core", fee: 4, minCores: 16, minCoresPerCpu: 8 }], trialDays: 180,
    versions: [
      v("2003", 2005, "2010-07", "2015-07"), v("2008", 2008, "2015-01", "2020-01"), v("2008 R2", 2010, "2015-01", "2020-01"),
      v("2012", 2012, "2018-10", "2023-10"), v("2012 R2", 2014, "2018-10", "2023-10"), v("2016", 2016, "2022-01", "2027-01"),
      v("2019", 2019, "2024-01", "2029-01"), v("2022", 2022, "2026-10", "2031-10"), v("2025", 2025, "2029-11", "2034-11"),
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
