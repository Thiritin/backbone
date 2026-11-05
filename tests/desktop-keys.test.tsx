// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

describe("desktop shortcuts", () => {
  it("leave focused buttons, links and menu items to their own keys", async () => {
    window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
    const { KEYS_OWN } = await import("../src/ui/desktop/Desktop");
    document.body.innerHTML = '<button id="b">x</button><a id="a" href="#">y</a><div id="d" role="menuitem">z</div><div id="p">w</div>';
    for (const id of ["b", "a", "d"]) expect(document.getElementById(id)!.closest(KEYS_OWN), id).not.toBeNull();
    expect(document.getElementById("p")!.closest(KEYS_OWN)).toBeNull();
  });
});
