import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CLI_ONLY, HostCli } from "../src/ui/apps/browser/consoles/hostcli/HostCli";
import { panelVm, readyGame, skipTo } from "./fixtures";

describe("backula page", () => {
  it("prints bconsole output instead of a web console", () => {
    const s = readyGame(1);
    skipTo(s, 2008);
    s.cash = 1_000_000;
    const host = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "backula", { vcpu: 4, ramGb: 8, diskGb: 600 }), c = s.clusters.find((x) => x.id === host)!;
    expect(CLI_ONLY.has("backula")).toBe(true);
    const html = renderToString(<HostCli game={s} c={c} family="backula" host="backup.example.com" name="bk1" />);
    expect(html).toContain("bconsole");
    expect(html).toContain("bk1-dir Version:");
    expect(html).toContain("/var/lib/backula");
    expect(html).toContain("No lost machines");
  });
});
