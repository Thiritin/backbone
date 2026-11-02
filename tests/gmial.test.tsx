// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { gmialUrl } from "../src/sim/10-catalog/mail-consumer";
import { boxOf } from "../src/sim/42-mail/model";
import type { GameState } from "../src/sim/50-state";
import { defaultBookmarks, resolve } from "../src/sim/80-business/browser";
import { createMailFolder } from "../src/sim/90-actions/mailmsg";
import { Gmial, gmialTitle } from "../src/ui/apps/browser/sites/mail/gmial/Gmial";
import { GOGGLE_SESSION } from "../src/ui/apps/browser/sites/mail/goggle/GoggleSite";
import { writeSession } from "../src/ui/session";
import { useStore } from "../src/ui/store";
import { idOf } from "./company-mail.helpers";
import { FRIEND, goggleBox, mail } from "./gmial.helpers";

const game = () => useStore.getState().game;
let went: string[] = [];
function show(s: GameState, a: string | null, page = "") {
  if (a) writeSession(GOGGLE_SESSION, a);
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const [url, setUrl] = useState(gmialUrl(s.company.domain!, page)), r = resolve(g, url);
    const go = (u: string) => { went.push(u); setUrl(u); };
    return r.page.kind === "mailProvider" && r.page.id === "gmial" ? <Gmial key={url} game={g} path={r.path} go={go} /> : <p>{r.page.kind}</p>;
  };
  return render(<View />);
}
const row = (thread: string) => document.querySelector(`[data-id="${thread}"]`)!;
const msg = (a: string, id: string) => boxOf(game(), a).find((m) => m.id === id)!;

beforeEach(() => { sessionStorage.clear(); went = []; });
afterEach(cleanup);

describe("Gmial", () => {
  it("is the webmail bookmark of a Goggle tenant and asks for the Goggle sign-in", () => {
    const { s, a } = goggleBox(61);
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a ? { ...x, roles: ["owner", "sales", "support", "abuse"] } : x)) };
    expect(defaultBookmarks(s).find((b) => b.title === t("sim.index.webmail"))?.url).toBe(gmialUrl(s.company.domain!));
    show(s, null);
    fireEvent.change(document.querySelector('[name="address"]')!, { target: { value: `admin@${s.company.domain}` } });
    fireEvent.change(document.querySelector('[name="password"]')!, { target: { value: "admin-pw" } });
    fireEvent.click(screen.getByRole("button", { name: t("goggle.signin.submit") }));
    expect(screen.getByRole("heading", { name: t("gmial.view.inbox") })).toBeTruthy();
  });

  it("groups a conversation into one row, archives it and finds it again by search", () => {
    const { s, a, address } = goggleBox(62, "2008-05");
    const first = mail(s, address, "Rack quote");
    mail(s, address, "Re: Rack quote", { thread: first, re: first });
    show(s, a);
    expect(document.querySelectorAll(".gml-list tr")).toHaveLength(2);
    expect(row(first).textContent).toContain("(2)");
    expect(gmialTitle(game(), a)).toContain("(2)");
    expect(document.querySelector(".gml-logo sup")?.textContent).toBe("BETA");
    fireEvent.click(row(first).querySelector('input[type="checkbox"]')!);
    fireEvent.click(screen.getByRole("button", { name: t("gmial.tool.archive") }));
    expect(msg(a, first).folder).toBe("archive");
    expect(document.querySelector(`[data-id="${first}"]`)).toBeNull();
    fireEvent.change(document.querySelector('[name="q"]')!, { target: { value: "from:ada rack" } });
    fireEvent.submit(document.querySelector(".gml-search")!);
    expect(went.at(-1)).toContain("search/");
    expect(row(first)).toBeTruthy();
  });

  it("creates a filter from a message that labels and archives what follows", () => {
    const { s, a, address } = goggleBox(63);
    const id = mail(s, address, "Weekly report"), l = idOf(createMailFolder(s, a, "Ada"));
    show(s, a, `inbox/${id}`);
    expect(msg(a, id).read).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: t("gmial.tool.filterLike") }));
    expect((document.querySelector('[name="f-from"]') as HTMLInputElement).value).toBe(FRIEND);
    fireEvent.click(screen.getByRole("button", { name: t("gmial.filter.next") }));
    fireEvent.click(document.querySelector('[name="skip"]')!);
    fireEvent.change(document.querySelector('[name="label"]')!, { target: { value: l } });
    fireEvent.click(document.querySelector('[name="also"]')!);
    fireEvent.click(screen.getByRole("button", { name: t("gmial.filter.create") }));
    expect(game().mail.filters.filter((f) => f.accountId === a)).toHaveLength(1);
    expect(msg(a, id)).toMatchObject({ folder: "archive", labels: [l] });
    const next = mail(game(), address, "Weekly report 2");
    expect(msg(a, next)).toMatchObject({ folder: "archive", labels: [l] });
  });

  it("warns about the 30 day purge in Trash and shows Sponsored Links on the free edition", () => {
    const { s, a, address } = goggleBox(64, "2009-03", "free");
    const id = mail(s, address, "Your licence key");
    show(s, a, `inbox/${id}`);
    expect(document.querySelector(".gml-ads")?.getAttribute("data-ad")).toBe("0");
    cleanup();
    show(s, a, "trash");
    expect(screen.getByText(t("gmial.purge.trash"), { exact: false })).toBeTruthy();
  });
});
