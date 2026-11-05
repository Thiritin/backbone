import type { Layout } from "../../../../sim/10-catalog/bookkeeping";
import type { ComponentType } from "react";
import { FlatLayout } from "./FlatLayout";
import { GtkLayout } from "./GtkLayout";
import { IconsLayout } from "./IconsLayout";
import { MenusLayout } from "./MenusLayout";
import { TabsLayout } from "./TabsLayout";
import type { LayoutProps } from "./types";
import { WebLayout } from "./WebLayout";

export const LAYOUTS: Record<Layout, ComponentType<LayoutProps>> = {
  icons: IconsLayout, menus: MenusLayout, tabs: TabsLayout, web: WebLayout, flat: FlatLayout, gtk: GtkLayout,
};
