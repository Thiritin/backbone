// Values from docs/design/economy.md, section "Know-how and unlock costs". Each skill is a training the company takes once.
export type Track = "ops" | "infra" | "sales" | "company";
export interface Skill {
  id: string;
  track: Track;
  name: string;
  about: string;
  tier: number;
  knowHow: number;
  days: number;
  needs: string[];
  // The first year the training is offered.
  from?: number;
  // Pear Store item ids the skill makes available.
  opens: string[];
  // What the skill switches on in the game besides store items.
  grants?: string[];
}

export const SKILLS: Skill[] = [
  { id: "monitoring", track: "ops", name: "Monitoring", about: "Your team learns to watch the hardware and the queues, so failures and waiting work announce themselves.", tier: 1, knowHow: 50, days: 5, needs: [], opens: ["Nagiosaurus"] },
  { id: "memoryReservation", track: "ops", name: "Memory reservation", about: "Your team learns to keep each server's booked memory within the memory it has, so a busy hour cannot freeze it.", tier: 2, knowHow: 100, days: 5, needs: ["monitoring"], opens: [], grants: ["Memory reservation per cluster"] },
  { id: "automation", track: "ops", name: "Automation", about: "Your company learns to hand routine tickets and reminders to bots that never sleep and never quite understand.", tier: 3, knowHow: 1500, days: 21, needs: ["people", "monitoring"], opens: ["chadGpt", "clipsy"] },
  { id: "network", track: "infra", name: "Network operations", about: "Your team learns to buy transit, peer with other networks and survive the occasional flood of traffic.", tier: 2, knowHow: 300, days: 14, needs: ["monitoring"], opens: ["Network"] },
  { id: "virtualization", track: "infra", name: "High availability", about: "Your team learns to move virtual machines between servers while they run, spread them when a server runs hot and restart them elsewhere when one fails.", tier: 3, knowHow: 400, days: 14, needs: ["products", "monitoring"], opens: [], grants: ["Live migration", "Automatic failover", "Auto-balancing on a hypervisor with a balancer", "Product lines that need failover"] },
  { id: "gpuCompute", track: "infra", name: "GPU computing", about: "Your team learns to hand whole graphics cards to virtual machines, so customers can train models and render on your servers.", tier: 3, knowHow: 400, days: 14, needs: ["products", "monitoring"], opens: [], from: 2011, grants: ["GPU virtual machines"] },
  { id: "cloudOrchestration", track: "infra", name: "Cloud orchestration", about: "Your team learns to run OpenStash: self-service virtual machines billed by the hour, networks and volumes on demand, and load spread over the whole cloud. The software is free, the know-how is not.", tier: 4, knowHow: 3000, days: 45, needs: ["virtualization", "network", "provisioning"], opens: [], from: 2010, grants: ["OpenStash installs", "Cloud computing", "Watchman auto-balancing"] },
  { id: "products", track: "sales", name: "Product management", about: "You learn to price your services per resource and set your own rates for every product line.", tier: 1, knowHow: 100, days: 7, needs: [], opens: [], grants: ["Rates per product line"] },
  { id: "shops", track: "sales", name: "Shop systems", about: "You learn to run an order and provisioning system that sells from stock and hands orders to your servers.", tier: 1, knowHow: 60, days: 4, needs: [], opens: [] },
  { id: "provisioning", track: "sales", name: "Provisioning automation", about: "Your team learns to quote order emails at your rates, place new orders on a fitting server without anyone picking the host, and run an accepted order from account to setup by itself.", tier: 2, knowHow: 150, days: 10, needs: ["products"], opens: [], grants: ["Automatic host for a setup", "Order automation: quotes, accounts, invoices and setups"] },
  { id: "knowledgeBase", track: "sales", name: "Documentation", about: "Your team learns to write the answers to common questions down, so customers find them before they write in.", tier: 2, knowHow: 200, days: 10, needs: ["products"], opens: ["Knowledge base"] },
  { id: "market", track: "sales", name: "Market research", about: "You learn to read demand by product and to find out why a sale got away.", tier: 3, knowHow: 800, days: 21, needs: ["products", "marketing"], opens: ["Market"] },
  { id: "people", track: "company", name: "Employee management", about: "You learn to hire, pay and organise people without losing track of who does what.", tier: 1, knowHow: 100, days: 10, needs: [], opens: ["Staff"] },
  { id: "marketingBasics", track: "company", name: "Marketing basics", about: "You learn who your customers are, what they write about you and how sponsoring events wins them over.", tier: 1, knowHow: 50, days: 5, needs: [], opens: [] },
  { id: "marketing", track: "company", name: "Marketing campaigns", about: "Your staff learns to run campaigns, track awareness and book stands at trade fairs.", tier: 2, knowHow: 300, days: 14, needs: ["marketingBasics", "people"], opens: ["Marketing"] },
];
// The rows of the research tree, top to bottom.
export const TRACKS: { id: Track; name: string }[] = [
  { id: "ops", name: "Operations" }, { id: "infra", name: "Infrastructure" }, { id: "sales", name: "Sales" }, { id: "company", name: "Company" },
];

// The skill that unlocks live migration, auto-balancing and failover per hypervisor cluster; its id predates the rename.
export const HA_SKILL = "virtualization";
// The skill that lets a hypervisor cluster rent out its GPU cards.
export const GPU_SKILL = "gpuCompute";
// The skill that adds Automatic to an order's setup and the switch that quotes order emails and runs accepted orders by themselves.
export const AUTOMATION_SKILL = "provisioning";

export const skillById = (id: string): Skill | undefined => SKILLS.find((k) => k.id === id);

// The skill that makes a Pear Store item available; items without one need no training.
export const skillFor = (itemId: string): Skill | undefined => SKILLS.find((k) => k.opens.includes(itemId));

export const isAvailable = (itemId: string, learned: string[]): boolean => {
  const skill = skillFor(itemId);
  return !skill || learned.includes(skill.id);
};
