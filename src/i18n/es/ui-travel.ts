import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Mapa",
  "travel.close": () => "Cerrar",
  "travel.road": () => "En camino",
  "travel.speed": (p) => `${p.n}×`,
} satisfies Dict;
