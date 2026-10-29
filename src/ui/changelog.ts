// CHANGELOG.md is newest first: a "## YYYY-MM-DD" heading per day and one "- " bullet per change. The build embeds the
// parsed list; the update sheet shows the bullets a newer build has that this one does not.
// version counts the days from the oldest, so a new day never renumbers the ones before it.
export interface ChangelogDay { date: string; items: string[]; version?: number }

export const changeKeys = (days: ChangelogDay[]): string[] => days.flatMap((d) => d.items.map((i) => `${d.date}|${i}`));

export function parseChangelog(text: string): ChangelogDay[] {
  const days: ChangelogDay[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const head = /^## (\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (head) days.push({ date: head[1], items: [] });
    else if (line.startsWith("- ") && days.length > 0) days[days.length - 1].items.push(line.slice(2).trim());
  }
  return days.map((d, i) => ({ ...d, version: days.length - i }));
}

// The bullets in the served changelog that the key list does not hold, newest first, grouped by day.
export function unseenChanges(seen: string[], served: ChangelogDay[]): ChangelogDay[] {
  const known = new Set(seen);
  return served.map((d) => ({ ...d, items: d.items.filter((i) => !known.has(`${d.date}|${i}`)) })).filter((d) => d.items.length > 0);
}

// The bullets in the served changelog that the running build does not know.
export const newEntries = (running: ChangelogDay[], served: ChangelogDay[]): ChangelogDay[] => unseenChanges(changeKeys(running), served);
