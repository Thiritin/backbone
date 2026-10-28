import { run, SOLO, STEADY, type RunResult } from "../src/sim/balance/model";
import { PACING_YEAR } from "../src/sim/10-catalog/economy";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

for (const bot of [STEADY, SOLO]) {
  const runs: RunResult[] = SEEDS.map((s) => run(bot, s));
  console.log(`\n${bot.name}: ${runs.filter((r) => r.bankrupt).length} of ${runs.length} bankrupt`);
  console.log("year  level  customers        MRR   lowest cash  staff");
  runs[0].rows.forEach((_, y) => {
    const col = (f: (r: RunResult) => number) => median(runs.map((r) => (r.rows[y] ? f(r) : NaN)).filter((v) => !Number.isNaN(v)));
    const row = runs[0].rows[y];
    console.log(
      `${row.year}  ${String(col((r) => r.rows[y].level)).padStart(5)}  ${String(col((r) => r.rows[y].customers)).padStart(9)}  ${String(col((r) => r.rows[y].mrr)).padStart(9)}  ${String(col((r) => r.rows[y].minCash)).padStart(12)}  ${String(col((r) => r.rows[y].staff)).padStart(5)}`,
    );
  });
  console.log("level  target  median year reached");
  for (const lv of [2, 3, 4, 5, 6]) {
    const ys = runs.map((r) => r.levelYear[lv] ?? Infinity);
    const m = median(ys);
    console.log(`${lv}      ${PACING_YEAR[lv]}    ${Number.isFinite(m) ? m.toFixed(1) : "never"}`);
  }
}
