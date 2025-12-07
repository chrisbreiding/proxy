import { describe, expect, it } from 'vitest'

import { startServer } from '../../../index'
import { handleServer } from '../../util'

describe('lib/notion/index', () => {
  handleServer(startServer)

  it('status 403 if key does not match', async (ctx) => {
    const res = await ctx.request.get('/notion/action/nope')

    expect(res.status).to.equal(403)
  })

  it('errors if action not specified', async (ctx) => {
    const res = await ctx.request.get('/notion/action/key')

    expect(res.text).to.include('<p>A value for <em>action</em> must be provided in the query string</p>')
    expect(res.status).to.equal(400)
  })

  it('errors if action not supported', async (ctx) => {
    const res = await ctx.request.get('/notion/action/key?action=nope')

    expect(res.text).to.include('<p>Action not supported: nope</p>')
    expect(res.status).to.equal(400)
  })
})
