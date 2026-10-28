---
name: Backbone
description: A hosting-company management game played on a macOS-style desktop in the browser.
colors:
  accent: "oklch(0.53 0.19 262)"
  accent-ink: "oklch(0.99 0.01 262)"
  accent-soft: "oklch(0.94 0.035 262)"
  accent-text: "oklch(0.47 0.18 262)"
  ok: "oklch(0.64 0.16 150)"
  ok-soft: "oklch(0.95 0.04 150)"
  warn: "oklch(0.75 0.15 72)"
  warn-soft: "oklch(0.96 0.045 85)"
  warn-text: "oklch(0.52 0.12 60)"
  bad: "oklch(0.6 0.21 25)"
  bad-soft: "oklch(0.95 0.035 25)"
  bad-text: "oklch(0.52 0.19 25)"
  win: "oklch(0.99 0.004 250)"
  win-side: "oklch(0.962 0.007 250)"
  win-bar: "oklch(0.975 0.006 250)"
  field: "oklch(1 0 0)"
  hover: "oklch(0.94 0.01 255)"
  line: "oklch(0.9 0.009 252)"
  line-strong: "oklch(0.83 0.012 252)"
  text: "oklch(0.22 0.02 258)"
  text-2: "oklch(0.44 0.022 258)"
  text-3: "oklch(0.5 0.018 258)"
  metal: "oklch(0.26 0.008 255)"
  metal-2: "oklch(0.32 0.009 255)"
  metal-3: "oklch(0.38 0.01 255)"
  metal-line: "oklch(0.18 0.006 255)"
  rack: "oklch(0.17 0.006 255)"
  desktop-night: "oklch(0.2 0.04 262)"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    letterSpacing: "-0.005em"
  card-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 650
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"cv11\", \"ss01\""
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 550
  number:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.94em"
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
rounded:
  ctl: "6px"
  card: "10px"
  win: "12px"
  banner: "14px"
  dock: "20px"
  pill: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.ctl}"
    padding: "0 11px"
    height: "28px"
  button-hover:
    backgroundColor: "{colors.hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.ctl}"
    padding: "0 11px"
    height: "28px"
  button-ghost:
    textColor: "{colors.text-2}"
    rounded: "{rounded.ctl}"
    height: "28px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.ctl}"
    padding: "0 8px"
    height: "28px"
  pill:
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "20px"
  pill-ok:
    backgroundColor: "{colors.ok-soft}"
  pill-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn-text}"
  pill-bad:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad-text}"
  sidebar-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.ctl}"
    height: "28px"
  card:
    backgroundColor: "{colors.field}"
    rounded: "{rounded.card}"
  window:
    backgroundColor: "{colors.win}"
    rounded: "{rounded.win}"
---

# Design System: Backbone

## Overview

**Creative North Star: "The Operator's Desktop"**

Backbone is a real macOS-grade desktop where the only rich drawing is the hardware itself. The chrome is quiet and native: a translucent menu bar, a frosted dock, windows with traffic lights and soft shadows, and dense sidebars and tables in cool slate neutrals. Against that calm surface, racks, switches, servers and patch panels are drawn in code with real port counts, SFP cages and live status LEDs, and the same fronts reappear as miniatures wherever a device is shown.

The interface is dense in the way a working admin tool is dense. Body text sits at 13px, rows are 28 to 34px tall, and several windows stay open at once over a night map of Western Europe's backbone. Every number is set in JetBrains Mono so columns line up. Light and dark modes share one token set, switched on the root element.

**Key Characteristics:**
- Native desktop chrome with translucency on the menu bar, dock and notification banners.
- One cobalt accent for selection and primary actions.
- Green, amber and red appear only for device and SLA state.
- Code-drawn hardware fronts on near-black metal are the visual signature.
- Hairline 0.5px borders and tonal layering separate regions inside windows.

## Colors

Cool slate neutrals tinted toward blue carry the interface, one cobalt accent marks selection, and a reserved trio of state colours reports health.

### Primary
- **Cobalt** (accent): fills the primary button, the active sidebar row, the pressed game-speed control, meter bars and the focus ring. Its soft tint (accent-soft) backs accent pills, and accent-text colours sidebar icons and links.

### State
- **Signal Green** (ok): a healthy device, an up port, a met SLA.
- **Amber** (warn): degraded devices, port errors and SLA risk; warn-text is the readable variant on soft fills.
- **Alarm Red** (bad): failures, down ports, breached SLAs and the unread-count badges on the menu bar and dock. bad-text is the readable variant used on soft fills and destructive buttons.

