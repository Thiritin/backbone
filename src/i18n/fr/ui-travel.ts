import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Carte",
  "travel.close": () => "Fermer",
  "travel.road": () => "En route",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
  "travel.air": () => "En vol",
  "travel.drive": (p) => `Trajet, ${p.hours} h, ${p.fee}`,
  "travel.flight": (p) => `Vol, ${p.hours} h, ${p.fee}`,
  "ledger.fly": (p) => `Vol pour ${p.place}`,
  "ledger.drive": (p) => `Trajet vers ${p.place}`,
  "map.zoomIn": () => "Zoom avant",
  "map.zoomOut": () => "Zoom arrière",
} satisfies Dict;
