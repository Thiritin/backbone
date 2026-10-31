import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { holdAsksReason, holdLabels, type ConsoleLook } from "../src/sim/80-business/consoles";

const LOOKS: ConsoleLook[] = ["cpanic", "pleskit", "directadmen", "freepanel", "horizont", "vsphear", "proxmocks", "hypervee", "openveezee", "mail", "game"];

describe("hold labels", () => {
  it("gives every look a suspend, unsuspend and terminate label that resolves", () => {
    for (const look of LOOKS) {
      for (const key of Object.values(holdLabels(look))) expect(t(key), `${look} ${key}`).not.toBe(key);
      expect(holdLabels(look).suspend).not.toBe(holdLabels(look).unsuspend);
    }
  });

  it("uses the product's own words", () => {
    expect(t(holdLabels("pleskit").suspend)).toBe("Suspend subscription");
    expect(t(holdLabels("proxmocks").suspend)).toBe("Stop and lock");
    expect(t(holdLabels("directadmen").terminate)).toBe("Delete user");
  });

  it("asks for a reason on the three web panels only", () => {
    expect(LOOKS.filter(holdAsksReason)).toEqual(["cpanic", "pleskit", "directadmen"]);
  });
});
