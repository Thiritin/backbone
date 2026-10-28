// Values from docs/design/economy.md, section "Know-how and unlock costs". Each skill is a training the company takes once.
export interface Skill {
  id: string;
  name: string;
  about: string;
  tier: number;
  knowHow: number;
  days: number;
  needs: string[];
  // Pear Store item ids the skill makes available.
  opens: string[];
}

export const SKILLS: Skill[] = [
  { id: "monitoring", name: "Monitoring", about: "Your team learns to watch the hardware and the queues, so failures and waiting work announce themselves.", tier: 1, knowHow: 50, days: 5, needs: [], opens: ["dockBadges"] },
  { id: "marketingBasics", name: "Marketing basics", about: "You learn who your customers are and what makes them pick one host over another.", tier: 1, knowHow: 50, days: 5, needs: [], opens: [] },
  { id: "people", name: "Employee management", about: "You learn to hire, pay and organise people without losing track of who does what.", tier: 1, knowHow: 100, days: 10, needs: [], opens: ["Staff"] },
  { id: "network", name: "Network operations", about: "Your team learns to buy transit, peer with other networks and survive the occasional flood of traffic.", tier: 2, knowHow: 300, days: 14, needs: ["monitoring"], opens: ["Network"] },
  { id: "products", name: "Product management", about: "You learn to bundle your services into product lines with plans, licences and clusters.", tier: 2, knowHow: 200, days: 14, needs: ["marketingBasics"], opens: ["Products"] },
  { id: "marketing", name: "Marketing campaigns", about: "Your staff learns to run campaigns and to keep an eye on what customers write about you.", tier: 2, knowHow: 300, days: 14, needs: ["marketingBasics", "people"], opens: ["Marketing"] },
  { id: "virtualization", name: "Virtualization", about: "Your team learns to run virtual machines on a platform, move them between servers and bring them back from a backup.", tier: 3, knowHow: 400, days: 14, needs: ["products", "monitoring"], opens: ["Virtual machines"] },
  { id: "market", name: "Market research", about: "You learn to read demand by product and to find out why a sale got away.", tier: 3, knowHow: 800, days: 21, needs: ["products", "marketing"], opens: ["Market"] },
  { id: "automation", name: "Automation", about: "Your company learns to hand routine tickets and reminders to bots that never sleep and never quite understand.", tier: 3, knowHow: 1500, days: 21, needs: ["people", "monitoring"], opens: ["chadGpt", "clipsy"] },
];

export const skillById = (id: string): Skill | undefined => SKILLS.find((k) => k.id === id);

// The skill that makes a Pear Store item available; items without one need no training.
export const skillFor = (itemId: string): Skill | undefined => SKILLS.find((k) => k.opens.includes(itemId));

export const isAvailable = (itemId: string, learned: string[]): boolean => {
  const skill = skillFor(itemId);
  return !skill || learned.includes(skill.id);
};
