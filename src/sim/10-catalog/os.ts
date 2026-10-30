import { monthIndexOf } from "../00-core/time";

// Pear OS releases, dated like the real ones; an update only restyles the desktop.
export interface OsRelease { id: string; name: string; version: string; year: number; month: number }

export const OS_RELEASES: OsRelease[] = [
  { id: "aqua", name: "Panthera", version: "10.3", year: 2003, month: 10 },
  { id: "leopard", name: "Leapard", version: "10.5", year: 2007, month: 10 },
  { id: "yosemite", name: "Yosemighty", version: "10.10", year: 2014, month: 10 },
  { id: "bigsur", name: "Big Sir", version: "11", year: 2020, month: 11 },
  { id: "tahoe", name: "Tahoo", version: "26", year: 2025, month: 9 },
];

// The newest release out by this game hour.
export const latestOs = (hour: number): OsRelease => {
  const now = monthIndexOf(hour);
  return OS_RELEASES.filter((r) => r.year * 12 + r.month - 1 <= now).at(-1)!;
};

export const osById = (id: string): OsRelease => OS_RELEASES.find((r) => r.id === id) ?? OS_RELEASES[0];
