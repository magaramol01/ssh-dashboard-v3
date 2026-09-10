# Vessel Dashboard CII-Alignment Implementation Plan

**Goal:** Transform the Vessel Dashboard into a 1:1 visual match with the CII / Emissions intelligence page (`app/pages/emissions.vue`), adopting its spacing (`space-y-6`, `p-4 md:p-6 pb-12`), standard shadcn `<Card>` hierarchy, 6-tile operational KPI grid, context strip, and `useChartTheme` tokens.

**Architecture:** Nuxt 4, Vue 3, Tailwind CSS v4 with semantic tokens, shadcn-vue Card/Select/Button/Badge components.

---

### Task 1: 6-Tile Operational KPI Grid (`VesselKpiStrip.vue`)
- Convert `VesselKpiStrip.vue` into the 6-tile grid from `emissions.vue` lines 1196–1250.
- `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">`.
- `<Card class="shadow-xs"><CardContent class="p-4 space-y-1.5">`.
- SOG, Fuel Rate, Shaft Power, Voyage Progress, Exhaust Thermal Avg, Alarms Rail.
- Verify tests with `npm test`.

### Task 2: Page Header & Context Strip (`VesselHeaderBar.vue`)
- Sticky top header (`top-14 z-20`, `bg-background/95 backdrop-blur`, `border-b border-border`) with `Gauge` icon in `size-9 rounded-lg bg-primary/10 text-primary border border-primary/20`.
- Standard shadcn `<Select>` for vessel and sister group, `<Button>` for refresh and alarms toggle.
- Context Strip (`bg-card/70 border rounded-xl p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs`) with vessel name, DWT, route ports, ETA, and VSAT status.

### Task 3: Middle Operations Section Cards (`VesselVoyageMap.vue` & `VesselRadialCockpit.vue`)
- Wrap in standard `<Card class="shadow-xs flex flex-col">` with `<CardHeader class="p-4 pb-2">` and `<CardTitle class="text-sm font-semibold">`.
- Layout: `grid gap-6 lg:grid-cols-12` (7 cols map, 5 cols cockpit).
- Use standard `bg-muted` for cockpit tab buttons and theme-aligned colors.

### Task 4: Multi-Graph Analytics Section (`VesselTelemetryChart.vue`, `VesselCylinderBarChart.vue`, `VesselDiagnosticsMatrix.vue`)
- Wrap in standard `<Card class="shadow-xs">` with `<CardHeader class="p-4 pb-2">` and `<CardTitle class="text-sm font-semibold">`.
- Adopt `useChartTheme` (`chartTextColor`, `chartAxisColor`, `chartSplitLineColor`, `chartTooltipBg`, etc.) from `@/components/ui/charts/useChartTheme`.
- Layout: `grid gap-6 lg:grid-cols-12` (7 cols timeline, 5 cols cylinder bar), full-width diagnostics matrix.

### Task 5: Sliding Alarms Drawer & Page Assembly (`app/pages/dashboard.vue`)
- Page container: `space-y-6 p-4 md:p-6 pb-12 transition-[margin] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]`.
- Docked/sliding alarms rail matching `SentinelCopilotPanel` dock in `emissions.vue`.
- Verification: `npm test` and `npm run build`.
