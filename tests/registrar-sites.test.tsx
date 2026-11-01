import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { registrarHost, REGISTRARS } from "../src/sim/10-catalog/registrars";
import { signRegistrar } from "../src/sim/90-actions/registrar";
import { RegistrarSite } from "../src/ui/apps/browser/sites/registrars";
import { REGISTRAR_ERAS } from "../src/ui/apps/browser/sites/registrars/RegistrarPage";
import { SponsorBoard } from "../src/ui/apps/browser/sites/SponsorBoard";
import { skipTo, newGame } from "./fixtures";

const at = (year: number) => {
  const s = newGame(1);
  if (year > 2005) skipTo(s, year);
  return s;
};

describe("registrar and board sites", () => {
  it("mounts every registrar in both eras with search, prices and contract", () => {
    for (const r of REGISTRARS) for (const { from, look } of REGISTRAR_ERAS[r.id]) {
      const s = at(from);
      const html = renderToString(<RegistrarSite game={s} id={r.id} />);
      expect(html).toContain(look);
      expect(html).toContain(registrarHost(r));
      expect(html).toContain(">Buy<");
      expect(html).toContain(".com");
      expect(html).not.toContain("Your account");
      signRegistrar(s, r.id);
      expect(renderToString(<RegistrarSite game={s} id={r.id} />)).toContain("Under contract");
    }
  });

  it("mounts the board as a phpBB-style forum in 2005 and a flat site from 2014", () => {
    const early = renderToString(<SponsorBoard game={at(2005)} />);
    expect(early).toContain("sb early");
    expect(early).toContain("Visitors");
    const late = renderToString(<SponsorBoard game={at(2014)} />);
    expect(late).toContain("sb late");
    expect(late).toContain("Post offer");
  });
});
