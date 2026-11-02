import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder } from "../src/sim/42-mail/model";
import { startMail } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { parseSieve, sieveScript } from "../src/sim/80-business/sieve";
import { saveFilter } from "../src/sim/90-actions/mailbox";
import { createMailFolder, saveSieveScript, setVacation } from "../src/sim/90-actions/mailmsg";
import { err, idOf, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

// Postfixit with the Dovecoat of 2010, which speaks Sieve, and the mailbox sales@.
function sieveBox(seed = 5) {
  const s = readyGame(seed), mail = selfHosted(s);
  s.clusters = s.clusters.map((c) => (c.id === mail ? { ...c, version: 2010 } : c));
  s.mail = startMail({ id: "tn9", host: "self", domain: s.company.domain!, plan: "self", since: s.hour, verified: true, endsAt: null, clusterId: mail, admin: null }, "sales", "Sales", "hunter22", "Postfixit", s.hour);
  s.hour = Math.max(s.hour, hourOfMonth("2011-03"));
  const acc = s.mail.accounts.find((a) => a.local === "sales")!.id;
  return { s, acc, address: `sales@${s.company.domain}` };
}
const strip = (s: GameState, acc: string) => s.mail.filters.filter((f) => f.accountId === acc).map(({ id: _id, accountId: _a, ...f }) => f);
const mailFrom = (s: GameState, to: string, from: string, subject: string) => deliver(s, { to, from: `ext:${from}`, kind: "reply", topic: "", own: { subject, text: "hi" } });

describe("Sieve script", () => {
  it("round-trips every filter through the raw script", () => {
    const { s, acc } = sieveBox();
    const parent = idOf(createMailFolder(s, acc, "Work")), child = idOf(createMailFolder(s, acc, "Clients", parent));
    const rules = [
      { name: "Clients", on: true, match: "all" as const, conds: [{ field: "from" as const, op: "ends" as const, value: "@client.example" }, { field: "subject" as const, op: "starts" as const, value: "[Ticket]" }], acts: [{ do: "move" as const, folder: child }, { do: "stop" as const }] },
      { name: "Big \"files\"", on: false, match: "any" as const, conds: [{ field: "size" as const, op: "over" as const, value: 500 }, { field: "to" as const, op: "is" as const, value: "big@x.example" }], acts: [{ do: "trash" as const }] },
      { name: "Flags", on: true, match: "all" as const, conds: [{ field: "subject" as const, op: "contains" as const, value: "urgent" }], acts: [{ do: "read" as const }, { do: "star" as const }, { do: "forward" as const, to: "boss@x.example" }, { do: "junk" as const }] },
    ];
    for (const r of rules) expect(err(saveFilter(s, acc, r))).toBe("ok");
    const script = sieveScript(s, acc);
    expect(script).toContain('require ["fileinto","imap4flags"];');
    expect(script).toContain('fileinto "Work/Clients";');
    expect(script).toContain("if false # anyof (size :over 500K");
    expect(err(saveSieveScript(s, acc, script))).toBe("ok");
    expect(strip(s, acc)).toEqual(rules);
    expect(sieveScript(s, acc)).toBe(script);
  });

  it("fails a script outside the grammar with the line number and keeps the filters", () => {
    const { s, acc } = sieveBox();
    expect(err(saveFilter(s, acc, { name: "a", on: true, match: "all", conds: [{ field: "subject", op: "contains", value: "x" }], acts: [{ do: "stop" }] }))).toBe("ok");
    const before = strip(s, acc);
    const cases: [string, string, Record<string, string>][] = [
      ['require ["fileinto"];\nif header :contains "subject" "x"\n{\n\tdiscard;\n}\n', "mailserver.sieve.unknownCommand", { name: "discard", line: "4" }],
      ['if header :contains "subject" "x" {\n  fileinto "INBOX";\n}', "mailserver.sieve.unknownCommand", { name: "fileinto", line: "2" }],
      ['require ["fileinto", "nonsense"];', "mailserver.sieve.capability", { name: "nonsense", line: "1" }],
      ['require "fileinto"\nif true { stop; }', "mailserver.sieve.syntax", { line: "2" }],
      ['require "fileinto";\n\nif header :contains "subject" "x" { fileinto "Nowhere"; }', "mailserver.sieve.mailbox", { name: "Nowhere", line: "3" }],
    ];
    for (const [text, key, params] of cases) {
      const r = saveSieveScript(s, acc, text);
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error).toBe(key); expect(r.params).toMatchObject(params); }
    }
    expect(strip(s, acc)).toEqual(before);
  });

  it("holds the 20 filter limit", () => {
    const { s, acc } = sieveBox();
    const rule = (i: number) => `if header :contains "subject" "n${i}" { stop; }`;
    expect(err(saveSieveScript(s, acc, Array.from({ length: 20 }, (_, i) => rule(i)).join("\n")))).toBe("ok");
    expect(err(saveSieveScript(s, acc, Array.from({ length: 21 }, (_, i) => rule(i)).join("\n")))).toBe("error.mailFilterMax");
    expect(strip(s, acc)).toHaveLength(20);
  });

  it("round-trips a vacation through setVacation", () => {
    const { s, acc } = sieveBox();
    const until = hourOfMonth("2011-05");
    expect(err(setVacation(s, acc, { on: true, subject: "Away", text: "Back in May.\nRegards", until }))).toBe("ok");
    const script = sieveScript(s, acc);
    expect(script).toContain('currentdate :value "le" "date" "2011-04-30"');
    expect(err(saveSieveScript(s, acc, script.replace('"Away"', '"Gone fishing"').replace("if currentdate", "if false # currentdate")))).toBe("ok");
    expect(s.mail.accounts.find((a) => a.id === acc)!.vacation).toEqual({ on: false, subject: "Gone fishing", text: "Back in May.\nRegards", until });
    expect(err(saveSieveScript(s, acc, ""))).toBe("ok");
    expect(s.mail.accounts.find((a) => a.id === acc)!.vacation).toBeNull();
    expect(parseSieve('require "vacation";\nvacation :subject "a" "b";\nvacation "c";', () => null)).toMatchObject({ ok: false, error: { key: "duplicateVacation", line: 3 } });
  });

  it("sends the out-of-office reply only while it is on", () => {
    const { s, acc, address } = sieveBox();
    const replies = () => listFolder(s, acc, "sent").filter((m) => m.auto).length;
    expect(err(saveSieveScript(s, acc, 'require "vacation";\nif false # true\n{\n\tvacation :subject "Away" "Out";\n}\n'))).toBe("ok");
    mailFrom(s, address, "a@example.com", "One");
    expect(replies()).toBe(0);
    expect(err(saveSieveScript(s, acc, 'require "vacation";\nvacation :subject "Away" "Out";\n'))).toBe("ok");
    mailFrom(s, address, "b@example.com", "Two");
    expect(replies()).toBeGreaterThan(0);
  });
});
