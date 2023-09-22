import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startServer } from '../../../index'
import {
  block,
  nockAppendBlockChildren,
  nockDeleteBlock,
  nockGetBlockChildren,
  nockNotion,
  nockUpdateBlock,
  notionFixtureContents,
} from './util'
import { RequestError, handleServer, snapshotBody } from '../../util'

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

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2021, 11, 24))
    })

    afterEach(() => {
      vi.useRealTimers()
      nock.cleanAll()
    })

    it('adds week based on template and updates button url', async (ctx) => {
      const upcomingBlocks = notionFixtureContents('quests/upcoming-blocks')

      nockGetBlockChildren('upcoming-id', { reply: upcomingBlocks })
      nockGetBlockChildren('extra-with-children', { fixture: 'blocks' })
      nockGetBlockChildren('variables-id', { fixture: 'upcoming-week/variables-blocks' })
      nockGetBlockChildren('week-template-id', { fixture: 'upcoming-week/week-template-blocks' })
      nockGetBlockChildren('nested-parent-id', { fixture: 'blocks' })

      const snapshots = [
        snapshotBody(nockAppendBlockChildren({
          id: 'upcoming-id',
        }), 'upcoming'),
        snapshotBody(nockUpdateBlock('button-id'), 'button'),
      ]

      nockDeleteBlock('extra-date-1')
      nockDeleteBlock('extra-date-2')
      nockDeleteBlock('extra-item-1')
      nockDeleteBlock('extra-item-2')
      nockDeleteBlock('extra-with-children')

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
        return block.id !== 'button-id' && !block.id.includes('extra-')
      })
      weekTemplateBlocks.results = weekTemplateBlocks.results.slice(0, 8)

      nockGetBlockChildren('upcoming-id', { reply: upcomingBlocks })
      nockGetBlockChildren('week-template-id', { reply: weekTemplateBlocks })
      nockUpdateBlock('button-id')

      const snapshot = snapshotBody(nockAppendBlockChildren({
        id: 'upcoming-id',
        fixture: 'upcoming-week/append-1-result',
      }))

      const query = makeQuery()
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Following week successfully added!')

      await snapshot
    })

    it('handles deeply nested quests', async (ctx) => {
      nockGetBlockChildren('upcoming-id', { reply: { results: [
        block.bullet({ id: 'last-quest-id', text: 'Last quest' }),
        block({ id: 'button-id' }),
      ] } })
      nockGetBlockChildren('week-template-id', { reply: { results: [
        block.p({ text: 'Mon, ' }),
        block.bullet({ id: 'quest-id', text: 'Quest', hasChildren: true }),
      ] } })
      nockGetBlockChildren('quest-id', { reply: { results: [
        block.bullet({ id: 'nested-1-id', text: 'Nested 1', hasChildren: true }),
      ] } })
      nockGetBlockChildren('nested-1-id', { reply: { results: [
        block.bullet({ id: 'nested-2-id', text: 'Nested 2', hasChildren: true }),
      ] } })
      nockGetBlockChildren('nested-2-id', { reply: { results: [
        block.bullet({ text: 'Nested 3' }),
      ] } })
      nockUpdateBlock('button-id')

      const snapshots = [
        snapshotBody(nockAppendBlockChildren({
          id: 'upcoming-id',
          reply: { results: [{ id: 'last-quest-id' }, {}, { id: 'upcoming-1-id' }] },
        })),
        snapshotBody(nockAppendBlockChildren({
          id: 'upcoming-1-id',
          reply: { results: [{ id: 'upcoming-2-id' }] },
        })),
        snapshotBody(nockAppendBlockChildren({
          id: 'upcoming-2-id',
          reply: { results: [{ id: 'upcoming-3-id' }] },
        })),
        snapshotBody(nockAppendBlockChildren({
          id: 'upcoming-3-id',
        })),
      ]

      const query = makeQuery()
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.text).to.include('Following week successfully added!')
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.status).to.equal(200)

      await Promise.all(snapshots)
    })

    it('sends 500 with error if no addFollowingWeekButtonId specified', async (ctx) => {
      const query = makeQuery().replace('addFollowingWeekButtonId=button-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.body.error.message).to.equal('A value for \'addFollowingWeekButtonId\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if no upcomingId specified', async (ctx) => {
      const query = makeQuery().replace('upcomingId=upcoming-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.body.error.message).to.equal('A value for \'upcomingId\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if no notionToken specified', async (ctx) => {
      const query = makeQuery().replace('notionToken=notion-token', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.body.error.message).to.equal('A value for \'notionToken\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if no startDate specified', async (ctx) => {
      const query = makeQuery().replace('startDate=2021-12-26T12:00:00.000Z', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.body.error.message).to.equal('A value for \'startDate\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if no weekTemplatePageId specified', async (ctx) => {
      const query = makeQuery().replace('weekTemplatePageId=week-template-id', '')
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.body.error.message).to.equal('A value for \'weekTemplatePageId\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if request errors', async (ctx) => {
      const error = new RequestError('notion error', {
        code: 42,
        response: {
          data: {
            code: 24,
            message: 'error data',
          },
        },
      })

      nockNotion({ error, path: '/v1/blocks/upcoming-id/children' })

      const query = makeQuery()
      const res = await ctx.request.post(`/notion/upcoming-week/key?${query}`)

      expect(res.body.data.message).to.equal('error data')
      expect(res.status).to.equal(500)
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/upcoming-week/nope')

      expect(res.status).to.equal(403)
    })
  })
})
