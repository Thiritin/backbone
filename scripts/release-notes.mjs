// Release notes and the Discord post, run by .github/workflows/release.yml and scripts/release.mjs.
//   node scripts/release-notes.mjs check <tag>            fails unless the tag is vX.Y.Z
//   node scripts/release-notes.mjs notes <tag>            prints the CHANGELOG.md bullets added since the previous release
//   node scripts/release-notes.mjs discord <tag> [--dry]  posts the release body to Discord once; --dry prints instead
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { discordChunks, isReleaseTag, notesSince, previousRelease } from './release-lib.mjs';

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

/** The bullets of CHANGELOG.md in the working tree that the previous published release lacks. Throws when there are none. */
export function releaseNotes(tag) {
  const releases = JSON.parse(run('gh', ['release', 'list', '--json', 'tagName,publishedAt,isDraft', '--limit', '100'])).filter((r) => !r.isDraft);
  const prev = previousRelease(releases, tag);
  const old = prev ? run('git', ['show', `${prev}:CHANGELOG.md`]) : null;
  const notes = notesSince(old, readFileSync('CHANGELOG.md', 'utf8'));
  if (!notes) throw new Error(`CHANGELOG.md has no bullets added since ${prev ?? 'the start'}. Add bullets on main before cutting a release.`);
  return notes;
}

async function post(webhook, content) {
  for (;;) {
    const res = await fetch(`${webhook}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, username: 'raid0', allowed_mentions: { parse: [] } }),
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

// The marker asset makes a re-run of the workflow skip a post that already went out.
const MARKER = 'discord-posted.txt';

async function discord(tag, dry) {
  const rel = JSON.parse(run('gh', ['release', 'view', tag, '--json', 'body,assets']));
  const chunks = discordChunks(tag, rel.body.replaceAll('\r', '').trim());
  if (dry) return console.log(chunks.join('\n-----\n'));
  if (rel.assets.some((a) => a.name === MARKER)) return console.log(`${tag} was already posted`);
  const webhook = process.env.DISCORD_CHANGELOG_WEBHOOK;
  if (!webhook) throw new Error('DISCORD_CHANGELOG_WEBHOOK missing');
  for (const c of chunks) await post(webhook, c);
  const file = `${process.env.RUNNER_TEMP ?? '.'}/${MARKER}`;
  writeFileSync(file, new Date().toISOString());
  run('gh', ['release', 'upload', tag, file, '--clobber']);
  console.log(`Posted ${tag} in ${chunks.length} messages`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, tag, ...flags] = process.argv.slice(2);
  try {
    if (!isReleaseTag(tag ?? '')) throw new Error(`"${tag}" is not a release tag. Use vX.Y.Z, for example v1.0.0.`);
    if (cmd === 'notes') console.log(releaseNotes(tag));
    else if (cmd === 'discord') await discord(tag, flags.includes('--dry'));
    else if (cmd !== 'check') throw new Error('Usage: release-notes.mjs check|notes|discord <tag> [--dry]');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
