import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startServer } from '../../../index'
import {
  block,
  nockDeleteBlock,
  nockGetBlockChildren,
  nockNotion,
  notionFixtureContents,
  snapshotAppendChildren,
  toQueryString,
} from './util'
import { RequestError, handleServer } from '../../util'

process.env.API_KEY = 'key'

describe('lib/notion/upcoming-week', () => {
  handleServer(startServer)

  describe('GET /notion/action/:key?action=addUpcomingWeek', () => {
    function makeQuery (updates: Record<string, string | null> = {}) {
      return toQueryString({
        action: 'addUpcomingWeek',
        notionToken: 'notion-token',
        upcomingId: 'upcoming-id',
        ...updates,
      })
    }

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2021, 11, 24))
    })

    afterEach(() => {
      vi.useRealTimers()
      nock.cleanAll()
    })

    it('adds week based on template', async (ctx) => {
      const upcomingBlocks = notionFixtureContents('quests/upcoming-blocks')

      nockGetBlockChildren('upcoming-id', { reply: upcomingBlocks })
      nockGetBlockChildren('extra-with-children', { fixture: 'blocks' })
      nockGetBlockChildren('variables-id', { fixture: 'upcoming-week/variables-blocks' })
      nockGetBlockChildren('week-template-id', { fixture: 'upcoming-week/week-template-blocks' })
      nockGetBlockChildren('nested-parent-id', { fixture: 'blocks' })

      const snapshots = [
        snapshotAppendChildren({
          id: 'upcoming-id',
          after: 'last-upcoming-id',
        }),
      ]

      nockDeleteBlock('extra-date-1')
      nockDeleteBlock('extra-date-2')
      nockDeleteBlock('extra-item-1')
      nockDeleteBlock('extra-item-2')
      nockDeleteBlock('extra-with-children')

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Following week successfully added!')

      await Promise.all(snapshots)
    })

    it('gracefully handles absence of variables block', async (ctx) => {
      const upcomingBlocks = notionFixtureContents('quests/upcoming-blocks')
      const weekTemplateBlocks = notionFixtureContents('upcoming-week/week-template-blocks')

      upcomingBlocks.results = upcomingBlocks.results.filter((block: any) => {
        return !block.id.includes('extra-')
      })
      weekTemplateBlocks.results = weekTemplateBlocks.results.slice(0, 8)

      nockGetBlockChildren('upcoming-id', { reply: upcomingBlocks })
      nockGetBlockChildren('week-template-id', { reply: weekTemplateBlocks })

      const snapshot = snapshotAppendChildren({
        after: 'last-upcoming-id',
        id: 'upcoming-id',
        fixture: 'upcoming-week/append-1-result',
      })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Following week successfully added!')

      await snapshot
    })

    it('handles deeply nested quests', async (ctx) => {
      nockGetBlockChildren('upcoming-id', { reply: { results: [
        block.p({ text: 'Sat, 12/25' }),
        block.bullet({ id: 'last-quest-id', text: 'Last quest' }),
        block.divider(),
        block.divider(),
        block.divider(),
        block({ id: 'week-template-id', type: 'child_page', content: { title: 'Week Template' } }),
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

      const snapshots = [
        snapshotAppendChildren({
          id: 'upcoming-id',
          after: 'last-quest-id',
          reply: { results: [
            { id: 'last-quest-id' },
            {},
            { id: 'upcoming-1-id' },
          ] },
        }),
        snapshotAppendChildren({
          id: 'upcoming-1-id',
          reply: { results: [{ id: 'upcoming-2-id' }] },
        }),
        snapshotAppendChildren({
          id: 'upcoming-2-id',
          reply: { results: [{ id: 'upcoming-3-id' }] },
        }),
        snapshotAppendChildren({
          id: 'upcoming-3-id',
        }),
      ]

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.include('Following week successfully added!')
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.status).to.equal(200)

      await Promise.all(snapshots)
    })

    it('sends 500 with error if no upcomingId specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ upcomingId: null })}`)

      expect(res.text).to.include('A value for \'upcomingId\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if no notionToken specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ notionToken: null })}`)

      expect(res.text).to.include('A value for \'notionToken\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if last date cannot be found', async (ctx) => {
      nockGetBlockChildren('upcoming-id', { reply: { results: [
        block.divider(),
        block.divider(),
        block.divider(),
        block({ id: 'week-template-id', type: 'child_page', content: { title: 'Week Template' } }),
      ] } })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.include('Could not find a date to put the upcoming week after. There should be at least one date present in the first part of Upcoming.')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if week template cannot be found', async (ctx) => {
      nockGetBlockChildren('upcoming-id', { reply: { results: [
        block.p({ text: 'Sat, 12/25' }),
        block.bullet({ id: 'last-quest-id', text: 'Last quest' }),
        block({ id: 'week-template-id', type: 'child_page', content: { title: 'Week Template' } }),
      ] } })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.include('Could not find the Week Template. It should be a page after the third divider.')
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
      const res = await ctx.request.get(`/notion/action/key?${query}`)

      expect(res.text).to.include('error data')
      expect(res.status).to.equal(500)
    })
  })
})
