// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MenuBar } from "../src/ui/desktop/MenuBar";
import { useStore } from "../src/ui/store";
import { newGame } from "./fixtures";

describe("menu bar", () => {
  it("closes an open menu on Escape", () => {
    useStore.setState({ game: newGame(1), surface: "desktop", windows: [] });
    render(<MenuBar onBell={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "raid0" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
