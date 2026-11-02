// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOfMonth } from "../src/sim/00-core/time";
import { goggleToken, verificationAt } from "../src/sim/10-catalog/mail-consumer";
import { mxSetAt } from "../src/sim/10-catalog/mail-providers";
import { mxTarget } from "../src/sim/42-mail/caps";
import type { GameState } from "../src/sim/50-state";
import { mxHostsAt } from "../src/sim/60-infra/company-zone";
import { defaultBookmarks, resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { setCompanyRecord } from "../src/sim/90-actions/domains";
import { connectGoggleDns, signUpGoggle } from "../src/sim/90-actions/mail-provider";
import { GoggleSite, goggleTitle } from "../src/ui/apps/browser/sites/mail/goggle/GoggleSite";
import { writeSession } from "../src/ui/session";
import { useStore } from "../src/ui/store";
import { err, idOf } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);
const tenant = (s: GameState) => s.mail.tenants.find((x) => x.host === "goggle")!;

function show(s: GameState, url: string) {
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const [u, setU] = useState(url), r = resolve(g, u);
    return r.page.kind === "mailProvider" ? <GoggleSite key={u} game={g} host={r.host} path={r.path} go={setU} /> : <p>{r.page.kind}</p>;
  };
  return render(<View />);
}
const type = (name: string, value: string) => fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value } });
const click = (key: string) => fireEvent.click(screen.getByText(t(key)));

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("Goggle site", () => {
  it("answers on goggle.com and accounts.goggle.com and sits in the index", () => {
    const s = readyGame(1);
    expect(resolve(s, "www.goggle.com/pricing").page).toEqual({ kind: "mailProvider", id: "goggle" });
    expect(resolve(s, "accounts.goggle.com/recovery").page).toEqual({ kind: "mailProvider", id: "goggle" });
    const row = siteIndex(s).find((c) => c.title === t("sim.index.cat.mailProviders"))!.rows.find((r) => r.title === "Goggle")!;
    expect(resolve(s, row.url).page).toEqual({ kind: "mailProvider", id: "goggle" });
    expect(defaultBookmarks(s).some((b) => b.url.includes("goggle"))).toBe(false);
  });

  it("names the product and sells the editions of its year", () => {
    const cases = [
      ["2006-10", "mail.goggle.brand.appsDomain", ["standard"]],
      ["2008-06", "mail.goggle.brand.apps", ["standard", "premier"]],
      ["2017-06", "mail.goggle.brand.swoot", ["basic"]],
      ["2021-06", "mail.goggle.brand.workspace", ["starter"]],
    ] as const;
    for (const [ym, brand, editions] of cases) {
      const s = readyGame(2);
      s.hour = at(ym);
      expect(goggleTitle(s, "www.goggle.com")).toBe(t(brand));
      const { container } = show(s, "www.goggle.com/pricing");
      expect([...container.querySelectorAll(".gg-editions thead th[data-plan]")].map((x) => x.textContent)).toEqual(editions.map((e) => t(`mail.goggle.edition.${e}`)));
      cleanup();
    }
    const s = readyGame(2);
    s.hour = at("2005-06");
    const { container } = show(s, "www.goggle.com/");
    expect(container.querySelector(".gg-search")).not.toBeNull();
  });

  it("refuses a domain that is not the company's and signs the admin in after the wizard", () => {
    const s = readyGame(3);
    s.hour = at("2009-03");
    show(s, "www.goggle.com/signup");
    type("domain", "someone-else.com");
    click("goggle.signup.next");
    expect(screen.getByRole("alert").textContent).toBe(t("error.needsDomain"));
    type("domain", s.company.domain!);
    click("goggle.signup.next");
    type("first", "Ada");
    type("password", "admin-pw");
    type("repeat", "admin-pw");
    click("goggle.signup.next");
    click("goggle.signup.next");
    expect(screen.getByText(t("mail.goggle.edition.standard"), { selector: "dd" })).toBeTruthy();
    click("goggle.signup.accept");
    const g = useStore.getState().game, tn = tenant(g);
    expect(g.mail.accounts.find((a) => a.id === tn.admin)!.local).toBe("admin");
    expect(screen.getByText(t("goggle.setup.unverified"))).toBeTruthy();
  });

  it("verifies only once the record has propagated", () => {
    const s = readyGame(4);
    s.hour = at("2013-03");
    const admin = idOf(signUpGoggle(s, { domain: s.company.domain!, plan: "paid", local: "admin", title: "Admin", password: "admin-pw" }));
    writeSession("goggle.account", admin);
    show(s, "www.goggle.com/setup?step=verify");
    click("goggle.setup.verify");
    expect(tenant(useStore.getState().game).verified).toBe(false);
    const g = useStore.getState().game, want = verificationAt(tenant(g).since, goggleToken(g.seed, tenant(g).domain));
    expect(want.type).toBe("TXT");
    expect(err(setCompanyRecord(g, { type: want.type, name: want.name, ttl: 3600, data: want.data }))).toBe("ok");
    click("goggle.setup.verify");
    expect(tenant(useStore.getState().game).verified).toBe(false);
    cleanup();
    const later = { ...useStore.getState().game, hour: useStore.getState().game.hour + 2 };
    show(later, "www.goggle.com/setup?step=verify");
    click("goggle.setup.verify");
    expect(tenant(useStore.getState().game).verified).toBe(true);
    expect(screen.getByText(t("goggle.setup.verified"))).toBeTruthy();
  });

  it("shows the CNAME before 2012 and connects the records through GoDuddy from 2019", () => {
    const s = readyGame(5);
    s.hour = at("2008-03");
    expect(verificationAt(s.hour, "x").type).toBe("CNAME");
    s.hour = at("2019-06");
    signUpGoggle(s, { domain: s.company.domain!, plan: "paid", local: "admin", title: "Admin", password: "admin-pw" });
    const tn = tenant(s);
    expect(s.registrar?.id).toBe("nameCheep");
    expect(err(connectGoggleDns(s, tn.id))).toBe("error.mailNoService");
    s.registrar = { ...s.registrar!, id: "goDuddy" };
    expect(err(connectGoggleDns(s, tn.id))).toBe("ok");
    s.hour += 2;
    expect(mxHostsAt(s, s.hour)).toEqual(mxSetAt("goggle", tn.domain, s.hour).map(([, h]) => h));
    expect(mxTarget(s)?.id).toBe(tn.id);
  });
});
