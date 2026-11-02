import { describe, expect, it, vi } from "vitest";
import { trapBack, useBack } from "../src/ui/desktop/back";

vi.mock("react", () => ({ useRef: (v: unknown) => ({ current: v }), useEffect: (f: () => void) => f() }));

describe("back trap", () => {
  it("keeps the page and hands Back to the front window", () => {
    let pop = () => {};
    const history = { pushState: vi.fn() };
    trapBack({ history, addEventListener: (_: string, f: () => void) => (pop = f) } as never, () => "w1");
    const back = vi.fn();
    useBack("w1", back);
    pop();
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledOnce();
  });
});
