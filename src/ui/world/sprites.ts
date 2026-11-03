import mapping from "../../../public/world/sprites.json";

// A sprite's rect in source pixels on a sheet under public/world/; anchor shifts it from the tile's bottom-left corner.
export interface SpriteRect { sheet: string; x: number; y: number; w: number; h: number; anchor?: { x: number; y: number } }
export type SpriteMap = Record<string, SpriteRect>;

export const SPRITES: SpriteMap = mapping as SpriteMap;

export const sheetUrl = (sheet: string) => `${import.meta.env.BASE_URL}world/${sheet}`;
