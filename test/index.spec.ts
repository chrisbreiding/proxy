import { describe, expect, it } from 'vitest'

import { handleServer } from './support/setup'
import { startServer } from '../index'

describe('/test', () => {
  handleServer(startServer)

  it('returns { ok: true }', async (ctx) => {
    const res = await ctx.request.get('/test')

    expect(res.status).to.equal(200)
    expect(res.type).to.include('json')
    expect(res.body).to.deep.equal({ ok: true })
  })
})
