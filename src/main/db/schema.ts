import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
// Relative, not @shared: drizzle-kit loads this file without the Vite aliases.
import { DEFAULT_STORAGE_CLASS } from '../../shared/storageClass'

// Config: the app's single configuration. No attributes of its own; it owns everything below.
export const config = sqliteTable('config', {
  id: integer('id').primaryKey()
})

// Source: where we're backing photos up from. Each Config has one or more.
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configId: integer('config_id')
    .notNull()
    .references(() => config.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['local', 'remote'] }).notNull(),
  name: text('name').notNull(),
  // URL or local path
  location: text('location').notNull().default(''),
  // Optional, e.g. a Google refresh token. Encrypted with safeStorage.
  credentials: text('credentials')
})

// Destination: where photos are backed up to. Always AWS. Each Config has exactly one.
export const destinations = sqliteTable('destinations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configId: integer('config_id')
    .notNull()
    .unique()
    .references(() => config.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // AWS URL, e.g. https://<bucket>.s3.<region>.amazonaws.com/<prefix>
  location: text('location').notNull().default(''),
  // AWS access key ID and secret, as JSON. Encrypted with safeStorage.
  credentials: text('credentials'),
  storageClass: text('storage_class').notNull().default(DEFAULT_STORAGE_CLASS)
})

// Folder naming convention: how the backup zip file is named. Each Config has zero or more.
export const folderNamingConventions = sqliteTable('folder_naming_conventions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configId: integer('config_id')
    .notNull()
    .references(() => config.id, { onDelete: 'cascade' }),
  // Date template, e.g. "{surname}-photos-{yyyy}-{MM}-{name}"
  pattern: text('pattern').notNull()
})
