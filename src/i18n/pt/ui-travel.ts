import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Mapa",
  "travel.close": () => "Fechar",
  "travel.road": () => "A caminho",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
  "travel.air": () => "No ar",
  "travel.drive": (p) => `Viagem, ${p.hours} h, ${p.fee}`,
  "travel.flight": (p) => `Voo, ${p.hours} h, ${p.fee}`,
  "ledger.fly": (p) => `Voo para ${p.place}`,
  "ledger.drive": (p) => `Viagem para ${p.place}`,
} satisfies Dict;
