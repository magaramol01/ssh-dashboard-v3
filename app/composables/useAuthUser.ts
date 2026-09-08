export interface AuthUser {
  email: string
  firstName?: string
  userName?: string
  role?: string
  company?: string
}

const DEFAULT_USER: AuthUser = {
  email: 'a.magar@smartshiphub.com',
  firstName: 'amol',
  userName: 'amol magar',
  role: 'Smart Ship Super User',
  company: 'smartshiphub',
}

function titleCase(str?: string): string {
  if (!str) return ''
  return str
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function useAuthUser() {
  const userCookie = useCookie<AuthUser | null>('ssh_user', {
    default: () => null,
  })

  const user = computed<AuthUser>(() => userCookie.value || DEFAULT_USER)

  const displayName = computed(() => {
    const raw = user.value.userName || user.value.firstName || user.value.email.split('@')[0]
    return titleCase(raw) || 'Amol Magar'
  })

  const email = computed(() => user.value.email || DEFAULT_USER.email)

  const initials = computed(() => {
    const name = displayName.value
    if (!name) return 'AM'
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  })

  const role = computed(() => user.value.role || DEFAULT_USER.role)
  const company = computed(() => user.value.company || DEFAULT_USER.company)

  function logout() {
    const authToken = useCookie('auth_token')
    const refreshToken = useCookie('refresh_token')
    authToken.value = null
    refreshToken.value = null
    userCookie.value = null
  }

  return {
    user,
    displayName,
    email,
    initials,
    role,
    company,
    logout,
  }
}
