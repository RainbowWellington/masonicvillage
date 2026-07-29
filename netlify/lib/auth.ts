import type { Context } from '@netlify/functions'

export type SessionRole = 'resident' | 'admin'

const encoder = new TextEncoder()

function toBase64Url(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function signature(payload: string) {
  const secret = Netlify.env.get('SESSION_SECRET') || `${Netlify.env.get('CINEMA_PASSWORD')}:${Netlify.env.get('ADMIN_PASSWORD')}`
  if (!secret) return ''
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const result = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64Url(String.fromCharCode(...new Uint8Array(result)))
}

export async function createSession(role: SessionRole) {
  const payload = toBase64Url(JSON.stringify({ role, expires: Date.now() + 1000 * 60 * 60 * 12 }))
  return `${payload}.${await signature(payload)}`
}

export async function readSession(context: Context): Promise<SessionRole | null> {
  const token = context.cookies.get('cinema_session')
  if (!token) return null
  const [payload, suppliedSignature] = token.split('.')
  if (!payload || !suppliedSignature || suppliedSignature !== (await signature(payload))) return null
  try {
    const standardPayload = payload.replaceAll('-', '+').replaceAll('_', '/')
    const paddedPayload = standardPayload.padEnd(Math.ceil(standardPayload.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(paddedPayload)) as {
      role: SessionRole
      expires: number
    }
    return decoded.expires > Date.now() ? decoded.role : null
  } catch {
    return null
  }
}

export function passwordFor(role: SessionRole) {
  return Netlify.env.get(role === 'admin' ? 'ADMIN_PASSWORD' : 'CINEMA_PASSWORD')
}

export function setSessionCookie(context: Context, value: string) {
  context.cookies.set({
    name: 'cinema_session',
    value,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 12,
  })
}

export function clearSessionCookie(context: Context) {
  context.cookies.delete('cinema_session')
}