### Neutral
- **Window White** (win): window bodies and sticky table headers.
- **Sidebar Slate** (win-side) and **Title Bar Slate** (win-bar): the two tonal layers that frame a window's content.
- **Field White** (field): inputs, buttons, segmented-control thumbs and cards that sit on a window.
- **Hairline** (line) and **Strong Hairline** (line-strong): row dividers and control outlines.
- **Ink** (text), **Graphite** (text-2) and **Slate Grey** (text-3): primary text, secondary text and labels or muted figures.
- **Rack Black** (rack) and the **Metal** steps (metal, metal-2, metal-3, metal-line): device faces, rack interiors and the technician terminal.
- **Desktop Night** (desktop-night): the body colour behind the wallpaper, deep cobalt to match the night map.

Dark mode redefines the same keys on `:root[data-theme="dark"]`: windows drop to around 0.2 to 0.27 lightness, the accent lifts to oklch(0.64 0.17 262), and soft state fills become deep tinted surfaces with lighter text variants.

### Named Rules
**The Reserved State Rule.** Green, amber and red mean device or SLA state and nothing else. Prices, revenue, plan figures and other business numbers use neutral text, and a figure turns red or amber only when it reports a failure or a breach.

**The One Accent Rule.** Cobalt is the only interactive colour. Selection, primary action and focus all use it; no second accent hue exists in the chrome.

**The Native Chrome Exception.** The window traffic lights (oklch(0.68 0.2 27), oklch(0.83 0.16 85), oklch(0.72 0.18 145)) and the per-app dock tile colours are part of the macOS world and are exempt from both rules above. They never appear inside window content.

## Typography

**Body Font:** Inter (with system-ui, sans-serif), with stylistic sets cv11 and ss01.
**Number Font:** JetBrains Mono (with ui-monospace, monospace), tabular figures.

**Character:** Inter carries a native, compact system voice; JetBrains Mono gives every count, price, IP and timestamp the look of a console readout.

### Hierarchy
- **Headline** (650, 17px, -0.01em): the subject heading of a detail pane, such as a device, ticket or plan name.
- **Title** (650, 13px, -0.005em): window titles in the title bar and the app name in the menu bar, followed by a 450-weight subtitle in text-3.
- **Card Title** (650, 12.5px): headers of cards inside a pane, paired with a 16px Lucide icon.
- **Body** (400, 13px, 1.4): all running UI text, table cells and controls; buttons and segmented controls use 500.
- **Label** (550, 11.5px): pills, table headers (600), sidebar counts and key labels in fact grids. Sidebar group headings use 650 at 11px in text-3.

### Named Rules
**The Mono Numbers Rule.** Every number the player reads, including cash, dates, counts, ports, IPs and prices, is set in JetBrains Mono with tabular figures at 0.94em of the surrounding size.

**The Sentence Case Rule.** Labels and headings are sentence case at normal tracking. The hierarchy comes from weight and size, and the system has no uppercase tracked labels.

## Layout

The viewport is a fixed desktop: a 30px menu bar across the top, a dock centred 8px above the bottom edge, and absolutely positioned windows between them. Banners stack at the top right in a 344px column, 40px from the top. Inside a window, a 44px title bar sits above a body that usually splits into a 210px sidebar and a content pane, or into fixed and fluid grid columns such as 360px by 1fr. Controls are 28px tall, table rows 34px with 30px headers, and pills 20px. Spacing runs on a 4px base with 8, 12 and 16px as the common steps; panes pad at 12 to 16px and card headers at 10 to 11px by 14px. The layout targets desktop browsers from 1280px wide and is reviewed at 1440 by 900.

## Elevation & Depth

Depth belongs to the desktop layer: windows, banners, popovers and the dock float with soft, wide shadows plus a 0.5px outline ring, while everything inside a window is flat and separated by tone and hairlines. The front window carries a deeper shadow than windows behind it, and its title bar is fully opaque. Translucent surfaces (menu bar, dock, banners) use backdrop blur of 24 to 28px with 1.5 to 1.6 saturation.

### Shadow Vocabulary
- **Front window** (`box-shadow: 0 22px 60px -12px oklch(0 0 0 / 0.42), 0 0 0 0.5px oklch(0 0 0 / 0.28)`): the focused window only.
- **Back window** (`box-shadow: 0 12px 34px -10px oklch(0 0 0 / 0.3), 0 0 0 0.5px oklch(0 0 0 / 0.22)`): every unfocused window.
- **Popover** (`box-shadow: 0 10px 30px -8px oklch(0 0 0 / 0.35), 0 0 0 0.5px oklch(0 0 0 / 0.2)`): banners and dock tooltips.
- **Control lift** (`box-shadow: 0 0.5px 1px oklch(0 0 0 / 0.06)`): buttons at rest, and a slightly stronger version under the selected segment.

