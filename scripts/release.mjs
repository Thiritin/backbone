// Cuts a release: checks the preconditions, picks the next version and creates the GitHub release that starts
// .github/workflows/release.yml. The full procedure is in docs/release.md.
//   npm run release -- <patch|minor|major|X.Y.Z> [--dry] [--user-approved-major] [--notes-file <path>]
// --dry runs every check and prints the version and notes without creating anything.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nextTag } from './release-lib.mjs';
import { releaseNotes } from './release-notes.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const bump = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--notes-file');
const notesFile = flag('--notes-file') ? args[args.indexOf('--notes-file') + 1] : null;
const dry = flag('--dry');

const sh = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
const problems = [];
const need = (ok, message) => { if (!ok) problems.push(message); };
const fail = (message) => { console.error(message); process.exit(1); };

if (!bump) fail('Usage: npm run release -- <patch|minor|major|X.Y.Z> [--dry] [--user-approved-major] [--notes-file <path>]');

sh('git', ['fetch', 'origin', 'main', '--tags', '--force']);
need(sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']) === 'main', 'Check out main.');
need(sh('git', ['status', '--porcelain']) === '', 'The working tree has uncommitted changes.');
need(sh('git', ['rev-parse', 'HEAD']) === sh('git', ['rev-parse', 'origin/main']), 'main differs from origin/main. Pull or push first.');

let tag;
let notes;
try {
  tag = nextTag(sh('git', ['tag', '--list', 'v*']).split('\n').filter(Boolean), bump, flag('--user-approved-major'));
  notes = notesFile ? readFileSync(notesFile, 'utf8').trim() : releaseNotes(tag);
  need(notes !== '', 'The notes file is empty.');
} catch (e) {
  problems.push(e.message);
}

if (!problems.length) {
  for (const script of ['typecheck', 'test']) {
    try { execFileSync('npm', ['run', script], { stdio: 'ignore' }); } catch { problems.push(`npm run ${script} fails.`); }
  }
}

if (tag && notes) console.log(`Release ${tag} from ${sh('git', ['rev-parse', '--short', 'HEAD'])}\n\n${notes}\n`);
if (problems.length) fail(`Not ready to release:\n${problems.map((p) => `- ${p}`).join('\n')}`);
if (dry) process.exit(0);

const file = join(mkdtempSync(join(tmpdir(), 'release-')), 'notes.md');
writeFileSync(file, `${notes}\n`);
execFileSync('gh', ['release', 'create', tag, '--target', sh('git', ['rev-parse', 'HEAD']), '--title', `raid0 ${tag.slice(1)}`, '--notes-file', file], { stdio: 'inherit' });
console.log(`\nCreated ${tag}. Watch the run with: gh run watch $(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')`);
