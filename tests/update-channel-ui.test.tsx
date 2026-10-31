import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { channelOf } from "../src/sim/60-infra/channel";
import { setChannel } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { ChannelPicker } from "../src/ui/apps/browser/consoles/HostSettings";
import { panelVm, readyGame } from "./fixtures";

function setup() {
  const s = readyGame(1);
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, "cpanic");
  const view = () => renderToString(<ChannelPicker c={s.clusters.find((x) => x.id === id)!} />);
  return { s, id, view };
}

describe("update channel picker", () => {
  it("offers the three channels with Release pressed for a panel from before channels", () => {
    const html = setup().view();
    for (const name of ["Stable", "Release", "Edge"]) expect(html).toContain(name);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Release/);
  });

  it("moves the pressed channel when the player picks one", () => {
    const { s, id, view } = setup();
    expect(setChannel(s, id, "edge").ok).toBe(true);
    expect(view()).toMatch(/aria-pressed="true"[^>]*>Edge/);
  });

  it("keeps the chosen channel through a save and refuses an unknown cluster", () => {
    const { s, id } = setup();
    setChannel(s, id, "stable");
    const back = deserialize(serialize(s))!;
    expect(channelOf(back.clusters.find((x) => x.id === id)!)).toBe("stable");
    expect(setChannel(s, "nope", "edge").ok).toBe(false);
  });
});
