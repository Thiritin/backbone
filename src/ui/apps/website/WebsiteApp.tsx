import { useEffect } from "react";
import { companyUrl } from "../../../sim/80-business/browser";
import { useStore } from "../../store";

// A shortcut: the company site lives in the Browser, so this window hands over and closes.
export function WebsiteApp() {
  const url = useStore((s) => companyUrl(s.game));
  const openApp = useStore((s) => s.openApp);
  const close = useStore((s) => s.close);
  useEffect(() => {
    openApp("Browser", { kind: "url", id: url });
    const own = useStore.getState().windows.find((w) => w.app === "Website");
    if (own) close(own.id);
  }, []);
  return null;
}
