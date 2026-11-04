// Pure helpers for cutting a release: tags, versions, notes and Discord chunks. No IO, so tests/release.test.ts covers them.
export const SITE = 'https://raid0.dev';
export const DISCORD_LIMIT = 2000;
export const FIRST_VERSION = '1.0.0';

const SEMVER = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const isReleaseTag = (tag) => SEMVER.test(tag);

/** "v1.2.3" to [1, 2, 3]. */
export const parseTag = (tag) => SEMVER.exec(tag).slice(1).map(Number);

const compare = (a, b) => {
  const [x, y] = [parseTag(a), parseTag(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

/** The highest strict vX.Y.Z tag; every other tag (such as the old date tags) is ignored. */
export const latestTag = (tags) => tags.filter(isReleaseTag).sort(compare).at(-1) ?? null;

/**
 * The tag a new release is cut as. `bump` is patch, minor, major or an explicit X.Y.Z. A raised major number needs
 * `approvedMajor`. Without any semver tag the only accepted version is the first one, 1.0.0.
 */
export function nextTag(tags, bump, approvedMajor = false) {
  const latest = latestTag(tags);
  if (!latest) {
    if (bump !== FIRST_VERSION) throw new Error(`No v*.*.* release exists yet. The first release must be cut as ${FIRST_VERSION}.`);
    return `v${FIRST_VERSION}`;
  }
  const [major, minor, patch] = parseTag(latest);
  let next;
  if (bump === 'patch') next = [major, minor, patch + 1];
  else if (bump === 'minor') next = [major, minor + 1, 0];
  else if (bump === 'major') next = [major + 1, 0, 0];
  else if (isReleaseTag(`v${bump}`)) next = parseTag(`v${bump}`);
  else throw new Error(`Bump must be patch, minor, major or X.Y.Z, got "${bump}".`);
  const tag = `v${next.join('.')}`;
  if (compare(tag, latest) <= 0) throw new Error(`${tag} is not newer than the latest release ${latest}.`);
  if (next[0] > major && !approvedMajor) {
    throw new Error(`${tag} raises the major version. Only the user may decide that: ask them, and pass --user-approved-major only when they explicitly asked for a major release in this conversation.`);
  }
  return tag;
}

/**
 * The release whose CHANGELOG.md the new notes are measured against: the highest semver release below `tag`, or when
 * there is none, the most recently published other release. `releases` is [{ tagName, publishedAt }].
 */
export function previousRelease(releases, tag) {
  const others = releases.filter((r) => r.tagName !== tag);
  const semver = others.map((r) => r.tagName).filter((t) => isReleaseTag(t) && (!isReleaseTag(tag) || compare(t, tag) < 0));
  if (semver.length) return latestTag(semver);
  return others.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]?.tagName ?? null;
}

/** [{ date, bullets }] in file order (newest first) from CHANGELOG.md text. */
export function parseDays(text) {
  const days = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) days.push({ date: line.slice(3).trim(), bullets: [] });
    else if (line.startsWith('- ') && days.length) days.at(-1).bullets.push(line.trimEnd());
  }
  return days;
}

/** Markdown for the bullets in `newText` that `oldText` (null for no baseline) lacks, grouped under their day, newest first. */
export function notesSince(oldText, newText) {
  const seen = new Set((oldText ? parseDays(oldText) : []).flatMap((d) => d.bullets.map((b) => `${d.date}|${b}`)));
  return parseDays(newText)
    .map((d) => ({ ...d, bullets: d.bullets.filter((b) => !seen.has(`${d.date}|${b}`)) }))
    .filter((d) => d.bullets.length)
    .map((d) => `## ${d.date}\n\n${d.bullets.join('\n')}`)
    .join('\n\n');
}

/** Discord messages for a release: a header with the version, then the notes split on line breaks below the size limit. */
export function discordChunks(tag, notes, limit = DISCORD_LIMIT) {
  const out = [];
  let cur = `# [raid0 ${tag.slice(1)}](${SITE})`;
  for (const line of notes.split('\n')) {
    if (cur.length + line.length + 1 > limit) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + line;
  }
  return [...out, cur];
}
