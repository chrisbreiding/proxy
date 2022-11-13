import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { startServer } from '../../../index'
import {
  nockAppendBlockChildren,
  nockGetBlockChildren,
  nockUpdateBlock,
} from './util'
import { handleServer, snapshotBody } from '../../util'

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
    function makeQuery () {
      return [
        ['addFollowingWeekButtonId', 'button-id'],
        ['appendToId', 'append-to-id'],
        ['notionToken', 'notion-token'],
        ['startDate', '2021-12-26T12:00:00.000Z'],
        ['weekTemplatePageId', 'week-template-id'],
      ].map(([key, value]) => `${key}=${value}`).join('&')
    }

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

      const query = makeQuery()
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Following week successfully added!')

      await Promise.all(snapshots)
    })

    it('sends 500 with error if no addFollowingWeekButtonId specified', async (ctx) => {
      const query = makeQuery().replace('addFollowingWeekButtonId=button-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'A value for \'addFollowingWeekButtonId\' must be provided in the query string' })
    })

    it('sends 500 with error if no appendToId specified', async (ctx) => {
      const query = makeQuery().replace('appendToId=append-to-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'A value for \'appendToId\' must be provided in the query string' })
    })

    it('sends 500 with error if no notionToken specified', async (ctx) => {
      const query = makeQuery().replace('notionToken=notion-token', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'A value for \'notionToken\' must be provided in the query string' })
    })

    it('sends 500 with error if no startDate specified', async (ctx) => {
      const query = makeQuery().replace('startDate=2021-12-26T12:00:00.000Z', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'A value for \'startDate\' must be provided in the query string' })
    })

    it('sends 500 with error if no weekTemplatePageId specified', async (ctx) => {
      const query = makeQuery().replace('weekTemplatePageId=week-template-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'A value for \'weekTemplatePageId\' must be provided in the query string' })
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/upcoming-week/nope')

      expect(res.status).to.equal(403)
    })
  })
})
