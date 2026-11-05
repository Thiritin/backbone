// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_MS, useHomeTimer, useVisit } from "../src/ui/world/visit";

// A component that re-renders on every game tick, like the room does.
function Room({ tick, blocked, home }: { tick: number; blocked: boolean; home: () => void }) {
  useHomeTimer("l", blocked, home);
  return <i data-t={tick} />;
}

describe("figure returns home while the clock ticks", () => {
  beforeEach(() => { vi.useFakeTimers(); useVisit.setState({ at: { locationId: "l", pt: { x: 5, y: 1 } }, walk: null, pending: null }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const run = (ms: number, tickEvery: number, blocked = false) => {
    const home = vi.fn();
    const view = render(<Room tick={0} blocked={blocked} home={() => home()} />);
    for (let t = 0, i = 1; t < ms; t += tickEvery, i++) {
      act(() => { vi.advanceTimersByTime(tickEvery); });
      view.rerender(<Room tick={i} blocked={blocked} home={() => home()} />);
    }
    return home;
  };

  it("walks home at 1x ticks", () => expect(run(HOME_MS + 1000, 1000).mock.calls.length).toBe(1));
  it("walks home at 60x ticks", () => expect(run(HOME_MS + 1000, 16).mock.calls.length).toBe(1));
  it("waits while a panel is open", () => expect(run(HOME_MS * 3, 100, true)).not.toHaveBeenCalled());
  it("does not run for another location", () => {
    useVisit.setState({ at: { locationId: "other", pt: { x: 1, y: 1 } } });
    expect(run(HOME_MS * 2, 100)).not.toHaveBeenCalled();
  });
  it("restarts the wait on a new visit", () => {
    const home = vi.fn(), view = render(<Room tick={0} blocked={false} home={home} />);
    act(() => { vi.advanceTimersByTime(HOME_MS - 100); });
    act(() => { useVisit.setState({ at: { locationId: "l", pt: { x: 9, y: 9 } } }); });
    act(() => { vi.advanceTimersByTime(HOME_MS - 100); });
    expect(home).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(home).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
