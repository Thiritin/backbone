// Replays run files and checks the scores they claim: npx tsx scripts/replay.ts [--json] <run.json>...
// Exits with 1 when a run fails to replay or a claimed score differs; --json prints the verified runs for scripts/leaderboard.ts.
import { readFileSync } from "node:fs";
import { dateOf } from "../src/sim/00-core/time";
import { verify, type RunFile, type Verified } from "../src/sim/92-run/run";

const args = process.argv.slice(2);
const json = args.includes("--json");
const files = args.filter((a) => a !== "--json");
if (!files.length) {
  console.error("usage: npx tsx scripts/replay.ts [--json] <run.json>...");
  process.exit(2);
}

const day = (hour: number | null) => (hour === null ? "never" : dateOf(hour).toISOString().slice(0, 10));
const verified: Verified[] = [];
let failed = 0;
for (const f of files) {
  try {
    const { verified: v, errors } = verify(JSON.parse(readFileSync(f, "utf8")) as RunFile);
    if (errors.length) throw new Error(errors.join("; "));
    verified.push(v);
    if (!json) console.log(`${f}: ok, ${v.company.name}, net worth ${v.scores.netWorth ?? "none"}, level 3 ${day(v.scores.level3)}, happiness ${v.scores.happiness ?? "none"}`);
  } catch (e) {
    failed++;
    console.error(`${f}: ${(e as Error).message}`);
  }
}
if (json) console.log(JSON.stringify(verified));
process.exit(failed ? 1 : 0);
