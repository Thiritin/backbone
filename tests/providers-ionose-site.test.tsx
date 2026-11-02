// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOfMonth } from "../src/sim/00-core/time";
import { IONOSE_OWA } from "../src/sim/10-catalog/mail-hosted";
import { deliver } from "../src/sim/42-mail/deliver";
import type { GameState } from "../src/sim/50-state";
import { resolve } from "../src/sim/80-business/browser";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { cancelMail } from "../src/sim/90-actions/mail";
import { checkIonoseDomain, orderIonose } from "../src/sim/90-actions/mail-hosted";
import { IonoseSite } from "../src/ui/apps/browser/sites/mail/ionose/IonoseSite";
import { Owa } from "../src/ui/apps/browser/sites/mail/owa/Owa";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

function fresh(seed: number, ym: string): GameState {
  const s = readyGame(seed);
  s.hour = hourOfMonth(ym);
  cancelMail(s);
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  return s;
}

function show(s: GameState, url: string) {
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const [u, setU] = useState(url), r = resolve(g, u);
    if (r.page.kind !== "mailProvider") return <p>{r.page.kind}</p>;
    return r.page.id === "ionose-owa" ? <Owa key={u} game={g} provider="ionose" host={IONOSE_OWA} path={r.path} go={setU} /> : <IonoseSite key={u} game={g} path={r.path} go={setU} />;
  };
  return render(<View />);
}
const type = (name: string, value: string) => fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value } });
const submit = () => fireEvent.submit(document.querySelector("form")!);

function signedInOwa(seed: number, ym: string) {
  const s = fresh(seed, ym);
  orderIonose(s, { domain: s.company.domain!, plan: "exchange", local: "info", title: "Info", password: "owner-pw" });
  setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data: "10 mx00.ionose.de" });
  s.hour += 2;
  checkIonoseDomain(s, s.mail.tenants.find((x) => x.host === "ionose" && x.endsAt === null)!.id);
  show(s, `${IONOSE_OWA}/`);
  type("address", `info@${s.company.domain}`);
  type("password", "owner-pw");
  submit();
  return s;
}

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("Ionose site", () => {
  it("answers on ionose.com and owa.ionose.com", () => {
    const s = readyGame(1);
    expect(resolve(s, "www.ionose.com/order").page).toEqual({ kind: "mailProvider", id: "ionose" });
    expect(resolve(s, "owa.ionose.com/").page).toEqual({ kind: "mailProvider", id: "ionose-owa" });
  });

  it("orders Hosted Exchange and opens the Domain setup of the Control Panel", () => {
    const s = fresh(2, "2008-05");
    show(s, "www.ionose.com/order?plan=business");
    type("password", "owner-pw");
    type("repeat", "owner-pw");
    submit();
    const g = useStore.getState().game, tn = g.mail.tenants.find((x) => x.host === "ionose" && x.endsAt === null)!;
    expect(tn.plan).toBe("business");
    expect(screen.getByText(t("ionose.domain.unverified"))).toBeTruthy();
    expect(screen.getByText("10 mx00.ionose.de")).toBeTruthy();
  });

  it("greys Premium in 2006 and shows the unsupported page when it is clicked", () => {
    show(fresh(3, "2006-03"), `${IONOSE_OWA}/`);
    fireEvent.click(document.querySelector("[data-premium]")!);
    expect(screen.getByText(t("owa.premium.unsupported", { product: "Lookout Web Access" }))).toBeTruthy();
  });

  it("runs Basic without dragging, reading pane or rules, and Lookout Web App 2010 with all three", () => {
    const old = signedInOwa(4, "2006-06");
    deliver(old, { to: `info@${old.company.domain}`, from: "n:Supplier", kind: "notice", topic: "x" });
    useStore.setState({ game: { ...old } });
    expect(screen.getByText(/Lookout Web Access Basic/)).toBeTruthy();
    expect(document.querySelector("tr[data-id]")!.getAttribute("draggable")).toBeNull();
    expect(document.querySelector("[data-reading-pane]")).toBeNull();
    fireEvent.click(screen.getByText(t("owa.nav.options")));
    expect(screen.queryByText(t("owa.options.rules.new"))).toBeNull();
    cleanup();
    sessionStorage.clear();

    const now = signedInOwa(5, "2014-06");
    deliver(now, { to: `info@${now.company.domain}`, from: "n:Supplier", kind: "notice", topic: "x" });
    useStore.setState({ game: { ...now } });
    expect(document.querySelector("tr[data-id]")!.getAttribute("draggable")).toBe("true");
    expect(document.querySelector("[data-reading-pane]")).toBeTruthy();
    fireEvent.click(screen.getByText(t("owa.nav.options")));
    expect(screen.getByText(t("owa.options.rules.new"))).toBeTruthy();
  });
});
