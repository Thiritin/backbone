import type { Dict } from "../lang";

export default {
  "games.title.counterstrife": () => "Counter-Strife 1.6",
  "games.title.quackiii": () => "Quack III Arena",
  "games.title.battlefeld": () => "Battlefeld 1942",
  "games.title.warcrafty": () => "World of Warcrafty",
  "games.title.teamfortune": () => "Team Fortune 2",
  "games.title.blockcraft": () => "Blockcraft",
  "games.title.terrarea": () => "Terrarea",
  "games.title.rost": () => "Rost",
  "games.title.arkaic": () => "ARC Archaic",
  "games.title.fiveem": () => "FiveEm",
  "games.title.valhome": () => "Valhome",
  "games.title.pallworld": () => "Pallworld",
  "games.players": (p) => `Jogadores ${p.players}/${p.slots}`,
  "games.unknown": () => "Desconhecido",
} satisfies Dict;
