import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { setCompanyRecord } from "../src/sim/90-actions/domains";
import { RegistrarSite } from "../src/ui/apps/browser/sites/registrars";
import { readyGame } from "./fixtures";

describe("registrar DNS page", () => {
  it("lists the company zone at /login/dns with a new MX record pending", () => {
    const s = readyGame(3), id = s.registrar!.id;
    setCompanyRecord(s, { type: "MX", name: "@", ttl: 3600, data: "10 aspmx.l.goggle.com" });
    const html = renderToString(<RegistrarSite game={s} id={id} path="/login/dns" />);
    expect(html).toContain(s.company.domain!);
    expect(html).toContain("aspmx.l.goggle.com");
    expect(html).toContain("Pending");
    expect(renderToString(<RegistrarSite game={s} id={id} path="/login" />)).not.toContain("aspmx.l.goggle.com");
  });
});
