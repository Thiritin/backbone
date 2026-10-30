import { useEffect, useState } from "react";
import { create } from "zustand";
import type { ServerOsId } from "../sim/10-catalog/server-os";
import { downloadImage, downloadMbps, IMAGE_MB } from "../sim/90-actions/media";
import { useStore } from "./store";

// ISO downloads run in real time at the line speed they started at; a page reload drops the ones still running.
interface Download { start: number; secs: number }
export const useDownloads = create<Partial<Record<ServerOsId, Download>>>(() => ({}));

let timer: ReturnType<typeof setInterval> | undefined;

export function startDownload(id: ServerOsId): void {
  const mbps = downloadMbps(useStore.getState().game);
  if (!mbps || useDownloads.getState()[id]) return;
  useDownloads.setState({ [id]: { start: performance.now(), secs: (IMAGE_MB[id] * 8) / mbps } });
  timer ??= setInterval(() => {
    const now = performance.now(), all = useDownloads.getState();
    for (const [osId, d] of Object.entries(all) as [ServerOsId, Download][]) {
      if (!d || now - d.start < d.secs * 1000) continue;
      useDownloads.setState({ [osId]: undefined });
      useStore.getState().act(downloadImage, osId);
    }
    if (!Object.values(useDownloads.getState()).some(Boolean)) {
      clearInterval(timer);
      timer = undefined;
    }
  }, 250);
}

// The share of the download done, from 0 to 1, refreshed while it runs.
export function useProgress(id: ServerOsId): number | null {
  const d = useDownloads((s) => s[id]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!d) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [d]);
  return d ? Math.min(1, (performance.now() - d.start) / (d.secs * 1000)) : null;
}
