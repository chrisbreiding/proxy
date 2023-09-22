import { describe, expect, it } from 'vitest'

process.env.API_KEY = 'key'

import { startServer } from '../../../index'
import { RequestError, handleServer, snapshotBody } from '../../util'
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
  nockAppendBlockChildren,
  nockDeleteBlock,
  nockGetBlockChildren,
  nockNotion,
} from './util'

function nockDeletedBlocks (ids: string[]) {
  ids.forEach((id) => {
    nockDeleteBlock(`item-${id}-id`)
  })
}

describe('lib/notion/clear-completed', () => {
  handleServer(startServer)

  describe('GET /notion/action/:key?action=clearCompleted', () => {
    function makeQuery () {
      return [
        ['action', 'clearCompleted'],
        ['pageId', 'page-id'],
        ['notionToken', 'notion-token'],
      ].map(([key, value]) => `${key}=${value}`).join('&')
    }

    it('removes completed items', async (ctx) => {
      nockGetBlockChildren('page-id', { reply: page() })
      nockGetBlockChildren('column-list-id', { reply: columns })
      nockGetBlockChildren('column-1-id', { reply: column1() })
      nockGetBlockChildren('column-2-id', { reply: column2() })
      nockDeletedBlocks(['1-1', '2-1', '2-2', '4-1', '5-1'])

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
      nockDeletedBlocks(['1-1', '2-1', '2-2', '4-1', '5-1'])

      const snapshot = snapshotBody(nockAppendBlockChildren({ id: 'recently-cleared-id' }))

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
      nockDeletedBlocks(['1-1', '2-1', '2-2', '2-3', '4-1', '4-2', '5-1'])

      const snapshots = [
        snapshotBody(nockAppendBlockChildren({ id: 'column-1-id' })),
        snapshotBody(nockAppendBlockChildren({ id: 'column-2-id' })),
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
      nockDeletedBlocks(['1-1', '2-1', '2-2', '4-1', '5-1'])

      const snapshot = snapshotBody(nockAppendBlockChildren({ id: 'recently-cleared-id' }))

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
      const query = makeQuery().replace('&pageId=page-id', '')
      const res = await ctx.request.get(`/notion/action/key?${query}`)

      expect(res.text).to.equal('<p>A value for <em>pageId</em> must be provided in the query string</p>')
      expect(res.status).to.equal(400)
    })

    it('sends 400 with error if no notionToken specified', async (ctx) => {
      const query = makeQuery().replace('&notionToken=notion-token', '')
      const res = await ctx.request.get(`/notion/action/key?${query}`)

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
})
