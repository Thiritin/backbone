import { euroCents } from "../sim/00-core/money";

type Params = Record<string, string | number>;

// Bank and payables text the sim writes: ledger lines, emails, errors; spread into en.
export const BANK_EN: Record<string, (p: Params) => string> = {
  "doc.tans": () => "TAN list",
  "bank.tanList.no": (p) => `TAN list no. ${p.n}`,
  "ledger.bankFee": (p) => `Account fee, ${p.bank}`,
  "ledger.overdraftInterest": (p) => `Overdraft interest, ${p.bank}`,
  "ledger.transfer": (p) => `Transfer to ${p.name}: ${p.reference}`,
  "error.unknownBank": () => "This bank does not open accounts yet.",
  "ticket.mail.bankWelcome.subject": (p) => `Your account at ${p.bank}`,
  "ticket.mail.bankWelcome.text": (p) => `Welcome to ${p.bank}. Your business account ${p.number} is open. Your PIN for online banking is ${p.pin}. You can log in at ${p.url}.`,
  "ticket.mail.bankMtan.subject": () => "Your mTAN",
  "ticket.mail.bankMtan.text": (p) => `The mTAN for your transfer of ${euroCents(Number(p.amount))} to ${p.name} is ${p.code}.`,
  "ticket.mail.bankTanList.subject": (p) => `TAN list no. ${p.n}`,
  "ticket.mail.bankTanList.text": (p) => `You have used every TAN on your list. ${p.bank} has sent you TAN list no. ${p.n}, which is now on your desktop.`,
};
