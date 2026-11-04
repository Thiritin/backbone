import { at3, pts } from "../draw";

// Flat polygon on the ground plane of the site, from tile corners.
export const flat = (z: number, ...p: [number, number][]) => pts(...p.map(([x, y]) => at3(x, y, z)));
// Vertical quad on the plane y = const (faces the lower left) and x = const (faces the lower right).
export const faceY = (x0: number, x1: number, y: number, z0: number, z1: number) => pts(at3(x0, y, z0), at3(x1, y, z0), at3(x1, y, z1), at3(x0, y, z1));
export const faceX = (x: number, y0: number, y1: number, z0: number, z1: number) => pts(at3(x, y0, z0), at3(x, y1, z0), at3(x, y1, z1), at3(x, y0, z1));
