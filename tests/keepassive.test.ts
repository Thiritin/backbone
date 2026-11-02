import { describe, expect, it } from "vitest";
import { isAvailable } from "../src/sim/10-catalog/research";
import { storeItem } from "../src/sim/10-catalog/store";
import { install, rememberLogin } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

describe("KeePassive", () => {
  it("is an upgrade that needs no skill", () => {
    expect(storeItem("keepassive")?.kind).toBe("upgrade");
    expect(isAvailable("keepassive", [])).toBe(true);
  });

  it("saves logins only once installed, and keeps them in the save", () => {
    const s = readyGame(1);
    s.cash = 100;
    expect(rememberLogin(s, "fritz:r1", ["igel1234"])).toEqual({ ok: false, error: "error.notInstalled" });
    expect(install(s, "keepassive")).toEqual({ ok: true });
    expect(rememberLogin(s, "fritz:r1", ["igel1234"])).toEqual({ ok: true });
    expect(rememberLogin(s, "bank:sparklasse", ["1234567", "0000"])).toEqual({ ok: true });
    expect(deserialize(serialize(s)).logins).toEqual({ "fritz:r1": ["igel1234"], "bank:sparklasse": ["1234567", "0000"] });
  });

  it("gives old saves an empty vault", () => {
    const data = JSON.parse(serialize(readyGame(2)));
    delete data.logins;
    expect(deserialize(JSON.stringify(data)).logins).toEqual({});
  });
});
