// A car model is baked once per facing; its front points along the unit vector listed here.
export type Facing = "x" | "y" | "nx" | "ny";
export const FRONT: Record<Facing, [number, number]> = { x: [1, 0], y: [0, 1], nx: [-1, 0], ny: [0, -1] };

// The facing whose front points along the motion (dx, dy), which runs along one axis.
export const facing = (dx: number, dy: number): Facing => (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "x" : "nx") : dy >= 0 ? "y" : "ny");

// Right-hand traffic: seen from above, the right of +x is +y, so cars heading +x keep to the far half of a street running along x and cars heading -x to the near half.
export const laneOffset = (f: Facing, half: number): number => (f === "x" ? half : f === "nx" ? -half : 0);
