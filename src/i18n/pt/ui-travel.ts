import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Mapa",
  "travel.close": () => "Fechar",
  "travel.road": () => "A caminho",
  "travel.speed": (p) => `${p.n}×`,
} satisfies Dict;
