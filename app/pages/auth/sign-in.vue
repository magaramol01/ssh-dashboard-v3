<script setup lang="ts">
/**
 * Mock sign-in. Everything is theatre — the form takes any input and
 * lands on /dashboard. The "Continue as…" row is the real entry point:
 * it sets the demo persona and routes. Rendered without the dashboard
 * layout so the centred card owns the viewport.
 */
import { ref } from 'vue'
import { Mail, Lock, ArrowRight } from 'lucide-vue-next'
import Logo from '@/components/ui/Logo.vue'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import type { Persona } from '~/composables/usePersona'

useHead({ title: 'Sign in · Zepp' })
definePageMeta({ layout: false })

const { set: setPersona } = usePersona()
const { tenant } = useTenant()

function targetDashboard() {
  return tenant.value ? `/${tenant.value}/dashboard` : '/asiaticlloyd/dashboard'
}

const email = ref('')
const password = ref('')
const remember = ref(true)
const isLoading = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  if (!email.value || !password.value) {
    toast.error('Please enter your email and password')
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await $fetch<{
      success: boolean
      message?: string
      user?: { email?: string; firstName?: string; userName?: string; role?: string }
      authToken?: string
    }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        tenant: tenant.value || 'asiaticlloyd',
      },
    })

    if (res.success) {
      toast.success(res.message || `Signed in as ${res.user?.firstName || res.user?.userName || email.value}`)
      setPersona('admin')
      await navigateTo(targetDashboard())
    } else {
      toast.error(res.message || 'Login failed')
    }
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || 'Login failed. Please check credentials.'
    errorMessage.value = msg
    toast.error(msg)
  } finally {
    isLoading.value = false
  }
}
async function continueWithSso(provider: 'Google' | 'Microsoft') {
  toast.info(`Continuing with ${provider} (mock)`)
  await navigateTo(targetDashboard())
}
async function continueAs(persona: Persona, label: string) {
  setPersona(persona)
  toast.success(`Continuing as ${label}`)
  await navigateTo(targetDashboard())
}
async function fakeForgot() {
  toast.info('Password reset link sent (mock)')
}
async function fakeSignUp() {
  toast.info('Sign-up is mocked — landing you on the dashboard')
  await navigateTo(targetDashboard())
}

const personas: Array<{ key: Persona; label: string; tagline: string }> = [
  { key: 'admin', label: 'Admin', tagline: 'See everything' },
  { key: 'dispatcher', label: 'Dispatcher', tagline: 'Run operations' },
  { key: 'customer', label: 'Customer', tagline: 'Track my bike' },
]
</script>

<template>
  <div class="bg-muted/40 grid min-h-screen place-items-center p-4">
    <div class="w-full max-w-md space-y-4">
      <Card class="rounded-2xl">
        <CardContent class="space-y-6 p-6 sm:p-8">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <div class="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg shadow-sm">
                <Logo class="size-7" />
              </div>
              <div class="flex flex-col leading-tight">
                <span class="text-sm font-semibold tracking-tight">Smart Ship Hub</span>
                <span class="text-muted-foreground text-xs">Marine operations · </span>
              </div>
            </div>
            <div class="space-y-1 pt-2">
              <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p class="text-muted-foreground text-sm">Sign in to Your account.</p>
            </div>
          </div>

          <form class="space-y-4" @submit.prevent="handleSubmit">
            <div class="space-y-1.5">
              <Label for="email" class="text-sm font-medium">Work email</Label>
              <div class="relative">
                <Mail class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input id="email" v-model="email" type="email" name="email" autocomplete="username" placeholder="you@company.com" class="pl-9" />
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <Label for="password" class="text-sm font-medium">Password</Label>
                <Button type="button" variant="ghost" size="sm" class="h-auto px-1 text-xs font-medium" @click="fakeForgot">Forgot password?</Button>
              </div>
              <div class="relative">
                <Lock class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input id="password" v-model="password" type="password" name="password" autocomplete="current-password" show-password-toggle placeholder="••••••••" class="pl-9" />
              </div>
            </div>

            <label class="flex cursor-pointer items-center gap-2">
              <Checkbox id="remember" v-model="remember" />
              <span class="text-muted-foreground text-sm">Remember me on this device</span>
            </label>

            <div v-if="errorMessage" class="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {{ errorMessage }}
            </div>

            <Button type="submit" class="w-full" :disabled="isLoading">
              <span v-if="isLoading" class="flex items-center gap-2">
                Signing in...
              </span>
              <span v-else class="inline-flex items-center">
                Sign in<ArrowRight class="ml-2 size-4" />
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  </div>
</template>
