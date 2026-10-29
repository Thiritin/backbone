// Values from docs/design/economy.md, section "Know-how and unlock costs". Each skill is a training the company takes once.
export interface Skill {
  id: string;
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
}

export const SKILLS: Skill[] = [
  { id: "monitoring", name: "Monitoring", about: "Your team learns to watch the hardware and the queues, so failures and waiting work announce themselves.", tier: 1, knowHow: 50, days: 5, needs: [], opens: ["Nagiosaurus"] },
  { id: "marketingBasics", name: "Marketing basics", about: "You learn who your customers are and what makes them pick one host over another.", tier: 1, knowHow: 50, days: 5, needs: [], opens: [] },
  { id: "people", name: "Employee management", about: "You learn to hire, pay and organise people without losing track of who does what.", tier: 1, knowHow: 100, days: 10, needs: [], opens: ["Staff"] },
  { id: "network", name: "Network operations", about: "Your team learns to buy transit, peer with other networks and survive the occasional flood of traffic.", tier: 2, knowHow: 300, days: 14, needs: ["monitoring"], opens: [] },
  { id: "memoryReservation", name: "Memory reservation", about: "Your team learns to keep each server's booked memory within the memory it has, so a busy hour cannot freeze it.", tier: 2, knowHow: 100, days: 5, needs: ["monitoring"], opens: [] },
  { id: "products", name: "Product management", about: "You learn to bundle your services into product lines with prices per resource, licences and clusters.", tier: 1, knowHow: 100, days: 7, needs: [], opens: ["Products"] },
  { id: "provisioning", name: "Provisioning automation", about: "Your team learns to place new orders on a fitting server without anyone picking the host, and to run an accepted order from account to setup by itself.", tier: 2, knowHow: 150, days: 10, needs: ["products"], opens: [] },
  { id: "marketing", name: "Marketing campaigns", about: "Your staff learns to run campaigns and to keep an eye on what customers write about you.", tier: 2, knowHow: 300, days: 14, needs: ["marketingBasics", "people"], opens: ["Marketing"] },
  { id: "virtualization", name: "High availability", about: "Your team learns to move virtual machines between servers while they run, spread them when a server runs hot and restart them elsewhere when one fails.", tier: 3, knowHow: 400, days: 14, needs: ["products", "monitoring"], opens: [] },
  { id: "gpuCompute", name: "GPU computing", about: "Your team learns to hand whole graphics cards to virtual machines, so customers can train models and render on your servers.", tier: 3, knowHow: 400, days: 14, needs: ["products", "monitoring"], opens: [], from: 2011 },
  { id: "market", name: "Market research", about: "You learn to read demand by product and to find out why a sale got away.", tier: 3, knowHow: 800, days: 21, needs: ["products", "marketing"], opens: ["Market"] },
  { id: "knowledgeBase", name: "Documentation", about: "Your team learns to write the answers to common questions down, so customers find them before they write in.", tier: 2, knowHow: 200, days: 10, needs: ["products"], opens: ["Knowledge base"] },
  { id: "automation", name: "Automation", about: "Your company learns to hand routine tickets and reminders to bots that never sleep and never quite understand.", tier: 3, knowHow: 1500, days: 21, needs: ["people", "monitoring"], opens: ["chadGpt", "clipsy"] },
];

// The skill that unlocks live migration, auto-balancing and failover per hypervisor cluster; its id predates the rename.
export const HA_SKILL = "virtualization";
// The skill that lets a hypervisor cluster rent out its GPU cards.
export const GPU_SKILL = "gpuCompute";
// The skill that adds Automatic to an order's setup and the switch that runs accepted orders by themselves.
export const AUTOMATION_SKILL = "provisioning";

export const skillById = (id: string): Skill | undefined => SKILLS.find((k) => k.id === id);

// The skill that makes a Pear Store item available; items without one need no training.
export const skillFor = (itemId: string): Skill | undefined => SKILLS.find((k) => k.opens.includes(itemId));

export const isAvailable = (itemId: string, learned: string[]): boolean => {
  const skill = skillFor(itemId);
  return !skill || learned.includes(skill.id);
};
