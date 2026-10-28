import { dateOf } from "../00-core/time";
import type { Product, Profile } from "../30-customers/customers";

// Values from docs/design/economy.md, section "Usage curves and overcommit": hour of day and the share of booked capacity in use.
type Keys = [number, number][];
export type CurveId = "game" | "shop" | "blog" | "news" | "business" | "backup" | "vpn" | "dev" | "enterprise";

export const CURVES: Record<CurveId, { weekday: Keys; weekend: Keys }> = {
  game: { weekday: [[0, 0.15], [16, 0.15], [20, 0.45], [23, 0.3]], weekend: [[0, 0.6], [3, 0.2], [8, 0.2], [12, 0.9], [18, 1], [23, 0.9]] },
  shop: { weekday: [[0, 0.1], [6, 0.15], [9, 0.55], [13, 0.7], [17, 0.6], [20, 0.75], [22, 0.3], [23, 0.12]], weekend: [[0, 0.1], [10, 0.5], [15, 0.6], [20, 0.8], [22, 0.3]] },
  blog: { weekday: [[0, 0.15], [7, 0.3], [12, 0.45], [19, 0.6], [22, 0.5], [23, 0.2]], weekend: [[0, 0.2], [10, 0.4], [19, 0.55], [23, 0.2]] },
  news: { weekday: [[0, 0.1], [5, 0.3], [7, 0.9], [9, 0.7], [12, 0.6], [18, 0.5], [22, 0.3]], weekend: [[0, 0.1], [9, 0.7], [12, 0.5], [22, 0.25]] },
  business: { weekday: [[0, 0.05], [7, 0.2], [9, 0.6], [12, 0.5], [17, 0.5], [19, 0.15]], weekend: [[0, 0.1]] },
  backup: { weekday: [[0, 0.4], [1, 1], [5, 1], [7, 0.05]], weekend: [[0, 0.4], [1, 1], [5, 1], [7, 0.05]] },
  vpn: { weekday: [[0, 0.2], [8, 0.3], [19, 0.7], [23, 0.4]], weekend: [[0, 0.4], [14, 0.7], [22, 0.7]] },
  dev: { weekday: [[0, 0.1], [10, 0.3], [18, 0.3], [21, 0.2]], weekend: [[0, 0.15]] },
  enterprise: { weekday: [[0, 0.3], [8, 0.6], [18, 0.6], [22, 0.35]], weekend: [[0, 0.3]] },
};

const BY_PRODUCT: Partial<Record<Product, CurveId>> = { gameServer: "game", vpn: "vpn", storage: "backup", dedicated: "enterprise" };
const BY_PROFILE: Record<Profile, CurveId> = {
  private: "blog", gamer: "game", hobbyDev: "dev", soleProp: "business", smallBiz: "business", agency: "news", office: "business", onlineShop: "shop", enterprise: "enterprise",
};
export const curveFor = (product: Product, profile: Profile): CurveId => BY_PRODUCT[product] ?? BY_PROFILE[profile];

// Straight lines between keyframes; the last keyframe holds until midnight.
function at(keys: Keys, h: number): number {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1][0] <= h) i++;
  const [h0, v0] = keys[i], next = keys[i + 1];
  return next ? v0 + ((next[1] - v0) * (h - h0)) / (next[0] - h0) : v0;
}

// Load from 0 to 1 at a game hour. Fridays from 18:00 count as weekend for game servers and VPNs.
export function curveLoad(id: CurveId, hour: number): number {
  const d = dateOf(hour), day = d.getUTCDay(), h = d.getUTCHours();
  const weekend = day === 0 || day === 6 || (day === 5 && h >= 18 && (id === "game" || id === "vpn"));
  return at(CURVES[id][weekend ? "weekend" : "weekday"], h);
}
