import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Mapa",
  "travel.close": () => "Cerrar",
  "travel.road": () => "En camino",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
} satisfies Dict;
