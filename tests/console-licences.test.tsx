// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { yearOf } from "../src/sim/00-core/time";
import type { GameState } from "../src/sim/50-state";
import { assignedKey, panelMachine, panelStatus } from "../src/sim/60-infra/licence";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { tick } from "../src/sim/88-tick/tick";
import { activateLicence, removeLicence } from "../src/sim/90-actions/licence";
import { ConsolePage } from "../src/ui/apps/browser/consoles/ConsolePage";
import { LicenceFacts } from "../src/ui/apps/browser/consoles/HostSettings";
import { NodeList } from "../src/ui/apps/browser/consoles/HypervisorBase";
import { KeyEntry } from "../src/ui/apps/browser/consoles/Readouts";
import { Licensing } from "../src/ui/apps/browser/consoles/vmwhere/Admin";
import { useStore } from "../src/ui/store";
import { buyKey, hypervisor, newGame, skipTo, withServer } from "./fixtures";

const HOST = "vcenter.example.com";
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

// A one-node hypervisor cluster in 2010 with high availability learned, its fixture key taken back.
function cloud(platform: string) {
  const s = { ...withServer(newGame(3)), cash: 1e6 };
  skipTo(s, 2010);
  s.unlocks = [...s.unlocks, "virtualization", "monitoring"];
  const id = hypervisor(s, ["dev3"], "Cloud 1", platform), m = panelMachine(cluster(s, id))!;
  removeLicence(s, m, platform);
  return { s, id, m };
}

// The cluster's hypervisor finishing a fresh install on its trial.
function installed(platform: string) {
  const x = cloud(platform);
  x.s.trials = [{ machineId: x.m, product: platform, until: x.s.hour + 60 * 24 }];
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.id ? { ...c, platform: null, switching: { kind: "cloud", to: platform, doneAt: x.s.hour } } : c));
  tick(x.s);
  return x;
}

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("hypervisor licences", () => {
  it("opens a fresh VMwhere install on its licence page at the first sign-in", () => {
    const { s, id } = installed("vmwhere");
    expect(cluster(s, id).setupPending).toBe(true);
    expect(panelStatus(s, cluster(s, id))).toBe("trial");
    useStore.setState({ game: s });
    sessionStorage.setItem("backbone.ui.browser.logins", JSON.stringify([HOST]));
    const View = () => {
      const game = useStore((x) => x.game);
      return <ConsolePage game={game} hostname={HOST} host={HOST} cluster={game.clusters.find((x) => x.id === id)} defaced={false} />;
    };
    render(<View />);
    expect(screen.getByText(t("host.setup"))).toBeTruthy();
    fireEvent.click(screen.getByText(t("host.useTrial")));
    expect(screen.queryByText(t("host.setup"))).toBeNull();
    expect(useStore.getState().game.clusters.find((c) => c.id === id)!.setupPending).toBe(false);
  });

  it("shows VMwhere's trial, then its key with Remove, and sells nothing", () => {
    const { s, id, m } = installed("vmwhere");
    const trial = renderToString(<Licensing game={s} c={cluster(s, id)} />);
    expect(trial).toContain("Trial ends");
    expect(trial).toContain("Essentials");
    expect(trial).toContain(t("vendor-sites.licenceKey"));
    const key = buyKey(s, "vmwhere", "enterprise").key;
    expect(activateLicence(s, m, "vmwhere", key).ok).toBe(true);
    const held = renderToString(<Licensing game={s} c={cluster(s, id)} />);
    expect(held).toContain(key);
    expect(held).toContain(t("host.removeKey"));
    expect(held).toContain(t("readouts.version"));
    expect(held).not.toContain(t("vendor-sites.licenceKey"));
    const nodes = renderToString(<NodeList game={s} c={cluster(s, id)} f={consoleFeatures("vmwhere", yearOf(s.hour))} />);
    expect(nodes).not.toContain(t("browser-consoles-1.buy"));
  });

  it("shows HyperVee's leased key with its renewal and Remove", () => {
    const { s, id, m } = cloud("hypervee");
    const none = renderToString(<><LicenceFacts game={s} c={cluster(s, id)} /><KeyEntry game={s} c={cluster(s, id)} /></>);
    expect(none).toContain(t("vendor-sites.licenceKey"));
    const key = buyKey(s, "hypervee", null).key;
    expect(activateLicence(s, m, "hypervee", key).ok).toBe(true);
    expect(assignedKey(s, m, "hypervee")?.renewsAt).not.toBeNull();
    const held = renderToString(<><LicenceFacts game={s} c={cluster(s, id)} /><KeyEntry game={s} c={cluster(s, id)} /></>);
    expect(held).toContain("Active");
    expect(held).toContain(t("host.renews"));
    expect(held).toContain(key);
    expect(held).toContain(t("host.removeKey"));
  });
});
