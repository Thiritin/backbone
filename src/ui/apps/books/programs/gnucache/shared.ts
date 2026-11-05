import { euroCents } from "../../../../../sim/00-core/money";
import type { Account, Kind } from "../../data";

export const KINDS: Kind[] = ["asset", "liability", "equity", "income", "expense"];
// Credit accounts show their sign turned, so income and debts read positive.
export const shown = (kind: Kind, v: number) => (kind === "asset" || kind === "expense" ? v : 0 - v);
export const money = (kind: Kind, v: number) => euroCents(shown(kind, v));
// The account type column: the three fixed accounts have their own types, the rest the kind.
export const typeKey = (a: Account) => (a.id === "bank" ? "bank" : a.id === "receivables" ? "receivable" : a.id === "payables" ? "payable" : a.kind);
