// GPU cards, their prices and the demand for GPU rental (economy.md, Prices over time, GPU cards and rental; Market and leads).
export interface GpuCard { year: number; name: string; watts: number; price: number; wide: boolean }

// Launch year, model, watts, list price in euros and whether the card takes two slots. Parts and components name a card by its launch year.
export const GPU_CARDS: GpuCard[] = [
  { year: 2007, name: "nVidea Tezla C870", watts: 170, price: 1300, wide: false },
  { year: 2010, name: "nVidea Tezla M2050", watts: 225, price: 2200, wide: false },
  { year: 2014, name: "nVidea Tezla K80", watts: 300, price: 4500, wide: false },
  { year: 2017, name: "nVidea Tezla V100", watts: 300, price: 9000, wide: true },
  { year: 2020, name: "nVidea Tezla A100", watts: 400, price: 11000, wide: true },
  { year: 2023, name: "nVidea Tezla H100", watts: 700, price: 28000, wide: true },
  { year: 2025, name: "nVidea Tezla B200", watts: 1000, price: 35000, wide: true },
];

// The card launched in a year; an unknown year gives the first card.
export const cardOf = (launch: number | undefined): GpuCard => GPU_CARDS.find((c) => c.year === launch) ?? GPU_CARDS[0];
// The newest card launched by a year, or null before the first.
export const cardAt = (year: number): GpuCard | null => GPU_CARDS.filter((c) => c.year <= year).at(-1) ?? null;
// What the Parts tab sells in a year: the newest card and the one before.
export const gpuOffers = (year: number): GpuCard[] => GPU_CARDS.filter((c) => c.year <= year).slice(-2);

// A card falls 10% of its list price a year after launch, to half; once its successor is out it sits at half.
export function gpuPrice(card: GpuCard, year: number): number {
  const next = GPU_CARDS[GPU_CARDS.indexOf(card) + 1];
  return card.price * (next && year >= next.year ? 0.5 : Math.max(0.5, 1 - 0.1 * (year - card.year)));
}

// Watts a device's working cards add to its draw.
export const cardWatts = (components: { kind: string; size?: number; failedAt: number | null }[]): number =>
  components.reduce((n, c) => n + (c.kind === "gpu" && c.failedAt === null ? cardOf(c.size).watts : 0), 0);

// The market's price for one card a month, by year: straight lines between the anchors, flat after the last.
const RENT: [year: number, eur: number][] = [[2011, 600], [2016, 450], [2017, 1500], [2020, 1800], [2023, 4000], [2026, 2500]];
export function gpuRent(year: number): number {
  if (year <= RENT[0][0]) return RENT[0][1];
  for (let i = 1; i < RENT.length; i++) {
    if (year <= RENT[i][0]) return RENT[i - 1][1] + ((RENT[i][1] - RENT[i - 1][1]) * (year - RENT[i - 1][0])) / (RENT[i][0] - RENT[i - 1][0]);
  }
  return RENT[RENT.length - 1][1];
}

// How strongly GPU rental is asked for: none before the first GPU servers, then three steps for deep learning and generative AI.
export const gpuDemand = (year: number): number => (year < 2011 ? 0 : year < 2017 ? 0.2 : year < 2020 ? 0.6 : year < 2023 ? 1 : 2.5);
// The share of a profile's orders that ask for a GPU at demand 1.
export const GPU_SHARE = 0.03;
// Profiles that rent GPUs.
export const GPU_PROFILES = ["hobbyDev", "agency", "enterprise", "onlineShop"] as const;
