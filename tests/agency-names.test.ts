import { expect, test } from "vitest";
import { loadLang } from "../src/i18n/lang";
import { senderName } from "../src/sim/40-support/notices";

test("agency names follow the language, company names stay", async () => {
  expect(senderName("fbi")).toBe("Federal Bureau of Inspection");
  await loadLang("de");
  expect(senderName("fbi")).toBe("Polizeidirektion Cybercrime");
  expect(senderName("warner")).toBe("Warner Bras.");
  await loadLang("en");
});
