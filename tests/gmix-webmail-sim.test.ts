import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOfMonth } from "../src/sim/00-core/time";
import { serverStatus } from "../src/sim/42-mail/accounts";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder, view } from "../src/sim/42-mail/model";
import type { GameState } from "../src/sim/50-state";
import { GMIX_ADS, gmixAd } from "../src/sim/80-business/mail-provider";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { setGmixTier, signUpGmix } from "../src/sim/90-actions/mail-provider";
import { changePassword, deleteFetchRule, runFetchRule, saveFetchRule, setAccountPrefs, setExternalAccess } from "../src/sim/90-actions/mailbox";
import { deleteMessages, emptyFolder, sendMessage } from "../src/sim/90-actions/mailmsg";
import { err, idOf, run } from "./company-mail.helpers";
import { startGame } from "./fixtures";

const primary = (s: GameState) => s.mail.accounts.find((a) => a.id === s.mail.primary)!;
const addr = (s: GameState, id: string) => { const a = s.mail.accounts.find((x) => x.id === id)!; return `${a.local}@${a.domain}`; };
const second = (s: GameState, local = "second") => idOf(signUpGmix(s, { local, title: "Second", password: "secret-2", plan: "free" }));
const note = (s: GameState, to: string, subject = "Hello") => deliver(s, { to, from: "ext:friend@yahoy.com", kind: "reply", own: { subject, text: "Hi" } });

