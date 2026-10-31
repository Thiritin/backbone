import type { LicenseKind } from "./server-os";

// economy.md, Platforms and licenses: the editions of a panel. The top tier keeps the fee the software has always cost.
export interface LicenceTier { id: string; name: string; cap: number | null; fee: number; kind: LicenseKind }

const t = (id: string, name: string, cap: number | null, fee: number, kind: LicenseKind = "server"): LicenceTier => ({ id, name, cap, fee, kind });

export const TIERS: Record<string, LicenceTier[]> = {
  cpanic: [t("solo", "Solo", 1, 2), t("admin", "Admin", 5, 4), t("pro", "Pro", 30, 10), t("premier", "Premier", null, 0.4, "account")],
  pleskit: [t("webAdmin", "Web Admin", 10, 5), t("webPro", "Web Pro", 30, 8), t("webHost", "Web Host", null, 12)],
  directadmen: [t("personal", "Personal", 1, 1), t("lite", "Lite", 10, 2), t("standard", "Standard", null, 4)],
};

export const tiersOf = (softwareId: string | null): LicenceTier[] => (softwareId ? TIERS[softwareId] ?? [] : []);
export const topTier = (softwareId: string | null): LicenceTier | undefined => tiersOf(softwareId).at(-1);
export const TRIAL_DAYS = 30;
export const LAPSE_GRACE_DAYS = 7;
