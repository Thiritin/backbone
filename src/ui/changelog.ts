// CHANGELOG.md is newest first: a "## YYYY-MM-DD" heading per day and one "- " bullet per change. The build embeds the
// parsed list; the update sheet shows the bullets a newer build has that this one does not.
export interface ChangelogDay { date: string; items: string[] }

export function parseChangelog(text: string): ChangelogDay[] {
  const days: ChangelogDay[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const head = /^## (\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (head) days.push({ date: head[1], items: [] });
    else if (line.startsWith("- ") && days.length > 0) days[days.length - 1].items.push(line.slice(2).trim());
  }
  return days;
}

// The bullets in the served changelog that the running build does not know, newest first, grouped by day.
export function newEntries(running: ChangelogDay[], served: ChangelogDay[]): ChangelogDay[] {
  const known = new Set(running.flatMap((d) => d.items.map((i) => `${d.date}|${i}`)));
  return served.map((d) => ({ date: d.date, items: d.items.filter((i) => !known.has(`${d.date}|${i}`)) })).filter((d) => d.items.length > 0);
}