describe("GMix webmail rules", () => {
  it("deletes to Trash, and Empty Trash removes the message for good", () => {
    const s = startGame(11), a = primary(s), id = note(s, addr(s, a.id)).id!;
    expect(deleteMessages(s, a.id, [id]).ok).toBe(true);
    expect(listFolder(s, a.id, "trash").map((m) => m.id)).toContain(id);
    expect(emptyFolder(s, a.id, "trash").ok).toBe(true);
    expect((s.mail.msgs[a.id] ?? []).some((m) => m.id === id)).toBe(false);
  });

  it("refuses a 21 MB attachment on FreeMix before 2012 and takes it on ProMix", () => {
    const s = startGame(12), a = primary(s);
    s.hour = hourOfMonth("2010-06");
    const mail = { from: addr(s, a.id), to: ["friend@yahoy.com"], subject: "Photos", text: "", att: [{ k: "file" as const, name: "photos.zip", kb: 21 * 1024 }] };
    const r = sendMessage(s, a.id, mail);
    expect(r).toMatchObject({ ok: false, error: "error.mailAttach", params: { mb: "5" } });
    s.hour = hourOfMonth("2012-06");
    expect(err(sendMessage(s, a.id, mail))).toBe("error.mailAttach");
    expect(setGmixTier(s, a.tenant, "pro").ok).toBe(true);
    expect(err(sendMessage(s, a.id, mail))).toBe("ok");
  });

  it("refuses IMAP while external access is off, and on FreeMix before IMAP opened", () => {
    const s = startGame(13), a = primary(s);
    s.hour = hourOfMonth("2013-01");
    expect(serverStatus(s, a.id, "imap", a.password)).toBe("external");
    setExternalAccess(s, a.id, true);
    expect(serverStatus(s, a.id, "imap", a.password)).toBe("ok");
    s.hour = hourOfMonth("2009-01");
    expect(serverStatus(s, a.id, "imap", a.password)).toBe("external");
    expect(serverStatus(s, a.id, "pop", a.password)).toBe("ok");
  });

  it("Mail Collector fetches new Inbox mail once, leaves a copy, and stops when the password changes", () => {
    const s = startGame(14), a = primary(s), b = second(s);
    s.hour = hourOfMonth("2013-01");
    const src = s.mail.accounts.find((x) => x.id === b)!;
    expect(err(saveFetchRule(s, a.id, { source: b, proto: "pop", password: src.password, leave: true }))).toBe("error.mailExternal");
    setExternalAccess(s, b, true);
    expect(err(saveFetchRule(s, a.id, { source: b, proto: "pop", password: "wrong", leave: true }))).toBe("error.mailLogin");
    const rule = idOf(saveFetchRule(s, a.id, { source: b, proto: "pop", password: src.password, leave: true }));
    expect(err(saveFetchRule(s, b, { source: a.id, proto: "pop", password: a.password, leave: true }))).toBe("error.mailFetchLoop");
    note(s, addr(s, b), "Collected");
    const inbox = () => listFolder(s, a.id, "inbox").filter((m) => view(s, m).subject === "Collected").length;
    run(s, 2);
    expect(inbox()).toBe(1);
    expect(listFolder(s, b, "inbox").some((m) => view(s, m).subject === "Collected")).toBe(true);
    run(s, 3);
    expect(inbox()).toBe(1);
    changePassword(s, b, src.password, "changed-pw");
    run(s, 2);
    expect(s.mail.fetch.find((r) => r.id === rule)!.err).toBe("error.mailLogin");
    expect(err(runFetchRule(s, rule))).toBe("error.mailLogin");
    expect(deleteFetchRule(s, rule).ok).toBe(true);
  });

  it("allows one collector on FreeMix", () => {
    const s = startGame(15), a = primary(s), b = second(s, "bee"), c = second(s, "cee");
    for (const id of [b, c]) setExternalAccess(s, id, true);
    const pw = (id: string) => s.mail.accounts.find((x) => x.id === id)!.password;
    expect(err(saveFetchRule(s, a.id, { source: b, proto: "pop", password: pw(b), leave: false }))).toBe("ok");
    expect(saveFetchRule(s, a.id, { source: c, proto: "pop", password: pw(c), leave: false })).toMatchObject({ ok: false, error: "error.mailCollectors", params: { n: "1" } });
  });

  it("catches more spam on Strict than on Normal, nothing on Off, and honours blocked and allowed senders", () => {
    const caught = (level: string) => {
      const s = startGame(16), a = primary(s);
      setAccountPrefs(s, a.id, { spam: level });
      for (let i = 0; i < 400; i++) deliver(s, { to: addr(s, a.id), from: `ext:promo${i}@cheapmeds.biz`, kind: "spam", topic: "pills" });
      return listFolder(s, a.id, "junk").length;
    };
    const [off, normal, strict] = [caught("off"), caught("normal"), caught("strict")];
    expect(off).toBe(0);
    expect(strict).toBeGreaterThan(normal);
    const s = startGame(17), a = primary(s);
    setAccountPrefs(s, a.id, { block: "pest@yahoy.com", allow: "promo@cheapmeds.biz" });
    deliver(s, { to: addr(s, a.id), from: "ext:pest@yahoy.com", kind: "reply", own: { subject: "Again", text: "" } });
    expect(listFolder(s, a.id, "junk").length).toBe(1);
    for (let i = 0; i < 20; i++) deliver(s, { to: addr(s, a.id), from: "ext:promo@cheapmeds.biz", kind: "spam", topic: "pills" });
    expect(listFolder(s, a.id, "junk").length).toBe(1);
  });

  it("puts the footer on FreeMix mail only", () => {
    const s = startGame(18), a = primary(s), b = second(s, "reader");
    const sent = (subject: string) => {
      sendMessage(s, a.id, { from: addr(s, a.id), to: [addr(s, b)], subject, text: "Body" });
      return listFolder(s, b, "inbox").find((m) => view(s, m).subject === subject)!;
    };
    expect(sent("Free").foot).toBe("mail.footer.gmix");
    expect(view(s, sent("Free again")).text).toContain(t("mail.footer.gmix"));
    expect(setGmixTier(s, a.tenant, "pro").ok).toBe(true);
    expect(sent("Paid").foot).toBeUndefined();
  });

  it("rotates FreeMix ads by hour and mailbox, the same on every render", () => {
    expect(gmixAd(100, "mb1")).toBe(gmixAd(100, "mb1"));
    expect(new Set(Array.from({ length: GMIX_ADS }, (_, h) => gmixAd(h, "mb1"))).size).toBe(GMIX_ADS);
    expect(gmixAd(5, "mb1", 1)).not.toBe(gmixAd(5, "mb1", 0));
  });

  it("keeps collect rules across a save", () => {
    const s = startGame(19), a = primary(s), b = second(s);
    setExternalAccess(s, b, true);
    saveFetchRule(s, a.id, { source: b, proto: "pop", password: s.mail.accounts.find((x) => x.id === b)!.password, leave: true });
    const back = deserialize(serialize(s));
    expect(back.mail.fetch).toHaveLength(1);
    expect(back.mail.fetch[0].upTo).toBe(s.mail.fetch[0].upTo);
  });
});
