// Posts CHANGELOG.md bullets to the Discord #changelog channel via webhook, headed by the release version.
// node scripts/discord-changelog.mjs --all          every day, oldest first
// node scripts/discord-changelog.mjs --since <rev>  only bullets added after <rev> (a release tag)
// --version <v> adds a version heading, --notes <file> writes the GitHub release body, --dry skips Discord.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
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

const rev = opt('--since');
let days = parse(readFileSync('CHANGELOG.md', 'utf8'));
if (rev !== undefined) {
  // No base (the first release) posts everything.
  let old = '';
  if (rev) try { old = execFileSync('git', ['show', `${rev}:CHANGELOG.md`], { encoding: 'utf8' }); } catch {}
  const seen = new Set(parse(old).flatMap((d) => d.bullets));
  days = days.map((d) => ({ ...d, bullets: d.bullets.filter((b) => !seen.has(b)) }));
} else if (!args.includes('--all')) {
  throw new Error('Pass --all or --since <rev>');
}
days = days.filter((d) => d.bullets.length).reverse();
if (!days.length) { console.error('No new changelog bullets since the last release'); process.exit(1); }

const version = opt('--version');
const notes = [...days].reverse().map((d) => `## ${d.date}\n${d.bullets.join('\n')}`).join('\n\n');
if (opt('--notes')) writeFileSync(opt('--notes'), notes + '\n');

function chunks(day, head = '') {
  const out = [];
  let cur = `${head}## ${day.date}`;
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

if (!dry) {
  for (const [i, day] of days.entries()) for (const c of chunks(day, i === 0 && version ? `# Version ${version}\n` : '')) await post(c);
}
console.log(`${dry ? 'Prepared' : 'Posted'} ${days.reduce((n, d) => n + d.bullets.length, 0)} bullets over ${days.length} days`);
