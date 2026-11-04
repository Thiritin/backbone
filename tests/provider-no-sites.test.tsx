import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { loadLang } from "../src/i18n/lang";
import { t } from "../src/i18n/en";
import { ProviderSite } from "../src/ui/apps/browser/sites/providers/registry";
import { newGame } from "./fixtures";

describe("providers without a datacenter", () => {
  afterAll(() => loadLang("en"));

  it.each(["telex", "digitalreality", "corespite"])("shows %s as a styled page with the notice in German", async (id) => {
    await loadLang("de");
    const html = renderToString(<ProviderSite game={newGame(1)} id={id} path="/" go={() => {}} />);
    expect(html).toContain(t("providers.noSites"));
    expect(html).toContain("Dieser Anbieter hat kein Rechenzentrum");
    expect(html).toContain(`ps-${id}`);
    expect(html).toContain("ps-noc");
    expect(html).not.toContain("web-page-error");
  });
});
