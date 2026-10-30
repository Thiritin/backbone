import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { CONSOLES, ConsolePage } from "../src/ui/apps/browser/consoles/ConsolePage";
import { panelVm, readyGame, skipTo } from "./fixtures";

// docs/design/software.md, section 10: the first year of each console's early and late look, and a word only that look prints.
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

function render(id: string, year: number, signedIn: boolean) {
  const { s, c } = setup(id, year), View = CONSOLES[id];
  return { year: yearOf(s.hour), html: renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="svc.example.com" signedIn={signedIn} login={() => {}} logout={() => {}} />) };
}

describe("DNS, VPN, storage and mail consoles", () => {
  it("are drawn by their own component", () => {
    for (const id of [...Object.keys(ERAS), "mailpig"]) expect(CONSOLES[id], id).toBeDefined();
  });

  it("wear the early look before the late year and the late look from it, signed in or not", () => {
    for (const [id, [early, late, earlyMark, lateMark]] of Object.entries(ERAS)) {
      for (const [year, look, mark] of [[early, "early", earlyMark], [late - 1, "early", earlyMark], [late, "late", lateMark]] as const) {
        const out = render(id, year, true);
        expect(out.year, id).toBe(year);
        expect(out.html, `${id} ${year}`).toContain(`data-era="${look}"`);
        expect(out.html, `${id} ${year}`).toContain(mark);
        expect(out.html).toContain("svc.example.com");
        const login = render(id, year, false).html;
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
  const CLI: Record<string, [number, string]> = {
    bound: [2005, "named-checkconf -z"], knut: [2011, "knotc status"], wireguarded: [2018, "wg show"], vsftpeed: [2005, "tail -n 10 /var/log/vsftpeed.log"], postfixit: [2005, "mailq"],
  };
  it("shows the host page with the product's CLI status, in both eras", () => {
    for (const [id, [from, cmd]] of Object.entries(CLI)) {
      for (const year of [from, 2022]) {
        const { s, c } = setup(id, year);
        const html = renderToString(<ConsolePage game={s} hostname="dns-1" host="dns-1.example.com" cluster={c} defaced={false} />);
        expect(html, `${id} ${year}`).toContain("This host serves no web page");
        expect(html, id).toContain(`root@dns-1:~# ${cmd}`);
      }
    }
  });

  it("prints the zones and peers the machine holds", () => {
    const zones = (id: string) => { const { s, c } = setup(id, 2019); return renderToString(<ConsolePage game={s} hostname="h" host="h.example.com" cluster={c} defaced={false} />); };
    expect(zones("bound")).toMatch(/zone [a-z0-9.-]+\/IN: loaded serial \d{10}/);
    expect(zones("bound")).toMatch(/number of zones: [1-9]/);
    expect(zones("knut")).toMatch(/\[[a-z0-9.-]+\.\] role: master/);
    expect(zones("wireguarded")).toMatch(/peer: [A-Za-z0-9+/]{43}=/);
    expect(zones("postfixit")).toContain("Mail queue is empty");
  });
});
