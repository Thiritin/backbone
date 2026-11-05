// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { downloadProgram, installProgram, uninstallApp } from "../src/sim/90-actions/programs";
import { ApplicationsApp } from "../src/ui/apps/ApplicationsApp";
import { useStore } from "../src/ui/store";

afterEach(cleanup);

describe("Finder Downloads", () => {
  it("holds an installer until the program is installed", () => {
    const s = newGame(31);
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
    s.cash = 5_000;
    downloadProgram(s, "FileGorilla");
    s.hour = s.installers.FileGorilla.readyAt;
    useStore.setState({ game: { ...s } });
    render(<ApplicationsApp />);
    fireEvent.click(screen.getByText(t("apps.finder.downloads")));
    const has = () => document.body.textContent!.includes(".dmg");
    expect(has()).toBe(true);
    act(() => { installProgram(s, "FileGorilla"); useStore.setState({ game: { ...s } }); });
    expect(has()).toBe(false);
    act(() => { uninstallApp(s, "FileGorilla"); useStore.setState({ game: { ...s } }); });
    expect(has()).toBe(true);
  });
});
