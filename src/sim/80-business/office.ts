import { textRecord } from "../00-core/text";
import { dateOf } from "../00-core/time";
import type { Registration } from "../50-state";

// docs/design/tutorial.md: the trade office registers the company; its online service keeps office hours.
export const OFFICE_HOST = "trade-office.gov";
export const OFFICE_TITLE = "Trade Office Online";
export const OFFICE_URL = `www.${OFFICE_HOST}/eservice/`;
export const OFFICE_OPEN = 8;
export const OFFICE_CLOSE = 16;
export const LEGAL_FORMS: Record<string, string> = textRecord("sim.legal", { sole: "", partnership: "", limited: "" });

// Monday to Friday, 08:00 to 16:00.
export function officeOpen(hour: number): boolean {
  const d = dateOf(hour), day = d.getUTCDay(), h = d.getUTCHours();
  return day >= 1 && day <= 5 && h >= OFFICE_OPEN && h < OFFICE_CLOSE;
}

export const registerNumber = (seed: number): number => 10000 + (seed % 90000);

export const legacyRegistration = (seed: number): Registration => ({ hour: 0, owner: "", form: "sole", number: registerNumber(seed) });
