import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { COMPANY_COLORS, setCompany } from "../src/sim/90-actions/company";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("company profile", () => {
  it("sets a trimmed name, a logo and a colour", () => {
    const s = newGame(7);
    expect(setCompany(s, { name: "  Pixel Pipes  ", logo: "rocket", color: COMPANY_COLORS[3] })).toEqual({ ok: true });
    expect(s.company).toEqual({ name: "Pixel Pipes", logo: "rocket", color: COMPANY_COLORS[3], domain: null, mail: { kind: "free" }, tagline: "" });
  });

  it("accepts the animal and toaster logos", () => {
    const s = newGame(7);
    for (const logo of ["wolf", "fox", "cat", "toaster"]) {
      expect(setCompany(s, { logo })).toEqual({ ok: true });
      expect(s.company.logo).toBe(logo);
    }
  });

  it("rejects empty or long names and unknown marks", () => {
    const s = newGame(7), before = structuredClone(s.company);
    expect(setCompany(s, { name: "   " })).toEqual({ ok: false, error: "error.companyName" });
    expect(setCompany(s, { name: "x".repeat(33) })).toEqual({ ok: false, error: "error.companyName" });
    expect(setCompany(s, { logo: "apple" })).toEqual({ ok: false, error: "error.companyLogo" });
    expect(setCompany(s, { color: "red" })).toEqual({ ok: false, error: "error.companyColor" });
    expect(s.company).toEqual(before);
  });

  it("sets a trimmed tagline of up to 60 characters and rejects a longer one", () => {
    const s = newGame(7);
    expect(s.company.tagline).toBe("");
    expect(setCompany(s, { tagline: `  ${"x".repeat(60)}  ` })).toEqual({ ok: true });
    expect(s.company.tagline).toHaveLength(60);
    expect(setCompany(s, { tagline: "x".repeat(61) })).toEqual({ ok: false, error: "error.companyTagline" });
    expect(s.company.tagline).toHaveLength(60);
    expect(setCompany(s, { tagline: "" })).toEqual({ ok: true });
    expect(s.company.tagline).toBe("");
  });

  it("gives old saves the default profile and keeps a set one", () => {
    const old = JSON.parse(serialize(newGame(7)));
    delete old.company;
    expect(deserialize(JSON.stringify(old)).company).toEqual(newGame(7).company);
    const noTagline = JSON.parse(serialize(newGame(7)));
    delete noTagline.company.tagline;
    expect(deserialize(JSON.stringify(noTagline)).company.tagline).toBe("");

    const s = newGame(7);
    setCompany(s, { name: "Pixel Pipes" });
    expect(deserialize(serialize(s)).company.name).toBe("Pixel Pipes");
  });
});
