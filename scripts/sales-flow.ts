// Headless run of the real tick: a bot quotes 3% under the reference on every request it can serve, answers tickets,
// sets up a website in month 3 and runs €250 of search ads from month 6. Usage: npx tsx scripts/sales-flow.ts [seed] [months]
import { startGame } from "../src/sim/90-actions/start";
import { tick } from "../src/sim/88-tick/tick";
import { quote } from "../src/sim/90-actions/sales";
import { missingFor } from "../src/sim/30-market/market";
import { replyTicket } from "../src/sim/90-actions/support";
import { rightTemplate, isFinal } from "../src/sim/40-support/tickets";
import { setCampaign, setUpChannel } from "../src/sim/90-actions/marketing";

const s = startGame(Number(process.argv[2] ?? 1));
const months = Number(process.argv[3] ?? 12);
for (let m = 0; m < months; m++) {
  if (m === 2) setUpChannel(s, "website");
  if (m === 5) { setUpChannel(s, "searchAds"); setCampaign(s, "search", ["private", "gamer", "hobbyDev", "soleProp"], 250); }
  for (let h = 0; h < 730; h++) {
    tick(s);
    for (const t of s.tickets) if (!isFinal(t) && !t.work && !t.replies.length && rightTemplate(s, t)) replyTicket(s, t.id, rightTemplate(s, t));
    for (const r of s.sales.requests) {
      if (r.status !== "open" && r.status !== "countered") continue;
      if (missingFor(s, r).length) continue;
      quote(s, r.id, r.status === "countered" ? r.counter! : r.reference * 0.97);
    }
  }
  const from = m * 730;
  const reqs = s.sales.requests.filter((r) => r.createdAt >= from);
  const greyed = reqs.filter((r) => missingFor(s, r).length > 0).length;
  const won = reqs.filter((r) => r.status === "won").length;
  const reasons: Record<string, number> = {};
  for (const l of s.sales.lost) if (l.hour >= from) reasons[l.reason] = (reasons[l.reason] ?? 0) + 1;
  const active = s.customers.filter((c) => c.churnedAt === null).length;
  const live = s.customers.filter((c) => c.churnedAt === null);
  const avgH = Math.round(live.reduce((n, c) => n + c.happiness, 0) / Math.max(1, live.length));
  const down = s.servicesDown.length, unpaid = s.invoices.filter((i) => i.status !== "paid").length;
  console.log(`m${m} H ${avgH} down ${down} unpaid ${unpaid} requests ${reqs.length} greyed ${greyed} won ${won} customers ${active} cash ${Math.round(s.cash)} lost ${JSON.stringify(reasons)}`);
}
