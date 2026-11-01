import type { Service } from "../../../../../sim/30-customers/customers";
import type { GameState } from "../../../../../sim/50-state";
import { accountsOf } from "../../../../../sim/60-infra/webpanel";

export interface Subscription { service: Service; domains: Service[] }

// A subscription is a web space of the host; its domains are the customer's domain, DNS and SSL services that carry its name.
export function subscriptionsOf(s: GameState, clusterId: string): Subscription[] {
  return accountsOf(s, clusterId).map((service) => {
    const names = [service.label, service.domain].filter(Boolean);
    const domains = s.services.filter((x) => x.endedAt === null && x.customerId === service.customerId && ["domain", "dns", "ssl"].includes(x.product) && [x.label, x.domain].some((k) => k && names.includes(k)));
    return { service, domains };
  });
}
