// Footprints of items that share a wall tile or a desk column, so layout never lets two overlap (tests/slots.test.ts).
// Wall items span u0..u1 along the wall in units of 32 per tile; the light switch sits in the tile past the door's.
export const WALL_SLOTS = {
  switch: [8, 14],
  phone: [16, 30],
  letterbox: [15, 27],
} as const;

// An item in the tile just before a door's slides away from it so its far edge ends DOOR_END units into the tile, clear of the frame.
export const DOOR_END = 20;
export const nearDoor = (f: { x: number; y: number }, door?: { x: number; y: number }) => !!door && f.x === 0 && door.x === 0 && f.y === door.y + 1;
export function wallSlot(kind: keyof typeof WALL_SLOTS, near: boolean): [number, number] {
  const [a, b] = WALL_SLOTS[kind], shift = near && b > DOOR_END ? b - DOOR_END : 0;
  return [a - shift, b - shift];
}

// Rectangles on the desk top within one column, in tiles. The lamp and scanner share the column before the monitor's.
interface Rect { x0: number; x1: number; y0: number; y1: number }
export const DESK_SLOTS: Record<"side" | "main", Record<string, Rect>> = {
  side: {
    lamp: { x0: 0.78, x1: 0.88, y0: 0.14, y1: 0.24 },
    scanner: { x0: 0.18, x1: 0.66, y0: 0.2, y1: 0.7 },
  },
  main: {
    monitor: { x0: 0.12, x1: 0.88, y0: 0.22, y1: 0.38 },
    keyboard: { x0: 0.2, x1: 0.76, y0: 0.54, y1: 0.7 },
    mouse: { x0: 0.82, x1: 0.9, y0: 0.58, y1: 0.68 },
  },
};
