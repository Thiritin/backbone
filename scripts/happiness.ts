// Plays the early game like a careful player through the real tick and actions: every order step at the market price,
// the setup once paid, every ticket answered with the right template, every sales request quoted at the market price,
// domains renewed, orders declined when the cluster cannot fit them, another server bought by the model's steady rule (on a
// bank loan when cash is short) and a faster home line once the upload runs full.
// Logs per month the customers with a live service, MRR, average happiness, level and the happiness change per customer by source.
// Usage: npx tsx scripts/happiness.ts [seeds=1-6] [months=12] [--upgrades] [--no-buy] [--quiet]
import { counts } from "../src/sim/00-core/workhours";
import { domainDown } from "../src/sim/30-customers/registry";
import { serviceOnline } from "../src/sim/40-support/status";
import { isSuspended } from "../src/sim/45-billing/billing";
import { lostDisk, workloadsOf, type Workload } from "../src/sim/60-infra/cluster";
import { takenDown } from "../src/sim/60-infra/ops";
import { linkStatus } from "../src/sim/60-infra/status";
import { activeServices } from "../src/sim/30-customers/customers";
import { missingFor } from "../src/sim/30-market/market";
import { nextStep, stepError } from "../src/sim/30-market/manual";
import { orderOf } from "../src/sim/30-market/orders";
import { bumpProbe, isFinal, monthlyValue, profileStats, rightTemplate, TEMPLATES, type TicketAction, type TicketKind } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { BASEMENT_SLOTS } from "../src/sim/10-catalog/economy";
import { modelById } from "../src/sim/10-catalog/hardware";
import { bookable, controlPlaneUse, nodeUsed } from "../src/sim/60-infra/cluster";
import { sizeOf } from "../src/sim/30-market/spec";
import type { SalesRequest } from "../src/sim/30-market/market";
import { addNode, createPanelVm, resizePanelVm } from "../src/sim/90-actions/clusters";
import { installSoftware } from "../src/sim/90-actions/software";
import { sitesDown, vmById, vmOf, vmRoom } from "../src/sim/60-infra/cluster";
import { buyDevice, connect, orderHomeLine } from "../src/sim/90-actions/hardware";
import { mountDevice } from "../tests/plugged";
import { acceptUpgrade, confirmOrder, createAccount, provisionOrder, registerOrderDomain, renewDomain } from "../src/sim/90-actions/orders";
import { quote } from "../src/sim/90-actions/sales";
import { closeTicket, replyTicket, resolveTicket } from "../src/sim/90-actions/support";
import { startGame } from "../src/sim/90-actions/start";
import { fillLines } from "../src/sim/80-business/website";
import { OWNED, owns } from "../src/sim/80-business/marketing";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { research } from "../src/sim/90-actions/store";
import { debt, LOAN_AMOUNTS, loanAvailable } from "../src/sim/45-billing/billing";
import { takeLoan } from "../src/sim/90-actions/billing";
import { HOME_LINES, homeLineById } from "../src/sim/20-world/datacenters";
import { homePeak } from "../src/sim/60-infra/network";
import { yearOf } from "../src/sim/00-core/time";
import { metrics } from "../src/sim/metrics";

const args = process.argv.slice(2), flags = new Set(args.filter((a) => a.startsWith("--")));
const [seedArg = "1-6", monthArg = "12"] = args.filter((a) => !a.startsWith("--"));
const [lo, hi = lo] = seedArg.split("-").map(Number);
const MONTHS = Number(monthArg), MONTH = 730, SERVER_PRICE = 2500;
// Tickets without a right template: the careful choice. Cancellations wait for the monthly run.
const ACTION: Partial<Record<TicketKind, TicketAction>> = { notice: "forward", legal: "comply", refund: "credit", appeal: "unsuspend" };

