import { describe, expect, it } from "vitest";
import { euroPrice } from "../src/sim/00-core/money";

describe("prices", () => {
  it("shows cents only when a price has them", () => {
    expect(euroPrice(6)).toBe("€6");
    expect(euroPrice(6.5)).toBe("€6.50");
    expect(euroPrice(2.7)).toBe("€2.70");
    expect(euroPrice(5.999)).toBe("€6");
  });
});
