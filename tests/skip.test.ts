import { describe, expect, it } from "vitest";
import { SKIP } from "../src/sim/00-core/time";
import { tick } from "../src/sim/88-tick/tick";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

describe("skip", () => {
  it("runs until the first event, stops on that hour and drops to 1×", () => {
    const game = readyGame(1), probe = structuredClone(game);
    let first = 0;
    while (!tick(probe).length) first++;
    useStore.setState({ game, speed: SKIP, alert: null });
    useStore.getState().advance(first + 50);
    expect(useStore.getState().game.hour).toBe(game.hour + first + 1);
    expect(useStore.getState().speed).toBe(1);
  });

  it("keeps a normal speed running through events", () => {
    const game = readyGame(1), probe = structuredClone(game);
    let first = 0;
    while (!tick(probe).length) first++;
    useStore.setState({ game, speed: 16, alert: null });
    useStore.getState().advance(first + 1);
    expect(useStore.getState().game.hour).toBe(game.hour + first + 1);
    expect(useStore.getState().speed).toBe(16);
  });
});
