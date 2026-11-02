// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { euroPrice } from "../src/sim/00-core/money";
import { hourOf } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { tickMinute } from "../src/sim/88-tick/tick";
import { useStore } from "../src/ui/store";
import { ComponentsPage } from "../src/ui/apps/browser/consoles/ComponentsPage";
import { ServicesPage } from "../src/ui/apps/browser/consoles/ServicesPage";
import { panelServer, withServer } from "./fixtures";

afterEach(cleanup);

function host(year: number, family: string) {
  const s = withServer(newGame(4));
  s.hour = hourOf(new Date(Date.UTC(year, 0, 1)));
  const id = panelServer(s, "dev3", family);
  useStore.setState({ game: s, speed: 4, alert: null });
  return id;
}

function Page({ id, page: P }: { id: string; page: typeof ServicesPage }) {
  const game = useStore((x) => x.game);
  return <P game={game} c={game.clusters.find((x) => x.id === id)!} />;
}

const row = (text: string) => screen.getByText(text).closest("tr")!;
const minutes = (n: number) => act(() => {
  const s = structuredClone(useStore.getState().game);
  for (let i = 0; i < n; i++) tickMinute(s);
  useStore.setState({ game: s });
});

describe("panel Services page", () => {
  it("lists each family's services with the installed component's name", () => {
    for (const [family, first, mail] of [["cpanic", "cpsrvd", "Exhim"], ["pleskit", "psa", "Postfixit"], ["directadmen", "directadmin", "Exhim"], ["freepanel", "webmin", "Postfixit"]]) {
      render(<Page id={host(2012, family)} page={ServicesPage} />);
      expect(row(first).textContent, family).toContain("Running");
      expect(screen.getByText(mail), family).toBeTruthy();
      cleanup();
    }
  });

  it("restarts a service and shows it restarting until it is back", () => {
    render(<Page id={host(2012, "cpanic")} page={ServicesPage} />);
    fireEvent.click(within(row("Apatchy")).getByRole("button", { name: "Restart" }));
    expect(row("Apatchy").textContent).toContain("Restarting (2 min)");
    expect(within(row("Apatchy")).getByRole("button", { name: "Restart" })).toHaveProperty("disabled", true);
    expect(row("mysql").textContent).toContain("Running");
    minutes(2);
    expect(row("Apatchy").textContent).toContain("Running");
  });
});

describe("panel Components page", () => {
  it("shows the family default and installs an alternative", () => {
    const id = host(2018, "cpanic");
    render(<Page id={id} page={ComponentsPage} />);
    const web = row("Web server");
    expect(web.textContent).toContain("Apatchy");
    fireEvent.change(within(web).getByRole("combobox"), { target: { value: "enginexApatchy" } });
    fireEvent.click(within(web).getByRole("button", { name: "Install" }));
    expect(screen.getByText("Installing Enginex + Apatchy (30 min)")).toBeTruthy();
    minutes(30);
    expect(screen.queryByText(/Installing/)).toBeNull();
    expect(within(row("Web server")).getByText("Enginex + Apatchy").tagName).toBe("B");
  });

  it("offers modules with their monthly fee and installs one", () => {
    render(<Page id={host(2018, "pleskit")} page={ComponentsPage} />);
    const av = row("ImmunofyAV");
    expect(av.textContent).toContain(`${euroPrice(4)} per month`);
    expect(row("SpamAssistant").textContent).toContain("Free");
    fireEvent.click(within(av).getByRole("button", { name: "Install" }));
    expect(screen.getByText("Installing ImmunofyAV (15 min)")).toBeTruthy();
    expect(within(row("WordPass Toolkit")).getByRole("button", { name: "Install" })).toHaveProperty("disabled", true);
  });
});
