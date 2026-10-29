import { describe, expect, it } from "vitest";
import { shouldOffer, SNOOZE_MS } from "../src/ui/update";

describe("update offer", () => {
  it("offers only when the served build differs", () => {
    expect(shouldOffer("abc", "abc", null, 0)).toBe(false);
    expect(shouldOffer("abc", "def", null, 0)).toBe(true);
    expect(shouldOffer("abc", null, null, 0)).toBe(false);
  });

  it("stays quiet for an hour after Later", () => {
    expect(shouldOffer("abc", "def", 1000, 1000 + SNOOZE_MS - 1)).toBe(false);
    expect(shouldOffer("abc", "def", 1000, 1000 + SNOOZE_MS)).toBe(true);
  });
});
