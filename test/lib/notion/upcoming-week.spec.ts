import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { startServer } from '../../../index'
import {
  nockAppendBlockChildren,
  nockGetBlockChildren,
  nockUpdateBlock,
  notionFixtureContents,
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
        ['notionToken', 'notion-token'],
        ['startDate', '2021-12-26T12:00:00.000Z'],
        ['upcomingId', 'upcoming-id'],
        ['weekTemplatePageId', 'week-template-id'],
      ].map(([key, value]) => `${key}=${value}`).join('&')
    }

    afterEach(() => {
      nock.cleanAll()
    })

    it('adds week based on template and updates button url', async (ctx) => {
      nockGetBlockChildren('upcoming-id', { fixture: 'quests/upcoming-blocks' })
      nockGetBlockChildren('variables-id', { fixture: 'upcoming-week/variables-blocks' })
      nockGetBlockChildren('week-template-id', { fixture: 'upcoming-week/week-template-blocks' })
      nockGetBlockChildren('nested-parent-id', { fixture: 'blocks' })

      const snapshots = [
        snapshotBody(nockAppendBlockChildren({
          id: 'upcoming-id',
          fixture: 'upcoming-week/append-1-result',
        }), 'append-1'),
        snapshotBody(nockAppendBlockChildren({ id: 'nested-parent-id' }), 'nested'),
        snapshotBody(nockAppendBlockChildren({ id: 'upcoming-id' }), 'append-2'),
        snapshotBody(nockUpdateBlock('button-id'), 'button'),
      ]

      const query = makeQuery()
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Following week successfully added!')

      await Promise.all(snapshots)
    })

    it('gracefully handles absence of button block and variables block', async (ctx) => {
      const upcomingBlocks = notionFixtureContents('quests/upcoming-blocks')
      const weekTemplateBlocks = notionFixtureContents('upcoming-week/week-template-blocks')

      upcomingBlocks.results = upcomingBlocks.results.filter((block: any) => {
        return block.id !== 'button-id'
      })
      weekTemplateBlocks.results = weekTemplateBlocks.results.slice(0, 8)

      nockGetBlockChildren('upcoming-id', { reply: upcomingBlocks })
      nockGetBlockChildren('week-template-id', { reply: weekTemplateBlocks })
      nockUpdateBlock('button-id')

      const snapshot = snapshotBody(nockAppendBlockChildren({
        id: 'upcoming-id',
        fixture: 'upcoming-week/append-1-result',
      }), 'append-1')

      const query = makeQuery()
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Following week successfully added!')

      await snapshot
    })

    it('sends 500 with error if no addFollowingWeekButtonId specified', async (ctx) => {
      const query = makeQuery().replace('addFollowingWeekButtonId=button-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'A value for \'addFollowingWeekButtonId\' must be provided in the query string' })
    })

    it('sends 500 with error if no upcomingId specified', async (ctx) => {
      const query = makeQuery().replace('upcomingId=upcoming-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'A value for \'upcomingId\' must be provided in the query string' })
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
