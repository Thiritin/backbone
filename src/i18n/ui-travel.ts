import type { Dict } from "./lang";

// The trip from the door to the next room.
export default {
  "travel.map": () => "Map",
  "travel.close": () => "Close",
  "travel.road": () => "On the road",
  "travel.speed": (p) => `${p.n}×`,
} satisfies Dict;
