import { Component, type ReactNode } from "react";
import { t } from "../../../i18n/en";

// A site that throws shows a plain error page in its tab; the rest of the game keeps running.
export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="web-page-error" role="alert"><h1>{t("browser.pageError.title")}</h1><p>{t("browser.pageError.body")}</p></div>;
  }
}
