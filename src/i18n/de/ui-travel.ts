import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Karte",
  "travel.close": () => "Schließen",
  "travel.road": () => "Unterwegs",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
} satisfies Dict;
