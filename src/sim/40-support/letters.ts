// docs/design/plans/company-paperwork.md: paper post. A letter lands with the morning post a number of working days after
// it was sent; a letter carrying a bill files it with the payables when it arrives.
import { dateOf } from "../00-core/time";
import { invoice, supplierAccount, supplierCode, supplierIban, type SupplierId } from "../46-finance/payables";
import { groupIban, ibanEra } from "../46-finance/bank";
import type { GameState, LedgerEntry } from "../50-state";

export interface Letter {
  id: string; from: string; topic: string; params: Record<string, string | number>;
  // at is the hour it lands in the letterbox; arrived turns true once its bill and form are applied.
  at: number; read: boolean; arrived: boolean;
  bill?: { supplier: SupplierId; lines: LedgerEntry[]; days: number };
  payable?: string;
  // The legal form the company holds from this letter on.
  form?: string;
}

export const POST_APP = "Post";
export const POST_HOUR = 10;

// The morning post on the working day `days` working days after hour.
export function postDay(hour: number, days: number): number {
  let day = Math.floor(hour / 24);
  for (let left = days; left > 0;) {
    day++;
    const wd = dateOf(day * 24).getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return day * 24 + POST_HOUR;
}

export function post(s: GameState, from: string, topic: string, params: Record<string, string | number>, days: number, extra: Pick<Letter, "bill" | "form"> = {}): Letter {
  const l: Letter = { id: `let${s.nextId++}`, from, topic, params, at: postDay(s.hour, days), read: false, arrived: false, ...extra };
  s.letters = [...s.letters, l];
  return l;
}

export const inbox = (s: GameState): Letter[] => s.letters.filter((l) => l.arrived);

// Delivers the letters due this hour; the first one puts the Post app on the dock.
export function lettersTick(s: GameState): void {
  for (const l of s.letters) {
    if (l.arrived || l.at > s.hour) continue;
    l.arrived = true;
    if (l.bill) {
      const p = invoice(s, l.bill.supplier, l.from, l.bill.lines, l.bill.days, true);
      l.payable = p.id;
      l.params = { ...l.params, number: p.number, amount: p.amount, due: p.dueAt, account: supplierAccount(p.supplier), code: supplierCode, iban: ibanEra(s) ? groupIban(supplierIban(p.supplier)) : "" };
    }
    if (l.form && s.registration) s.registration = { ...s.registration, form: l.form };
    if (!s.installed.includes(POST_APP)) s.installed = [...s.installed, POST_APP];
  }
}
