import { describe, expect, it } from 'vitest'

process.env.API_KEY = 'key'

import { startServer } from '../../../index'
import { RequestError, handleServer } from '../../util'
import {
  column1,
  column2,
  columns,
  emptyList,
  nested1,
  nested2,
  nested3,
  page,
  recentlyCleared,
} from '../../fixtures/notion/clear-completed.fixtures'
import {
  nockDeleteBlock,
  nockGetBlockChildren,
  nockNotion,
  snapshotAppendChildren,
  toQueryString,
} from './util'

function nockDeletedBlocks (ids: string[]) {
  ids.forEach((id) => {
    nockDeleteBlock(`${id}-id`)
  })
}

describe('lib/notion/clear-completed', () => {
  handleServer(startServer)

  describe('GET /notion/action/:key?action=clearCompleted', () => {
    function makeQuery (updates: Record<string, string | null> = {}) {
      return toQueryString({
        action: 'clearCompleted',
        pageId: 'page-id',
        notionToken: 'notion-token',
        ...updates,
      })
    }

    it('removes completed items', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: page() })
      nockGetBlockChildren('column-list-id', { reply: columns })
      nockGetBlockChildren('column-1-id', { reply: column1() })
      nockGetBlockChildren('column-2-id', { reply: column2() })
      nockDeletedBlocks(['item-1-1', 'item-2-1', 'item-2-2', 'item-4-1', 'item-5-1'])

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully cleared completed items</h3>')
      expect(res.status).to.equal(200)
    })

    it('prepends cleared items to Recently Cleared', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: page(true) })
      nockGetBlockChildren('column-list-id', { reply: columns })
      nockGetBlockChildren('column-1-id', { reply: column1() })
      nockGetBlockChildren('column-2-id', { reply: column2() })
      nockGetBlockChildren('recently-cleared-id', { reply: recentlyCleared })
      nockDeletedBlocks(['item-1-1', 'item-2-1', 'item-2-2', 'item-4-1', 'item-5-1'])

      const snapshot = snapshotAppendChildren({
        id: 'recently-cleared-id',
        after: 'recently-cleared-divider-id',
      })
      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully cleared completed items</h3>')
      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds checklist block under empty stores', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: page() })
      nockGetBlockChildren('column-list-id', { reply: columns })
      nockGetBlockChildren('column-1-id', { reply: column1(true) })
      nockGetBlockChildren('column-2-id', { reply: column2(true) })
      nockDeletedBlocks(['item-1-1', 'item-2-1', 'item-2-2', 'item-2-3', 'item-4-1', 'item-4-2', 'item-5-1'])

      const snapshots = [
        snapshotAppendChildren({ id: 'column-1-id', after: 'store-2-id' }),
        snapshotAppendChildren({ id: 'column-2-id', after: 'store-4-id' }),
      ]

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully cleared completed items</h3>')
      expect(res.status).to.equal(200)

      await Promise.all(snapshots)
    })

    it('handles nested items', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: page(true) })
      nockGetBlockChildren('column-list-id', { reply: columns })
      nockGetBlockChildren('column-1-id', { reply: column1() })
      nockGetBlockChildren('column-2-id', { reply: column2(false, true) })
      nockGetBlockChildren('item-4-1-id', { reply: nested1 })
      nockGetBlockChildren('item-5-1-id', { reply: nested2 })
      nockGetBlockChildren('toggle-id', { reply: nested3 })
      nockGetBlockChildren('recently-cleared-id', { reply: recentlyCleared })
      nockDeletedBlocks(['item-1-1', 'item-2-1', 'item-2-2', 'item-4-1', 'item-5-1'])

      const snapshot = snapshotAppendChildren({
        id: 'recently-cleared-id',
        after: 'recently-cleared-divider-id',
      })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully cleared completed items</h3>')
      expect(res.status).to.equal(200)

      await snapshot
    })

    it('gracefully handles absence of cleared items', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: page() })
      nockGetBlockChildren('column-list-id', { reply: columns })
      nockGetBlockChildren('column-1-id', { reply: column1(false, true) })
      nockGetBlockChildren('column-2-id', { reply: column2(false, false, true) })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully cleared completed items</h3>')
      expect(res.status).to.equal(200)
    })

    it('gracefully handles absence of columns', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: emptyList })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully cleared completed items</h3>')
      expect(res.status).to.equal(200)
    })

    it('gracefully handles absence of list items', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: page() })
      nockGetBlockChildren('column-list-id', { reply: columns })
      nockGetBlockChildren('column-1-id', { reply: emptyList })
      nockGetBlockChildren('column-2-id', { reply: emptyList })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully cleared completed items</h3>')
      expect(res.status).to.equal(200)
    })

    it('sends 400 with error if no pageId specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ pageId: null })}`)

      expect(res.text).to.equal('<p>A value for <em>pageId</em> must be provided in the query string</p>')
      expect(res.status).to.equal(400)
    })

    it('sends 400 with error if no notionToken specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ notionToken: null })}`)

      expect(res.text).to.equal('<p>A value for <em>notionToken</em> must be provided in the query string</p>')
      expect(res.status).to.equal(400)
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

      nockNotion({ error, path: '/v1/blocks/page-id/children' })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.include('Clearing completed failed with the following error:')
      expect(res.text).to.include('<pre>error data</pre>')
      expect(res.text).not.to.include('Data status')
      expect(res.status).to.equal(500)
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/notion/action/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('GET /notion/action/:key?action=deleteRecentlyCleared', () => {
    function makeQuery (updates: Record<string, string | null> = {}) {
      return toQueryString({
        action: 'deleteRecentlyCleared',
        recentlyClearedId: 'recently-cleared-id',
        notionToken: 'notion-token',
        ...updates,
      })
    }

    it('deletes recently cleared items', async (ctx) => {
      nockGetBlockChildren('recently-cleared-id', { reply: recentlyCleared })
      nockDeletedBlocks(['store-1', 'item-1-1', 'store-2', 'item-2-1', 'item-2-2'])

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully deleted recently cleared items</h3>')
      expect(res.status).to.equal(200)
    })

    it('gracefully handles absence of recently cleared items', async (ctx) => {
      const emptyRecentlyCleared = { results: recentlyCleared.results.slice(3) }

      nockGetBlockChildren('recently-cleared-id', { reply: emptyRecentlyCleared })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.equal('<h3>Successfully deleted recently cleared items</h3>')
      expect(res.status).to.equal(200)
    })

    it('sends 400 with error if no recentlyClearedId specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ recentlyClearedId: null })}`)

      expect(res.text).to.equal('<p>A value for <em>recentlyClearedId</em> must be provided in the query string</p>')
      expect(res.status).to.equal(400)
    })

    it('sends 400 with error if no notionToken specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ notionToken: null })}`)

      expect(res.text).to.equal('<p>A value for <em>notionToken</em> must be provided in the query string</p>')
      expect(res.status).to.equal(400)
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

      nockNotion({ error, path: '/v1/blocks/recently-cleared-id/children' })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.text).to.include('Deleting recently cleared failed with the following error:')
      expect(res.text).to.include('<pre>error data</pre>')
      expect(res.text).not.to.include('Data status')
      expect(res.status).to.equal(500)
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/notion/action/nope')

      expect(res.status).to.equal(403)
    })
  })
})
