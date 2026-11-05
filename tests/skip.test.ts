import { beforeAll, describe, expect, it } from "vitest";
import { SKIP } from "../src/sim/00-core/time";
import { tick } from "../src/sim/88-tick/tick";
import { useDownloads } from "../src/ui/downloads";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

describe("skip", () => {
  // Hours until the first tick that raises an event.
  let first = 0;
  beforeAll(() => {
    const probe = readyGame(1);
    while (!tick(probe).length) first++;
  });

  it("runs until the first event, stops on that hour and drops to 1×", () => {
    const game = readyGame(1);
    useStore.setState({ game, speed: SKIP, alert: null });
    useStore.getState().advance(first + 50);
    expect(useStore.getState().game.hour).toBe(game.hour + first + 1);
    expect(useStore.getState().speed).toBe(1);
  });

  it("keeps a normal speed running through events", () => {
    const game = readyGame(1);
    useStore.setState({ game, speed: 60, alert: null });
    useStore.getState().advance(first + 1);
    expect(useStore.getState().game.hour).toBe(game.hour + first + 1);
    expect(useStore.getState().speed).toBe(60);
  });

  it("stops where a running download finishes", () => {
    const game = readyGame(1);
    expect(first).toBeGreaterThanOrEqual(2);
    useDownloads.setState({ iso: { start: game.hour, hours: 2 } });
    useStore.setState({ game, speed: SKIP, alert: null });
    useStore.getState().advance(first + 50);
    useDownloads.setState({ iso: undefined });
    expect(useStore.getState().game.hour).toBe(game.hour + 2);
    expect(useStore.getState().speed).toBe(1);
  });

  it("stops where a program installer download finishes", () => {
    const game = readyGame(1);
    game.installers = { FileGorilla: { startedAt: game.hour, readyAt: game.hour + 2 } };
    useStore.setState({ game, speed: SKIP, alert: null });
    useStore.getState().advance(first + 50);
    expect(useStore.getState().game.hour).toBe(game.hour + 2);
    expect(useStore.getState().speed).toBe(1);
  });
});