// The first frame outside bump and this probe names the source; credit() and anonymous callbacks add their caller.
function source(stack: string): string {
  const frames = stack.split("\n").slice(1).map((l) => /at (?:(\S+) \()?.*\/([\w.-]+\.ts):(\d+)/.exec(l)).filter((m) => m && !m[2].startsWith("happiness"));
  const name = (m: RegExpExecArray) => `${m[1] ?? m[2] + ":" + m[3]}`.replace(/^Object\./, "");
  const [a, b] = frames.slice(1) as RegExpExecArray[];
  return a[1] === "credit" || a[1] === "slowed" || !a[1] ? `${name(a)}<${b ? name(b) : "?"}` : name(a);
}

export interface Month { month: number; servers: number; cash: number; debt: number; netWorth: number; level: number; knowHow: number; line: string; live: number; mrr: number; happiness: number; churned: number; won: number; lost: Record<string, number>; bySource: Record<string, number>; waitByKind: Record<string, number>; stepErrors: Record<string, number>; downHours: Record<string, number> }

export function play(seed: number, months: number, upgrades = false, buy = true): { rows: Month[]; s: GameState; reached: Record<string, number> } {
  // The first server: the Shop's Dwell 1U from the savings, in the basement rack cabled to the home router, then Proxmocks
  // with a FreePanel VM. The friends move in once the panel VM is ready and every line it sells goes on the website.
  const s: GameState = startGame(seed);
  const first = (buyDevice(s, "g1-compute", "Dwell", 1, "loc1") as { id: string }).id;
  mountDevice(s, first, "rack2", 1);
  connect(s, { device: first, port: 0 }, { device: "dev5", port: 0 });
  const hv = (installSoftware(s, first, "proxmocks") as { id: string }).id;
  createPanelVm(s, hv, "freepanel");
  let bySource: Record<string, number> = {}, waitByKind: Record<string, number> = {}, stepErrors: Record<string, number> = {}, downHours: Record<string, number> = {};
  bumpProbe.fn = (_c, d) => {
    if (!d) return;
    const k = source(new Error().stack ?? "");
    bySource[k] = (bySource[k] ?? 0) + d;
  };
  const rows: Month[] = [];
  const doStep = (t: string, step: string, reference: number) =>
    step === "account" ? createAccount(s, t) : step === "invoice" ? confirmOrder(s, t, reference) : step === "domain" ? registerOrderDomain(s, t) : provisionOrder(s, t);
  // The model's steady capacity rule: another basement server once the cluster's RAM is 80% booked and cash allows.
  // Web hosting lives in panel VMs: one 80% full grows by 2 GB, or a new one starts next to it once its node is full.
  const growWeb = () => {
    for (const h of s.clusters.filter((x) => x.vm)) {
      const vm = vmById(s, h.vm)!, { cap, used } = vmRoom(s, h);
      if (used.ramGb < 0.8 * cap.ramGb && used.diskGb < 0.8 * cap.diskGb) continue;
      // A careful player grows the VM only within its server's installed RAM.
      const d = s.devices.find((x) => x.id === vm.deviceId)!, fits = nodeUsed(s, d.id).ramGb + 2 <= bookable(s, d, true).ramGb;
      if (!(fits && resizePanelVm(s, h.id, { vcpu: vm.vcpu + 1, ramGb: vm.ramGb + 2, diskGb: vm.diskGb + 50 }).ok) && h === s.clusters.filter((x) => x.vm).at(-1)) createPanelVm(s, s.clusters[0].id, h.panel!);
    }
  };
  // Servers whose Proxmocks finished installing join the first cluster in the hour it finishes.
  const joinReady = () => {
    const c = s.clusters[0];
    for (const x of s.clusters.filter((x) => x !== c && x.platform === c.platform && !x.switching && x.nodes.length === 1)) addNode(s, c.id, x.nodes[0].deviceId);
  };
  const grow = () => {
    growWeb();
    const c = s.clusters[0];
    const ram = (f: (id: string) => number) => c.nodes.reduce((n, x) => n + f(x.deviceId), 0);
    const booked = ram((id) => nodeUsed(s, id).ramGb) + controlPlaneUse(c).ramGb, installed = ram((id) => modelById(s.devices.find((d) => d.id === id)!.model).server!.ramGb);
    needServer = booked >= 0.8 * installed && c.nodes.length < BASEMENT_SLOTS;
    if (!needServer) return;
    // Short of cash: the smallest preset loan that covers the server and a reserve, over five years.
    const short = SERVER_PRICE + 2000 - s.cash, amount = LOAN_AMOUNTS.find((a) => a >= short);
    if (short > 0 && amount && amount <= loanAvailable(s)) takeLoan(s, amount, 5);
    if (s.cash < SERVER_PRICE + 2000) return;
    const bought = buyDevice(s, "g1-compute", "Dwell", 1, "loc1");
    if (!bought.ok) return;
    const id = bought.id!;
    for (let slot = 2; slot < 24 && !s.devices.find((d) => d.id === id)!.rackId; slot++) mountDevice(s, id, "rack2", slot);
    for (let port = 1; port < 4 && !connect(s, { device: id, port: 0 }, { device: "dev5", port }).ok; port++);
    if (installSoftware(s, id, "proxmocks").ok) servers++;
  };
  let servers = 0;
  const reached: Record<string, number> = {};
  // Product management then Marketing basics as know-how allows; web design and the order form once no server is due and
// cash keeps a reserve.
  let needServer = false;
  const learn = () => {
    const next = ["products", "marketingBasics"].find((id) => !s.unlocks.includes(id));
    if (next && !s.training) research(s, next);
    for (const c of ["website", "orderForm"] as const) if (!owns(s, c) && !needServer && s.cash >= OWNED[c].setup + 2000) setUpChannel(s, c);
    for (const k of ["products", "orderForm"]) if (!(k in reached) && (s.unlocks.includes(k) || owns(s, k as "orderForm"))) reached[k] = Math.round((10 * s.hour) / MONTH) / 10;
  };
  // The cheapest line with more upload this year, once the basement's evening peak reaches 90% of the line.
  const upgradeLine = () => {
    const up = homeLineById(s.homeLine.id).up;
    if (s.homeLine.next || homePeak(s) < 0.9 * up) return;
    const better = HOME_LINES.filter((l) => l.from <= yearOf(s.hour) && l.up > up).sort((a, b) => a.monthly - b.monthly)[0];
    if (better) orderHomeLine(s, better.id);
  };
  const room = (r: SalesRequest) => {
    const taken = s.sales.requests.filter((x) => x.kind === "order" && x.customerId && !x.serviceId && ["open", "quoted"].includes(x.status));
    const need = [...taken, r].map((x) => sizeOf(x.spec)).reduce((a, b) => ({ vcpu: a.vcpu + b.vcpu, ramGb: a.ramGb + b.ramGb, diskGb: a.diskGb + b.diskGb }));
    const free = s.clusters[0].nodes.map((n) => { const cap = bookable(s, s.devices.find((d) => d.id === n.deviceId)!, true), used = nodeUsed(s, n.deviceId); return { ramGb: cap.ramGb - used.ramGb, diskGb: cap.diskGb - used.diskGb }; });
    return free.reduce((n, f) => n + f.ramGb, 0) >= need.ramGb && free.reduce((n, f) => n + f.diskGb, 0) >= need.diskGb;
  };
  for (let m = 0; m < months; m++) {
    const churnedBefore = s.customers.filter((c) => c.churnedAt !== null && s.services.some((v) => v.customerId === c.id)).length, before = s.customers.length, lostBefore = s.sales.lost.length;
    for (let h = 0; h < MONTH; h++) {
      tick(s);
      joinReady();
      if (!s.marketing.lines.length && s.customers.some((c) => c.habit === "friend")) s.marketing.lines = fillLines(s, undefined).marketing.lines;
      if (buy && s.hour % 24 === 9) { grow(); upgradeLine(); }
      if (s.hour % 24 === 9) learn();
      if (s.hour % 24 === 9) for (const d of s.domains) if (d.expiresAt - s.hour < 7 * 24 && s.customers.some((c) => c.id === d.customerId && c.churnedAt === null)) renewDomain(s, d.name);
      for (const v of s.services) {
        if (v.endedAt !== null || isSuspended(s, v.customerId) || serviceOnline(s, v.id)) continue;
        const ws = workloadsOf(s, v.id), on = (f: (w: Workload) => boolean) => ws.some(f);
        const why = takenDown(s, v.id) ? "takedown" : domainDown(s, v) ? "domain" : on((w) => !!w.deviceId && s.frozen.includes(w.deviceId)) ? "frozen"
          : on((w) => !!w.deviceId && (s.security.offline.includes(w.deviceId) || s.security.hacked.includes(w.deviceId))) ? "security"
          : on((w) => sitesDown(s, w.clusterId ?? "")) ? "panelSecurity" : on((w) => !!s.clusters.find((c) => c.id === w.clusterId)?.switching) ? "switching"
          : on((w) => { const vm = vmOf(s, w); return !!vm && (vm.stopped || vm.busyUntil > s.hour); }) ? "vmBusy" : on((w) => { const vm = vmOf(s, w); return !!vm?.deviceId && s.frozen.includes(vm.deviceId); }) ? "vmFrozen"
          : on((w) => lostDisk(s, w)) ? "lostDisk" : on((w) => !!w.deviceId && !linkStatus(s, w.deviceId).online) ? "link" : on((w) => w.stopped || w.busyUntil > s.hour) ? "stopped" : "other";
        downHours[why] = (downHours[why] ?? 0) + 1;
      }
      // Mirrors the wait penalty in supportTick: open, overdue, on a counting hour.
      for (const t of s.tickets) {
        const c = s.customers.find((x) => x.id === t.customerId);
        if (!c || c.churnedAt !== null || t.notice || t.status !== "open" || s.hour <= t.dueAt || isFinal(t)) continue;
        const p = profileStats(c.profile);
        if (counts(p.reply.clock, s.hour)) waitByKind[t.kind] = (waitByKind[t.kind] ?? 0) - p.waitPenalty;
      }
      for (const t of s.tickets) {
        if (isFinal(t) || t.work) continue;
        if (t.kind === "order") {
          const r = orderOf(s, t);
          if (!r) continue;
          const step = nextStep(s, r);
          if (!step) continue;
          // A careful player declines an order the cluster cannot also fit after the orders already taken.
          if (step === "account" && !room(r)) { closeTicket(s, t.id); continue; }
          const error = stepError(s, t, step);
          if (error) { stepErrors[error] = (stepErrors[error] ?? 0) + 1; continue; }
          doStep(t.id, step, r.reference);
          continue;
        }
        if (t.status !== "open") continue;
        const tpl = rightTemplate(s, t);
        if (TEMPLATES[t.kind].includes(tpl)) replyTicket(s, t.id, tpl);
        else if (ACTION[t.kind]) resolveTicket(s, t.id, ACTION[t.kind]);
      }
      for (const r of s.sales.requests) {
        if (r.status !== "open" && r.status !== "countered") continue;
        if (r.kind === "order" || missingFor(s, r).length) continue;
        if (r.kind === "expansion" && r.spec) { if (upgrades) acceptUpgrade(s, r.id, r.counter ?? r.reference); continue; }
        quote(s, r.id, r.status === "countered" ? r.counter! : r.reference);
      }
    }
    const live = s.customers.filter((c) => c.churnedAt === null && activeServices(s.services, c.id).length > 0);
    rows.push({
      month: m + 1, live: live.length, mrr: Math.round(live.reduce((n, c) => n + monthlyValue(s.services, c.id), 0)),
      servers, cash: Math.round(s.cash), debt: Math.round(debt(s)), netWorth: Math.round(metrics(s).netWorth), level: metrics(s).level.level, knowHow: Math.round(s.knowHow), line: s.homeLine.id, happiness: Math.round(live.reduce((n, c) => n + c.happiness, 0) / Math.max(1, live.length)),
      churned: s.customers.filter((c) => c.churnedAt !== null && s.services.some((v) => v.customerId === c.id)).length - churnedBefore, won: s.customers.length - before, lost: Object.fromEntries(Object.entries(s.sales.lost.slice(lostBefore).reduce<Record<string, number>>((o, l) => ({ ...o, [l.reason]: (o[l.reason] ?? 0) + 1 }), {}))),
      bySource, waitByKind, stepErrors, downHours,
    });
    bySource = {}; waitByKind = {}; stepErrors = {}; downHours = {};
  }
  bumpProbe.fn = null;
  return { rows, s, reached };
}

const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => a[1] - b[1]).map(([k, v]) => [k, Math.round(v)]));

