import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { bought, deliverLicences, licenceKey, licenceMail } from "../src/sim/80-business/licences";
import { hasModule } from "../src/sim/80-business/shop";
import { registerLicence } from "../src/sim/90-actions/licences";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { buyModule } from "../src/sim/90-actions/shop";
import { buyShopLink } from "../src/sim/90-actions/shoplink";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { installWithKey, readyGame } from "./fixtures";

function clientExitGame(): GameState {
  const s = readyGame(11);
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  installWithKey(s, "clientExit");
  return s;
}

// Pleskit on ClientExit and a registered PayPail licence bought from ClientExit.
function withModules(): GameState {
  const s = clientExitGame();
  expect(buyModule(s, "pleskit").ok).toBe(true);
  expect(buyShopLink(s, "clientExit", "paypail").ok).toBe(true);
  s.hour++;
  deliverLicences(s);
  expect(registerLicence(s, licenceKey(s, "paypail")).ok).toBe(true);
  s.hour += 48;
  return s;
}

describe("modules belong to the shop system they were bought for", () => {
  it("leaves them behind on a switch and brings them back on switching back", () => {
    const s = withModules();
    expect(hasModule(s, "pleskit")).toBe(true);
    expect(s.modules).toContain("paypail");

    installWithKey(s, "whmCache");
    expect(s.shop.modules).toEqual({});
    expect(s.modules).toEqual([]);
    expect(bought(s, "paypail")).toBe(false);
    expect(licenceMail(s, "paypail")).toBeUndefined();
    expect(registerLicence(s, licenceKey(s, "paypail"))).toMatchObject({ ok: false, error: "error.licenceKey" });
    expect(buyShopLink(s, "whmCache", "paypail").ok).toBe(true);
    s.hour++;
    deliverLicences(s);
    expect(licenceMail(s, "paypail")!.p!.shop).toBe("WHMCache");

    installWithKey(s, "clientExit");
    expect(hasModule(s, "pleskit")).toBe(true);
    expect(s.modules).toEqual(["paypail"]);
    expect(bought(s, "paypail")).toBe(true);
    expect(bought(s, "paypail", "whmCache")).toBe(true);
    expect(bought(s, "shop-link", "whmCache")).toBe(false);
  });

  it("keeps them through a save", () => {
    const s = withModules();
    installWithKey(s, "whmCache");
    const back = deserialize(serialize(s));
    expect(back.shop.modulesBy.clientExit).toEqual(s.shop.modulesBy.clientExit);
    installWithKey(back, "clientExit");
    expect(back.modules).toEqual(["paypail"]);
  });

  it("loads an old save's modules and purchases under the shop system in use", () => {
    const s = withModules();
    const d = JSON.parse(serialize(s));
    delete d.shop.modulesBy;
    for (const e of d.ledger) if (e.key.startsWith("ledger.module.")) e.params = {};
    const old = deserialize(JSON.stringify(d));
    expect(old.shop.modulesBy).toEqual({});
    expect(bought(old, "paypail")).toBe(true);
    installWithKey(old, "whmCache");
    expect(old.modules).toEqual([]);
    expect(bought(old, "paypail")).toBe(false);
    installWithKey(old, "clientExit");
    expect(old.modules).toEqual(["paypail"]);
    expect(old.shop.modules.pleskit).toBeDefined();
  });
});
