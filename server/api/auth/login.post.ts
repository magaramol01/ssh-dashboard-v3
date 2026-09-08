import { createError, defineEventHandler, readBody, setCookie, appendResponseHeader } from 'h3'
import { validateUser } from '../../utils/http-adapter'

interface LoginRequestBody {
  email?: string
  password?: string
  tenant?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginRequestBody>(event)
  const email = body?.email?.trim()
  const password = body?.password?.trim()

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required',
    })
  }

  const tenant = body?.tenant || event.context.tenant

  const response = await validateUser({
    email,
    password,
    tenant,
    event,
  })

  if (!response.success || !response.data?.authToken) {
    const errorMsg = response.data?.msg || 'Authentication failed. Please check your credentials.'
    throw createError({
      statusCode: response.status >= 400 ? response.status : 401,
      statusMessage: errorMsg,
      data: { message: errorMsg },
    })
  }

  const data = response.data
  const maxAge = data.expiresIn || 28800 // default 8 hours

  // Set authToken cookie (accessible to client and SSR requests)
  setCookie(event, 'auth_token', data.authToken, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  })

  // Set refreshToken cookie (httpOnly for security)
  if (data.refreshToken) {
    setCookie(event, 'refresh_token', data.refreshToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    })
  }

  // Set user profile cookie for convenient UI display
  const userProfile = {
    email: data.Email,
    firstName: data.FirstName,
    userName: data.UserName,
    role: data.Role,
    company: data.CompanyName,
  }

  setCookie(event, 'ssh_user', JSON.stringify(userProfile), {
    path: '/',
    maxAge,
    sameSite: 'lax',
  })

  return {
    success: true,
    message: data.msg || 'User Login Success',
    user: userProfile,
    authToken: data.authToken,
    expiresIn: maxAge,
  }
})
