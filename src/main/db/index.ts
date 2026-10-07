import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { DEFAULT_PATTERN } from '@shared/pattern'

export type Db = BetterSQLite3Database<typeof schema>

export const CONFIG_ID = 1

export interface SeedDefaults {
  localFolder: string
}

/** Opens (or creates) the database, applies migrations and seeds the single Config. */
export function openDb(file: string, migrationsFolder: string, defaults: SeedDefaults): Db {
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  seed(db, defaults)
  return db
}

function seed(db: Db, defaults: SeedDefaults): void {
  db.transaction((tx) => {
    if (tx.select().from(schema.config).get()) return
    tx.insert(schema.config).values({ id: CONFIG_ID }).run()
    // A Config has one or more Sources: seed both kinds the app backs up from.
    tx.insert(schema.sources)
      .values([
        {
          configId: CONFIG_ID,
          type: 'local',
          name: 'Local folder',
          location: defaults.localFolder
        },
        { configId: CONFIG_ID, type: 'remote', name: 'Google Drive', location: '' }
      ])
      .run()
    tx.insert(schema.destinations).values({ configId: CONFIG_ID, name: 'AWS S3' }).run()
    tx.insert(schema.folderNamingConventions)
      .values({ configId: CONFIG_ID, pattern: DEFAULT_PATTERN })
      .run()
  })
}
