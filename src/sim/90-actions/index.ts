import type { GameState, LogEntry } from "../50-state";
import type { ActionResult } from "./hardware";
import * as addresses from "./addresses";
import * as billing from "./billing";
import * as changes from "./changes";
import * as checklist from "./checklist";
import * as clusters from "./clusters";
import * as company from "./company";
import * as customers from "./customers";
import * as docs from "./docs";
import * as finance from "./finance";
import * as hardware from "./hardware";
import * as mail from "./mail";
import * as maintenance from "./maintenance";
import * as market from "./market";
import * as marketing from "./marketing";
import * as moves from "./moves";
import * as network from "./network";
import * as orders from "./orders";
import * as rates from "./rates";
import * as registrar from "./registrar";
import * as remote from "./remote";
import * as routers from "./routers";
import * as sales from "./sales";
import * as security from "./security";
import * as software from "./software";
import * as staff from "./staff";
import * as start from "./start";
import * as store from "./store";
import * as support from "./support";
import * as used from "./used";
import * as vms from "./vms";
import * as website from "./website";

export type Action<A extends unknown[] = any[]> = (s: GameState, ...args: A) => ActionResult;
// An action and its arguments, for code that hands an action to the store without running it.
export type Call = [Action, ...unknown[]];
export type { LogEntry };
export const LOG_CAP = 50_000;

const modules = [addresses, billing, changes, checklist, clusters, company, customers, docs, finance, hardware, mail, maintenance, market, marketing, moves, network, orders, rates, registrar, remote, routers, sales, security, software, staff, start, store, support, used, vms, website];
// Every exported function of 90-actions by its name, so a replay can call the actions a run logged.
export const ACTIONS: Record<string, Action> = Object.fromEntries(modules.flatMap((m) => Object.entries(m).filter(([, f]) => typeof f === "function"))) as Record<string, Action>;
const NAMES = new Map<unknown, string>(Object.entries(ACTIONS).map(([k, f]) => [f, k]));

export const actionName = (fn: unknown): string | undefined => NAMES.get(fn);

// Runs a registered action with JSON copies of its arguments, the values a replay reads back, and logs it when it succeeds.
export function runAction(s: GameState, name: string, args: unknown[]): ActionResult {
  const fn = ACTIONS[name];
  if (!fn) throw new Error(`unknown action ${name}`);
  let n = args.length;
  while (n > 0 && args[n - 1] === undefined) n--;
  const json = JSON.stringify(args.slice(0, n));
  const r = fn(s, ...(JSON.parse(json) as unknown[]));
  if (r.ok && s.log.length < LOG_CAP) s.log.push({ hour: s.hour, name, args: JSON.parse(json) as unknown[] });
  return r;
}
