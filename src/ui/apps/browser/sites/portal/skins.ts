import type { FC, ReactNode } from "react";
import type { ShopId } from "../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../sim/50-state";
import type { PortalArea, PortalIds, PortalRoute } from "../../../../../sim/80-business/portal";
import { blesstaSkin } from "./blessta";
import { boxBillinSkin } from "./boxbillin";
import { clientExitSkin } from "./clientexit";
import { hostBullSkin } from "./hostbull";
import { modemBillSkin } from "./modembill";
import { Plain } from "./plain/Plain";
import { whmCacheSkin } from "./whmCache";

export type Open = (area: PortalArea, ids?: PortalIds, screen?: string | Record<string, string>) => void;
// version and major are the installed release, which picks the look; browse opens a full address in the Browser.
export interface SkinProps { game: GameState; variant: ShopId; route: PortalRoute; open: Open; version: string; major: string; browse: (url: string) => void }
// Login and Bare (the frame around the licence-locked admin and the closed store) fall back to the shared ones.
export interface Skin {
  Admin: FC<SkinProps>; Store: FC<SkinProps>; Client: FC<SkinProps>;
  Login?: FC<SkinProps & { onLogin: () => void }>; Bare?: FC<SkinProps & { children: ReactNode }>;
}

// A shop system without a skin of its own looks plain.
const SKINS: Partial<Record<ShopId, Partial<Skin>>> = {
  whmCache: whmCacheSkin,
  modemBill: modemBillSkin, clientExit: clientExitSkin,
  blessta: blesstaSkin, boxBillin: boxBillinSkin, hostBull: hostBullSkin,
};

export const skinOf = (variant: ShopId): Skin => ({ ...Plain, ...SKINS[variant] });
