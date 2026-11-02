import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { accountUse } from "../src/sim/80-business/readouts";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { downloadArchive } from "../src/sim/90-actions/media";
import { uploadFile } from "../src/sim/90-actions/webspace-files";
import { Customer } from "../src/ui/apps/browser/consoles/cpanic/Customer";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

// A WordPass site on a cPanic server in 2012, with the WHMCache archive in Downloads.
function account(app: "wordpass" | "static") {
  const s = withServer(newGame(3));
  skipTo(s, 2012);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const r = provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, 2012), mailboxes: 1, app }, clusterId: host });
  if (!r.ok) throw new Error(r.error);
  downloadArchive(s, "whmcache_5.0.zip");
  const w = s.workloads.find((x) => x.serviceId === r.id)!;
  return { s, w, c: s.clusters.find((x) => x.id === host)! };
}

describe("web space file sizes", () => {
  it("weighs single files in KB while the disk use stays as derived", () => {
    const { s, w } = account("wordpass"), ws = webspaceOf(s, w.id)!;
    for (const f of ["wp-config.php", ".htaccess", "index.php"]) expect(ws.files[`public_html/${f}`].mb, f).toBeLessThan(0.05);
    expect(ws.files["public_html/wp-content"].mb).toBeGreaterThan(1);
    expect(ws.usage.diskMb).toBeCloseTo(accountUse(s, w).disk[0] * 1024, 1);
  });
});

describe("cPanic customer disk bar", () => {
  it("grows with an upload", () => {
    const { s, w, c } = account("static"), bar = () => renderToString(<Customer game={s} c={c} workloadId={w.id} />).match(/class="cx-bar"[^>]*><i style="width:([\d.e-]+)%/)?.[1];
    const before = Number(bar());
    expect(uploadFile(s, w.id, "public_html", "whmcache_5.0.zip").ok).toBe(true);
    expect(Number(bar())).toBeGreaterThan(before);
  });
});
