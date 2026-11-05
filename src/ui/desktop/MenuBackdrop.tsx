import { RackBox } from "../world/draw";
import { iso } from "../world/grid";

const COLS = 7;
const LEDS = [34, 29, 23, 18, 12, 7].map((top) => ({ id: String(top), on: true, top }));
const ROWS = [0, 3];
const SPAN = 6;
const tile = (x: number, y: number) => [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)].map((p) => `${p.x},${p.y}`).join(" ");

// Static rack rows on a tiled aisle floor, drawn with the world's own rack art and bleeding off the bottom right.
export function MenuBackdrop() {
  const floor = [];
  for (let y = 0; y < SPAN; y++) for (let x = 0; x < COLS; x++) floor.push(<polygon key={`${x}-${y}`} points={tile(x, y)} className="mbd-tile" />);
  const racks = ROWS.flatMap((y) => Array.from({ length: COLS }, (_, x) => ({ x, y }))).sort((a, b) => a.x + a.y - (b.x + b.y));
  const left = iso(0, SPAN).x, right = iso(COLS - 1, 0).x + 20, top = -130, bottom = iso(COLS, SPAN - 1).y;
  return (
    <svg className="mbd" viewBox={`${left} ${top} ${right - left} ${bottom - top}`} preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      {floor}
      {racks.map((r) => <RackBox key={`${r.x}-${r.y}`} tile={{ x: r.x, y: r.y, facing: "s" }} units={42} items={[]} leds={LEDS} zoomed={false} />)}
    </svg>
  );
}
