import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Mappa",
  "travel.close": () => "Chiudi",
  "travel.road": () => "In viaggio",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
} satisfies Dict;
