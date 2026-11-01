import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { SOFTWARE } from "../src/sim/10-catalog/platforms";
import { SERVER_OS } from "../src/sim/10-catalog/server-os";
import { nextMajor, versionAt, versionInfo, versionsOf } from "../src/sim/10-catalog/software-versions";
import { newGame } from "../src/sim/50-state";
import { machineOf } from "../src/sim/60-infra/cluster";
import { assignedKey, installedVersion, licenceStatus, updateKey } from "../src/sim/60-infra/licence";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, hypervisor, skipTo, withServer } from "./fixtures";

const at = hourOfMonth;

describe("software versions", () => {
  it("OpenVeeZee has a release out when the game starts", () => {
    expect(versionAt("openveezee", 0).release).toBe(0);
  });
  it("every OS and software has releases in order with ends after them", () => {
    for (const id of [...SOFTWARE.map((x) => x.id), ...SERVER_OS.map((o) => o.id)]) {
      const vs = versionsOf(id);
      expect(vs.length, id).toBeGreaterThan(0);
      expect(new Set(vs.map((v) => v.version)).size, id).toBe(vs.length);
      vs.forEach((v, i) => {
        if (i) expect(v.release, `${id} ${v.version}`).toBeGreaterThan(vs[i - 1].release);
        if (v.updatesUntil !== null) expect(v.updatesUntil, `${id} ${v.version}`).toBeGreaterThanOrEqual(v.release);
        if (v.securityUntil !== null) expect(v.securityUntil, `${id} ${v.version}`).toBeGreaterThanOrEqual(v.updatesUntil ?? Infinity);
      });
      // A major's releases sit together, so the next major is the next one in the list.
      const majors = vs.map((v) => v.major).filter((m, i, all) => m !== all[i - 1]);
      expect(new Set(majors).size, id).toBe(majors.length);
    }
  });

  it("gives the newest release out at an hour", () => {
    expect(versionAt("vmwhere", at("2013-08")).version).toBe("5.1");
    expect(versionAt("vmwhere", at("2013-09")).version).toBe("5.5");
    expect(versionAt("cpanic", 0).version).toBe("10");
    expect(versionAt("proxmocks", 0).version).toBe("0.9");
    expect(versionAt("lunix", at("2016-06"))).toMatchObject({ version: "8", name: "Jessie", updatesUntil: at("2018-06"), securityUntil: at("2020-06") });
    expect(versionInfo("openstash", "2023.1")?.name).toBe("Antelope");
  });

  it("finds the newest release of the next major once it is out", () => {
    expect(nextMajor("vmwhere", "5.0", at("2014-06"))).toBeNull();
    expect(nextMajor("vmwhere", "5.0", at("2016-01"))?.version).toBe("6.0");
    expect(nextMajor("vmwhere", "5.5", at("2019-01"))?.version).toBe("6.7");
    expect(nextMajor("proxmocks", "7.0", at("2025-06"))?.version).toBe("8.4");
    expect(nextMajor("hypervee", "2012", at("2020-01"))?.version).toBe("2012 R2");
    expect(nextMajor("vmwhere", "9.1", at("2030-01"))).toBeNull();
    expect(nextMajor("vmwhere", "2015", at("2030-01"))).toBeNull();
  });

  it("installs the newest release and keys cover their major", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    skipTo(s, 2013);
    hypervisor(s, [BASEMENT_SERVER], undefined, "vmwhere");
    expect(installedVersion(s, BASEMENT_SERVER, "vmwhere")).toBe(versionAt("vmwhere", s.hour).version);
    expect(installedVersion(s, BASEMENT_SERVER, "vmwhere")).toBe("5.1");
    const key = assignedKey(s, BASEMENT_SERVER, "vmwhere")!;
    expect(key.covers).toEqual({ kind: "version", major: "5" });
    expect(licenceStatus(s, BASEMENT_SERVER, "vmwhere")).toBe("active");
    updateKey(s, key.id, { covers: { kind: "version", major: "4" } });
    expect(licenceStatus(s, BASEMENT_SERVER, "vmwhere")).toBe("unlicensed");
  });

  it("gives installs of an old save the newest release out at the save's date", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    skipTo(s, 2016);
    hypervisor(s, [BASEMENT_SERVER]);
    const raw = JSON.parse(serialize(s));
    raw.devices.find((d: { id: string }) => d.id === BASEMENT_SERVER).software[0].version = "2014";
    const old = deserialize(JSON.stringify(raw));
    expect(machineOf(old, BASEMENT_SERVER)?.software).toMatchObject([{ id: "proxmocks", version: "4.0" }]);
  });
});
