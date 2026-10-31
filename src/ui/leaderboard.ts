import { useEffect, useState } from "react";
import { t } from "../i18n/en";
import { euro } from "../sim/00-core/money";
import type { Twist } from "../sim/10-catalog/challenges";
import { datacenterById, homeLineById } from "../sim/20-world/datacenters";
import type { Board, Leaderboard } from "../sim/92-run/run";

declare const __BUILD_ID__: string;
export const BUILD_ID = __BUILD_ID__;

// leaderboard.json is published with the site by .github/workflows/leaderboard.yml; it loads once per page.
let loading: Promise<Leaderboard> | null = null;
const load = () => (loading ??= fetch(`${import.meta.env.BASE_URL}leaderboard.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

// This build's board for a challenge, null until it has loaded or when it has no runs.
export function useBoard(challenge: string | null): Board | null {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  useEffect(() => {
    let live = true;
    load().then((b) => live && setBoard(b));
    return () => { live = false; };
  }, []);
  const b = challenge ? board?.[BUILD_ID]?.[challenge] : undefined;
  return b && b.netWorth.length + b.level3.length + b.happiness.length > 0 ? b : null;
}

export const twistLabel = (w: Twist): string =>
  w.kind === "line" ? t("core.twistLine", { name: homeLineById(w.line).name }) : w.kind === "dc" ? t("core.twistDc", { name: datacenterById(w.dc).name }) : t("core.twistCash", { cash: euro(w.cash) });
