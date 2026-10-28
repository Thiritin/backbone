export type Profile = "private" | "gamer" | "hobbyDev" | "soleProp" | "smallBiz" | "agency" | "office" | "onlineShop" | "enterprise";
export type Product = "webHosting" | "domain" | "ssl" | "dns" | "gameServer" | "vps" | "vpn" | "dedicated" | "storage" | "cloud" | "colocation";
export type PaymentHabit = "prompt" | "late" | "bad";
// history holds happiness at each of the last 12 month starts, oldest first.
export interface Customer { id: string; name: string; profile: Profile; since: number; happiness: number; habit: PaymentHabit; churnedAt: number | null; history: number[] }
// price is per hour for period "hour" (invoiced monthly in arrears) and per year for period "year" (invoiced in advance).
export interface Service { id: string; customerId: string; product: Product; label: string; price: number; period: "hour" | "year"; commitMonths: number; startedAt: number; endedAt: number | null; zone: string | null }
export const activeServices = (services: Service[], customerId: string): Service[] => services.filter((v) => v.customerId === customerId && v.endedAt === null);
