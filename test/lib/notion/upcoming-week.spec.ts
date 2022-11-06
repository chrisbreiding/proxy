import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { handleServer } from '../../support/setup'
import {
  nockAppendBlockChildren,
  nockGetBlockChildren,
  nockUpdateBlock,
  snapshotBody,
} from '../../support/util'
import { startServer } from '../../../index'

process.env.API_KEY = 'key'

describe('lib/notion/upcoming-week', () => {

  handleServer(startServer)

  describe('GET /notion/upcoming-week/:key', () => {
    it('renders upcoming week button', async (ctx) => {
      const res = await ctx.request.get('/notion/upcoming-week/key')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('<button class="add">Add Following Week</button>')
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/notion/upcoming-week/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('POST /notion/upcoming-week/:key', () => {
    afterEach(() => {
      nock.cleanAll()
    })

    it('adds week based on template and updates button url', async (ctx) => {
      nockGetBlockChildren('week-template-id', { fixture: 'upcoming-week/week-template-blocks' })
      nockGetBlockChildren('nested-parent-id', { fixture: 'blocks' })

      const snapshots = [
        snapshotBody(nockAppendBlockChildren({
          id: 'append-to-id',
          fixture: 'upcoming-week/append-1-result',
        }), 'append-1'),
        snapshotBody(nockAppendBlockChildren({ id: 'nested-parent-id' }), 'nested'),
        snapshotBody(nockAppendBlockChildren({ id: 'append-to-id' }), 'append-2'),
        snapshotBody(nockUpdateBlock('button-id'), 'button'),
      ]

      const query = [
        ['weekTemplatePageId', 'week-template-id'],
        ['appendToId', 'append-to-id'],
        ['addFollowingWeekButtonId', 'button-id'],
        ['notionToken', 'notion-token'],
        ['startDate', '2022-11-06T12:00:00.000Z'],
      ].map(([key, value]) => `${key}=${value}`).join('&')

      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Following week successfully added!')

      await Promise.all(snapshots)
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/upcoming-week/nope')

      expect(res.status).to.equal(403)
    })
  })
})
