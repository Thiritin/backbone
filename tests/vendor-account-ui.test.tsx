import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { assignKey, issueKey, panelMachine } from "../src/sim/60-infra/licence";
import { Account } from "../src/ui/apps/browser/sites/shop/VendorShop";
import { useStore } from "../src/ui/store";
import { panelVm, readyGame } from "./fixtures";

describe("vendor My account", () => {
  it("lists the other editions of every key with their prices", () => {
    const s = readyGame(1);
    s.hour = hourOf(new Date(Date.UTC(2020, 0, 1)));
    const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic");
    assignKey(s, issueKey(s, "cpanic", "pro").id, panelMachine(s.clusters.find((c) => c.id === id)!)!);
    Object.assign(useStore.getInitialState().game, s);
    const html = renderToString(<Account host={hostOf("cpanic")!} btn="b" />);
    expect(html).toContain("Change edition");
    expect(html).toContain(">Admin · 4");
    expect(html).toContain(">Premier · 0.40");
    // Each key offers the editions other than its own.
    expect(html.match(/value="pro"/g)).toHaveLength(1);
    expect(html.match(/value="premier"/g)).toHaveLength(1);
  });
});
