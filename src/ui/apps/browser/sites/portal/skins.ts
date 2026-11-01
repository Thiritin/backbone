import type { FC } from "react";
import type { ShopId } from "../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../sim/50-state";
import type { PortalArea, PortalIds, PortalRoute } from "../../../../../sim/80-business/portal";
import { blesstaSkin } from "./blessta";
import { boxBillinSkin } from "./boxbillin";
import { clientExitSkin } from "./clientexit";
import { hostBullSkin } from "./hostbull";
import { modemBillSkin } from "./modembill";
import { makeSkin } from "./shared/makeSkin";
import { Plain } from "./plain/Plain";
import { WhmCacheAdmin } from "./whmCache/Admin";

export type Open = (area: PortalArea, ids?: PortalIds, screen?: string | Record<string, string>) => void;
export interface SkinProps { game: GameState; variant: ShopId; route: PortalRoute; open: Open }
export interface Skin { Admin: FC<SkinProps>; Store: FC<SkinProps>; Client: FC<SkinProps> }

// A shop system without a skin of its own looks plain.
const SKINS: Partial<Record<ShopId, Partial<Skin>>> = {
  whmCache: { ...makeSkin({ cls: "whm-shop", nav: "top", stepsFrom: 2013 }), Admin: WhmCacheAdmin },
  modemBill: modemBillSkin, clientExit: clientExitSkin,
  blessta: blesstaSkin, boxBillin: boxBillinSkin, hostBull: hostBullSkin,
};

export const skinOf = (variant: ShopId): Skin => ({ ...Plain, ...SKINS[variant] });
