import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import {
  block,
  nockGetBlockChildren,
  snapshotAppendChildren,
  snapshotUpdateBlock,
} from './util'
import { handleServer } from '../../util'
import { startServer } from '../../..'

interface TestColumn {
  id: string
  blocks: ReturnType<typeof block>[]
}

// the shopping pages hold their store lists inside `column` blocks within a
// `column_list` at the root of the page
function nockColumnsPage (pageId: string, columns: TestColumn[]) {
  nockGetBlockChildren(pageId, {
    reply: {
      results: [
        block({ type: 'column_list', id: 'column-list-id', hasChildren: true, content: {} }),
      ],
    },
  })

  nockGetBlockChildren('column-list-id', {
    reply: {
      results: columns.map((column) => {
        return block({ type: 'column', id: column.id, hasChildren: true, content: {} })
      }),
    },
  })

  columns.forEach((column) => {
    nockGetBlockChildren(column.id, { reply: { results: column.blocks } })
  })
}

describe('lib/notion/shopping', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  describe('POST /notion/shopping/:key', () => {
    handleServer(startServer)

    it('adds a grocery item at the end of a matching store within a column', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
            block.to_do({ text: 'Other item' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ type: 'Grocery', store: 'Trader Joes', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('fills in an empty to_do after the store name instead of appending', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'empty-todo-id' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
      ])

      const snapshot = snapshotUpdateBlock('empty-todo-id')

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Trader Joes', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('fills in an empty to_do after the first store when the store is Any', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'empty-todo-id' }),
          ],
        },
      ])

      const snapshot = snapshotUpdateBlock('empty-todo-id')

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('appends a new item when the to_do after the store name is not empty', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Trader Joes', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds a misc item using the misc page when type is Misc', async (ctx) => {
      nockColumnsPage('misc-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Target' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Amazon' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ type: 'Misc', store: 'Target', item: 'Batteries' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('defaults to the grocery page when type is undefined', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Costco' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Aldi' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Costco', item: 'Eggs' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('finds a store in a later column', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'first-column',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ text: 'Existing item' }),
          ],
        },
        {
          id: 'second-column',
          blocks: [
            block.p({ text: 'Whole Foods' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Costco' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'second-column',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Whole Foods', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds to the end of the column when the matching store has no following paragraph', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ text: 'Existing item' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Trader Joes', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('uses the first store in the first column when the store is undefined', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'first-column',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
        {
          id: 'second-column',
          blocks: [
            block.p({ text: 'Costco' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'first-column',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('skips empty paragraphs to find the first store when the store is Any', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: '' }),
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Any', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('falls back to the first store in the first column when the store is not found', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'first-column',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
        {
          id: 'second-column',
          blocks: [
            block.p({ text: 'Costco' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'first-column',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ type: 'Grocery', store: 'Nonexistent Store', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('searches the misc page for the store when the type is unspecified', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'grocery-column',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ text: 'Existing item' }),
          ],
        },
      ])

      nockColumnsPage('misc-id', [
        {
          id: 'misc-column',
          blocks: [
            block.p({ text: 'Home Depot' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Lowes' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'misc-column',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Home Depot', item: 'Nails' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('falls back to the grocery page when the store is found on neither page and the type is unspecified', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'grocery-column',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
      ])

      nockColumnsPage('misc-id', [
        {
          id: 'misc-column',
          blocks: [
            block.p({ text: 'Home Depot' }),
            block.to_do({ text: 'Existing item' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'grocery-column',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Nonexistent Store', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('does not fetch the misc page when the store is found on the grocery page', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'grocery-column',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'grocery-column',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Trader Joes', item: 'Bananas' })

      expect(res.status).to.equal(200)
      // the misc page is never requested since the store was found on grocery
      expect(nock.pendingMocks()).to.have.length(0)

      await snapshot
    })

    it('adds to the end of the first column for Any when its store has no following paragraph', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ text: 'Existing item' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Any', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds to the end of the first column for Any when it has no store paragraph', async (ctx) => {
      nockColumnsPage('groceries-id', [
        {
          id: 'column-id',
          blocks: [
            block.p({ text: '' }),
            block.to_do({ text: 'Existing item' }),
          ],
        },
      ])

      const snapshot = snapshotAppendChildren({
        id: 'column-id',
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Any', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('treats the page root as a single column when there is no column layout', async (ctx) => {
      nockGetBlockChildren('groceries-id', {
        reply: {
          results: [
            block.p({ text: 'Trader Joe\'s' }),
            block.to_do({ id: 'after-me', text: 'Existing item' }),
            block.p({ text: 'Whole Foods' }),
          ],
        },
      })

      const snapshot = snapshotAppendChildren({
        id: 'groceries-id',
        after: 'after-me',
        reply: { results: [block.to_do()] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Trader Joes', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds to the end of the page when the column list has no columns', async (ctx) => {
      nockGetBlockChildren('groceries-id', {
        reply: {
          results: [
            block({ type: 'column_list', id: 'column-list-id', hasChildren: true, content: {} }),
          ],
        },
      })

      nockGetBlockChildren('column-list-id', {
        reply: { results: [] },
      })

      const snapshot = snapshotAppendChildren({
        id: 'groceries-id',
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Any', item: 'Bananas' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('is a no-op when the item is empty', async (ctx) => {
      nockGetBlockChildren('groceries-id', {
        reply: { results: [] },
      })

      const res = await ctx.request.post('/notion/shopping/key')
      .send({ store: 'Trader Joes', item: '' })

      expect(res.status).to.equal(200)
      // the page is never fetched because nothing is added
      expect(nock.pendingMocks()).to.have.length(1)
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/shopping/nope')

      expect(res.status).to.equal(403)
    })
  })
})
