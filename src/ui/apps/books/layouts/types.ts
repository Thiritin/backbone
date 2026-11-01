import { BellRing, ChartColumn, FileText, Landmark, LayoutGrid, Percent, Receipt, ScrollText, Users, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { BooksVendor } from "../../../../sim/10-catalog/bookkeeping";

export type Group = "sales" | "payments" | "reports";
// One entry of the program's navigation; a locked one opens the vendor's upgrade page.
export interface Entry { id: string; group: Group; count: number; locked: boolean }
export interface LayoutProps { v: BooksVendor; entries: Entry[]; active: string; pick: (id: string) => void; children: ReactNode }

export const GROUPS: Group[] = ["sales", "payments", "reports"];
export const ICONS: Record<string, LucideIcon> = {
  overview: LayoutGrid, customers: Users, quotes: FileText, invoices: Receipt, bank: Landmark, reminders: BellRing,
  payables: Wallet, statistics: ChartColumn, tax: Percent, statement: ScrollText,
};
