import type { LicenseKind } from "./server-os";

// economy.md, Platforms and licenses: the editions of a panel. The top tier keeps the fee the software has always cost.
export interface LicenceTier { id: string; name: string; cap: number | null; fee: number; kind: LicenseKind }

const tier = (id: string, name: string, cap: number | null, fee: number, kind: LicenseKind = "server"): LicenceTier => ({ id, name, cap, fee, kind });

export const TIERS: Record<string, LicenceTier[]> = {
  cpanic: [tier("dedicated", "Dedicated", null, 12), tier("solo", "Solo", 1, 2), tier("admin", "Admin", 5, 4), tier("pro", "Pro", 30, 10), tier("premier", "Premier", null, 0.4, "account")],
  vmwhere: [tier("essentials", "Essentials", null, 0), tier("standard", "Standard", null, 0), tier("enterprise", "Enterprise", null, 0)],
  pleskit: [tier("webAdmin", "Web Admin", 10, 5), tier("webPro", "Web Pro", 30, 8), tier("webHost", "Web Host", null, 12)],
  directadmen: [tier("personal", "Personal", 1, 1), tier("lite", "Lite", 10, 2), tier("standard", "Standard", null, 4)],
};

export const tiersOf = (softwareId: string | null): LicenceTier[] => (softwareId ? TIERS[softwareId] ?? [] : []);
export const topTier = (softwareId: string | null): LicenceTier | undefined => tiersOf(softwareId).at(-1);
export const LAPSE_GRACE_DAYS = 7;
