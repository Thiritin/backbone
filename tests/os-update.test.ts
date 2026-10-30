import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { latestOs } from "../src/sim/10-catalog/os";
import { newGame } from "../src/sim/50-state";
import { updateOs } from "../src/sim/90-actions/os";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("Pear OS updates", () => {
  it("starts on the first release with nothing to install", () => {
    const s = newGame(7);
    expect(s.os).toBe("aqua");
    expect(updateOs(s).ok).toBe(false);
  });

  it("offers a release from its month and installs the newest one", () => {
    const s = newGame(7);
    s.hour = hourOf(new Date(Date.UTC(2007, 8, 30, 23)));
    expect(latestOs(s.hour).id).toBe("aqua");
    s.hour = hourOf(new Date(Date.UTC(2015, 0, 1)));
    expect(latestOs(s.hour).id).toBe("yosemite");
    expect(updateOs(s).ok).toBe(true);
    expect(s.os).toBe("yosemite");
    expect(updateOs(s).ok).toBe(false);
  });

  it("loads saves from before the field on the first release", () => {
    const { os: _, ...old } = newGame(7);
    expect(deserialize(JSON.stringify(old)).os).toBe("aqua");
    expect(deserialize(serialize(newGame(7))).os).toBe("aqua");
  });
});
