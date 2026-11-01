import { openBankAccount } from "../src/sim/90-actions/bank";
import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { STARTER_APPS } from "../src/sim/10-catalog/store";
import { officeOpen } from "../src/sim/80-business/office";
import { resolve } from "../src/sim/80-business/browser";
import { registerCompany } from "../src/sim/90-actions/company";
import { tick } from "../src/sim/88-tick/tick";
import { checkDone } from "../src/sim/checklist";
import { deserialize, serialize } from "../src/sim/91-save/save";

// Hour 0 is Saturday 1 January 2005, 00:00; Monday 08:00 is hour 56.
const MONDAY_8 = 56;

describe("trade office", () => {
  it("starts with only the Browser and the trade office bookmarked", () => {
    const s = newGame(1);
    expect(s.installed).toEqual(["Browser"]);
    expect(s.registration).toBeNull();
    expect(resolve(s, "www.trade-office.gov/eservice/").page.kind).toBe("office");
  });

  it("keeps office hours from Monday to Friday, 08:00 to 16:00", () => {
    expect(officeOpen(0)).toBe(false);
    expect(officeOpen(MONDAY_8 - 1)).toBe(false);
    expect(officeOpen(MONDAY_8)).toBe(true);
    expect(officeOpen(MONDAY_8 + 7)).toBe(true);
    expect(officeOpen(MONDAY_8 + 8)).toBe(false);
  });

  it("refuses the form outside office hours and announces the opening once", () => {
    const s = newGame(1);
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole")).toEqual({ ok: false, error: "error.officeClosed" });
    const opened: number[] = [];
    while (s.hour < MONDAY_8 + 24) if (tick(s).some((e) => e.key === "event.officeOpen")) opened.push(s.hour);
    expect(opened).toEqual([MONDAY_8, MONDAY_8 + 24]);
  });

  it("registers the company, installs the starter apps and ticks the guide step", () => {
    const s = newGame(1);
    s.hour = MONDAY_8;
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole")).toEqual({ ok: false, error: "error.noBank" });
    expect(openBankAccount(s, "sparklasse").ok).toBe(true);
    expect(registerCompany(s, "Basement Hosting", " ", "sole")).toEqual({ ok: false, error: "error.ownerName" });
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "limited")).toEqual({ ok: false, error: "error.registerSole" });
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "partnership")).toEqual({ ok: false, error: "error.registerSole" });
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole").ok).toBe(true);
    expect(s.company.name).toBe("Basement Hosting");
    expect(s.registration).toMatchObject({ hour: MONDAY_8, owner: "Becker, Tin", form: "sole" });
    expect(s.installed).toEqual(expect.arrayContaining(STARTER_APPS));
    expect(checkDone(s, "register")).toBe(true);
    expect(checkDone(s, "company")).toBe(false);
    expect(registerCompany(s, "Again", "Becker, Tin", "sole")).toEqual({ ok: false, error: "error.registered" });
    s.hour += 24;
    expect(tick(s).some((e) => e.key === "event.officeOpen")).toBe(false);
  });

  it("counts saves from before the trade office as registered", () => {
    const data = JSON.parse(serialize(newGame(1)));
    delete data.registration;
    expect(deserialize(JSON.stringify(data)).registration).toMatchObject({ hour: 0 });
  });
});
