import type { Resources } from "../../../../../sim/10-catalog/products";
import { t } from "../../../../../i18n/en";

// The catalog behind the launch wizard and the Flavors page, so the two cannot drift apart.
export const FLAVORS: [string, Resources][] = [
  ["m1.tiny", { vcpu: 1, ramGb: 1, diskGb: 10 }], ["m1.small", { vcpu: 1, ramGb: 2, diskGb: 20 }], ["m1.medium", { vcpu: 2, ramGb: 4, diskGb: 40 }],
  ["m1.large", { vcpu: 4, ramGb: 8, diskGb: 80 }], ["m1.xlarge", { vcpu: 8, ramGb: 16, diskGb: 160 }],
];
export const same = (a: Resources, b: Resources) => a.vcpu === b.vcpu && a.ramGb === b.ramGb && a.diskGb === b.diskGb;
export const flavorOf = (r: Resources) => FLAVORS.find(([, x]) => same(x, r))?.[0] ?? t("browser-consoles-1.hzCustomFlavor", { spec: `${r.vcpu}/${r.ramGb}/${r.diskGb}` });

// Instances per flavor, then the ones that match none.
export function flavorCounts(sizes: Resources[]): { name: string; r: Resources; n: number }[] {
  return FLAVORS.map(([name, r]) => ({ name, r, n: sizes.filter((x) => same(x, r)).length }));
}
