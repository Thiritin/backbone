import { describe, expect, it } from "vitest";
import { archive, DMS_APP, docType, inbox, post } from "../src/sim/40-support/letters";
import { storeItem } from "../src/sim/10-catalog/store";
import { NOTARY_NAME, OFFICE_NAME, REGISTER_NAME } from "../src/sim/80-business/paperwork";
import { tick } from "../src/sim/88-tick/tick";
import { retypeLetter } from "../src/sim/90-actions/paperwork";
import { install } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const run = (s: ReturnType<typeof newGame>, days: number) => { for (let i = 0; i < days * 24; i++) tick(s); };

// Three letters of different kinds, delivered.
function withPost() {
  const s = newGame(7);
  s.letters = [];
  post(s, REGISTER_NAME, "registerInvoice", { name: "Kellerhost" }, 1, { bill: { supplier: "register", lines: [{ hour: s.hour, category: "fees", key: "ledger.registerEntry", params: {}, amount: -150 }], days: 14 } });
  post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4711" }, 1);
  post(s, NOTARY_NAME, "mailReset", { address: "info@kellerhost.de", code: "123" }, 1);
  run(s, 4);
  return s;
}

describe("DocuWhere", () => {
  it("sells in the Pear Store and installs for its monthly price", () => {
    const s = newGame(7), cash = s.cash;
    expect(install(s, DMS_APP)).toEqual({ ok: true });
    expect(s.installed).toContain(DMS_APP);
    expect(s.cash).toBe(cash - storeItem(DMS_APP)!.monthly);
  });

  it("types every letter on arrival: a bill as invoice, the trade office as registration", () => {
    const s = withPost();
    const by = (topic: string) => docType(inbox(s).find((l) => l.topic === topic)!);
    expect(inbox(s)).toHaveLength(3);
    expect(by("registerInvoice")).toBe("invoice");
    expect(by("officeRegistered")).toBe("registration");
    expect(by("mailReset")).toBe("other");
  });

  it("files a letter under the type the player picks", () => {
    const s = withPost();
    const l = inbox(s).find((x) => x.topic === "mailReset")!;
    expect(retypeLetter(s, l.id, "contract")).toEqual({ ok: true });
    expect(docType(inbox(s).find((x) => x.id === l.id)!)).toBe("contract");
    expect(retypeLetter(s, "nope", "contract")).toEqual({ ok: false, error: "error.unknownLetter" });
    expect(retypeLetter(s, l.id, "memo" as never)).toEqual({ ok: false, error: "error.unknownDocType" });
  });

  it("searches sender, subject and text, and filters by type", () => {
    const s = withPost();
    expect(archive(s, "")).toHaveLength(3);
    expect(archive(s, NOTARY_NAME.slice(0, 6).toUpperCase()).map((l) => l.topic)).toEqual(["mailReset"]);
    expect(archive(s, "info@kellerhost.de").map((l) => l.topic)).toEqual(["mailReset"]);
    expect(archive(s, "", "invoice").map((l) => l.topic)).toEqual(["registerInvoice"]);
    expect(archive(s, "kellerhost", "official")).toEqual([]);
  });

  it("loads an old save whose letters carry no type", () => {
    const s = withPost();
    const l = inbox(s)[0];
    retypeLetter(s, l.id, "contract");
    const raw = JSON.parse(serialize(s));
    for (const x of raw.letters) delete x.type;
    const back = deserialize(JSON.stringify(raw));
    expect(back.letters.map(docType)).toEqual(["invoice", "registration", "other"]);
    expect(docType(deserialize(serialize(s)).letters[0])).toBe("contract");
  });
});
