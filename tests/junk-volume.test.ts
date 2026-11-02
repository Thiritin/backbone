import { describe, expect, it } from "vitest";
import { deliver } from "../src/sim/42-mail/deliver";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { startGame } from "./fixtures";

const count = (s: GameState, spam: boolean, folder: string) =>
  (s.mail.msgs[s.mail.primary] ?? []).filter((m) => (m.kind === "spam") === spam && m.folder === folder).length;

const run = (s: GameState, days: number, legitPerDay = 0) => {
  const a = s.mail.accounts.find((x) => x.id === s.mail.primary)!;
  for (let h = 0; h < days * 24; h++) {
    if (h % 24 === 12) for (let i = 0; i < legitPerDay; i++) deliver(s, { to: `${a.local}@${a.domain}`, from: "ext:friend@yahoy.com", kind: "reply", own: { subject: "Hi", text: "Hi" } });
    tick(s);
  }
};

describe("junk reaching the Inbox", () => {
  it("lets a few spam mails a week into a quiet FreeMix box in 2005 and catches the rest", () => {
    for (const seed of [1, 7, 42]) {
      const s = startGame(seed);
      run(s, 56);
      expect(count(s, true, "inbox")).toBeGreaterThan(4);
      expect(count(s, true, "inbox")).toBeLessThanOrEqual(8 * 3);
      expect(s.mail.accounts.find((x) => x.id === s.mail.primary)!.junkCaught).toBeGreaterThan(100);
    }
  });

  it("never lets more spam into the Inbox than the box gets real mail", () => {
    const s = startGame(3);
    run(s, 42, 2);
    expect(count(s, true, "inbox")).toBeLessThan(count(s, false, "inbox"));
  });
});
