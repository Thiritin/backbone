import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { addressTick, mailAddress } from "../src/sim/60-infra/addresses";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { HostCli } from "../src/ui/apps/browser/consoles/hostcli/HostCli";
import { BASEMENT_SERVER, panelServer, withServer, newGame } from "./fixtures";

describe("postfixit page", () => {
  it("prints the deferred queue and the command buttons", () => {
    const s = withServer(newGame(1));
    const host = panelServer(s, BASEMENT_SERVER), cust = addCustomer(s, "Anna Albers", "private");
    provisionService(s, cust, "webHosting", { label: "a", spec: sizeSpec("webHosting", 0, 2005), clusterId: host });
    addressTick(s);
    const c = s.clusters.find((x) => x.id === host)!, html = () => renderToString(<HostCli game={s} c={c} family="postfixit" host="mail.example.com" name="mx1" />);
    expect(html()).toContain("Mail queue is empty");
    s.netsvc.mail[mailAddress(s, host)!.id] = { deferred: 3, hit: 0, listings: [] };
    expect(html()).toContain("-- ");
    expect(html()).toContain("3 Requests.");
    expect(html()).toContain("postqueue -f");
  });
});
