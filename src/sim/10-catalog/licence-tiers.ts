import type { LicenseKind } from "./server-os";

// economy.md, Platforms and licenses: the editions of a panel. The top tier keeps the fee the software has always cost.
export interface LicenceTier { id: string; name: string; cap: number | null; fee: number; kind: LicenseKind }

const tier = (id: string, name: string, cap: number | null, fee: number, kind: LicenseKind = "server"): LicenceTier => ({ id, name, cap, fee, kind });

export const TIERS: Record<string, LicenceTier[]> = {
  cpanic: [tier("dedicated", "Dedicated", null, 12), tier("solo", "Solo", 1, 2), tier("admin", "Admin", 5, 4), tier("pro", "Pro", 30, 10), tier("premier", "Premier", null, 0.4, "account")],
  vmwhere: [tier("essentials", "Essentials", null, 0), tier("standard", "Standard", null, 0), tier("enterprise", "Enterprise", null, 0)],
  pleskit: [tier("webAdmin", "Web Admin", 10, 5), tier("webPro", "Web Pro", 30, 8), tier("webHost", "Web Host", null, 12)],
  directadmen: [tier("personal", "Personal", 1, 1), tier("lite", "Lite", 10, 2), tier("standard", "Standard", null, 4)],
  // Shop systems lease by edition; caps count what shopLicence(id).caps names (docs/design/software-versions.md).
  modemBill: [tier("lite", "Lite", 50, 15), tier("unlimited", "Unlimited", null, 22)],
  clientExit: [tier("branded", "Branded", null, 13), tier("unbranded", "Unbranded", null, 15)],
  whmCache: [tier("leased", "Leased", null, 15), tier("plus", "Plus", 250, 18), tier("professional", "Professional", 500, 30),
    tier("business", "Business", 1000, 45), tier("business5000", "Business 5000", 5000, 285), tier("unlimited", "Unlimited", null, 2000)],
  blessta: [tier("branded", "Branded", null, 13), tier("unbranded", "Unbranded", null, 15)],
  ubersmyth: [tier("starter", "Starter", 100, 100), tier("standard", "Standard", 500, 400), tier("pro", "Pro", 2000, 700), tier("enterprise", "Enterprise", null, 1500)],
};

export const tiersOf = (softwareId: string | null): LicenceTier[] => (softwareId ? TIERS[softwareId] ?? [] : []);
export const topTier = (softwareId: string | null): LicenceTier | undefined => tiersOf(softwareId).at(-1);
export const LAPSE_GRACE_DAYS = 7;

// economy.md, Licence price rises: on 1 January of each year listed a vendor's list prices become this multiple of the
// era's fees; the vendor announces it RISE_NOTICE_MONTHS before.
export const LICENCE_RISES: Record<string, [number, number][]> = {
  cpanic: [[2021, 1.1], [2022, 1.21], [2023, 1.33], [2024, 1.46], [2025, 1.61]],
  pleskit: [[2021, 1.1], [2023, 1.2], [2025, 1.3]],
  windoors: [[2025, 1.1]],
};
export const RISE_NOTICE_MONTHS = 3;
export const licenceIndex = (product: string, year: number): number =>
  (LICENCE_RISES[product] ?? []).reduce((f, [y, x]) => (y <= year ? x : f), 1);
