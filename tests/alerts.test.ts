import { describe, expect, it } from "vitest";
import { ALERT_KEYS, isAlert } from "../src/sim/alerts";
import { ADVISORY_KEYS } from "../src/sim/60-infra/security";
import { t } from "../src/i18n/en";

const APP: Record<string, string> = {
  "event.cashNegative": "Bank", "event.loanMissed": "Bank", "event.loanCalled": "Bank",
  "event.vuln.announced": "Security", "event.vuln.poc": "Security", "event.vuln.warning": "Security", "event.vuln.patch": "Security", "event.vuln.hacked": "Security",
  "event.dataLoss": "Locations", "event.seized": "Support", "event.ddos": "Network", "event.gridDark": "Locations",
};

describe("alerts", () => {
  it("maps each alert key to the app its sheet opens", () => {
    expect(ALERT_KEYS).toEqual(APP);
    for (const [key, app] of Object.entries(APP)) {
      expect(isAlert(key)).toBe(true);
      expect(ALERT_KEYS[key]).toBe(app);
    }
  });

  it("treats every other event as a banner", () => {
    for (const key of ["event.bankrupt", "event.tax", "event.gridCarried", "event.vulnOpen", "toString", ""]) expect(isAlert(key)).toBe(false);
  });

  it("covers every advisory stage and has a title and text for each key", () => {
    for (const key of ADVISORY_KEYS) expect(isAlert(key)).toBe(true);
    for (const key of Object.keys(APP)) {
      expect(t(`${key}.title`, {})).not.toBe(`${key}.title`);
      expect(t(`${key}.text`, {})).not.toBe(`${key}.text`);
    }
  });
});
