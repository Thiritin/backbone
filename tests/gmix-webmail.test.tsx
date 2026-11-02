// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOfMonth } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder, view } from "../src/sim/42-mail/model";
import { GMIX_DOMAIN } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { resolve, VIDEO_URL } from "../src/sim/80-business/browser";
import { gmixAd } from "../src/sim/80-business/mail-provider";
import { setGmixTier } from "../src/sim/90-actions/mail-provider";
import { gmixTitle } from "../src/ui/apps/browser/sites/mail/gmix/GmixMail";
import { GmixSite } from "../src/ui/apps/browser/sites/mail/gmix/GmixSite";
import { writeSession } from "../src/ui/session";
import { useStore } from "../src/ui/store";
import { FREEMAIL_DOMAINS } from "../src/sim/30-customers/addresses";
import { startGame } from "./fixtures";

const FRIEND = `friend@${FREEMAIL_DOMAINS[0]}`;

const start = (s: GameState) => s.mail.accounts.find((a) => a.id === s.mail.primary)!;
const address = (s: GameState) => `${start(s).local}@${GMIX_DOMAIN}`;
const game = () => useStore.getState().game;

let went: string[] = [];
function show(s: GameState, path: string, signedIn = true) {
  if (signedIn) writeSession("gmix.account", start(s).id);
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const [url, setUrl] = useState(`www.gmix.net${path}`), r = resolve(g, url);
    const go = (u: string) => { went.push(u); setUrl(u); };
    return r.page.kind === "mailProvider" ? <GmixSite key={url} game={g} path={r.path} go={go} /> : <p>{r.page.kind}</p>;
  };
  return render(<View />);
}
const note = (s: GameState, subject: string) => deliver(s, { to: address(s), from: `ext:${FRIEND}`, kind: "reply", own: { subject, text: "Hi there" } }).id!;
const type = (name: string, value: string) => fireEvent.change(document.querySelector(`[name="${name}"]`)!, { target: { value } });
const row = (id: string) => document.querySelector(`[data-id="${id}"]`)!;

beforeEach(() => { sessionStorage.clear(); went = []; });
afterEach(cleanup);

