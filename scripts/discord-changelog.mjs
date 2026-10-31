// Publishes CHANGELOG.md bullets: one GitHub release per day (tag 2026.10.31) and a post to the Discord #changelog channel.
// node scripts/discord-changelog.mjs --all          every day, oldest first
// node scripts/discord-changelog.mjs --since <rev>  only bullets added after <rev>
// --dry prints nothing to Discord and creates no release.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const webhook = process.env.DISCORD_CHANGELOG_WEBHOOK;
if (!webhook && !dry) throw new Error('DISCORD_CHANGELOG_WEBHOOK missing');
const LIMIT = 2000;

function parse(text) {
  const days = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) days.push({ date: line.slice(3).trim(), bullets: [] });
    else if (line.startsWith('- ') && days.length) days.at(-1).bullets.push(line);
  }
  return days;
}

const rev = args[args.indexOf('--since') + 1];
const all = parse(readFileSync('CHANGELOG.md', 'utf8'));
let days = all;
let announced = new Set();
if (args.includes('--since')) {
  // An unknown base (new branch, force push) would repost everything, so post nothing.
  let old;
  try { old = execFileSync('git', ['show', `${rev}:CHANGELOG.md`], { encoding: 'utf8' }); } catch {
    console.log(`No CHANGELOG.md at ${rev}, nothing posted`);
    process.exit(0);
  }
  const before = parse(old);
  const seen = new Set(before.flatMap((d) => d.bullets));
  // A day that already had bullets was announced, so its header is not sent again.
  announced = new Set(before.filter((d) => d.bullets.length).map((d) => d.date));
  days = days.map((d) => ({ ...d, bullets: d.bullets.filter((b) => !seen.has(b)) }));
} else if (!args.includes('--all')) {
  throw new Error('Pass --all or --since <rev>');
}
days = days.filter((d) => d.bullets.length).reverse();

const version = (day) => day.date.replaceAll('-', '.');

function chunks(day) {
  const out = [];
  let cur = announced.has(day.date) ? '' : `## Version ${version(day)}`;
  for (const b of day.bullets) {
    if (cur.length + b.length + 1 > LIMIT) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + b;
  }
  return [...out, cur];
}

// One release per day: created with the day's first bullets, its notes rewritten as more land.
function release(day) {
  const tag = version(day);
  const notes = all.find((d) => d.date === day.date).bullets.join('\n');
  let exists = true;
  try { execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' }); } catch { exists = false; }
  const cmd = exists ? ['edit', tag] : ['create', tag, '--target', process.env.GITHUB_SHA ?? 'main', '--title', tag];
  execFileSync('gh', ['release', ...cmd, '--notes', notes], { stdio: 'inherit' });
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

if (!dry) {
  for (const day of days) {
    release(day);
    for (const c of chunks(day)) await post(c);
  }
}
console.log(`${dry ? 'Would post' : 'Posted'} ${days.reduce((n, d) => n + d.bullets.length, 0)} bullets over ${days.length} days`);
