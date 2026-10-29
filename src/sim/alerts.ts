// Events that stop the clock and open a sheet, mapped to the app the sheet's primary button opens.
export const ALERT_KEYS: Record<string, string> = {
  "event.cashNegative": "Finance",
  "event.loanMissed": "Finance",
  "event.loanCalled": "Finance",
  "event.vuln.announced": "Security",
  "event.vuln.poc": "Security",
  "event.vuln.warning": "Security",
  "event.vuln.patch": "Security",
  "event.vuln.hacked": "Security",
  "event.dataLoss": "Locations",
  "event.dataCorrupted": "Locations",
  "event.seized": "Support",
  "event.ddos": "Network",
  "event.gridDark": "Locations",
  "event.feedDark": "Locations",
  "event.vulnCritical": "Security",
  "event.breach": "Support",
};

export const isAlert = (key: string): boolean => Object.hasOwn(ALERT_KEYS, key);
