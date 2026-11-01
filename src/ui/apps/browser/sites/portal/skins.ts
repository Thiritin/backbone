import type { FC } from "react";
import type { ShopId } from "../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../sim/50-state";
import type { PortalArea, PortalIds, PortalRoute } from "../../../../../sim/80-business/portal";
import { makeSkin } from "./shared/makeSkin";
import { Plain } from "./plain/Plain";
import { WhmCacheAdmin } from "./whmCache/Admin";

export type Open = (area: PortalArea, ids?: PortalIds, screen?: string | Record<string, string>) => void;
export interface SkinProps { game: GameState; variant: ShopId; route: PortalRoute; open: Open }
export interface Skin { Admin: FC<SkinProps>; Store: FC<SkinProps>; Client: FC<SkinProps> }

// A shop system without a skin of its own looks plain.
const SKINS: Partial<Record<ShopId, Partial<Skin>>> = {
  whmCache: { ...makeSkin({ cls: "whm-shop", nav: "top", stepsFrom: 2013 }), Admin: WhmCacheAdmin },
};

export const skinOf = (variant: ShopId): Skin => ({ ...Plain, ...SKINS[variant] });
