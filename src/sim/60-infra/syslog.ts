// The System Event Log of a device.
import type { Device, LogSev } from "../50-state";

export const LOG_MAX = 20;

// Failures and heat are critical, losses and stalls warnings, the rest information.
export function sevOf(key: string): LogSev {
  if (/^ipmi\.log\.(failed\.|overheat$|corrupted$|inlet\.crit$)/.test(key)) return "crit";
  if (/^ipmi\.log\.(pulled|hung|bmcHung|lockedOut|stuck|psuLost|installAborted|upgradeAborted|inlet\.warn|node\.maintenance)$/.test(key)) return "warn";
  return "info";
}

export function pushLog(d: Pick<Device, "log">, hour: number, key: string, sev: LogSev = sevOf(key)): void {
  d.log = [...d.log, { hour, key, sev, id: (d.log.at(-1)?.id ?? -1) + 1 }].slice(-LOG_MAX);
}

