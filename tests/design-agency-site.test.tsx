import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { euro } from "../src/sim/00-core/money";
import { designQuote } from "../src/sim/80-business/website";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { AgencySite } from "../src/ui/apps/browser/sites/marketing/AgencySite";
import { CompanySite } from "../src/ui/apps/browser/sites/CompanySite";
import { skipTo, readyGame } from "./fixtures";

const at = (year: number) => {
  const s = readyGame(1);
  s.cash = 100000;
  if (year > 2005) skipTo(s, year);
  return s;
};
const go = () => {};

describe("agency site", () => {
  it("looks like a freelancer's table page in 2005, a studio in 2013 and an agency in 2021", () => {
    expect(renderToString(<AgencySite game={at(2005)} path="/" go={go} />)).toMatch(/ag f.*<table/s);
    expect(renderToString(<AgencySite game={at(2013)} path="/" go={go} />)).toContain("ag s");
    const late = renderToString(<AgencySite game={at(2021)} path="/about" go={go} />);
    expect(late).toContain("ag a");
    expect(late).toContain("Tarek Brandt");
  });

  it("quotes the price for the company and offers a redesign once the web design is owned", () => {
    const s = at(2017);
    const first = renderToString(<AgencySite game={s} path="/quote" go={go} />);
    expect(first).toContain(euro(designQuote(s)));
    expect(first).toContain("Order website design");
    setUpChannel(s, "website");
    expect(renderToString(<AgencySite game={s} path="/quote" go={go} />)).toContain("Order redesign");
  });
});

describe("company site", () => {
  it("is a frameset page with a marquee and a visitor counter until the web design is bought", () => {
    const s = at(2005);
    const html = renderToString(<CompanySite game={s} path="/" go={go} />);
    expect(html).toContain("site-frameset");
    expect(html).toContain("site-marquee");
    expect(html).toContain("site-counter");
    setUpChannel(s, "website");
    const designed = renderToString(<CompanySite game={s} path="/" go={go} />);
    expect(designed).toContain("designed");
    expect(designed).not.toContain("site-marquee");
  });
});
