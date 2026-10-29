import { createElement, type ComponentType } from "react";
import { deskOf } from "../../../sim/10-catalog/desks";
import type { GameState } from "../../../sim/50-state";
import { FreeScootMark, FreshduskMark, GoggleMark, IonoseMark, LookoutMark, OsTickitMark, PearMailMark, ZenduskMark, type MarkProps } from "../../art/mailmarks";

export { DESK_FEATURES } from "../../../sim/10-catalog/desks";

export type SupportStyle = "goggle" | "lookout" | "ionose" | "pear" | "ostickit" | "zendusk" | "freshdusk" | "freescoot";
export interface SupportApp { name: "Email" | "Support"; icon: ComponentType<MarkProps>; tile: string; style: SupportStyle; dim: boolean }

const DimPear = ({ className }: MarkProps) => createElement(PearMailMark, { className: `dim${className ? ` ${className}` : ""}` });

const MAIL: Record<string, { icon: ComponentType<MarkProps>; tile: string; style: SupportStyle }> = {
  goggleWorkspace: { icon: GoggleMark, tile: "oklch(0.97 0.005 255)", style: "goggle" },
  lookout365: { icon: LookoutMark, tile: "oklch(0.5 0.16 255)", style: "lookout" },
  hostedExchange: { icon: IonoseMark, tile: "oklch(0.55 0.12 195)", style: "ionose" },
};
const PEAR = { icon: PearMailMark, tile: "oklch(0.62 0.15 245)", style: "pear" as const };

export const DESK: Record<string, { icon: ComponentType<MarkProps>; tile: string; style: SupportStyle }> = {
  ostickit: { icon: OsTickitMark, tile: "oklch(0.5 0.01 255)", style: "ostickit" },
  zendusk: { icon: ZenduskMark, tile: "oklch(0.35 0.07 160)", style: "zendusk" },
  freshdusk: { icon: FreshduskMark, tile: "oklch(0.58 0.12 195)", style: "freshdusk" },
  freescoot: { icon: FreeScootMark, tile: "oklch(0.68 0.11 235)", style: "freescoot" },
};

// The Support app shows as Email until a support desk is installed; its id stays "Support" everywhere else.
export function supportApp(s: Pick<GameState, "installed" | "company">): SupportApp {
  const desk = deskOf(s);
  if (desk) return { name: "Support", ...DESK[desk.id], dim: false };
  const m = s.company.mail;
  if (m.kind === "external") return { name: "Email", ...MAIL[m.provider], dim: false };
  if (m.kind === "self") return { name: "Email", ...PEAR, dim: false };
  return { name: "Email", ...PEAR, icon: DimPear, tile: "oklch(0.72 0.02 255)", dim: true };
}
