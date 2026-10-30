// Posts CHANGELOG.md bullets to the Discord #changelog channel via webhook.
// node scripts/discord-changelog.mjs --all          every day, oldest first
// node scripts/discord-changelog.mjs --since <rev>  only bullets added after <rev>
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const webhook = process.env.DISCORD_CHANGELOG_WEBHOOK;
if (!webhook) throw new Error('DISCORD_CHANGELOG_WEBHOOK missing');
const LIMIT = 2000;

function parse(text) {
  const days = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) days.push({ date: line.slice(3).trim(), bullets: [] });
    else if (line.startsWith('- ') && days.length) days.at(-1).bullets.push(line);
  }
  return days;
}

const [mode, rev] = process.argv.slice(2);
let days = parse(readFileSync('CHANGELOG.md', 'utf8'));
if (mode === '--since') {
  // An unknown base (new branch, force push) would repost everything, so post nothing.
  let old;
  try { old = execFileSync('git', ['show', `${rev}:CHANGELOG.md`], { encoding: 'utf8' }); } catch {
    console.log(`No CHANGELOG.md at ${rev}, nothing posted`);
    process.exit(0);
  }
  const seen = new Set(parse(old).flatMap((d) => d.bullets));
  days = days.map((d) => ({ ...d, bullets: d.bullets.filter((b) => !seen.has(b)) }));
} else if (mode !== '--all') {
  throw new Error('Pass --all or --since <rev>');
}
days = days.filter((d) => d.bullets.length).reverse();

function chunks(day) {
  const out = [];
  let cur = `## ${day.date}`;
  for (const b of day.bullets) {
    if (cur.length + b.length + 1 > LIMIT) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + b;
  }
  return [...out, cur];
}

async function post(content) {
  for (;;) {
    const res = await fetch(`${webhook}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (res.status === 429) {
      const { retry_after } = await res.json();
      await new Promise((r) => setTimeout(r, retry_after * 1000 + 100));
      continue;
    }
    if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
    return;
  }
}

for (const day of days) for (const c of chunks(day)) await post(c);
console.log(`Posted ${days.reduce((n, d) => n + d.bullets.length, 0)} bullets over ${days.length} days`);
