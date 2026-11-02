import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { fqdn } from "../src/sim/30-customers/domains";
import { installDone } from "../src/sim/60-infra/apt";
import { resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { consoleBookmarks, consoleFeatures } from "../src/sim/80-business/consoles";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { lateVersions, panelVm, pinVersion, readyGame, skipTo } from "./fixtures";

// docs/design/software.md, section 10: a year of each console's early look, a year of its late look, and a word only that look prints.
const ERAS: Record<string, [number, number, string, string]> = {
  powerdnz: [2005, 2016, "Native", "Accounts"], openveepeen: [2005, 2017, "Gateway", "Current users"],
  anyconnekt: [2005, 2016, "Device Information", "Device Information"], ownclod: [2010, 2016, "<th>Size</th>", "oc-tile"],
  minnio: [2016, 2021, "mn-list", "mn-cards"],
};
const PRODUCT = { dns: "dns", vpn: "vpn", storage: "storage" } as const;

function setup(id: string, year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const cloud = s.clusters.find((c) => c.kind === "cloud")!, host = panelVm(s, cloud.id, id, { vcpu: 2, ramGb: 4, diskGb: 60 }), c = s.clusters.find((x) => x.id === host)!;
  const kind = softwareById(id).kind as keyof typeof PRODUCT;
  if (PRODUCT[kind]) { const r = provisionService(s, addCustomer(s, "Ada Lang", "hobbyDev"), PRODUCT[kind], { label: "ada", spec: { ...sizeSpec(PRODUCT[kind], 0, year), diskGb: 10 } }); expect(r.ok ? "ok" : r.error, id).toBe("ok"); }
  return { s, c };
}

function render(id: string, year: number, signedIn: boolean, version?: string) {
  const { s, c } = setup(id, year), View = CONSOLES[id];
  if (version) pinVersion(s, c, id, version);
  return { year: yearOf(s.hour), html: renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="svc.example.com" signedIn={signedIn} login={() => {}} logout={() => {}} />) };
}

describe("DNS, VPN, storage and mail consoles", () => {
  it("are drawn by their own component", () => {
    for (const id of [...Object.keys(ERAS), "mailpig"]) expect(CONSOLES[id], id).toBeDefined();
  });

  it("wear the look of the installed version, signed in or not", () => {
    for (const [id, [early, late, earlyMark, lateMark]] of Object.entries(ERAS)) {
      const [before, from] = lateVersions(id);
      for (const [year, look, mark, version] of [[early, "early", earlyMark, undefined], [late, "early", earlyMark, before], [late, "late", lateMark, from]] as const) {
        const out = render(id, year, true, version);
        expect(out.year, id).toBe(year);
        expect(out.html, `${id} ${year}`).toContain(`data-era="${look}"`);
        expect(out.html, `${id} ${year}`).toContain(mark);
        expect(out.html).toContain("svc.example.com");
        const login = render(id, year, false, version).html;
        expect(login, id).toContain(`data-era="${look}"`);
        expect(login).toContain("Password");
      }
    }
  });

  it("list the customer's zones in PowerDNZ and the VPN gateway with its account", () => {
    expect(render("powerdnz", 2010, true).html).toMatch(/ada-lang\.com|Ada Lang/);
    expect(render("openveepeen", 2010, true).html).toContain("Ada Lang");
  });

  it("draw Mailpig in one look with its four tabs and the company mailboxes", () => {
    for (const year of [2015, 2024]) {
      const html = render("mailpig", year, true).html;
      for (const tab of ["Mailboxes", "Domains", "Queue", "Configuration"]) expect(html).toContain(tab);
      expect(html).toContain("admin@");
      expect(html).not.toContain("data-era");
    }
  });
});

describe("software without a web console", () => {
  const CLI: Record<string, number> = { bound: 2005, knut: 2011, wireguarded: 2018, vsftpeed: 2005, postfixit: 2005, backula: 2005 };
  it("resolves its host to the plain host page with no bookmark, directory row or install address, in both eras", () => {
    for (const [id, from] of Object.entries(CLI)) {
      for (const year of [from, 2022]) {
        const { s, c } = setup(id, year), host = s.workloads.find((w) => w.id === c.vm)!.hostname!;
        expect(resolve(s, fqdn(s, host)).page, `${id} ${year}`).toEqual({ kind: "host", hostname: host });
        expect(consoleBookmarks(s).some((b) => b.url.includes(host)), id).toBe(false);
        expect(JSON.stringify(siteIndex(s)), id).not.toContain(host);
        expect(installDone(s, c.vm!, softwareById(id)).join("\n"), id).not.toContain("https://");
      }
    }
  });
});

