import { describe, expect, it } from "vitest";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { phpAt } from "../src/sim/10-catalog/platforms";
import { type GameState } from "../src/sim/50-state";
import { openVulns } from "../src/sim/60-infra/vulns";
import { runCommand, runLine, type Session } from "../src/sim/60-infra/terminal";
import type { Call } from "../src/sim/90-actions/index";
import { panelServer, readyGame, withServer, newGame } from "./fixtures";

const base = readyGame(3);
const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const act = (s: GameState) => ([fn, ...args]: Call) => fn(s, ...args);
const text = (s: GameState, line: string, session: Session | null = null) => runLine(() => s, act(s), session, null, line).output.join("\n");

// A panel host on dev3 still on the 2005 release, five years later.
function outdated() {
  const s = withServer(newGame(1)), id = panelServer(s, "dev3");
  s.hour = year(2010);
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, version: 2005, updatedAt: 0, channel: "edge" } : c));
  const at: Session = { host: s.devices.find((d) => d.id === "dev3")!.hostname!, deviceId: "dev3" };
  return { s, id, at };
}

describe("apt", () => {
  it("needs sudo at the desk, where nothing is ever due", () => {
    const s = structuredClone(base);
    expect(text(s, "apt update")).toContain("Permission denied");
    expect(text(s, "sudo apt update")).toContain("All packages are up to date.");
    expect(text(s, "sudo apt-get upgrade")).toContain("0 upgraded, 0 newly installed");
  });

  it("lists the outdated software and PHP of a server", () => {
    const { s, at } = outdated();
    expect(text(s, "apt update", at)).toContain("2 packages can be upgraded.");
    const rows = text(s, "apt list --upgradable", at).split("\n");
    expect(rows[1]).toBe("freepanel/sarge 2010.1 amd64 [upgradable from: 2005.1]");
    expect(rows[2]).toMatch(/^php5\/sarge 5\.\d/);
  });

  it("asks before upgrading and keeps the rest of the line for the answer", () => {
    const { s, at } = outdated();
    const r = runCommand(s, at, "apt upgrade");
    expect(r.confirm).toBe(true);
    expect(r.action).toBeUndefined();
    expect(r.output).toContain("Services on this server will be offline for about 30 minutes.");
    expect(runLine(() => s, act(s), at, null, "apt update && apt upgrade; echo done").confirm).toBe("apt upgrade -y; echo done");
  });

  it("upgrades like the Software app does, and then has nothing left", () => {
    const { s, id, at } = outdated();
    expect(openVulns(s, id).length).toBeGreaterThan(0);
    expect(text(s, "apt upgrade -y", at)).toContain("Setting up freepanel (2010.1) ...");
    const c = s.clusters.find((x) => x.id === id)!;
    expect(c).toMatchObject({ version: yearOf(s.hour), updatedAt: s.hour, php: phpAt(2010) });
    expect(openVulns(s, id)).toEqual([]);
    expect(text(s, "apt upgrade -y", at)).toContain("0 upgraded");
  });
});
