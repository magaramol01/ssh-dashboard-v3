import { computed, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
const COOKIE_KEY = 'uipkge-theme'

// useCookie is Nuxt-auto-imported. The cookie path matters: the server
// SSR renderer reads this cookie to decide the initial `theme` value
// before the first HTML is sent down, which means ThemeSwitch renders
// the same icon on the server as the client will produce on hydration.
// localStorage can't do that -- it doesn't exist server-side, so the
// SSR pass would always render `system` and then the client would flip
// to whatever was saved, producing a hydration mismatch warning.

export function useTheme() {
  const theme = useCookie<Theme>(COOKIE_KEY, {
    // Light is the default until the user explicitly picks dark/system.
    default: () => 'light',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  const systemDark = useState<boolean>('theme-sys-dark', () => false)

  function apply(next: Theme) {
    if (typeof window === 'undefined') return
    const sysMatches = window.matchMedia('(prefers-color-scheme: dark)').matches
    systemDark.value = sysMatches
    const isDarkValue = next === 'dark' || (next === 'system' && sysMatches)
    document.documentElement.classList.toggle('dark', isDarkValue)
  }

  function setTheme(next: Theme) {
    theme.value = next
    apply(next)
  }

  const isDark = computed<boolean>(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    return systemDark.value
  })

  if (typeof window !== 'undefined') {
    apply(theme.value)
    watch(theme, apply)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    if (media && media.addEventListener) {
      media.addEventListener('change', (e) => {
        systemDark.value = e.matches
        if (theme.value === 'system') {
          document.documentElement.classList.toggle('dark', e.matches)
        }
      })
    }
  }

  return { theme, setTheme, isDark }
}

