import type { ComponentType } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { registrarById, type RegistrarId } from "../../../../../sim/10-catalog/registrars";
import type { GameState } from "../../../../../sim/50-state";
import { eraOf } from "../era";
import { partnerOf } from "../../../../../sim/80-business/browser";
import { RegistrarForm } from "./RegistrarForm";
import { panelOpen, panelPage, RegistrarPanel } from "./RegistrarPanel";
import { GoDuddy } from "./goduddy";
import { InterNetY } from "./internety";
import { NameCheep } from "./namecheep";
import { OpenSRSly } from "./opensrsly";
import { REGISTRAR_ERAS, type RegistrarProps } from "./RegistrarPage";

export const REGISTRAR_VIEWS: Record<RegistrarId, ComponentType<RegistrarProps>> = { nameCheep: NameCheep, goDuddy: GoDuddy, interNetY: InterNetY, openSrsly: OpenSRSly };

export function RegistrarSite({ game, id, path = "/", go = () => {} }: { game: GameState; id: RegistrarId; path?: string; go?: (url: string) => void }) {
  const year = yearOf(game.hour), View = REGISTRAR_VIEWS[id];
  const form = partnerOf(game).id === id && /^\/(register|transfer)(\?|$)/.exec(path);
  // /login opens the panel on the domains, /account (the address on its invoices) on the account.
  const login = /^\/(login|account)(?:\/(dns|register|account|domain\/([^/?]+)))?(\?|$)/.exec(path), r = registrarById(id)!;
  if (login && panelOpen(game, r)) return <RegistrarPanel game={game} r={r} page={panelPage(game, r, login[2] ?? (login[1] === "account" ? "account" : undefined), login[3])} go={go} />;
  if (form) return <RegistrarForm key={path} game={game} r={r} transfer={form[1] === "transfer"} ticketId={new URLSearchParams(path.split("?")[1] ?? "").get("order") ?? ""} />;
  return <View game={game} r={r} look={eraOf(REGISTRAR_ERAS[id], year)} year={year} go={go} />;
}
