/**
 * Sidebar navigation tree. Single source of truth — used by the sidebar
 * block for rendering and by AppBreadcrumb for "where am I" lookups.
 * Adding a page means: drop a row here + write the page file. The persona
 * filter happens at render time.
 *
 * Order here is the order the sidebar renders. Section labels split
 * groups. `requires` restricts a row to a persona level (or higher).
 *
 * Smart Ship Hub operations: the tree follows the supply chain —
 * inbound (China → warehouse) → inventory → fulfilment (WH → DC → consumer)
 * → network → fleet → customers → insights.
 */
import type { Persona } from "~/composables/usePersona";
import { PERSONA_RANK } from "~/composables/usePersona";

export interface NavItem {
  label: string;
  to?: string;
  icon?: string;
  requires?: Persona;
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Control tower", to: "/control-tower", icon: "TowerControl", requires: "dispatcher" },
      { label: "Dashboard", to: "/dashboard", icon: "LayoutDashboard" },
    ],
  },
  {
    label: "Emissions",
    items: [{ label: "CII Tracking", to: "/emissions", icon: "Gauge", requires: "dispatcher" }],
  },
  {
    label: "Inventory",
    items: [
      { label: "Stock", to: "/inventory", icon: "Boxes", requires: "dispatcher" },
      { label: "Catalog", to: "/catalog", icon: "Bike", requires: "dispatcher" },
    ],
  },
  {
    label: "Fulfilment",
    items: [
      { label: "Movements", to: "/shipments", icon: "Package", requires: "dispatcher" },
      { label: "Live tracking", to: "/live", icon: "Radar", requires: "dispatcher" },
      { label: "New order", to: "/shipments/new", icon: "PackagePlus", requires: "dispatcher" },
      { label: "Track my bike", to: "/tracking", icon: "Search" },
    ],
  },
  {
    label: "Network",
    items: [
      { label: "Warehouses", to: "/warehouses", icon: "Warehouse", requires: "dispatcher" },
      { label: "Distribution centers", to: "/distribution-centers", icon: "Store", requires: "dispatcher" },
      { label: "Routes", to: "/routes", icon: "Route", requires: "dispatcher" },
    ],
  },
  {
    label: "Fleet",
    items: [
      { label: "Vehicles", to: "/fleet", icon: "Truck", requires: "dispatcher" },
      { label: "Drivers", to: "/drivers", icon: "IdCard", requires: "dispatcher" },
    ],
  },
  {
    label: "Customers",
    items: [{ label: "Customers", to: "/customers", icon: "Users", requires: "dispatcher" }],
  },
  {
    label: "Insights",
    items: [{ label: "Analytics", to: "/analytics", icon: "BarChart3", requires: "dispatcher" }],
  },
  {
    label: "Settings",
    items: [{ label: "Workspace", to: "/settings", icon: "Settings" }],
  },
];

/** Walks NAV + returns the matching item for a given path (or null). Supports tenant prefix. */
export function findNavItem(path: string, tenant?: string): NavItem | null {
  let normalized = path
  if (tenant && normalized.startsWith(`/${tenant}`)) {
    normalized = normalized.slice(tenant.length + 1) || '/'
  }
  for (const section of NAV) {
    for (const item of section.items) {
      if (item.to === normalized || item.to === path) return item;
    }
  }
  return null;
}

/** Filters NAV to only items the given persona can see, optionally prefixing routes with the tenant. */
export function navForPersona(persona: Persona, tenant?: string): NavSection[] {
  return NAV.map((section) => ({
    label: section.label,
    items: section.items
      .filter((item) => {
        if (!item.requires) return true;
        return PERSONA_RANK[persona] >= PERSONA_RANK[item.requires];
      })
      .map((item) => ({
        ...item,
        to: item.to && tenant ? `/${tenant}${item.to}` : item.to,
      })),
  })).filter((section) => section.items.length > 0);
}

