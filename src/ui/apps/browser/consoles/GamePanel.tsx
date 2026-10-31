import { t } from "../../../../i18n/en";

// What a game server row shows next to its name: the title and the players online out of its slots.
export interface GameRow { title: string; faded: boolean; players: { players: number; slots: number } | null; crashed: boolean }

export function GameLine({ g }: { g?: GameRow }) {
  if (!g) return null;
  return <span className="cx-sub">{[g.title, g.players && t("games.players", g.players), g.faded && t("games.faded"), g.crashed && t("games.crashed")].filter(Boolean).join(" · ")}</span>;
}

// How many of the listed servers play each title.
export function TitlesSummary({ rows }: { rows: { game?: GameRow }[] }) {
  const n = new Map<string, { title: string; count: number; faded: boolean }>();
  for (const { game: g } of rows) if (g) n.set(g.title, { title: g.title, faded: g.faded, count: (n.get(g.title)?.count ?? 0) + 1 });
  if (!n.size) return null;
  return <p className="cx-sub">{[...n.values()].map((x) => [t("games.titleCount", { title: x.title, count: x.count }), x.faded && t("games.faded")].filter(Boolean).join(" ")).join(" · ")}</p>;
}
