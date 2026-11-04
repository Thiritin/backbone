// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { AlertGate } from "../src/ui/desktop/AlertSheet";
import { useStore, type Banner } from "../src/ui/store";
import { readyGame } from "./fixtures";

const ban = (id: number, key = "event.cashNegative"): Banner => ({ id, app: "Books", title: `Alert ${id}`, text: "x", hour: 0, key });
const put = (p: Partial<ReturnType<typeof useStore.getState>>) => act(() => useStore.setState(p));

beforeEach(() => {
  document.body.innerHTML = '<div class="desktop"></div>';
  useStore.setState({ game: readyGame(1), surface: "world", closeup: false, alert: null, alertQueue: [], alertNow: false });
});
afterEach(cleanup);

const view = () => render(<AlertGate />, { container: document.querySelector(".desktop")!.appendChild(document.createElement("div")) });
const chip = () => screen.queryByRole("button", { name: t("desktop.alert.chip") });

describe("alert gate", () => {
  it("queues behind a chip while a close-up is open and shows on close", () => {
    view();
    put({ closeup: true, alert: ban(1) });
    expect(chip()?.textContent).toBe("1");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    put({ closeup: false });
    expect(chip()).toBeNull();
    expect(screen.getByRole("alertdialog").textContent).toContain("Alert 1");
  });

  it("opens the alert when the chip is clicked", () => {
    view();
    put({ closeup: true, alert: ban(1) });
    fireEvent.click(chip()!);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("shows game over at once", () => {
    view();
    put({ closeup: true, alert: ban(1), game: { ...readyGame(1), gameOver: { reason: "x" } as never } });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(chip()).toBeNull();
  });

  it("shows two queued alerts in order with a count", () => {
    view();
    put({ closeup: true, alert: ban(1), alertQueue: [ban(2)] });
    expect(chip()?.textContent).toBe("2");
    put({ closeup: false });
    expect(screen.getByRole("alertdialog").textContent).toContain("Alert 1");
    act(() => useStore.getState().closeAlert(true));
    expect(screen.getByRole("alertdialog").textContent).toContain("Alert 2");
    act(() => useStore.getState().closeAlert(true));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("leaves the desktop unchanged", () => {
    view();
    put({ surface: "desktop", closeup: true, alert: ban(1) });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(chip()).toBeNull();
  });
});
