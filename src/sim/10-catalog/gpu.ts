// GPU cards, their prices and the demand for GPU rental (economy.md, Prices over time, GPU cards and rental; Market and leads).
// line groups a maker's cards that succeed each other; maker is the part maker id (families.ts).
export interface GpuCard { id: string; year: number; name: string; watts: number; price: number; wide: boolean; line: string; maker: string }

const card = (line: string, maker: string, id: string, year: number, name: string, watts: number, price: number, wide: boolean): GpuCard => ({ id, line, maker, year, name, watts, price, wide });
// Launch year, model, watts, list price in euros and whether the card takes two slots. The Tezla line is the one GPU servers
// ship with; parts and components name a card by its launch year and, since cards have makers, by its id.
export const GPU_CARDS: GpuCard[] = [
  card("tezla", "nvidea", "tezla-c870", 2007, "nVidea Tezla C870", 170, 1300, false),
  card("tezla", "nvidea", "tezla-m2050", 2010, "nVidea Tezla M2050", 225, 2200, false),
  card("tezla", "nvidea", "tezla-k80", 2014, "nVidea Tezla K80", 300, 4500, false),
  card("tezla", "nvidea", "tezla-v100", 2017, "nVidea Tezla V100", 300, 9000, true),
  card("tezla", "nvidea", "tezla-a100", 2020, "nVidea Tezla A100", 400, 11000, true),
  card("tezla", "nvidea", "tezla-h100", 2023, "nVidea Tezla H100", 700, 28000, true),
  card("tezla", "nvidea", "tezla-b200", 2025, "nVidea Tezla B200", 1000, 35000, true),
];
// The small single-slot nVidea cards and AMB's Radeon Instinkt line, sold in the Parts tab next to the Tezlas.
export const OTHER_CARDS: GpuCard[] = [
  card("small", "nvidea", "t4", 2018, "nVidea T4", 70, 2500, false),
  card("small", "nvidea", "a10", 2021, "nVidea A10", 150, 3200, false),
  card("small", "nvidea", "l40s", 2023, "nVidea L40S", 350, 9000, true),
  card("instinkt", "amb", "instinkt-mi25", 2017, "AMB Radeon Instinkt MI25", 300, 6000, true),
  card("instinkt", "amb", "instinkt-mi100", 2020, "AMB Radeon Instinkt MI100", 300, 7000, true),
  card("instinkt", "amb", "instinkt-mi210", 2022, "AMB Radeon Instinkt MI210", 300, 9000, true),
  card("instinkt", "amb", "instinkt-mi300x", 2023, "AMB Radeon Instinkt MI300X", 750, 16000, true),
];
export const ALL_CARDS: GpuCard[] = [...GPU_CARDS, ...OTHER_CARDS];
export const cardById = (id: string | undefined): GpuCard | undefined => ALL_CARDS.find((c) => c.id === id);
// The card a part names: by id, else the Tezla launched in a year; an unknown year gives the first card.
export const cardOf = (launch: number | undefined, id?: string): GpuCard => cardById(id) ?? GPU_CARDS.find((c) => c.year === launch) ?? GPU_CARDS[0];
// The newest Tezla launched by a year, or null before the first.
export const cardAt = (year: number): GpuCard | null => GPU_CARDS.filter((c) => c.year <= year).at(-1) ?? null;
// What the Parts tab sells in a year: the newest card and the one before of every line.
export const gpuOffers = (year: number): GpuCard[] => [...new Set(ALL_CARDS.map((c) => c.line))].flatMap((line) => ALL_CARDS.filter((c) => c.line === line && c.year <= year).slice(-2));

// A card falls 10% of its list price a year after launch, to half; once its line's successor is out it sits at half.
export function gpuPrice(card: GpuCard, year: number): number {
  const next = ALL_CARDS.find((c) => c.line === card.line && c.year > card.year);
  return card.price * (next && year >= next.year ? 0.5 : Math.max(0.5, 1 - 0.1 * (year - card.year)));
}

// Watts a device's working cards add to its draw.
export const cardWatts = (components: { kind: string; size?: number; sku?: string; failedAt: number | null }[]): number =>
  components.reduce((n, c) => n + (c.kind === "gpu" && c.failedAt === null ? cardOf(c.size, c.sku).watts : 0), 0);

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
