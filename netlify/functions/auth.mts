import type { Config, Context } from '@netlify/functions'
import {
  clearSessionCookie,
  createSession,
  passwordFor,
  readSession,
  setSessionCookie,
  type SessionRole,
} from '../lib/auth.js'

export default async (request: Request, context: Context) => {
  if (request.method === 'GET') {
    return Response.json({ role: await readSession(context) })
  }

  if (request.method === 'DELETE') {
    clearSessionCookie(context)
    return Response.json({ ok: true })
  }

  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { password, role = 'resident' } = (await request.json()) as {
    password?: string
    role?: SessionRole
  }
  const expectedPassword = passwordFor(role)
  if (!expectedPassword) {
    return Response.json(
      { error: `${role === 'admin' ? 'ADMIN_PASSWORD' : 'CINEMA_PASSWORD'} is not configured.` },
      { status: 503 },
    )
  }
  if (!password || password !== expectedPassword) {
    return Response.json({ error: 'That password is not correct.' }, { status: 401 })
  }

  setSessionCookie(context, await createSession(role))
  return Response.json({ role })
}

export const config: Config = { path: '/api/auth' }

