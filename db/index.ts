import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// `POSTGRES_URL` is Supabase's pooled (PgBouncer, transaction mode) URL.
// `prepare: false` is required for transaction pooling — prepared statements
// don't survive across pooler-multiplexed connections.
const client = postgres(process.env.POSTGRES_URL!, { prepare: false })
export const db = drizzle(client, { schema })
