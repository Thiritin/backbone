// Which changelog versions the player has read. The first visit records the newest version as the baseline, so only later versions count as new.
export interface Seen { base: number; read: number[] }

const COOKIE = "raid0_news";
const OLD_COOKIE = "backbone_news";
const cookie = (name: string) => document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

export const isNew = (seen: Seen, version: number): boolean => version > seen.base && !seen.read.includes(version);

export const markRead = (seen: Seen, version: number): Seen => (seen.read.includes(version) ? seen : { ...seen, read: [...seen.read, version] });

export function loadSeen(latest: number): Seen {
  try {
    const raw = cookie(COOKIE) ?? cookie(OLD_COOKIE);
    if (raw) return JSON.parse(decodeURIComponent(raw)) as Seen;
  } catch {
    // An unreadable cookie counts as a first visit.
  }
  const first = { base: latest, read: [] };
  saveSeen(first);
  return first;
}

export function saveSeen(seen: Seen) {
  try {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(seen))}; max-age=31536000; path=/; SameSite=Lax`;
  } catch {
    // Cookies blocked: the badges just come back next visit.
  }
}
