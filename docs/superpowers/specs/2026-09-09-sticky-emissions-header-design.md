# Design Document: Sticky Emissions & CII Header & Controls Bar

## Objective
Keep the vessel header and interactive controls (Vessel selector, Year selector, Voyage selector, Refresh, CSV Export, and Copilot trigger) pinned to the top of the viewport when scrolling down the Emissions & CII dashboard.

## Context & Constraints
- **Layout Topbar**: `AppTopbar` is `sticky top-0 z-30 h-14` (56px).
- **Page Container**: Has padding `p-4 md:p-6 pb-12`.
- **Copilot Drawer**: `SentinelCopilotPanel` docks at `top-14 right-0 z-30` (or `fixed inset-0 z-50` when fullscreen). When docked, the main dashboard has right margin `lg:mr-[440px] xl:mr-[480px]`.
- **Theme**: Supports light and dark mode with semantic OKLCH Tailwind tokens (`bg-background/95`, `border-border`, etc.).

## Architecture & Design

### 1. Positioning & Spacing
- Position: `sticky top-14`
- Stacking: `z-20` (below global `AppTopbar` at `z-30` and `SentinelCopilotPanel` at `z-30`, above all dashboard body cards, charts, and tables).
- Margins & Padding:
  - Negative horizontal margin `-mx-4 md:-mx-6` with compensating padding `px-4 md:px-6` so the blurred backdrop spans edge-to-edge across the dashboard area.
  - Negative top margin `-mt-4 md:-mt-6` with compensating top padding `pt-4 md:pt-5 pb-4` so at scroll position 0 it aligns with existing layout spacing, and upon scrolling locks flush against `AppTopbar`.

### 2. Glassmorphic Surface
- `bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80`
- `border-b border-border shadow-xs`

### 3. Layout Structure
- Title, vessel badge, and MARPOL description on the left (`flex items-center gap-2.5`).
- Selectors (Vessel, Year, Voyage) and action buttons (Refresh, CSV Export, Copilot) on the right (`flex flex-wrap items-center gap-2.5`).

## Verification & Testing
- Verify scroll behavior: Header stays pinned at `top-14` under `AppTopbar` during vertical scroll.
- Verify dropdowns: Select popups (`SelectContent`) open and remain interactable without being clipped.
- Verify Copilot sidebar interactions: Margin transition and layout work smoothly when Copilot is toggled.
- Verify theme consistency: Blur and background match dark and light themes.
