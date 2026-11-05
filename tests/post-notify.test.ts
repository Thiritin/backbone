import { beforeEach, describe, expect, it } from "vitest";
import { lettersTick, post } from "../src/sim/40-support/letters";
import { listingById } from "../src/sim/20-world/properties";
import { freeSections, rentSection } from "../src/sim/90-actions/properties";
import { dateOf } from "../src/sim/00-core/time";
import { OFFICE_NAME } from "../src/sim/80-business/paperwork";
import { focusOf, useStore } from "../src/ui/store";
import { newGame } from "./fixtures";

const mk = () => { const s = newGame(11); s.letters = []; return s; };
const send = (s: ReturnType<typeof mk>, days = 1) => post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "1" }, days);

describe("post notification", () => {
  it("fires one event per letterbox at 10:00 and none an hour later", () => {
    const s = mk();
    for (let i = 0; i < 3; i++) send(s);
    const at = s.letters[0].at;
    s.hour = at - 1;
    expect(lettersTick(s)).toEqual([]);
    s.hour = at;
    expect(lettersTick(s)).toEqual([{ app: "Post", key: "event.post", params: { n: 3, location: s.locations[0].name, locationId: "loc1" } }]);
    s.hour = at + 1;
    expect(lettersTick(s)).toEqual([]);
  });

  it("fires per letterbox while forwarding", () => {
    const s = mk();
    s.cash = 1_000_000;
    const old = send(s, 2);
    expect(rentSection(s, "gallushof", freeSections(s, listingById("gallushof")!)[0]).ok).toBe(true);
    // The landlord's deposit letter is beside the point here.
    s.letters = s.letters.filter((l) => l.topic !== "landlordDoc");
    const office = s.properties.at(-1)!.locationId!;
    const fresh = send(s, 2);
    s.hour = fresh.at;
    const ev = lettersTick(s);
    expect(old.at).toBe(fresh.at);
    expect(ev.map((e) => e.params.locationId).sort()).toEqual(["loc1", office].sort());
    expect(ev.every((e) => e.params.n === 1 && e.params.location)).toBe(true);
  });

  it("stays quiet at the weekend", () => {
    const s = mk();
    for (let d = 1; d <= 10; d++) send(s, d);
    const days: number[] = [];
    const start = s.hour;
    for (s.hour = start; s.hour < start + 16 * 24; s.hour++) if (lettersTick(s).length) days.push(dateOf(s.hour).getUTCDay() * 100 + (s.hour % 24));
    expect(days).toHaveLength(10);
    expect(days.every((d) => d % 100 === 10 && d >= 100 && d <= 510)).toBe(true);
  });
});

describe("post notification click", () => {
  beforeEach(() => useStore.setState({ game: newGame(11), surface: "desktop", seek: null, windows: [] }));
  it("maps the location to a letterbox focus", () => {
    expect(focusOf({ locationId: "loc1", n: 1 })).toEqual({ kind: "letterbox", id: "loc1" });
  });
  it("sends the player at that location to the world", () => {
    const { game } = useStore.getState();
    useStore.getState().openApp("Post", { kind: "letterbox", id: game.locations[0].id });
    expect(useStore.getState()).toMatchObject({ surface: "world", seek: game.locations[0].id });
  });
  it("opens the Post app when the player is elsewhere", () => {
    useStore.getState().openApp("Post", { kind: "letterbox", id: "elsewhere" });
    const st = useStore.getState();
    expect([st.seek, st.surface, st.windows[0]?.app]).toEqual([null, "desktop", "Post"]);
  });
});
