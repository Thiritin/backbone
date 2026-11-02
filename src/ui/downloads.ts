import { create } from "zustand";
import { archiveNamed } from "../sim/10-catalog/archives";
import { imageExists, imageParts } from "../sim/10-catalog/server-os";
import { nowHours } from "../sim/00-core/time";
import { downloadArchive, downloadedFiles, downloadImage, downloadMbps, IMAGE_MB, transferHours, uploadMbps } from "../sim/90-actions/media";
import type { ActionResult } from "../sim/90-actions/hardware";
import { checkUpload, uploadFile } from "../sim/90-actions/webspace-files";
import { useStore } from "./store";

// Downloads (ISO images and archives) and uploads into a web space run in game time at the line speed they started at;
// a page reload drops the ones still running.
interface Transfer { start: number; hours: number }
interface Upload extends Transfer { workloadId: string; folder: string; file: string; overwrite: boolean }
export const useDownloads = create<Partial<Record<string, Transfer>>>(() => ({}));
export const useUploads = create<Partial<Record<string, Upload>>>(() => ({}));

let timer: ReturnType<typeof setInterval> | undefined;
const done = (d: Transfer, now: number) => now - d.start >= d.hours;

function tick(): void {
  const now = nowHours(useStore.getState().game), act = useStore.getState().act;
  for (const [id, d] of Object.entries(useDownloads.getState())) {
    if (!d || !done(d, now)) continue;
    useDownloads.setState({ [id]: undefined });
    if (imageExists(id)) act(downloadImage, id);
    else act(downloadArchive, id);
  }
  for (const [key, u] of Object.entries(useUploads.getState())) {
    if (!u || !done(u, now)) continue;
    useUploads.setState({ [key]: undefined });
    act(uploadFile, u.workloadId, u.folder, u.file, u.overwrite);
  }
  if (![...Object.values(useDownloads.getState()), ...Object.values(useUploads.getState())].some(Boolean)) {
    clearInterval(timer);
    timer = undefined;
  }
}
const run = () => { timer ??= setInterval(tick, 250); };

// Starts downloading an OS image (as "lunix@12") or an archive by its file name (10-catalog/archives.ts).
export function startDownload(id: string): void {
  const game = useStore.getState().game, mbps = downloadMbps(game);
  const mb = imageExists(id) ? IMAGE_MB[imageParts(id).id] : archiveNamed(id)?.mb;
  if (!mbps || !mb || useDownloads.getState()[id]) return;
  useDownloads.setState({ [id]: { start: nowHours(game), hours: transferHours(mb, mbps) } });
  run();
}

// Starts uploading a file from Downloads into a folder of the web space; the result says why it cannot start.
export function startUpload(workloadId: string, folder: string, file: string, overwrite: boolean): ActionResult {
  const game = useStore.getState().game, r = checkUpload(game, workloadId, folder, file, overwrite), mbps = uploadMbps(game);
  if (!r.ok) return r;
  if (!mbps) return { ok: false, error: "webspace.error.noLine" };
  const key = `${workloadId}:${r.id}`, mb = downloadedFiles(game).find((x) => x.id === file)!.mb;
  if (!useUploads.getState()[key]) useUploads.setState({ [key]: { start: nowHours(game), hours: transferHours(mb, mbps), workloadId, folder, file, overwrite } });
  run();
  return r;
}

const share = (d: Transfer | undefined, now: number): number | null => (d ? Math.min(1, (now - d.start) / d.hours) : null);

// The share of the download done, from 0 to 1, moving with game time.
export function useProgress(id: string): number | null {
  const d = useDownloads((s) => s[id]);
  const now = useStore((s) => nowHours(s.game));
  return share(d, now);
}

// Uploads into the web space still running, by target path, with the share done.
export function useUploadsInto(workloadId: string): [path: string, share: number][] {
  const all = useUploads(), now = useStore((s) => nowHours(s.game));
  return Object.entries(all).filter(([k, u]) => u && k.startsWith(`${workloadId}:`)).map(([k, u]) => [k.slice(workloadId.length + 1), share(u, now)!]);
}
