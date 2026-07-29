import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const dvds = pgTable('dvds', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  year: text('year'),
  director: text('director'),
  genre: text('genre'),
  cast: text('cast'),
  plot: text('plot'),
  runtime: text('runtime'),
  rating: text('rating'),
  imdbRating: text('imdb_rating'),
  imdbId: text('imdb_id'),
  posterUrl: text('poster_url'),
  shelf: text('shelf'),
  barcode: text('barcode'),
  quantity: integer('quantity').notNull().default(1),
  available: boolean('available').notNull().default(true),
  detailsSource: text('details_source').notNull().default('catalogue'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

