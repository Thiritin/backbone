import { t } from "../../../../i18n/en";

// What a game server row shows next to its name: the title and the players online out of its slots.
export interface GameRow { title: string; players: { players: number; slots: number } | null; crashed: boolean }

export function GameLine({ g }: { g?: GameRow }) {
  if (!g) return null;
  return <span className="cx-sub">{[g.title, g.players && t("games.players", g.players), g.crashed && t("games.crashed")].filter(Boolean).join(" · ")}</span>;
}
