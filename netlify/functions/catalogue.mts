import type { Config, Context } from '@netlify/functions'
import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dvds } from '../../db/schema.js'
import { readSession } from '../lib/auth.js'
import { getMovie, LookupError } from '../lib/movie-data.js'

function clean(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export default async (request: Request, context: Context) => {
  try {
    return await handle(request, context)
  } catch (error) {
    // Lookup problems are worth showing; anything else stays server-side.
    if (error instanceof LookupError) return Response.json({ error: error.message }, { status: 400 })
    console.error('catalogue request failed', error)
    return Response.json({ error: 'The catalogue could not be reached. Please try again.' }, { status: 500 })
  }
}

async function handle(request: Request, context: Context) {
  const role = await readSession(context)
  if (!role) return Response.json({ error: 'Please sign in.' }, { status: 401 })

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))

  if (request.method === 'GET') {
    if (id) {
      const [dvd] = await db.select().from(dvds).where(eq(dvds.id, id)).limit(1)
      if (!dvd) return Response.json({ error: 'DVD not found.' }, { status: 404 })
      return Response.json({ dvd, role })
    }

    const query = url.searchParams.get('q')?.trim()
    const genre = url.searchParams.get('genre')?.trim()
    const conditions: SQL[] = []
    if (query) {
      const term = `%${query}%`
      const searchCondition = or(ilike(dvds.title, term), ilike(dvds.genre, term), ilike(dvds.director, term), ilike(dvds.cast, term))
      if (searchCondition) conditions.push(searchCondition)
    }
    if (genre) conditions.push(ilike(dvds.genre, `%${genre}%`))
    const rows = await db
      .select()
      .from(dvds)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(dvds.title))
      .limit(500)
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(dvds)
    return Response.json({ dvds: rows, total: Number(count), role })
  }

  if (request.method === 'POST') {
    const body = (await request.json()) as Record<string, unknown>
    const details = body.imdbId || body.lookupTitle
      ? await getMovie(clean(body.imdbId) || undefined, clean(body.lookupTitle) || undefined)
      : null
    const title = clean(body.title) || details?.title
    if (!title) return Response.json({ error: 'A title is required.' }, { status: 400 })
    const [dvd] = await db
      .insert(dvds)
      .values({
        title,
        year: details?.year || clean(body.year),
        director: details?.director || clean(body.director),
        genre: details?.genre || clean(body.genre),
        cast: details?.cast || clean(body.cast),
        plot: details?.plot || clean(body.plot),
        runtime: details?.runtime || clean(body.runtime),
        rating: details?.rating || clean(body.rating),
        imdbRating: details?.imdbRating || clean(body.imdbRating),
        imdbId: details?.imdbId || clean(body.imdbId),
        posterUrl: details?.posterUrl || clean(body.posterUrl),
        shelf: clean(body.shelf),
        barcode: clean(body.barcode),
        detailsSource: details?.detailsSource || 'resident entry',
      })
      .returning()
    return Response.json({ dvd }, { status: 201 })
  }

  if (role !== 'admin') return Response.json({ error: 'Admin access is required.' }, { status: 403 })

  if (request.method === 'PATCH') {
    if (!id) return Response.json({ error: 'DVD ID is required.' }, { status: 400 })
    const body = (await request.json()) as Record<string, unknown>

    // Only touch the fields the admin actually submitted, so saving one value
    // never clears the rest of the record.
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.refresh === true) {
      const imdbId = clean(body.imdbId) || undefined
      const lookupTitle = clean(body.title) || undefined
      if (!imdbId && !lookupTitle) {
        return Response.json({ error: 'Enter a title or IMDb ID to look up.' }, { status: 400 })
      }
      Object.assign(updates, await getMovie(imdbId, lookupTitle))
    } else if ('title' in body) {
      const title = clean(body.title)
      if (!title) return Response.json({ error: 'A title is required.' }, { status: 400 })
      updates.title = title
    }

    if ('imdbId' in body && body.refresh !== true) updates.imdbId = clean(body.imdbId)
    if ('shelf' in body) updates.shelf = clean(body.shelf)
    if (typeof body.available === 'boolean') updates.available = body.available

    const [dvd] = await db.update(dvds).set(updates).where(eq(dvds.id, id)).returning()
    if (!dvd) return Response.json({ error: 'DVD not found.' }, { status: 404 })
    return Response.json({ dvd })
  }

  if (request.method === 'DELETE') {
    if (!id) return Response.json({ error: 'DVD ID is required.' }, { status: 400 })
    await db.delete(dvds).where(eq(dvds.id, id))
    return Response.json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config: Config = { path: '/api/catalogue' }
