// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { formatClock, hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame } from "../src/sim/50-state";
import { runJob } from "../src/sim/60-infra/backups";
import { saveJob } from "../src/sim/90-actions/backups";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect } from "../src/sim/90-actions/hardware";
import { BackupManager } from "../src/ui/apps/browser/consoles/BackupManager";
import { PageError } from "../src/ui/apps/browser/pageAct";
import { useStore } from "../src/ui/store";
import { buyDevice, named, panelServer, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

afterEach(cleanup);
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

// A Pleskit host with two sites on release 2014, a backup server in the zone and one daily point.
function world() {
  const s = { ...withServer(newGame(3)), cash: 100_000 };
  const host = panelServer(s, "dev3", "pleskit");
  const box = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, box, "rack2", 2));
  ok(connect(s, { device: box, port: 0 }, { device: "dev4", port: 1 }));
  const store = named(s, panelServer(s, box, "backula"), "Backup 1");
  s.hour = hourOf(new Date(Date.UTC(2018, 0, 1)));
  for (const i of [0, 1]) ok(provisionService(s, addCustomer(s, `Customer ${i}`, "hobbyDev"), "webHosting", {
    label: `site${i}.de`, spec: { ...sizeSpec("webHosting", 0, 2005), app: "wordpass", appVersion: 2014, appUpdatedAt: hourOf(new Date(Date.UTC(2014, 0, 1))) }, clusterId: host,
  }));
  ok(saveJob(s, host, { targetId: store, every: "daily" }));
  const c = s.clusters.find((x) => x.id === host)!;
  runJob(s, c, c.jobs[0], []);
  const at = s.hour;
  s.hour += 1;
  useStore.setState({ game: s, speed: 0, alert: null });
  return { host, box, at };
}

function Page({ id }: { id: string }) {
  const game = useStore((x) => x.game), [error, setError] = useState<string | null>(null);
  return (
    <PageError.Provider value={setError}>
      {error && <p role="alert">{t(error)}</p>}
      <BackupManager game={game} c={game.clusters.find((x) => x.id === id)!} />
    </PageError.Provider>
  );
}

const row = (text: string) => screen.getByText(text).closest("tr")!;
const game = () => useStore.getState().game;

describe("panel Backup Manager", () => {
  it("lists one full backup per point hour and opens it to the sites it holds", () => {
    const { host, at } = world();
    render(<Page id={host} />);
    const line = row(formatClock(at));
    expect(line.textContent).toContain("Full");
    expect(line.textContent).toContain("OK");
    fireEvent.click(screen.getByText(formatClock(at)));
    expect(row("site0.de").textContent).toContain("WordPass 2014");
    expect(row("site1.de")).toBeTruthy();
  });

  it("restores a site, shows it restoring and blocks other restores on the host", () => {
    const { host, at } = world();
    render(<Page id={host} />);
    fireEvent.click(screen.getByText(formatClock(at)));
    fireEvent.click(within(row("site0.de")).getByRole("button", { name: "Restore" }));
    const id = game().services.find((v) => v.domain === "site0.de")!.id;
    expect(game().webpanel.restoring[id]).toBeDefined();
    expect(row("site0.de").textContent).toMatch(/Restoring \(\d+ h left\)/);
    expect(within(row("site1.de")).getByRole("button", { name: "Restore" })).toHaveProperty("disabled", true);
  });

  it("refuses a restore while the backup server is halted and shows it halted", () => {
    const { host, box, at } = world();
    useStore.setState({ game: { ...game(), devices: game().devices.map((d) => (d.id === box ? { ...d, on: false } : d)) } });
    render(<Page id={host} />);
    fireEvent.click(screen.getByText(formatClock(at)));
    fireEvent.click(within(row("site0.de")).getByRole("button", { name: "Restore" }));
    expect(screen.getByRole("alert").textContent).toBe(t("error.backupStoreOffline"));
    expect(Object.keys(game().webpanel.restoring)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Remote Storage Settings" }));
    expect(row("Backup 1").textContent).toContain("Halted");
  });

  it("saves the schedule settings to the host's job", () => {
    const { host } = world();
    render(<Page id={host} />);
    fireEvent.click(screen.getByRole("button", { name: "Scheduled Backup Settings" }));
    fireEvent.change(screen.getByLabelText("Run this backup task"), { target: { value: "weekly" } });
    fireEvent.change(screen.getByLabelText("Time of day"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Maximum number of backups to store"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    const job = game().clusters.find((x) => x.id === host)!.jobs[0];
    expect([job.every, job.hour, job.keep.last]).toEqual(["weekly", 5, 7]);
    expect(screen.getByRole("button", { name: "Back Up" })).toBeTruthy();
  });

  it("backs up now into a new list row", () => {
    const { host, at } = world();
    render(<Page id={host} />);
    fireEvent.click(screen.getByRole("button", { name: "Back Up" }));
    expect(row(formatClock(at + 1))).toBeTruthy();
  });
});
