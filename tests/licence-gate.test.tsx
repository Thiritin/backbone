// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { panelMachine, issueKey } from "../src/sim/60-infra/licence";
import { ConsolePage } from "../src/ui/apps/browser/consoles/ConsolePage";
import { useStore } from "../src/ui/store";
import { panelVm, readyGame, skipTo } from "./fixtures";

const HOST = "panel.example.com";

// A panel host on its first sign-in: no key, no trial, setup pending, one unassigned key owned.
function fresh(panel: string, trial: boolean) {
  const s = readyGame(1);
  skipTo(s, 2020);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, panel);
  const vm = panelMachine(s.clusters.find((x) => x.id === id)!)!;
  s.licenses = s.licenses.filter((k) => k.machineId !== vm);
  s.trials = [];
  s.clusters = s.clusters.map((x) => (x.id === id ? { ...x, setupPending: true } : x));
  const key = issueKey(s, panel, null).key;
  useStore.setState({ game: s });
  sessionStorage.setItem("backbone.ui.browser.logins", JSON.stringify([HOST]));
  const View = () => {
    const game = useStore((x) => x.game);
    return <ConsolePage game={game} hostname={HOST} host={HOST} cluster={game.clusters.find((x) => x.id === id)} defaced={false} />;
  };
  render(<View />);
  return { id, vm, key, trial };
}

const gate = () => screen.queryByText(t("host.setup")) ?? screen.queryByText(t("host.enterLicense")) ?? screen.queryByText(t("host.installKey")) ?? screen.queryByText(t("host.licenseKey"));
const type = (v: string) => fireEvent.change(screen.getByLabelText(t("vendor-sites.licenceKey")), { target: { value: v } });

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("licence gate", () => {
  it("licenses a typed key and leaves in the same click", () => {
    const { key } = fresh("cpanic", true);
    expect(screen.getByText(t("host.enterLicense"))).toBeTruthy();
    type(key);
    fireEvent.click(screen.getByText(t("host.activate")));
    expect(gate()).toBeNull();
    expect(useStore.getState().game.clusters.find((c) => c.panel === "cpanic")!.setupPending).toBe(false);
  });

  it("licenses an owned key chip and leaves", () => {
    const { key } = fresh("pleskit", true);
    expect(screen.getByText(t("host.installKey"))).toBeTruthy();
    fireEvent.click(screen.getByText(key));
    expect(gate()).toBeNull();
  });

  it("starts the trial and leaves, and returns expired until a key is entered", () => {
    const { vm, key } = fresh("pleskit", true);
    fireEvent.click(screen.getByText(t("host.proceedTrial")));
    expect(gate()).toBeNull();
    expect(useStore.getState().game.trials.some((x) => x.machineId === vm)).toBe(true);
    const s = structuredClone(useStore.getState().game);
    s.hour = s.trials[0].until + 1;
    act(() => useStore.setState({ game: s }));
    expect(screen.getByText(t("error.licenceExpired"))).toBeTruthy();
    type(key);
    fireEvent.click(screen.getByText(t("host.activate")));
    expect(screen.queryByText(t("error.licenceExpired"))).toBeNull();
  });

  it("holds a product without a trial on the error until a key is entered", () => {
    const { key } = fresh("directadmen", false);
    expect(screen.getByText(t("host.licenseKey"))).toBeTruthy();
    expect(screen.getByText(t("error.licenceKey"))).toBeTruthy();
    expect(screen.queryByText(t("host.useTrial"))).toBeNull();
    type("not-a-key");
    fireEvent.click(screen.getByText(t("host.activate")));
    expect(screen.getAllByText(t("error.licenceKey")).length).toBeGreaterThan(0);
    type(key);
    fireEvent.click(screen.getByText(t("host.activate")));
    expect(gate()).toBeNull();
  });
});
