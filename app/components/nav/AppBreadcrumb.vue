<script setup lang="ts">
/**
 * Breadcrumb derived from the route path. First segment maps to its NAV
 * section/item label; subsequent segments render as-is (titleized).
 *
 * /dashboard            -> Dashboard
 * /people               -> People
 * /people/E-203         -> People > E-203
 * /settings/persona     -> Settings > Persona
 */
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { findNavItem } from '~/lib/nav'

const route = useRoute()
const { tenant } = useTenant()

const crumbs = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  if (!segments.length) return []

  const activeTenant = tenant.value
  let activeSegments = segments
  let baseAcc = ''

  if (activeTenant && segments[0] === activeTenant) {
    baseAcc = `/${activeTenant}`
    activeSegments = segments.slice(1)
  }

  if (!activeSegments.length) {
    return [{ label: titleize(activeTenant || 'Home') }]
  }

  const out: { label: string; to?: string }[] = []
  let acc = baseAcc
  for (let i = 0; i < activeSegments.length; i++) {
    acc += '/' + activeSegments[i]
    const match = findNavItem(acc, activeTenant)
    const label = match?.label ?? titleize(activeSegments[i]!)
    const isLast = i === activeSegments.length - 1
    out.push({ label, to: isLast ? undefined : acc })
  }
  return out
})

function titleize(s: string) {
  return s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}
</script>

<template>
  <Breadcrumb v-if="crumbs.length">
    <BreadcrumbList>
      <template v-for="(c, i) in crumbs" :key="c.label + i">
        <BreadcrumbItem>
          <BreadcrumbLink v-if="c.to" :as-child="true">
            <NuxtLink :to="c.to">{{ c.label }}</NuxtLink>
          </BreadcrumbLink>
          <BreadcrumbPage v-else>{{ c.label }}</BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator v-if="i < crumbs.length - 1" />
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
