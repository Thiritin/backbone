import { describe, expect, it } from "vitest";
import { plugStick, unplugStick, writeStick } from "../src/sim/90-actions/media";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { FREEMAIL_DOMAINS } from "../src/sim/30-customers/addresses";
import { rowsOf } from "../src/sim/60-infra/webdb";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { BASEMENT_SERVER, isoOf, newGame, panelServer, skipTo, withImage, withServer } from "./fixtures";

describe("the stick at the rack", () => {
  it("plugs into a racked server and comes out again", () => {
    const s = withServer(newGame(5));
    withImage(s);
    expect(writeStick(s, isoOf(s)).ok).toBe(true);
    expect(plugStick(s, "dev3").ok).toBe(true);
    expect(s.media.stick.in).toBe("dev3");
    expect(plugStick(s, "dev3")).toEqual({ ok: false, error: "error.stickIn" });
    expect(unplugStick(s).ok).toBe(true);
    expect(s.media.stick.in).toBeNull();
  });

  it("generates customer emails on pun domains", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = withServer(newGame(seed));
      skipTo(s, 2010);
      const host = panelServer(s, BASEMENT_SERVER, "cpanic");
      const cus = addCustomer(s, "Socken Shop", "onlineShop");
      const r = provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, 2010), mailboxes: 3, app: "wordpass" }, clusterId: host });
      s.hour += 60 * 24;
      const ws = webspaceOf(s, s.workloads.find((x) => x.serviceId === (r as { id: string }).id)!.id)!;
      const rows = rowsOf(s, ws, ws.app!.db, "wp_users", 0, 30);
      expect(rows.length).toBeGreaterThan(1);
      for (const r of rows.slice(1)) expect(FREEMAIL_DOMAINS).toContain(String(r.values.user_email).split("@")[1]);
    }
  });
});
