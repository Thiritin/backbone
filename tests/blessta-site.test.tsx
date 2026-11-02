import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { useStore } from "../src/ui/store";
import { blesstaSkin } from "../src/ui/apps/browser/sites/portal/blessta";
import { Blessta } from "../src/ui/apps/browser/sites/shopvendors/blessta";
import { shopGame } from "./portal-helpers";

const admin = (major: string) => {
  const s = shopGame("blessta", 2015);
  const route = parsePortal("blessta", portalPath("blessta", "admin", {}, { s: "home" }))!;
  return renderToString(<blesstaSkin.Admin game={s} variant="blessta" route={route} open={() => {}} version="" major={major} browse={() => {}} />);
};

describe("Blessta", () => {
  it("sells its keys on blessta.com, so the admin's Upgrade opens My account there", () => {
    expect(hostOf("blessta")).toBe("blessta.com");
  });

  it("changes the admin look at majors 3, 5 and 6", () => {
    expect(admin("2")).toContain("bl-classic");
    expect(admin("4")).toContain("bl-widgets");
    expect(admin("5")).toContain("bl-paradigm");
    expect(admin("5")).not.toContain("bl-dark");
    expect(admin("6")).toContain("bl-dark");
  });

  it("changes the vendor site with the game year and lists the player's keys", () => {
    const s = shopGame("blessta", 2009);
    useStore.setState({ game: s });
    expect(renderToString(<Blessta game={s} path="/" />)).toContain("bv-classic");
    const account = renderToString(<Blessta game={s} path="/account" />);
    expect(account).toContain(s.licenses.find((k) => k.product === "blessta")!.key);
    expect(account).toContain("Copy key");
    s.hour = hourOfMonth("2023-03");
    expect(renderToString(<Blessta game={s} path="/pricing" />)).toContain("bv-modern");
  });
});
