# Sticky Emissions & CII Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Emissions & CII page header and filter controls bar sticky below the navigation topbar with glassmorphic styling and proper full-bleed gutter margins.

**Architecture:** Apply Tailwind sticky positioning (`sticky top-14 z-20`) with negative margins (`-mx-4 md:-mx-6 -mt-4 md:-mt-6`), compensating padding, and backdrop blur (`bg-background/95 backdrop-blur`) on the header container in `app/pages/emissions.vue`.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind CSS v4, Radix/shadcn-vue Select components.

## Global Constraints
- Do not modify SSR-sensitive or deterministic mock structures.
- Use semantic Tailwind tokens (`bg-background`, `border-border`, `text-foreground`).
- Maintain `top-14` offset to cleanly align underneath the `h-14` `AppTopbar`.
- Keep z-index at `z-20` so dropdowns (`SelectContent`) and topbar (`z-30`) maintain correct stacking.

---

### Task 1: Update Emissions Header Container to be Sticky

**Files:**
- Modify: `app/pages/emissions.vue:898-904`

**Interfaces:**
- Consumes: Existing header template in `app/pages/emissions.vue`
- Produces: Sticky header strip with full-width backdrop and border

- [ ] **Step 1: Update header classes in `app/pages/emissions.vue`**

Modify line 900 of `app/pages/emissions.vue`:
```html
      <!-- Header Controls & Filters -->
      <div class="sticky top-14 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-3.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-xs flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
```

- [ ] **Step 2: Verify type check and build / dev compilation**

Run: `npx nuxi typecheck` or `npm run build` (or check console for template compilation errors).

- [ ] **Step 3: Commit changes**

```bash
git add app/pages/emissions.vue docs/superpowers/plans/2026-09-09-sticky-emissions-header.md
git commit -m "feat(emissions): make header controls and filters sticky at top-14"
```
