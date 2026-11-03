import type { ReactNode } from "react";
import { T } from "./grid";
import { sheetUrl, SPRITES, type SpriteMap } from "./sprites";

// Objects the tileset does not cover, drawn in code at their size in source pixels.
const PLACEHOLDERS: Record<string, { w: number; h: number }> = {
  letterbox: { w: 28, h: 30 },
  crate: { w: 16, h: 12 },
  parcel: { w: 28, h: 16 },
  weather: { w: 40, h: 26 },
};

const warned = new Set<string>();

// Size in source pixels of a sprite or placeholder, or null when the name is unknown.
export function spriteSize(name: string, map: SpriteMap = SPRITES): { w: number; h: number } | null {
  if (map[name]) return map[name];
  if (PLACEHOLDERS[name]) return PLACEHOLDERS[name];
  if (name.startsWith("player-")) return { w: T, h: T };
  if (!warned.has(name)) { warned.add(name); console.warn(`Unknown sprite ${name}`); }
  return null;
}

// Draws a sprite with its bottom-left corner at (x, y) in room pixels.
export function Sprite({ name, x, y, map = SPRITES, children }: { name: string; x: number; y: number; map?: SpriteMap; children?: ReactNode }) {
  const r = map[name], size = spriteSize(name, map);
  if (!size) return null;
  const left = x + (r?.anchor?.x ?? 0), top = y - size.h + (r?.anchor?.y ?? 0);
  return (
    <svg x={left} y={top} width={size.w} height={size.h} viewBox={r ? `${r.x} ${r.y} ${r.w} ${r.h}` : `0 0 ${size.w} ${size.h}`} overflow="hidden" data-sprite={name}>
      {r ? <image className="w-sprite" href={sheetUrl(r.sheet)} /> : name.startsWith("player-") ? <Player name={name} /> : <Placeholder name={name} {...size} />}
      {children && <g transform={`translate(${r?.x ?? 0} ${r?.y ?? 0})`}>{children}</g>}
    </svg>
  );
}

function Placeholder({ name, w, h }: { name: string; w: number; h: number }) {
  return (
    <g className={`w-ph w-ph-${name}`}>
      <rect className="w-ph-back" x="1" y="1" width={w - 2} height={h - 2} rx="3" />
      <rect className="w-ph-face" x="4" y="4" width={w - 8} height={h - 8} rx="2" />
    </g>
  );
}

// Front-facing figure: feet at the bottom of a 48 px cell, legs alternate between the two walk frames.
function Player({ name }: { name: string }) {
  const [, dir, frame] = name.split("-"), step = frame === "1" ? 2 : 0, side = dir === "left" ? -2 : dir === "right" ? 2 : 0;
  return (
    <g className="w-player-ph">
      <ellipse className="w-shadow" cx="24" cy="45" rx="10" ry="3" />
      <rect className="w-pants" x="18" y={34 + (step ? 0 : 1)} width="5" height={step ? 11 : 10} rx="2" />
      <rect className="w-pants" x="25" y={34 + (step ? 1 : 0)} width="5" height={step ? 10 : 11} rx="2" />
      <rect className="w-shirt" x="16" y="22" width="16" height="15" rx="5" />
      <circle className="w-skin" cx="24" cy="15" r="9" />
      {dir === "up" ? (
        <path className="w-hair" d="M15,16 A9,9 0 1 1 33,16 Q24,20 15,16 Z" />
      ) : (
        <>
          <path className="w-hair" d="M15,14 A9,9 0 0 1 33,14 Q27,9 15,14 Z" />
          {dir !== "right" && <circle className="w-eye" cx={21 + side} cy="16" r="1.1" />}
          {dir !== "left" && <circle className="w-eye" cx={27 + side} cy="16" r="1.1" />}
        </>
      )}
    </g>
  );
}
