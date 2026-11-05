// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { downloadProgram } from "../src/sim/90-actions/programs";
import { DownloadsButton } from "../src/ui/apps/browser/BrowserApp";
import { softwareDownloads, useDownloads } from "../src/ui/downloads";

afterEach(() => { cleanup(); useDownloads.setState({ "lunix@12": undefined }); });

const game = () => {
  const s = newGame(31);
  s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
  return s;
};
const bar = () => document.querySelector<HTMLElement>(".br-dl-bar i")?.style.width;

describe("Browser download indicator", () => {
  it("shows a program installer in flight and clears it when finished", () => {
    const s = game();
    downloadProgram(s, "FileGorilla");
    const d = s.installers.FileGorilla;
    s.hour = d.startedAt + (d.readyAt - d.startedAt) / 2;
    render(<DownloadsButton game={s} />);
    expect(bar()).toBe("50%");
    expect(softwareDownloads(s)[0].file).toMatch(/\.dmg$/);
    s.hour = d.readyAt;
    cleanup();
    render(<DownloadsButton game={s} />);
    expect(bar()).toBeUndefined();
  });

  it("shows an OS image in flight", () => {
    const s = game();
    useDownloads.setState({ "lunix@12": { start: s.hour, hours: 4 } });
    render(<DownloadsButton game={s} />);
    expect(bar()).toBe("0%");
  });

  it("an old save with an installer in flight still loads and lists it", () => {
    const s = game();
    downloadProgram(s, "FileGorilla");
    const back = deserialize(serialize(s))!;
    expect(softwareDownloads(back).map((x) => x.id)).toEqual(["FileGorilla"]);
  });
});
