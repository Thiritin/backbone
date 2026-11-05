// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeatherApp } from "../src/ui/apps/weather/WeatherApp";
import { useStore } from "../src/ui/store";
import { newGame } from "./fixtures";

describe("weather app header", () => {
  it("names the city the player is in", () => {
    const s = newGame(1);
    s.locations = [{ ...s.locations[0], city: "Berlin" }, ...s.locations.slice(1)];
    s.player = { ...s.player, at: s.locations[0].id };
    useStore.setState({ game: s });
    const { container } = render(<WeatherApp />);
    expect(container.querySelector(".wx-now h2")!.textContent).toBe("Berlin");
  });

  it("has no travel buttons", () => {
    useStore.setState({ game: newGame(1) });
    const { container } = render(<WeatherApp />);
    expect(container.querySelector("button")).toBeNull();
  });
});
