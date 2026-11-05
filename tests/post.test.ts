import { describe, expect, it } from "vitest";
import { archive, atDesk, boxAt, FORWARD_HOURS, inbox, inLetterbox, post, postLocation } from "../src/sim/40-support/letters";
import { listingById } from "../src/sim/20-world/properties";
import { freeSections, rentSection } from "../src/sim/90-actions/properties";
import { OFFICE_NAME, REGISTER_NAME } from "../src/sim/80-business/paperwork";
import { tick } from "../src/sim/88-tick/tick";
import { readLetter } from "../src/sim/90-actions/paperwork";
import { fetchPost, scanLetter } from "../src/sim/90-actions/post";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { stepOf } from "../src/ui/apps/guide";
import { newGame } from "./fixtures";

const run = (s: ReturnType<typeof newGame>, days: number) => { for (let i = 0; i < days * 24; i++) tick(s); };

function withPost() {
  const s = newGame(11);
  s.letters = [];
  post(s, REGISTER_NAME, "registerInvoice", { name: "Kellerhost" }, 1, { bill: { supplier: "register", lines: [{ hour: s.hour, category: "fees", key: "ledger.registerEntry", params: {}, amount: -150 }], days: 14 } });
  post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4711" }, 1);
  run(s, 4);
  return s;
}

describe("post in the letterbox", () => {
  it("points the pay-a-bill step at the letterbox while the letter waits there", () => {
    const s = withPost();
    expect(stepOf(s, "payBill").focus).toEqual({ kind: "letterbox", id: "loc1" });
  });

  it("lands new letters in the basement letterbox, unreadable until fetched", () => {
    const s = withPost();
    expect(inLetterbox(s)).toHaveLength(2);
    expect(inLetterbox(s).every((l) => l.box === "loc1")).toBe(true);
    expect(atDesk(s)).toEqual([]);
    expect(readLetter(s, inbox(s)[0].id)).toEqual({ ok: false, error: "error.inLetterbox" });
    expect(scanLetter(s, inbox(s)[0].id)).toEqual({ ok: false, error: "error.inLetterbox" });
    // The bill is booked on arrival, so its deadline runs while it waits.
    expect(s.payables.some((p) => p.id === inbox(s)[0].payable)).toBe(true);
  });

  it("fetches only with the player in the basement, and takes every letter", () => {
    const s = withPost();
    s.player = { at: "loc1", until: s.hour + 3, doing: "travel", by: "drive" };
    expect(fetchPost(s)).toEqual({ ok: false, error: "error.notThere" });
    s.player = { at: "loc1", until: 0, doing: "work", by: "drive" };
    expect(fetchPost(s)).toEqual({ ok: true });
    expect(inLetterbox(s)).toEqual([]);
    expect(atDesk(s)).toHaveLength(2);
    expect(readLetter(s, inbox(s)[0].id)).toEqual({ ok: true });
    expect(fetchPost(s)).toEqual({ ok: false, error: "error.letterboxEmpty" });
  });

  it("moves the post to the office letterbox from the move day, the basement keeping what it holds", () => {
    const s = withPost();
    s.cash = 1_000_000;
    expect(rentSection(s, "gallushof", freeSections(s, listingById("gallushof")!)[0]).ok).toBe(true);
    const office = s.properties.at(-1)!.locationId!;
    expect(postLocation(s)).toBe(office);
    post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4712" }, 1);
    run(s, 4);
    expect(boxAt(s, office)).toHaveLength(1);
    expect(boxAt(s, "loc1")).toHaveLength(2);
    s.player = { at: office, until: 0, doing: "work", by: "drive" };
    expect(fetchPost(s)).toEqual({ ok: true });
    expect(boxAt(s, "loc1")).toHaveLength(2);
    s.player = { at: "loc1", until: 0, doing: "work", by: "drive" };
    expect(fetchPost(s)).toEqual({ ok: true });
    expect(inLetterbox(s)).toEqual([]);
    expect(fetchPost(s)).toEqual({ ok: false, error: "error.notThere" });
  });

  it("delivers letters addressed before the move to the basement for a month", () => {
    const s = withPost();
    s.cash = 1_000_000;
    const before = post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4713" }, 2);
    const late = post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4714" }, 2);
    expect(rentSection(s, "gallushof", freeSections(s, listingById("gallushof")!)[0]).ok).toBe(true);
    const office = s.properties.at(-1)!.locationId!;
    const after = post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4715" }, 2);
    expect([before.addressedTo, after.addressedTo]).toEqual(["loc1", office]);
    late.at = s.hour + FORWARD_HOURS + 24;
    run(s, 5);
    expect(s.letters.find((l) => l.id === before.id)!.box).toBe("loc1");
    expect(s.letters.find((l) => l.id === after.id)!.box).toBe(office);
    run(s, 30);
    expect(s.letters.find((l) => l.id === late.id)!.box).toBe(office);
  });

  it("scans a desk letter into DocuWhere once", () => {
    const s = withPost();
    fetchPost(s);
    const l = inbox(s)[1];
    expect(archive(s, "")).toEqual([]);
    expect(scanLetter(s, l.id)).toEqual({ ok: true });
    expect(archive(s, "").map((x) => x.id)).toEqual([l.id]);
    expect(scanLetter(s, l.id)).toEqual({ ok: false, error: "error.letterScanned" });
    expect(archive(s, "")).toHaveLength(1);
  });

  it("loads an old save with its letters at the desk and filed", () => {
    const s = withPost();
    const raw = JSON.parse(serialize(s));
    for (const x of raw.letters) { delete x.box; delete x.scanned; delete x.addressedTo; }
    const back = deserialize(JSON.stringify(raw));
    expect(inLetterbox(back)).toEqual([]);
    expect(atDesk(back)).toHaveLength(2);
    expect(archive(back, "")).toHaveLength(2);
    expect(back.letters.every((l) => l.addressedTo === null)).toBe(true);
  });
});
