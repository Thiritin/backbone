import { expect, test } from "vitest";
import { disk } from "../src/ui/apps/hw";

test("disk meter keeps each amount in its own unit", () => {
  expect(`${disk(2)}/${disk(1000)}`).toBe("2 GB/1 TB");
});
