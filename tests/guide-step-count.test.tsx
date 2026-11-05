// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuideApp } from "../src/ui/apps/GuideApp";
import { useStore } from "../src/ui/store";
import { cardBoard } from "../src/sim/checklist";
import { newGame } from "./fixtures";

describe("guide step counter", () => {
  it("names the current step, not the finished count", () => {
    const s = newGame(1);
    useStore.setState({ game: s });
    const { cards, current } = cardBoard(s);
    const r = render(<GuideApp />);
    expect(r.container.querySelector(".next-count")!.textContent).toBe(`Step ${cards.indexOf(current!) + 1} of ${cards.length}`);
  });
});
