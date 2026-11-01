import type { ReactNode } from "react";
import type { Skin, SkinProps } from "../skins";
import { AdminFrame, WhmCacheAdmin, WhmCacheLogin } from "./Admin";
import { StoreFrame, WhmCacheClient, WhmCacheStore } from "./Store";

// The licence-locked admin and the closed store keep the frame of their side.
const Bare = (p: SkinProps & { children: ReactNode }) =>
  p.route.area === "admin" ? <AdminFrame {...p} on="licence" /> : <StoreFrame {...p} />;

export const whmCacheSkin: Skin = { Admin: WhmCacheAdmin, Store: WhmCacheStore, Client: WhmCacheClient, Login: WhmCacheLogin, Bare };
