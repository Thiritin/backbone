import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth, nowMinutes } from "../src/sim/00-core/time";
import { clientAccount } from "../src/sim/43-pear-mail/state";
import { PearMailApp } from "../src/ui/apps/pear-mail/PearMailApp";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

// Server rendering reads the store's initial state, so each case writes its game into it.
const RELEASES: [string, string, string][] = [["aqua", "2005-06", "2"], ["leopard", "2009-01", "3"], ["yosemite", "2015-01", "8"], ["bigsur", "2021-01", "14"], ["tahoe", "2026-01", "26"]];

describe("Pear Mail window", () => {
  it("draws the build of each release with the mailbox list and the columns", () => {
    for (const [os, month, version] of RELEASES) {
      const s = readyGame(1), a = s.mail.accounts.find((x) => x.local === "sales")!;
      s.os = os;
      s.hour = hourOfMonth(month);
      s.pearMail.accounts.push(clientAccount("cl1", { accountId: a.id, address: "sales@x", description: "Sales", fullName: "", password: a.password, protocol: "imap" }, nowMinutes(s)));
      Object.assign(useStore.getInitialState().game, s);
      const html = renderToString(<PearMailApp />);
      expect(html).toContain(`data-build="${version}"`);
      for (const label of ["Get Mail", "Mailboxes", "Sales", "From", "Subject", "Date Received", "No Message Selected"]) expect(html).toContain(label);
      expect(html).not.toContain("pm-sheet");
    }
  });

  it("opens with the welcome while there is no account", () => {
    Object.assign(useStore.getInitialState().game, readyGame(1));
    expect(renderToString(<PearMailApp />)).toContain("Welcome to Pear Mail");
  });
});
