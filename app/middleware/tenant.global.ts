import { isReservedTenant } from '~~/shared/constants/tenants'

/**
 * Global route middleware for multi-tenancy.
 *
 * 1. Synchronizes the active tenant from route params.
 * 2. Rejects reserved routes visited as tenant prefix (yields 404).
 * 3. Rewrites in-app relative navigations to maintain the current tenant context.
 * 4. Preserves un-prefixed root '/' (tenant selector) and '/auth/sign-in'.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const activeTenantState = useState<string>('activeTenant', () => '')

  const toTenant = to.params.tenant as string | undefined
  const fromTenant = from.params.tenant as string | undefined

  // 1. If destination has a reserved route name as tenant param (e.g. someone requested /live), 404
  if (toTenant && isReservedTenant(toTenant)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  // 2. If destination has a valid tenant in params, update active state
  if (toTenant) {
    activeTenantState.value = toTenant
    return
  }

  // 2. Allow root '/' (tenant selection screen) and unprefixed auth
  if (to.path === '/' || to.path === '/auth/sign-in') {
    return
  }

  // 3. If an in-app transition occurs without a tenant param (e.g. navigateTo('/403')),
  // but we came from an active tenant session, retain the tenant prefix:
  const currentTenant = fromTenant || activeTenantState.value
  if (currentTenant && from.path !== '/' && from.path !== '') {
    return navigateTo(`/${currentTenant}${to.fullPath}`)
  }
})