if (process.argv[1]?.endsWith("happiness.ts")) {
  const summary: string[] = [], total: Record<string, number> = {}, waits: Record<string, number> = {}, downs: Record<string, number> = {};
  let liveMonths = 0;
  for (let seed = lo; seed <= hi; seed++) {
    const { rows, reached } = play(seed, MONTHS, flags.has("--upgrades"), !flags.has("--no-buy"));
    if (!flags.has("--quiet")) {
      console.log(`\nseed ${seed}`);
      for (const r of rows) {
        console.log(`m${r.month} live ${r.live} mrr ${r.mrr} H ${r.happiness} L${r.level} new ${r.won} churned ${r.churned} cash ${r.cash} debt ${r.debt} worth ${r.netWorth} bought ${r.servers} line ${r.line} kh ${r.knowHow} lost ${JSON.stringify(r.lost)}`);
        console.log(`   src ${JSON.stringify(round(r.bySource))}`);
        console.log(`   wait ${JSON.stringify(round(r.waitByKind))} steps ${JSON.stringify(r.stepErrors)} down ${JSON.stringify(r.downHours)}`);
      }
    }
    for (const r of rows) {
      liveMonths += r.live;
      for (const [k, v] of Object.entries(r.bySource)) total[k] = (total[k] ?? 0) + v;
      for (const [k, v] of Object.entries(r.waitByKind)) waits[k] = (waits[k] ?? 0) + v;
      for (const [k, v] of Object.entries(r.downHours)) downs[k] = (downs[k] ?? 0) + v;
    }
    const at = (m: number) => rows[m - 1] ? `${rows[m - 1].live} €${rows[m - 1].mrr} H${rows[m - 1].happiness} L${rows[m - 1].level}` : "-";
    summary.push(`seed ${seed}: June ${at(6)} / December ${at(12)}${MONTHS >= 24 ? ` / Dec 2006 ${at(24)}` : ""} / Product management m${reached.products ?? "-"}, order form m${reached.orderForm ?? "-"}`);
  }
  const per = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => a[1] - b[1]).map(([k, v]) => [k, Math.round((10 * v) / Math.max(1, liveMonths)) / 10]));
  console.log(`\n${summary.join("\n")}`);
  console.log(`\nhappiness per live customer and month, by source: ${JSON.stringify(per(total))}`);
  console.log(`service hours down per live customer and month, by cause: ${JSON.stringify(per(downs))}`);
  console.log(`wait penalty per live customer and month, by ticket kind: ${JSON.stringify(per(waits))}`);
}
