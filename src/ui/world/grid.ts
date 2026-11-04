// Two-to-one diamonds; x runs to the lower right and y to the lower left of the screen.
export const TW = 64, TH = 32;

export interface Pt { x: number; y: number }

// Screen point of the grid corner (x, y); a tile's top corner is its own grid corner.
export const iso = (x: number, y: number): Pt => ({ x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) });
// Screen centre of tile (x, y).
export const center = (x: number, y: number): Pt => iso(x + 0.5, y + 0.5);
