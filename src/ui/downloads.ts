import { create } from "zustand";
import { imageParts, type OsImage } from "../sim/10-catalog/server-os";
import { MS_PER_HOUR, nowHours } from "../sim/00-core/time";
import { downloadImage, downloadMbps, IMAGE_MB } from "../sim/90-actions/media";
import { useStore } from "./store";

// ISO downloads run in game time at the line speed they started at; a page reload drops the ones still running.
interface Download { start: number; hours: number }
export const useDownloads = create<Partial<Record<OsImage, Download>>>(() => ({}));

let timer: ReturnType<typeof setInterval> | undefined;

export function startDownload(id: OsImage): void {
  const mbps = downloadMbps(useStore.getState().game);
  if (!mbps || useDownloads.getState()[id]) return;
  useDownloads.setState({ [id]: { start: nowHours(useStore.getState().game), hours: ((IMAGE_MB[imageParts(id).id] * 8) / mbps) * 1000 / MS_PER_HOUR } });
  timer ??= setInterval(() => {
    const now = nowHours(useStore.getState().game), all = useDownloads.getState();
    for (const [osId, d] of Object.entries(all) as [OsImage, Download][]) {
      if (!d || now - d.start < d.hours) continue;
      useDownloads.setState({ [osId]: undefined });
      useStore.getState().act(downloadImage, osId);
    }
    if (!Object.values(useDownloads.getState()).some(Boolean)) {
      clearInterval(timer);
      timer = undefined;
    }
  }, 250);
}

// The share of the download done, from 0 to 1, moving with game time.
export function useProgress(id: OsImage): number | null {
  const d = useDownloads((s) => s[id]);
  const now = useStore((s) => nowHours(s.game));
  return d ? Math.min(1, (now - d.start) / d.hours) : null;
}
