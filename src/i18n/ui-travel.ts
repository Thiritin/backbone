import type { Dict } from "./lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Map",
  "travel.close": () => "Close",
  "travel.road": () => "On the road",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
  "travel.air": () => "In the air",
  "travel.drive": (p) => `Drive, ${p.hours} h, ${p.fee}`,
  "travel.flight": (p) => `Flight, ${p.hours} h, ${p.fee}`,
  "ledger.fly": (p) => `Flight to ${p.place}`,
  "map.zoomIn": () => "Zoom in",
  "map.zoomOut": () => "Zoom out",
} satisfies Dict;
