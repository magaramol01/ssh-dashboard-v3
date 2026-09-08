/**
 * Tenant & Request Tracing Fetch Interceptor.
 *
 * Automatically injects:
 *   - `x-tenant-id`: active tenant extracted from route / URL.
 *   - `x-request-id`: UUID v4 for request tracing.
 * into all $fetch and useFetch calls made from the client.
 */
export default defineNuxtPlugin(() => {
  const originalFetch = globalThis.$fetch

  if (!originalFetch) return

  globalThis.$fetch = originalFetch.create({
    onRequest({ options }) {
      const headers = new Headers(options.headers || {})

      // Determine active tenant from route or pathname
      let tenant = ''
      try {
        const { tenant: activeTenant } = useTenant()
        tenant = activeTenant.value
      } catch {
        // Fallback if route context unavailable
      }

      if (!tenant && typeof window !== 'undefined') {
        const seg = window.location.pathname.split('/').filter(Boolean)[0]
        if (seg && !['_nuxt', 'api', 'auth', 'favicon.ico'].includes(seg)) {
          tenant = seg
        }
      }

      if (tenant && !headers.has('x-tenant-id')) {
        headers.set('x-tenant-id', tenant)
      }

      if (!headers.has('x-request-id')) {
        headers.set('x-request-id', crypto.randomUUID())
      }

      options.headers = headers
    },
    onResponseError({ response, request }) {
      const url = request?.toString() || ''
      // On 401 Unauthorized (except the login endpoint itself), redirect to sign-in
      if (response.status === 401 && !url.includes('/api/auth/login')) {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/sign-in')) {
          window.location.href = '/auth/sign-in'
        }
      }
    },
  })
})
