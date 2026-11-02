// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOfMonth } from "../src/sim/00-core/time";
import { LOOKOUT_OWA, lookoutToken } from "../src/sim/10-catalog/mail-hosted";
import { capsOf } from "../src/sim/42-mail/caps";
import { deliver } from "../src/sim/42-mail/deliver";
import type { GameState } from "../src/sim/50-state";
import { resolve } from "../src/sim/80-business/browser";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { cancelMail } from "../src/sim/90-actions/mail";
import { signUpLookout, verifyLookout } from "../src/sim/90-actions/mail-hosted";
import { LookoutSite, LOOKOUT_SESSION } from "../src/ui/apps/browser/sites/mail/lookout/LookoutSite";
import { Owa } from "../src/ui/apps/browser/sites/mail/owa/Owa";
import { writeSession } from "../src/ui/session";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

function fresh(seed: number, ym: string): GameState {
  const s = readyGame(seed);
  s.hour = hourOfMonth(ym);
  cancelMail(s);
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  return s;
}
const lookout = (s: GameState) => s.mail.tenants.find((x) => x.host === "lookout" && x.endsAt === null)!;

function show(s: GameState, url: string) {
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const [u, setU] = useState(url), r = resolve(g, u);
    if (r.page.kind !== "mailProvider") return <p>{r.page.kind}</p>;
    return r.page.id === "lookout-owa" ? <Owa key={u} game={g} provider="lookout" host={LOOKOUT_OWA} path={r.path} go={setU} /> : <LookoutSite key={u} game={g} host={r.host} path={r.path} go={setU} />;
  };
  return render(<View />);
}
const type = (name: string, value: string) => fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value } });

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("Lookout 365 sites", () => {
  it("answers on the site, the admin center and the web mail hosts", () => {
    const s = readyGame(1);
    expect(["lookout365.macrosoft.com/pricing", "admin.lookout365.macrosoft.com/", "mail.lookout365.macrosoft.com/"].map((u) => (resolve(s, u).page as { id: string }).id))
      .toEqual(["lookout", "lookout-admin", "lookout-owa"]);
  });

  it("signs up and shows the TXT record to verify on the Domains page", () => {
    const s = fresh(2, "2012-05");
    show(s, "lookout365.macrosoft.com/signup?plan=standard");
    type("password", "admin-pw");
    fireEvent.submit(document.querySelector("form")!);
    const g = useStore.getState().game;
    expect(lookout(g).plan).toBe("standard");
    expect(screen.getByText(lookoutToken(g.seed, g.company.domain!))).toBeTruthy();
    expect(screen.getByText(t("lookout.admin.brand.early"))).toBeTruthy();
  });

  it("explains held mail for a full mailbox in Message trace", () => {
    const s = fresh(3, "2018-02");
    signUpLookout(s, { domain: s.company.domain!, plan: "business", local: "admin", title: "Admin", password: "admin-pw" });
    setCompanyRecord(s, { type: "TXT", name: "@", ttl: 300, data: lookoutToken(s.seed, s.company.domain!) });
    setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data: "0 mail.protection.lookout365.com" });
    s.hour += 2;
    verifyLookout(s, lookout(s).id);
    const admin = s.mail.accounts.find((a) => a.id === lookout(s).admin)!;
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === admin.id ? { ...a, usedKb: capsOf(s, a).quotaMb * 1024 } : a)) };
    deliver(s, { to: `admin@${s.company.domain}`, from: "n:Supplier", kind: "notice", topic: "x" });
    writeSession(LOOKOUT_SESSION, admin.id);
    show(s, "admin.lookout365.macrosoft.com/trace");
    expect(screen.getByText(t("lookout.admin.brand.late"))).toBeTruthy();
    type("recipient", `admin@${s.company.domain}`);
    fireEvent.submit(document.querySelector("form")!);
    expect(screen.getByText(t("lookout.trace.why.full"))).toBeTruthy();
  });

  it("offers the light version of Lookout Web App as a free choice", () => {
    show(fresh(4, "2012-01"), `${LOOKOUT_OWA}/`);
    expect(document.querySelector("[data-premium]")).toBeNull();
    expect((document.querySelector('input[name="light"]') as HTMLInputElement).disabled).toBe(false);
  });
});
