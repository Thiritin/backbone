// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { atDesk, boxAt, inbox, post } from "../src/sim/40-support/letters";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { tick } from "../src/sim/88-tick/tick";
import { fetchPost } from "../src/sim/90-actions/post";
import { PostPanel } from "../src/ui/world/panel/Panels";
import { useStore } from "../src/ui/store";
import { newGame } from "./fixtures";

afterEach(cleanup);
const KINDS: [string, string, Record<string, string | number>][] = [
  ["Gewerbeamt", "officeRegistered", { name: "K", reg: "4711" }], ["Finanzamt", "taxNumber", { name: "K", number: "12/345", period: "none" }],
  ["IHQ", "chamberFee", { name: "K", year: 2005, staff: 1 }], ["Dr. Ilse Stempel", "notaryInvoice", { name: "K" }],
];

function boxed() {
  const s = newGame(5);
  s.letters = [];
  for (const [from, topic, params] of KINDS) post(s, from, topic, params, 1);
  for (let i = 0; i < 4 * 24; i++) tick(s);
  return s;
}

describe("letterbox", () => {
  it("empties on fetch and old saves drop read letters from the box", () => {
    const s = boxed();
    expect(boxAt(s, "loc1")).toHaveLength(4);
    expect(fetchPost(s).ok).toBe(true);
    expect(boxAt(s, "loc1")).toHaveLength(0);
    expect(atDesk(s)).toHaveLength(4);
    const old = JSON.parse(serialize(boxed()));
    old.letters[0].read = true;
    expect(deserialize(JSON.stringify(old)).letters[0].box).toBeNull();
  });

  it("shows the first letter on top for every kind, and drops read ones on reopening", () => {
    const s = boxed();
    fetchPost(s);
    useStore.setState({ game: s });
    const first = inbox(s)[0], head = t(`letter.${first.topic}.subject`, first.params);
    const { container, unmount } = render(<PostPanel title="Post" onClose={() => {}} />);
    const sheet = container.querySelector(".wp-sheet")!;
    expect(sheet.getAttribute("data-letter")).toBe(first.id);
    expect(sheet.querySelector("h1")!.textContent).toBe(head);
    expect(sheet.querySelector(".letter-logo")).toBeTruthy();
    unmount();
    // The first letter was read on show; the next visit starts at the unread one.
    const again = render(<PostPanel title="Post" onClose={() => {}} />).container;
    expect(again.querySelector(".wp-sheet")!.getAttribute("data-letter")).toBe(inbox(s)[1].id);
  });

  it.each(KINDS)("shows a letter from %s with its subject and letterhead", (from, topic, params) => {
    const s = newGame(5);
    s.letters = [];
    post(s, from, topic, params, 1);
    for (let i = 0; i < 4 * 24; i++) tick(s);
    fetchPost(s);
    useStore.setState({ game: s });
    const sheet = render(<PostPanel title="Post" onClose={() => {}} />).container.querySelector(".wp-sheet")!;
    expect(sheet.querySelector("h1")!.textContent).toBe(t(`letter.${topic}.subject`, params));
    expect(sheet.querySelector(".letter-logo svg")).toBeTruthy();
  });
});
