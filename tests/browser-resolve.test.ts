import { describe, expect, it } from "vitest";
import { MANUFACTURERS } from "../src/sim/10-catalog/hardware";
import { companyDomain, fqdn } from "../src/sim/30-customers/domains";
import { machineAddress } from "../src/sim/60-infra/addresses";
import { defaultBookmarks, displayHost, resolve, split, vendorHost, VENDORS, VIDEO_URL, WIKI_URL } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { newGame } from "../src/sim/50-state";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { setPower } from "../src/sim/90-actions/hardware";
import { setSiteHost } from "../src/sim/90-actions/website";
import { readyGame, registered, skipTo } from "./fixtures";
import { createRng } from "../src/sim/00-core/rng";
import { spawnNotice } from "../src/sim/40-support/notices";
import { customerSite } from "../src/sim/80-business/website";

const web = (s: ReturnType<typeof readyGame>) => s.services.find((v) => v.product === "webHosting" && v.domain)!;

// A server and a VM without management software, which serve no console.
function bare(s: ReturnType<typeof readyGame>) {
  s.devices.push({ ...s.devices.find((x) => x.hostname)!, id: "dev99", hostname: "node099" });
  const made = createVm(s, s.clusters[0].id, PANEL_VM_SIZE), vm = s.workloads.find((w) => w.id === (made.ok ? made.id : ""))!;
  return { node: s.devices.at(-1)!, vm };
}

