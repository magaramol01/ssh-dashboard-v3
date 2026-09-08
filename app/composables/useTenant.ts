import { computed } from 'vue'

/**
 * Multi-tenant composable.
 *
 * Provides reactive access to the current tenant ID extracted from the
 * route parameter (`/:tenant/...`) with fallbacks to path segments.
 * Exposes helpers to build tenant-prefixed routes.
 */
export function useTenant() {
  const route = useRoute()

  const tenant = computed<string>(() => {
    // 1. From route param (preferred)
    if (route.params.tenant && typeof route.params.tenant === 'string') {
      return route.params.tenant
    }

    // 2. Fallback from current path
    if (route.path) {
      const seg = route.path.split('/').filter(Boolean)[0]
      if (seg && !['_nuxt', 'api', 'auth', 'favicon.ico'].includes(seg)) {
        return seg
      }
    }

    return ''
  })

  /**
   * Prepends the active tenant prefix to a path if not already prefixed.
   * e.g. '/live' -> '/asiaticlloyd/live'
   */
  function tenantPath(path: string): string {
    if (!path || path.startsWith('http') || path.startsWith('//')) {
      return path
    }

    const clean = path.startsWith('/') ? path : `/${path}`
    const active = tenant.value

    if (!active) {
      return clean
    }

    if (clean === `/${active}` || clean.startsWith(`/${active}/`)) {
      return clean
    }

    return `/${active}${clean}`
  }

  /**
   * Tenant-aware navigation helper.
   */
  function tenantNavigate(path: string, options?: Parameters<typeof navigateTo>[1]) {
    return navigateTo(tenantPath(path), options)
  }

  return {
    tenant,
    tenantId: tenant,
    tenantPath,
    tenantNavigate,
  }
}
