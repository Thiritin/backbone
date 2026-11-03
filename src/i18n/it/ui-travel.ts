import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Mappa",
  "travel.close": () => "Chiudi",
  "travel.road": () => "In viaggio",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
  "travel.air": () => "In volo",
  "travel.drive": (p) => `Tragitto, ${p.hours} h, ${p.fee}`,
  "travel.flight": (p) => `Volo, ${p.hours} h, ${p.fee}`,
  "ledger.fly": (p) => `Volo per ${p.place}`,
  "ledger.drive": (p) => `Tragitto per ${p.place}`,
} satisfies Dict;
