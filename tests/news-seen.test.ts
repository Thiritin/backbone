import { expect, it } from "vitest";
import { isNew, markRead } from "../src/ui/news-seen";

it("marks only versions after the first visit as new, until read", () => {
  const first = { base: 3, read: [] };
  expect(isNew(first, 3)).toBe(false);
  expect(isNew(first, 4)).toBe(true);
  const read = markRead(first, 4);
  expect(isNew(read, 4)).toBe(false);
  expect(isNew(read, 5)).toBe(true);
});
