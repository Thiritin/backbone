---
version: 1
slug: "docs-design-mockups"
primary_target: "docs/design/mockups"
related_targets: []
---

# Mockups: desktop shell, Support, rack view, plans editor

Scope: static HTML layout mockups that become the visual reference for milestone 1 and 2 React components. Mode: Operate. Desktop only, 1440x900 frame, light and dark.

Audience and task: tech players running a small hosting company in 2006; they keep several app windows open, triage tickets, cable racks and price plans while the clock runs.

## Direction contract

THESIS: A real macOS-grade desktop where the only rich drawing is the hardware itself. Refuses the dashboard-of-cards look and the hacker-terminal costume.

OWN-WORLD: Pinned by the GDD: macOS-light chrome, translucent menu bar, dock, window title bars, Inter for UI, JetBrains Mono for every number. Cool slate neutrals tinted toward blue, one cobalt accent for selection and primary actions, state colours green/amber/red reserved for device and SLA state. Wallpaper is a code-drawn night map of Western Europe's backbone (city points, transit arcs).

STORY: The player sees time, cash and open tickets at a glance, sees what is failing, and acts in the right app within one click.

FIRST VIEWPORT: Menu bar on top (logo menu, app name, time controls, date, cash, ticket badge). Dock centered at the bottom. Two to three windows open, front window focused with a stronger shadow. Notification banners stack at top right.

FORM: Pinned macOS desktop (brief-pinned, no seed roll). Signature move: device fronts drawn in code with live status LEDs, reused as miniatures across Locations, rack view and inspector.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
