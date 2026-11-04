import type { Dict } from "../lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Mapa",
  "travel.close": () => "Cerrar",
  "travel.road": () => "En camino",
  "travel.osm": () => "© OpenStreetMap contributors",
  "travel.speed": (p) => `${p.n}×`,
  "travel.air": () => "En el aire",
  "travel.drive": (p) => `Trayecto, ${p.hours} h, ${p.fee}`,
  "travel.flight": (p) => `Vuelo, ${p.hours} h, ${p.fee}`,
  "ledger.fly": (p) => `Vuelo a ${p.place}`,
  "ledger.drive": (p) => `Trayecto a ${p.place}`,
  "map.zoomIn": () => "Acercar",
  "map.zoomOut": () => "Alejar",
} satisfies Dict;
