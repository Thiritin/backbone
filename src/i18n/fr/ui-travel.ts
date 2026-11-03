import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Carte",
  "travel.close": () => "Fermer",
  "travel.road": () => "En route",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
} satisfies Dict;
