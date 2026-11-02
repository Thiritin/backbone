// Flyerlarm, the print shop that sells flyer runs (economy.md, Marketing and reviews, Flyers).
import type { Profile } from "../30-customers/customers";
import { priceAt } from "./economy";

export const FLYER_NAME = "Flyerlarm", FLYER_HOST = "flyerlarm.de";
export const FLYER_SIZES = [1000, 5000, 10000];
// 2026 euros per flyer by run size, scaled back with m = 0.6.
const PER_FLYER: Record<number, number> = { 1000: 0.09, 5000: 0.07, 10000: 0.06 };
export const FLYER_DELIVERY_HOURS = 3 * 24;
export const FLYER_HAND_OUT_DAYS = 28;
// Leads per flyer handed out, and the conversion multiplier of those leads.
export const FLYER_RESPONSE = 0.004, FLYER_CONVERSION = 0.8;
// Who reads a flyer in the letterbox.
export const FLYER_PROFILES: Profile[] = ["private", "soleProp", "smallBiz"];

export const flyerPrice = (size: number, year: number): number => Math.round(priceAt(PER_FLYER[size], 0.6, year) * size * 100) / 100;
