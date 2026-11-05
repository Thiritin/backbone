import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { brandsOf, MODELS } from "../src/sim/10-catalog/hardware";
import { Isometric } from "../src/ui/art/Isometric";

it("draws no shape with a negative size at list and card widths", () => {
  const bad: string[] = [];
  for (const m of MODELS) for (const [w, count] of [[64, 1], [150, 1], [150, 3]]) {
    const html = renderToStaticMarkup(<Isometric model={m} brand={brandsOf(m)[0] ?? "x"} w={w} count={count} />);
    for (const x of html.matchAll(/<rect[^>]*?(?:width|height)="(-[0-9.e-]+)"/g)) bad.push(`${m.id}@${w}:${x[1]}`);
  }
  expect(bad).toEqual([]);
});
