import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Karte",
  "travel.close": () => "Schließen",
  "travel.road": () => "Unterwegs",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
  "travel.air": () => "In der Luft",
  "travel.drive": (p) => `Fahrt, ${p.hours} h, ${p.fee}`,
  "travel.flight": (p) => `Flug, ${p.hours} h, ${p.fee}`,
  "ledger.fly": (p) => `Flug nach ${p.place}`,
} satisfies Dict;
