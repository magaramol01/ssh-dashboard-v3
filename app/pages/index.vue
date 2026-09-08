<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Building2, Ship, Search, ShieldCheck } from 'lucide-vue-next'
import Logo from '@/components/ui/Logo.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

useHead({ title: 'Select Organization · Smart Ship Hub' })
definePageMeta({ layout: false })

const customTenant = ref('')

const sampleTenants = [
  {
    id: 'asiaticlloyd',
    name: 'Asiatic Lloyd Maritime',
    code: 'asiaticlloyd',
    vessels: '18 Active Vessels',
    tag: 'Primary Fleet',
  },
  {
    id: 'xyz',
    name: 'XYZ Logistics Hub',
    code: 'xyz',
    vessels: '12 Active Vessels',
    tag: 'Charter Operations',
  },
  {
    id: 'maersk',
    name: 'Maersk Regional Lines',
    code: 'maersk',
    vessels: '34 Active Vessels',
    tag: 'Global Carrier',
  },
]

function selectTenant(tenantId: string) {
  const normalized = tenantId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!normalized) return
  navigateTo(`/${normalized}/dashboard`)
}

function handleCustomSubmit() {
  if (!customTenant.value.trim()) return
  selectTenant(customTenant.value)
}
</script>

<template>
  <div class="bg-muted/30 grid min-h-screen place-items-center p-4">
    <div class="w-full max-w-lg space-y-6">
      <!-- Brand Header -->
      <div class="flex items-center justify-center gap-3">
        <div class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl shadow-md">
          <Logo class="size-7" />
        </div>
        <div class="text-left">
          <span class="font-display block text-lg font-bold tracking-tight">Smart Ship Hub</span>
          <span class="text-muted-foreground block text-xs tracking-wide">Multi-Tenant Marine Operations</span>
        </div>
      </div>

      <Card class="rounded-2xl shadow-sm border">
        <CardContent class="space-y-6 p-6 sm:p-8">
          <div class="space-y-1.5 text-center sm:text-left">
            <h1 class="text-2xl font-semibold tracking-tight">Select Organization</h1>
            <p class="text-muted-foreground text-sm">
              Choose your organization workspace to access fleet telemetry, live tracking, and operations.
            </p>
          </div>

          <!-- Preset Tenant Cards -->
          <div class="space-y-2.5">
            <Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Workspaces</Label>
            <div class="grid gap-2">
              <button
                v-for="t in sampleTenants"
                :key="t.id"
                type="button"
                class="group flex items-center justify-between rounded-xl border bg-card p-3.5 text-left transition hover:border-primary/50 hover:bg-muted/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="selectTenant(t.id)"
              >
                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Ship class="size-5" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-foreground">{{ t.name }}</span>
                      <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                        /{{ t.code }}
                      </span>
                    </div>
                    <span class="text-xs text-muted-foreground">{{ t.vessels }} · {{ t.tag }}</span>
                  </div>
                </div>
                <ArrowRight class="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            </div>
          </div>

          <div class="relative flex items-center justify-center">
            <div class="border-border absolute inset-0 border-t" />
            <span class="bg-card text-muted-foreground relative px-3 text-xs uppercase tracking-wider">Or enter custom tenant</span>
          </div>

          <!-- Custom Tenant Input Form -->
          <form class="space-y-3" @submit.prevent="handleCustomSubmit">
            <div class="space-y-1.5">
              <Label for="tenantInput" class="text-xs font-medium">Tenant slug / identifier</Label>
              <div class="relative">
                <Building2 class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  id="tenantInput"
                  v-model="customTenant"
                  placeholder="e.g. asiaticlloyd, xyz, custom-carrier"
                  class="pl-9 font-mono text-sm"
                />
              </div>
            </div>
            <Button type="submit" class="w-full" :disabled="!customTenant.trim()">
              Continue to Workspace
              <ArrowRight class="ml-2 size-4" />
            </Button>
          </form>

          <!-- Direct Links -->
          <div class="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t">
            <span class="flex items-center gap-1">
              <ShieldCheck class="size-3.5 text-success" />
              Tenant-isolated telemetry
            </span>
            <NuxtLink to="/auth/sign-in" class="hover:text-foreground underline underline-offset-4">
              Sign in with credentials
            </NuxtLink>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
