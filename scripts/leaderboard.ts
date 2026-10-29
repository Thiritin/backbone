// Writes public/leaderboard.json from the output of scripts/replay.ts --json: npx tsx scripts/leaderboard.ts <verified.json>...
import { readFileSync, writeFileSync } from "node:fs";
import { buildLeaderboard, type Verified } from "../src/sim/92-run/run";

const runs = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as Verified[]);
writeFileSync("public/leaderboard.json", `${JSON.stringify(buildLeaderboard(runs))}\n`);
console.log(`${runs.length} runs`);
