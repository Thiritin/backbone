import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { ALERT_KEYS } from "../src/sim/alerts";
import { ADVISORY_KEYS } from "../src/sim/60-infra/security";
import { NEWS } from "../src/sim/80-business/news";
import { BOT_INCIDENTS } from "../src/sim/47-staff/staff";
import { NOTIFY_TYPES, typeOf } from "../src/ui/notify-types";
import { prefOf, useStore } from "../src/ui/store";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith(".ts") ? [join(dir, d.name)] : []));

// Every (app, key) the sim emits: literal pairs from the source, plus the few keys it builds or picks at run time.
function emitted(): [string, string][] {
  const pairs = new Set(files("src/sim").flatMap((f) => [...readFileSync(f, "utf8").matchAll(/app: "([A-Za-z ]+)", key: "(event\.[A-Za-z.]+)"/g)].map((m) => `${m[1]}|${m[2]}`)));
  const extra: [string, string][] = [
    ["Support", "event.gridDark"], ["Support", "event.gridCarried"], ["Products", "event.installed"], ["Products", "event.switched"],
    ...ADVISORY_KEYS.map((k) => ["Security", k] as [string, string]),
    ...Array.from({ length: BOT_INCIDENTS }, (_, i) => ["Staff", `event.botIncident${i + 1}`] as [string, string]),
    ...NEWS.map((d) => ["News", d.key] as [string, string]), ["News", "event.news.line"],
  ];
  extra.forEach(([a, k]) => pairs.add(`${a}|${k}`));
  return [...pairs].map((p) => p.split("|") as [string, string]);
}

describe("notification types", () => {
  it("puts every key the sim emits in exactly one group of its app", () => {
    const wrong = emitted().filter(([app, key]) => (NOTIFY_TYPES[app] ?? []).filter((g) => g.id !== "other" && g.match(key)).length !== 1);
    expect(wrong).toEqual([]);
  });

  it("knows the app of every event that has a headline", () => {
    const known = new Set(emitted().map(([, k]) => k));
    const unknown = Object.keys(en).filter((k) => /^event\..+\.title$/.test(k)).map((k) => k.slice(0, -6)).filter((k) => !known.has(k));
    expect(unknown).toEqual([]);
  });

  it("sends a key no group claims to Other", () => {
    expect(typeOf("Finance", "event.somethingNew")).toBe("other");
    expect(typeOf("Shop", "event.tax")).toBe("other");
  });
});

describe("notification types in the store", () => {
  const s = useStore.getState;
  const saved = s().notifyPrefs;
  afterEach(() => useStore.setState({ notifyPrefs: saved, banners: [], history: [] }));

  it("hides a notification of a type that is off and keeps the others", () => {
    s().setNotifyPref("Network", { types: { [typeOf("Network", "event.networkBills")]: false } });
    s().notify("Network", "bills", "x", "event.networkBills");
    s().notify("Network", "uplink", "x", "event.uplinkReady");
    expect(s().history.map((b) => b.title)).toEqual(["uplink"]);
    expect(s().banners).toHaveLength(1);
  });

  it("shows nothing of an app that is off, whatever its types say", () => {
    s().setNotifyPref("Finance", { allow: false, types: {} });
    s().notify("Finance", "tax", "x", "event.tax");
    expect(s().history).toHaveLength(0);
  });

  it("always shows alert keys", () => {
    s().setNotifyPref("Bank", { allow: false, types: { [typeOf("Bank", "event.loanMissed")]: false } });
    expect(Object.keys(ALERT_KEYS)).toContain("event.loanMissed");
    s().notify("Bank", "missed", "x", "event.loanMissed");
    expect(s().history.map((b) => b.title)).toEqual(["missed"]);
  });

  it("loads preferences from before types with every type on", () => {
    const old = { Finance: { allow: true, sound: false } };
    expect(prefOf(old, "Finance").types).toBeUndefined();
    useStore.setState({ notifyPrefs: old });
    s().notify("Finance", "tax", "x", "event.tax");
    expect(s().history).toHaveLength(1);
  });
});
