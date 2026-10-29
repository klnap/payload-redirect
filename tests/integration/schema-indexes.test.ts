import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Client } from 'pg'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

type PgIndexRow = { indexname: string; indexdef: string }

describe.skipIf(!intDatabaseConfigured)('redirects table indexes', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload()
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('has unique btree on from and index on enabled', async () => {
    const client = new Client({ connectionString: handle.connectionString })
    await client.connect()
    try {
      const { rows } = await client.query<PgIndexRow>(
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'redirects'`
      )

      const defs = rows.map((r) => r.indexdef.toLowerCase())
      const fromIndexes = defs.filter((d) => d.includes('from'))
      expect(fromIndexes.some((d) => d.includes('unique'))).toBe(true)
      expect(fromIndexes.filter((d) => !d.includes('where')).length).toBe(1)
      expect(defs.some((d) => d.includes('enabled'))).toBe(true)

      const partial = defs.find((d) => d.includes('redirects_enabled_from_active_idx'))
      if (partial) {
        expect(partial).toContain('enabled')
        expect(partial).toContain('deleted_at')
      }
    } finally {
      await client.end()
    }
  })

  it('merged collection is visible on Payload config after init (empty host fields: [])', () => {
    const redirectsCol = handle.payload.config.collections?.find((c) => c.slug === 'redirects')
    expect(redirectsCol?.fields?.map((f) => ('name' in f ? f.name : ''))).toEqual([
      'from',
      'to',
      'StatusCode',
      'enabled',
      'origin',
    ])
  })
})