describe("browser resolver", () => {
  it("serves the encyclopedia and lists it in the index", () => {
    const s = newGame(1);
    expect(resolve(s, WIKI_URL)).toMatchObject({ page: { kind: "wiki" }, path: "/wiki/Main_Page", load: "fast" });
    expect(resolve(s, "wikipedio.org/wiki/Uplink").page.kind).toBe("wiki");
    expect(siteIndex(s).find((c) => c.title === "Community")!.rows.map((r) => r.url)).toContain(WIKI_URL);
  });

  it("splits an address into a lowercase host and a path", () => {
    expect(split("HTTPS://WWW.Basement-Hosting.de/a/b?x=1#top")).toEqual({ host: "www.basement-hosting.de", path: "/a/b?x=1" });
    expect(split("basement-hosting.de")).toEqual({ host: "basement-hosting.de", path: "/" });
  });

  it("resolves the company domain, with and without www, once the site is launched", () => {
    const s = registered(readyGame(1)), d = companyDomain(s);
    expect(resolve(s, d).page).toEqual({ kind: "company" });
    expect(resolve(s, `https://www.${d}/`)).toMatchObject({ page: { kind: "company" }, load: "fast" });
    expect(resolve(s, `${d}/admin`).page).toEqual({ kind: "company" });
    expect(defaultBookmarks(s).map((m) => resolve(s, m.url).page.kind)).toEqual(["company", "registrar"]);
    s.marketing.launched = false;
    expect(resolve(s, d).page).toEqual({ kind: "notfound" });
    expect(defaultBookmarks(s).map((m) => m.title)).not.toContain(s.company.name);
  });

  it("resolves every customer domain to its site", () => {
    const s = readyGame(1), sites = s.services.filter((v) => v.product === "webHosting" && v.domain);
    expect(sites.length).toBeGreaterThan(0);
    for (const v of sites) {
      expect(resolve(s, v.domain!).page).toEqual({ kind: "customer", serviceId: v.id });
      expect(resolve(s, `www.${v.domain}/index.html`).page).toEqual({ kind: "customer", serviceId: v.id });
    }
  });

  it("resolves machine and service names to the placeholder host page", () => {
    const s = readyGame(1), { node, vm } = bare(s);
    expect(resolve(s, fqdn(s, node.hostname!)).page).toEqual({ kind: "host", hostname: node.hostname });
    expect(resolve(s, fqdn(s, vm.hostname!)).page).toEqual({ kind: "host", hostname: vm.hostname });
    const svc = s.services.find((v) => v.hostname)!;
    expect(resolve(s, fqdn(s, svc.hostname!)).page).toEqual({ kind: "host", hostname: svc.hostname });
  });

  it("resolves private addresses typed as URLs to the machine", () => {
    const s = readyGame(1), { node } = bare(s), ip = machineAddress(s, node.id)!;
    expect(resolve(s, `http://${ip}/`).page).toEqual({ kind: "host", hostname: node.hostname });
    expect(resolve(s, "10.99.99.99").page).toEqual({ kind: "notfound" });
  });

  it("gives every manufacturer but the generic parts a vendor site and serves the video by address", () => {
    const s = readyGame(1);
    skipTo(s, 2040);
    expect(VENDORS.length).toBe(MANUFACTURERS.length - 1);
    for (const m of VENDORS) expect(resolve(s, `www.${vendorHost(m.id)}`).page).toEqual({ kind: "vendor", maker: m.id });
    expect(resolve(s, "generic.com").page).toEqual({ kind: "notfound" });
    expect(resolve(s, VIDEO_URL).page).toEqual({ kind: "video" });
    expect(resolve(s, "youtub.com/watch?v=other").page).toEqual({ kind: "notfound" });
  });

  it("serves a reported phishing page until it is taken down", () => {
    const s = readyGame(1);
    const t = spawnNotice(s, null, true, createRng(3), "phishing");
    expect(resolve(s, t.notice!.url).page).toEqual({ kind: "phishing", sender: "baenk" });
    expect(resolve(s, `${t.notice!.url}x`).page.kind).not.toBe("phishing");
    t.outcome = "takenDown";
    expect(resolve(s, t.notice!.url).page.kind).not.toBe("phishing");
  });

  it("shows the company's logo on a sponsored site while the sponsorship runs and its banner hangs", () => {
    const s = readyGame(1), v = web(s);
    expect(customerSite(s, v.id)!.sponsored).toBe(false);
    s.sponsorships = [{ id: "sp1", event: "lan", ticketId: "tkt0", offeredAt: 0, status: "running", customerId: v.customerId, serviceIds: [v.id], startedAt: 0, endsAt: 99999, endedAt: null, down: {}, seen: {}, reward: null }];
    expect(customerSite(s, v.id)!.sponsored).toBe(true);
    s.sponsorships[0].status = "done";
    expect(customerSite(s, v.id)!.sponsored).toBe(false);
  });

  it("does not know other names", () => {
    const s = readyGame(1);
    for (const u of ["example.com", "nonsense", `nope.${companyDomain(s)}`, "node001", "https://www.google.com/search?q=x"]) expect(resolve(s, u).page).toEqual({ kind: "notfound" });
  });

  it("cannot reach a site or machine on a host that is down", () => {
    const s = readyGame(1), node = s.devices.find((x) => x.hostname)!;
    expect(resolve(s, fqdn(s, node.hostname!)).load).toBe("fast");
    expect(resolve(s, web(s).domain!).load).toBe("fast");
    expect(setPower(s, node.id, false).ok).toBe(true);
    expect(resolve(s, fqdn(s, node.hostname!)).load).toBe("down");
    expect(resolve(s, web(s).domain!).load).toBe("down");
    expect(resolve(s, `http://${machineAddress(s, node.id)}/`).load).toBe("down");
  });

  it("cannot reach the company site on a down own host, while the admin page still opens", () => {
    const s = readyGame(1), host = s.clusters.find((c) => c.kind === "panel")!;
    expect(setSiteHost(s, { kind: "own", clusterId: host.id }).ok).toBe(true);
    expect(resolve(s, companyDomain(s)).load).toBe("fast");
    expect(setPower(s, s.devices.find((x) => x.hostname)!.id, false).ok).toBe(true);
    expect(resolve(s, companyDomain(s)).load).toBe("down");
  });

  it("has no company hostnames before a domain is registered", () => {
    const s = readyGame(1), node = s.devices.find((x) => x.hostname)!;
    s.company = { ...s.company, domain: null };
    expect(resolve(s, fqdn(s, node.hostname!)).page).toEqual({ kind: "notfound" });
    expect(resolve(newGame(3), "example.com").page).toEqual({ kind: "notfound" });
  });

  it("prefixes www. to a bare domain only, in the index and the bookmarks", () => {
    expect(displayHost("macrosoft.com")).toBe("www.macrosoft.com");
    expect(displayHost("basement-hosting.co.uk")).toBe("www.basement-hosting.co.uk");
    expect(displayHost("windoors.macrosoft.com")).toBe("windoors.macrosoft.com");
    expect(displayHost("anyconnekt.sysko.com")).toBe("anyconnekt.sysko.com");
    const s = readyGame(1);
    s.hour = 24 * 365 * 15;
    const urls = siteIndex(s).flatMap((c) => c.rows.map((r) => r.url));
    expect(urls).toContain("windoors.macrosoft.com/");
    expect(urls).toContain("anyconnekt.sysko.com/");
    expect(urls.filter((u) => /^www\.[^/]+\.[^/]+\.[^/]+\//.test(u) && !/\.co\.uk\//.test(u))).toEqual([]);
    for (const u of [...urls, ...defaultBookmarks(s).map((b) => b.url)]) expect(resolve(s, u).page.kind).not.toBe("notfound");
  });
});
