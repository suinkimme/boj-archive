// 가짜 시드 유저(login LIKE 'seed_fake%')와 그에 딸린 submissions/userSolvedProblems
// 모두 정리. cascade 삭제이므로 users만 지우면 자식 row 도 같이 사라진다.
//
// 실행:
//   npx tsx scripts/cleanup-fake-submissions.ts

import { config } from 'dotenv'
import { like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../db/schema'
import { users } from '../db/schema'

config({ path: '.env.local' })

async function main() {
  if (!process.env.POSTGRES_URL_NON_POOLING) {
    console.error('POSTGRES_URL_NON_POOLING is not set. Aborting.')
    process.exit(1)
  }

  const client = postgres(process.env.POSTGRES_URL_NON_POOLING)
  const db = drizzle(client, { schema })

  try {
    const deleted = await db
      .delete(users)
      .where(like(users.login, 'seed_fake%'))
      .returning({ id: users.id })

    console.log(
      `deleted ${deleted.length} fake users (cascade → submissions / user_solved_problems)`,
    )
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
