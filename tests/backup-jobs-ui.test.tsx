import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { runBackups } from "../src/sim/60-infra/backups";
import { saveJob } from "../src/sim/90-actions/backups";
import { connect } from "../src/sim/90-actions/hardware";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { Calendar, JobsPanel, PointsPanel } from "../src/ui/apps/browser/consoles/backup/Jobs";
import { buyDevice, named, panelServer, readyGame } from "./fixtures";
import { mountDevice } from "./plugged";

function setup() {
  const s = readyGame(7);
  s.cash = 100_000;
  const r = buyDevice(s, "g1-compute", "Dwell", 1, "loc1") as { id: string };
  const third = r.id;
  mountDevice(s, third, "rack2", 3);
  connect(s, { device: third, port: 0 }, { device: "dev4", port: 2 });
  const target = named(s, panelServer(s, third, "backula"), "Backup 1");
  const src = s.clusters[0].id;
  saveJob(s, src, { targetId: target, every: "daily", name: "Nightly" });
  while (s.hour % 24 !== 2) s.hour++;
  runBackups(s, []);
  return { s, src, target };
}

describe("backup job screens", () => {
  it("list the jobs in the Proxmocks tab and the backup console, with points and the calendar", () => {
    const { s, src, target } = setup();
    const c = s.clusters.find((x) => x.id === src)!, t = s.clusters.find((x) => x.id === target)!;
    expect(renderToString(<JobsPanel game={s} source={c} skin="proxmocks" />)).toContain("Nightly");
    expect(renderToString(<JobsPanel game={s} target={t} skin="backula" />)).toContain(c.name);
    const w = s.workloads.find((x) => x.clusterId === src && x.points?.length)!;
    const pts = renderToString(<PointsPanel game={s} c={c} w={w} />);
    expect(pts).toContain("Nightly");
    expect(pts).toContain("Test restore");
    expect(pts).toContain("Not tested");
    expect(renderToString(<Calendar game={s} target={t} />)).toContain('data-has="true"');
    const View = CONSOLES.backula;
    expect(renderToString(<View game={s} c={t} f={consoleFeatures("backula", yearOf(s.hour))} host="b.example.com" signedIn login={() => {}} logout={() => {}} />)).toContain("Nightly");
  });
});
