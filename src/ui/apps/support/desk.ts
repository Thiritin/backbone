import type { ComponentType } from "react";
import { deskOf } from "../../../sim/10-catalog/desks";
import type { GameState } from "../../../sim/50-state";
import { FREEMAIL, providerById } from "../../../sim/80-business/mail";
import { FreeScootMark, FreshduskMark, GoggleMark, IonoseMark, LookoutMark, GMixMark, OsTickitMark, PearMailMark, ZenduskMark, type MarkProps } from "../../art/mailmarks";

export { DESK_FEATURES } from "../../../sim/10-catalog/desks";

export type SupportStyle = "goggle" | "lookout" | "ionose" | "gmix" | "pear" | "ostickit" | "zendusk" | "freshdusk" | "freescoot";
// brand names the provider or desk the app is drawn as.
export interface SupportApp { name: "Email" | "Support"; brand: string; icon: ComponentType<MarkProps>; tile: string; style: SupportStyle }


export const MAIL: Record<string, { icon: ComponentType<MarkProps>; tile: string; style: SupportStyle }> = {
  goggleWorkspace: { icon: GoggleMark, tile: "oklch(0.97 0.005 255)", style: "goggle" },
  lookout365: { icon: LookoutMark, tile: "oklch(0.52 0.16 252)", style: "lookout" },
  hostedExchange: { icon: IonoseMark, tile: "oklch(0.33 0.13 262)", style: "ionose" },
};
export const GMIX = { brand: FREEMAIL, icon: GMixMark, tile: "oklch(0.52 0.15 250)", style: "gmix" as const };
const PEAR = { brand: "Pear Mail", icon: PearMailMark, tile: "oklch(0.62 0.15 245)", style: "pear" as const };

export const DESK: Record<string, { icon: ComponentType<MarkProps>; tile: string; style: SupportStyle }> = {
  ostickit: { icon: OsTickitMark, tile: "oklch(0.4 0.012 255)", style: "ostickit" },
  zendusk: { icon: ZenduskMark, tile: "oklch(0.35 0.07 160)", style: "zendusk" },
  freshdusk: { icon: FreshduskMark, tile: "oklch(0.58 0.12 195)", style: "freshdusk" },
  freescoot: { icon: FreeScootMark, tile: "oklch(0.68 0.11 235)", style: "freescoot" },
};

// The Support app shows as Email until a support desk is installed; its id stays "Support" everywhere else.
export function supportApp(s: Pick<GameState, "installed" | "company">): SupportApp {
  const desk = deskOf(s);
  if (desk) return { name: "Support", brand: desk.name, ...DESK[desk.id] };
  const m = s.company.mail;
  if (m.kind === "external") return { name: "Email", brand: providerById(m.provider)!.name, ...MAIL[m.provider] };
  return { name: "Email", ...(m.kind === "free" ? GMIX : PEAR) };
}
