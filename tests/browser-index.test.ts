import { describe, expect, it } from "vitest";
import { SOFTWARE } from "../src/sim/10-catalog/platforms";
import { SERVER_OS } from "../src/sim/10-catalog/server-os";
import { HOME_URL, resolve } from "../src/sim/80-business/browser";
import { consoleBookmarks } from "../src/sim/80-business/consoles";
import { siteIndex } from "../src/sim/80-business/index";
import { setPower } from "../src/sim/90-actions/hardware";
import { readyGame, skipTo, newGame } from "./fixtures";

const titles = (s: ReturnType<typeof newGame>, category: string) => siteIndex(s).find((c) => c.title === category)!.rows.map((r) => r.title);

describe("browser index", () => {
  it("opens at home and lists the categories in order", () => {
    const s = newGame(1);
    expect(resolve(s, HOME_URL).page).toEqual({ kind: "index" });
    expect(resolve(s, "yahoy.com").page).toEqual({ kind: "index" });
    expect(siteIndex(s).map((c) => c.title)).toEqual([
      "Banks", "Operating systems", "Virtualization", "Hosting panels", "Game panels", "DNS", "VPN", "Storage", "Mail", "Backup",
      "Domain resellers", "Government", "Community", "Hardware", "Video",
    ]);
    const ready = readyGame(1);
    expect(siteIndex(ready).map((c) => c.title).slice(-3)).toEqual(["Hardware", ready.company.name, "Video"]);
    expect(titles(s, "Operating systems")).toEqual(["Debiant GNU/Lunix", "Windoors Server"]);
  });

  it("lists a software from the year it exists", () => {
    const s = newGame(1);
    expect(titles(s, "Virtualization")).toEqual(["OpenVeeZee", "VMwhere"]);
    expect(titles(s, "Game panels")).toEqual(["TCAdmen"]);
    skipTo(s, 2016);
    expect(titles(s, "Virtualization")).toEqual(["OpenVeeZee", "OpenStash", "VMwhere", "Proxmocks", "HyperVee"]);
    expect(titles(s, "Game panels")).toEqual(["TCAdmen", "MultiKraft", "Pterodaktyl"]);
  });

  it("resolves every software and OS host with and without www, and none before its year", () => {
    const s = newGame(1);
    expect(resolve(s, "pterodaktyl.io").page).toEqual({ kind: "notfound" });
    expect(resolve(s, "www.proxmocks.com/download").page).toEqual({ kind: "notfound" });
    skipTo(s, 2025);
    for (const sw of SOFTWARE) {
      expect(resolve(s, sw.site.host).page).toEqual({ kind: "software", id: sw.id });
      expect(resolve(s, `https://www.${sw.site.host}/pricing`)).toMatchObject({ page: { kind: "software", id: sw.id }, path: "/pricing" });
    }
    for (const os of SERVER_OS) expect(resolve(s, `www.${os.site.host}/`).page).toEqual({ kind: "os", id: os.id });
    for (const c of siteIndex(s)) for (const r of c.rows) if (c.title !== "Video") expect(resolve(s, r.url).page.kind).not.toBe("notfound");
  });

  it("lists the company site once it is launched", () => {
    const s = readyGame(1), titles = () => siteIndex(s).find((c) => c.title === s.company.name)!.rows.map((r) => r.title);
    s.marketing.launched = true;
    expect(titles()[0]).toBe(s.company.name);
    s.marketing.launched = false;
    expect(titles()).not.toContain(s.company.name);
  });

  it("lists the company's consoles from its clusters, down when the host cannot be reached", () => {
    const s = readyGame(1), company = () => siteIndex(s).find((c) => c.title === s.company.name)!.rows.filter((r) => r.title !== s.company.name);
    expect(company().map((r) => r.url)).toEqual(consoleBookmarks(s).map((m) => m.url));
    expect(company().map((r) => r.title.split(" ").at(-1)!.split(":")[0])).toEqual(consoleBookmarks(s).map((m) => m.url.split(".")[0]));
    expect(consoleBookmarks(s).length).toBeGreaterThan(0);
    expect(company().every((r) => !r.down)).toBe(true);
    for (const d of s.devices.filter((x) => x.hostname)) expect(setPower(s, d.id, false).ok).toBe(true);
    expect(company().every((r) => r.down)).toBe(true);
  });

  it("lists the consoles at their machines' private addresses before the company has a domain", () => {
    const s = readyGame(1);
    s.company.domain = null;
    const rows = siteIndex(s).find((c) => c.title === s.company.name)!.rows.filter((r) => r.title !== s.company.name);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.url).toMatch(/^\d+\.\d+\.\d+\.\d+(:\d+)?$/);
      const page = resolve(s, r.url).page;
      expect(page.kind).toBe("console");
      if (page.kind === "console") expect(r.title.split(" ").at(-1)!.split(":")[0]).toBe(page.hostname);
    }
  });

  it("lists a hardware brand only from the month its first model is released", () => {
    const s = newGame(1);
    expect(titles(s, "Hardware")).toContain("Dwell");
    expect(titles(s, "Hardware")).not.toContain("Lenovoid");
    expect(resolve(s, "lenovoid.com").page).toEqual({ kind: "notfound" });
    skipTo(s, 2020);
    expect(titles(s, "Hardware")).toContain("Lenovoid");
    expect(resolve(s, "lenovoid.com").page).toEqual({ kind: "vendor", maker: "lenovoid" });
  });
});
