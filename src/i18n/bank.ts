import { euro, euroCents } from "../sim/00-core/money";

type Params = Record<string, string | number>;

// Bank and payables text the sim writes: ledger lines, emails, errors; spread into en.
export const BANK_EN: Record<string, (p: Params) => string> = {
  "doc.tans": () => "TAN list",
  "bank.tanList.no": (p) => `TAN list no. ${p.n}`,
  "ledger.bankFee": (p) => `Account fee, ${p.bank}`,
  "ledger.overdraftInterest": (p) => `Overdraft interest, ${p.bank}`,
  "ledger.transfer": (p) => `Transfer to ${p.name}: ${p.reference}`,
  "error.unknownBank": () => "This bank does not open accounts yet.",
  "error.noBank": () => "The company has no bank account yet.",
  "error.payeeName": () => "Enter the payee's name.",
  "error.payeeAccount": () => "The account details are not valid.",
  "error.badAmount": () => "Enter an amount in euros and cents.",
  "error.bankLocked": () => "Online banking is locked.",
  "error.noTransfer": () => "There is no transfer waiting for a TAN.",
  "error.wrongTan": () => "The TAN is wrong.",
  "error.loanMin": () => "The bank does not lend amounts this small.",
  "error.tanMethod": () => "The bank does not offer this TAN method yet.",
  "ledger.cardFee": (p) => `Credit card fee, ${p.bank}`,
  "error.hasCard": () => "The account already has a credit card.",
  "error.noOverdraft": () => "This bank offers no overdraft.",
  "error.applied": () => "The application is with the bank.",
  "error.noCard": () => "The account has no credit card.",
  "error.cardLimit": () => "The order is above the card limit.",
  "error.cardOnly": () => "This shop takes only credit cards.",
  "ticket.mail.bankCard.subject": () => "Your credit card",
  "ticket.mail.bankCard.text": (p) => `${p.bank} has approved your credit card with a limit of ${euro(Number(p.limit))}. The card bill is debited from your account at the start of each month.`,
  "ticket.mail.bankOverdraft.subject": () => "Your overdraft",
  "ticket.mail.bankOverdraft.text": (p) => `${p.bank} has set your overdraft limit to ${euro(Number(p.limit))} at ${p.rate} % interest a year.`,
  "ticket.mail.bankWelcome.subject": (p) => `Your account at ${p.bank}`,
  "ticket.mail.bankWelcome.text": (p) => `Welcome to ${p.bank}. Your business account ${p.number} is open. Your PIN for online banking is ${p.pin}. You can log in at ${p.url}.`,
  "ticket.mail.bankMtan.subject": () => "Your mTAN",
  "ticket.mail.bankMtan.text": (p) => `The mTAN for your transfer of ${euroCents(Number(p.amount))} to ${p.name} is ${p.code}.`,
  "ticket.mail.bankTanList.subject": (p) => `TAN list no. ${p.n}`,
  "ticket.mail.bankTanList.text": (p) => `You have used every TAN on your list. ${p.bank} has sent you TAN list no. ${p.n}, which is now on your desktop.`,
};
