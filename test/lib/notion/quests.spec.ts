import { readJsonSync } from 'fs-extra'
import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

process.env.API_KEY = 'key'
process.env.NOTION_TOKEN = 'notion-token'
process.env.NOTION_QUESTS_ID = 'quests-id'
process.env.NOTION_SARAH_TOKEN = 'sarah-notion-token'
process.env.NOTION_SARAH_TODO_ID = 'sarah-todo-id'

import {
  block,
  notionFixture as fixture,
  nockGetBlockChildren,
  snapshotAppendChildren,
} from './util'
import { getAllQuests } from '../../../lib/notion/quests'
import { handleServer } from '../../util'
import { startServer } from '../../..'

describe('lib/notion/quests', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  describe('#getAll', () => {
    it('returns all quest blocks', async () => {
      nockGetBlockChildren('quests-id', { fixture: 'quests/quests-blocks' })
      nockGetBlockChildren('upcoming-id', { fixture: 'quests/upcoming-blocks' })

      const result = await getAllQuests({
        notionToken: 'notion-token',
        pageId: 'quests-id',
      })

      expect(result).toMatchSnapshot()
    })

    it('errors if no upcoming block found', async () => {
      const questBlocks = readJsonSync(fixture('quests/quests-blocks'))

      questBlocks.results = questBlocks.results.slice(0, questBlocks.results.length - 1)

      nockGetBlockChildren('page-id', { reply: questBlocks })

      await expect(getAllQuests({
        notionToken: 'notion-token',
        pageId: 'page-id',
      })).rejects.toThrowError('Could not find Upcoming block')
    })
  })

  describe('POST /notion/quests/:key', () => {
    handleServer(startServer)

    it('adds quests before next date', async (ctx) => {
      nockGetBlockChildren('quests-id', {
        reply: {
          results: [
            block.bullet({ id: 'after-me', text: 'Existing quest' }),
            block.p({ text: 'Mon, 2/3 ☔︎ 68°F' }),
          ],
        },
      })

      const snapshot = snapshotAppendChildren({
        id: 'quests-id',
        after: 'after-me',
        reply: { results: [block.bullet()] },
      })

      const res = await ctx.request.post('/notion/quests/key')
      .send({ quest: 'A new quest' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds it before second date if first date is first item', async (ctx) => {
      nockGetBlockChildren('quests-id', {
        reply: {
          results: [
            block.p({ text: 'Sun, 2/2 ☀ 75°F' }),
            block.bullet({ id: 'after-me', text: 'Existing quest' }),
            block.p({ text: 'Mon, 2/3 ☔︎ 68°F' }),
          ],
        },
      })

      const snapshot = snapshotAppendChildren({
        id: 'quests-id',
        after: 'after-me',
        reply: { results: [block.bullet()] },
      })

      const res = await ctx.request.post('/notion/quests/key')
      .send({ quest: 'A new quest' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds it before divider if first date is first item and there is no second date', async (ctx) => {
      nockGetBlockChildren('quests-id', {
        reply: {
          results: [
            block.p({ text: 'Mon, 2/3 ☔︎ 68°F' }),
            block.bullet({ id: 'after-me', text: 'Existing quest' }),
            block.divider(),
          ],
        },
      })

      const snapshot = snapshotAppendChildren({
        id: 'quests-id',
        after: 'after-me',
        reply: { results: [block.bullet()] },
      })

      const res = await ctx.request.post('/notion/quests/key')
      .send({ quest: 'A new quest' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds it before divider if there are no dates', async (ctx) => {
      nockGetBlockChildren('quests-id', {
        reply: {
          results: [
            block.bullet({ id: 'after-me', text: 'Existing quest' }),
            block.divider(),
          ],
        },
      })

      const snapshot = snapshotAppendChildren({
        id: 'quests-id',
        after: 'after-me',
        reply: { results: [block.bullet()] },
      })

      const res = await ctx.request.post('/notion/quests/key')
      .send({ quest: 'A new quest' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds it at the end if there are somehow no dates and no dividers', async (ctx) => {
      nockGetBlockChildren('quests-id', {
        reply: {
          results: [
            block.bullet({ text: 'Existing quest' }),
          ],
        },
      })

      const snapshot = snapshotAppendChildren({
        id: 'quests-id',
      })

      const res = await ctx.request.post('/notion/quests/key')
      .send({ quest: 'A new quest' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/quests/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('POST /notion/sarah/todo/:key', () => {
    handleServer(startServer)

    it('adds quests after the first block on page', async (ctx) => {
      nockGetBlockChildren('sarah-todo-id', {
        reply: {
          results: [
            block.p({ id: 'after-me', text: 'To Do' }),
            block.bullet({ text: 'Do this first' }),
          ],
        },
        token: 'sarah-notion-token',
      })

      const snapshot = snapshotAppendChildren({
        id: 'sarah-todo-id',
        after: 'after-me',
        reply: { results: [block.bullet()] },
        token: 'sarah-notion-token',
      })

      const res = await ctx.request.post('/notion/sarah/todo/key')
      .send({ todo: 'A new todo' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('adds it at the end if there are no blocks on page', async (ctx) => {
      nockGetBlockChildren('sarah-todo-id', {
        reply: {
          results: [],
        },
        token: 'sarah-notion-token',
      })

      const snapshot = snapshotAppendChildren({
        id: 'sarah-todo-id',
        token: 'sarah-notion-token',
      })

      const res = await ctx.request.post('/notion/sarah/todo/key')
      .send({ todo: 'A new todo' })

      expect(res.status).to.equal(200)

      await snapshot
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/sarah/todo/nope')

      expect(res.status).to.equal(403)
    })
  })
})