describe("GMix webmail", () => {
  it("opens the inbox after login and counts unread mail in the tab title", () => {
    const s = startGame(31);
    s.hour = hourOfMonth("2006-03");
    show(s, "/", false);
    type("address", address(s));
    type("password", start(s).password);
    fireEvent.click(screen.getByText(t("gmix.login.submit")));
    expect(went.at(-1)).toBe("www.gmix.net/mail/inbox");
    expect(document.querySelector(".gxm-list")).not.toBeNull();
    const n = listFolder(game(), start(s).id, "inbox").filter((m) => !m.read).length;
    expect(gmixTitle(game(), start(s).id)).toBe(n ? `GMix (${n})` : "GMix");
  });

  it("reads, deletes to Trash and empties Trash after a confirm", () => {
    const s = startGame(32), id = note(s, "Lunch");
    show(s, "/mail/inbox");
    expect(row(id).className).toBe("gxm-unread");
    fireEvent.click(screen.getByText("Lunch"));
    expect(screen.getByText("Hi there")).toBeTruthy();
    expect(listFolder(game(), start(s).id, "inbox").find((m) => m.id === id)!.read).toBe(true);
    fireEvent.click(screen.getAllByText(t("gmix.mail.delete"))[0]);
    expect(listFolder(game(), start(s).id, "trash").map((m) => m.id)).toContain(id);
    cleanup();
    show(game(), "/mail/trash");
    fireEvent.click(screen.getByText(t("gmix.mail.empty.trash")));
    expect(listFolder(game(), start(s).id, "trash")).toHaveLength(1);
    fireEvent.click(screen.getByText(t("gmix.mail.yes")));
    expect(listFolder(game(), start(s).id, "trash")).toHaveLength(0);
  });

  it("draws the list as a table in 2005, cards with a preview in 2012 and a single column with hover actions in 2019", () => {
    for (const [ym, list] of [["2005-06", ".gxm-list"], ["2012-06", ".gxm-cards-navigator small"], ["2019-06", ".gxm-cards-flat .gxm-hover"]] as const) {
      const s = startGame(33);
      s.hour = hourOfMonth(ym);
      note(s, "Look");
      show(s, "/mail/inbox");
      expect(document.querySelector(list)).not.toBeNull();
      expect(!!document.querySelector(".gxm-sky")).toBe(ym === "2005-06");
      cleanup();
    }
  });

  it("replies with a Sent copy and a quoted subject", () => {
    const s = startGame(34), id = note(s, "Question");
    show(s, `/mail/compose?re=${id}&mode=reply`);
    expect((document.querySelector('[name="to"]') as HTMLInputElement).value).toBe(FRIEND);
    expect((document.querySelector('[name="subject"]') as HTMLInputElement).value).toBe(t("gmix.mail.reSubject", { subject: "Question" }));
    fireEvent.click(screen.getByText(t("gmix.mail.send")));
    expect(screen.getByText(t("gmix.mail.sent"))).toBeTruthy();
    const sent = listFolder(game(), start(s).id, "sent").at(-1)!;
    expect(view(game(), sent).subject).toBe(t("gmix.mail.reSubject", { subject: "Question" }));
    expect(listFolder(game(), start(s).id, "inbox").find((m) => m.id === id)!.ans).toBe(true);
  });

  it("creates a nested folder and moves mail into it", () => {
    const s = startGame(35), id = note(s, "Invoice");
    show(s, "/mail/settings/folders");
    type("folderName", "Work");
    fireEvent.click(screen.getByText(t("gmix.mail.createFolder")));
    const work = game().mail.folders.find((f) => f.name === "Work")!;
    type("folderName", "2006");
    type("parent", work.id);
    fireEvent.click(screen.getByText(t("gmix.mail.createFolder")));
    expect(game().mail.folders.find((f) => f.name === "2006")!.parent).toBe(work.id);
    cleanup();
    show(game(), "/mail/inbox");
    fireEvent.click(row(id).querySelector("input")!);
    fireEvent.change(screen.getByLabelText(t("gmix.mail.moveTo")), { target: { value: work.id } });
    expect(listFolder(game(), start(s).id, work.id).map((m) => m.id)).toEqual([id]);
  });

  it("shows IMAP as a ProMix feature on FreeMix before 2012 and switches external access", () => {
    const s = startGame(36);
    s.hour = hourOfMonth("2009-01");
    show(s, "/mail/settings/access");
    expect(screen.getByText(t("gmix.mail.proFeature"))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t("gmix.mail.external")));
    expect(game().mail.accounts.find((a) => a.id === start(s).id)!.external).toBe(true);
  });

  it("locks forwarding on FreeMix and saves spam settings", () => {
    const s = startGame(37);
    show(s, "/mail/settings/forward");
    expect(screen.getByText(t("gmix.mail.locked", { plan: t("mail.gmix.plan.pro") }))).toBeTruthy();
    cleanup();
    show(game(), "/mail/settings/spam");
    fireEvent.click(screen.getByLabelText(t("gmix.mail.level.strict")));
    type("block", "pest@yahoy.com");
    fireEvent.click(screen.getByText(t("gmix.account.save")));
    expect(game().mail.accounts.find((a) => a.id === start(s).id)!.prefs).toMatchObject({ spam: "strict", block: "pest@yahoy.com" });
  });

  it("shows ads and the storage banner on FreeMix only, and the prize ad opens the video", () => {
    const s = startGame(38), a = start(s);
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a.id ? { ...x, usedKb: 0.95 * 1024 * 1024 } : x)) };
    while (gmixAd(s.hour, a.id, 0) !== 0) s.hour++;
    show(s, "/mail/inbox");
    expect(screen.getByRole("status").textContent).toContain(t("gmix.mail.nearlyFull", { pct: 95 }));
    fireEvent.click(document.querySelector(".gxm-banner")!);
    expect(went.at(-1)).toBe(VIDEO_URL);
    cleanup();
    setGmixTier(s, a.tenant, "pro");
    show(s, "/mail/inbox");
    expect(document.querySelector(".gxm-ad")).toBeNull();
  });
});
