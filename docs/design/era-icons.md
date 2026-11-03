# Era icons

An era icon is a dock, desktop or Finder icon whose picture follows the Pear OS era the player runs. Early eras show a glossy picture from a period icon theme; later eras show the flat lucide mark on a coloured tile.

## Packs and eras

| OS era (`game.os`) | Pear OS | Picture |
|---|---|---|
| `aqua` | Panthera 10.3 (2003) | Crystal Clear pack (`crystal/`) |
| `leopard` | Leapard 10.5 (2007) | Oxygen pack (`oxygen/`) |
| `yosemite` | Yosemighty 10.10 (2014) | lucide mark on the tile |
| `bigsur` | Big Sir 11 (2020) | lucide mark on the tile |
| `tahoe` | Tahoo 26 (2025) | lucide mark on the tile |

The eras are listed in `src/sim/10-catalog/os.ts`. `Desktop.tsx` writes the current era to `data-os` on the root element.

## Files

- Pictures live in `public/icons/<pack>/<name>.webp`, one file per pack under the same name, for example `public/icons/crystal/trash.webp` and `public/icons/oxygen/trash.webp`.
- Each picture is 128 by 128 pixels, WebP with full alpha (`cwebp -q 90 -alpha_q 100`).
- Names are short lowercase ids with hyphens (`pear-mail`, `room`, `trash`), never product names.

## How it works

`era(Icon, name, packs?)` in `src/ui/art/era-icon.tsx` returns a component that renders one `<img>` per pack plus the lucide `Icon`. The rules at the end of `src/ui/desktop/os.css` show the image whose pack matches `data-os`, hide the lucide mark and drop the tile background behind it. In every other era the images stay hidden and the lucide mark on its tile shows.

## Adding an icon

1. Pick the picture in both themes: Crystal Clear from the Wikimedia Commons category, Oxygen from the KDE `oxygen-icons` repository (`128x128/<context>/<name>.png`). Choose one that no other icon already uses.
2. Convert each to `public/icons/crystal/<name>.webp` and `public/icons/oxygen/<name>.webp` at 128 pixels.
3. Wrap the lucide mark with `era(LucideIcon, "<name>")` and render that component where the plain lucide icon was. Pass `["oxygen"]` as the third argument when only one pack has a fitting picture; the other era then shows the lucide mark.
4. Add a line to `public/icons/CREDITS.md` when the picture comes from a different set or is combined from both.
5. Check the icon in the browser in every era above.

Every new dock or desktop icon goes through `era()`.

## Licence

- Crystal Clear by Everaldo Coelho, GNU LGPL 2.1 or later (`public/icons/LGPL-2.1.txt`).
- Oxygen by the KDE community, GNU LGPL 3.0 or later (`public/icons/LGPL-3.0.txt`).

`public/icons/CREDITS.md` holds the full attribution and notes on renamed or combined files. `ICON_CREDITS` in `era-icon.tsx` lists both sets for the in-game credits.
