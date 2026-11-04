import type { Facing } from "./layout";

export type LobbyClass = "S" | "M" | "L";
export interface LobbySlot { x: number; y: number; facing: Facing }

// The own hall's size class from its rack capacity.
export const lobbyClass = (capacity: number): LobbyClass => (capacity <= 20 ? "S" : capacity <= 48 ? "M" : "L");

// The lobby stands in front of the hall (x 0 to 9, y h to h + 6). Slot 0 is the receptionist beside the counter; the rest are chairs
// along the side walls, clear of the door lane at x 3.4 to 4.8: S 2, M 4, L 6.
export function lobbySlots(cls: LobbyClass, h: number): LobbySlot[] {
  const side: LobbySlot[] = [
    { x: 1.2, y: h + 3.2, facing: "e" }, { x: 1.2, y: h + 4.2, facing: "e" }, { x: 1.2, y: h + 5.2, facing: "e" },
    { x: 7.8, y: h + 3.4, facing: "w" }, { x: 7.8, y: h + 4.4, facing: "w" }, { x: 7.8, y: h + 5.2, facing: "w" },
  ];
  return [{ x: 3.7, y: h + 0.95, facing: "w" }, ...side.slice(0, cls === "S" ? 2 : cls === "M" ? 4 : 6)];
}