### Named Rules
**The Focus Has Weight Rule.** Only the front window gets the deep shadow; focus is shown by elevation and title-bar opacity rather than by colour.

**The Flat Content Rule.** Cards and lists inside a window carry no shadow. They sit on the window with a 0.5px line-strong border.

## Shapes

Corners are gently rounded and scale with the size of the object: 4 to 5px on chips and small toggles, 6px on controls and sidebar rows, 7px on search fields and segmented tracks, 10px on cards and the rack face, 12px on windows, 14px on banners and 20px on the dock. Pills are fully rounded. Borders are 0.5px hairlines throughout. Hardware fronts use tight radii of about 1px so devices read as machined metal.

## Components

### Buttons
- **Shape:** gently rounded (6px), 28px tall, 11px side padding, 500 weight, with an optional 16px Lucide icon at a 6px gap.
- **Default:** field background, 0.5px line-strong border and the control-lift shadow; hover switches to the hover tone.
- **Primary:** cobalt fill with accent-ink text and no border; hover mixes the accent 12% toward black.
- **Ghost:** transparent with text-2, gaining the hover tone and full text colour on hover.
- **Danger:** default button with bad-text, used for destructive actions such as Unplug.
- **Focus:** a 2px cobalt outline at 2px offset on every focusable element.

### Segmented Controls
- **Style:** a 7px track tinted 6% of text, holding 24px buttons; the pressed segment becomes a field-coloured thumb with a small shadow. The menu-bar speed control uses the same shape with a cobalt pressed state.

### Pills
- **Style:** 20px, fully rounded, 11.5px at 550 weight. Neutral pills tint 7% of text. State pills (ok, warn, bad) use the soft fill with the readable text variant, and accent pills use accent-soft with accent-text.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** field on a window background.
- **Shadow Strategy:** none, per the Flat Content Rule.
- **Border:** 0.5px line-strong, with a line divider under the header.
- **Internal Padding:** headers at 10 to 11px by 14px, content at 12 to 14px.

### Inputs / Fields
- **Style:** 28px, field background, 0.5px line-strong border, 6px radius; search fields use 7px with a 14px Lucide icon inset at 8px.
- **Focus:** the shared cobalt outline.

### Navigation
- **Sidebar:** 210px on win-side with 11px group headings in text-3. Rows are 28px with a 16px accent-text icon and a mono count on the right; hover uses the hover tone, and the active row fills with cobalt and turns icon and count to accent-ink. Locked rows dim to text-3.
- **Menu bar:** 30px, translucent, with 22px items that tint 10% on hover; it holds the logo menu, app name, game-speed control, mono date, cash and the ticket badge.
- **Dock:** 46px rounded tiles (11px) in per-app colours with a top-light gradient, a running dot underneath and a red count badge; hover lifts the tile 6px with a 160ms ease-out.

### Tables
- **Style:** full width, sticky 30px headers in 11.5px text-3 at 600, 34px rows with line dividers, right-aligned numeric columns and a light hover tint.

### Notification Banners
- **Style:** 14px radius on the translucent banner surface with the popover shadow, a 32px app-coloured icon tile, an app name, a 600 title, secondary text and a time.

### Device Fronts (signature)
Every rack device is an SVG front drawn in code at true unit height on near-black metal with rack ears. Brand servers each have their own bezel, switches come in 24 and 48 port sizes with SFP cages, and patch panels, storage and blade units share the same language. Status LEDs and port lights use brighter LED variants of the state colours plus cyan for activity and fiber. Port groups are outlined with a dashed violet line, and empty rack units collapse into one labelled free range. The same drawing is reused at miniature scale in lists, the rack column and the inspector.

## Do's and Don'ts

### Do:
- **Do** take every colour from the shell tokens so light and dark mode switch together.
- **Do** set every number in JetBrains Mono with tabular figures.
- **Do** keep green, amber and red for device and SLA state, and show business figures in neutral text.
- **Do** use Lucide icons at 16px with a 1.75 stroke inside windows.
- **Do** draw hardware in code and reuse the same front wherever that device appears.
- **Do** give only the front window the deep shadow.

### Don't:
- **Don't** colour prices, revenue or plan figures green or red to mean good or bad.
- **Don't** introduce a second accent hue in the chrome.
- **Don't** put shadows on cards or lists inside a window.
- **Don't** build screens as a dashboard of floating cards or style app windows as a hacker terminal. The technician terminal is the one console surface, and it sits on near-black metal inside a normal window.
- **Don't** add uppercase tracked labels or eyebrows above headings.
