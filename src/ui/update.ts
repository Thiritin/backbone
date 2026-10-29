// Offers a reload when the deployed build changes: the page polls version.json (written by the build) and compares its id.
declare const __BUILD_ID__: string;

export const POLL_MS = 5 * 60 * 1000;
export const SNOOZE_MS = 60 * 60 * 1000;

// Whether to show the offer: the served build differs and the player has not put it off within the last hour.
export const shouldOffer = (current: string, served: string | null, dismissedAt: number | null, now: number): boolean =>
  !!served && served !== current && (dismissedAt === null || now - dismissedAt >= SNOOZE_MS);

async function servedBuild(): Promise<string | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as { build?: string };
    return typeof data.build === "string" ? data.build : null;
  } catch {
    return null;
  }
}

// Polls every five minutes and when the tab regains focus; the dev server never offers. Returns a stop function.
export function watchUpdates(onUpdate: () => void, dismissedAt: () => number | null): () => void {
  if (import.meta.env.DEV) return () => {};
  const check = async () => {
    if (shouldOffer(__BUILD_ID__, await servedBuild(), dismissedAt(), Date.now())) onUpdate();
  };
  const timer = window.setInterval(check, POLL_MS);
  const focus = () => void check();
  window.addEventListener("focus", focus);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", focus);
  };
}
