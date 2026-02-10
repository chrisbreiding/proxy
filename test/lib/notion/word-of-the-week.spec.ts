import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { startServer } from '../../../index'
import { updateWordOfTheWeek } from '../../../lib/notion/word-of-the-week'
import { RequestError, handleServer } from '../../util'
import {
  block,
  listResults,
  nockDeleteBlock,
  nockGetBlockChildren,
  nockNotion,
  richText,
  snapshotAppendChildren,
  snapshotUpdateBlock,
  toQueryString,
} from './util'

const minimalRssFeed = `<?xml version="1.0"?>
<rss version="2.0" xmlns:merriam="https://www.merriam-webster.com">
  <channel>
    <title>WOTD</title>
    <item>
      <title>Later Word</title>
      <link>https://example.com/later</link>
      <merriam:shortdef>Later definition</merriam:shortdef>
    </item>
    <item>
      <title>Feed Word</title>
      <link>https://example.com/feed-word</link>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <merriam:shortdef>Definition from feed</merriam:shortdef>
    </item>
  </channel>
</rss>`

const rssFeedWithEmptyItem = `<?xml version="1.0"?>
<rss version="2.0" xmlns:merriam="https://www.merriam-webster.com">
  <channel>
    <title>WOTD</title>
    <item>
      <title>Feed Word</title>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <merriam:shortdef>Definition from feed</merriam:shortdef>
    </item>
    <item></item>
  </channel>
</rss>`

describe('lib/notion/word-of-the-week', () => {
  handleServer(startServer)

  describe('GET /notion/action/:key?action=promoteWordOfTheWeek', () => {
    function makeQuery (updates: Record<string, string | null> = {}) {
      return toQueryString({
        action: 'promoteWordOfTheWeek',
        notionToken: 'notion-token',
        headingId: 'heading-id',
        wordId: 'word-id',
        ...updates,
      })
    }

    it('updates word block with rich text from checked to-do', async (ctx) => {
      nockGetBlockChildren('heading-id', {
        reply: listResults([
          block.to_do({
            id: 'todo-1',
            content: {
              rich_text: [
                ...richText('Promoted word', { bold: true, color: 'blue' }),
                ...richText(': Definition from feed'),
                ...richText(' (Jan 1)', { italic: true }),
              ],
              checked: true,
            },
          }),
        ]),
      })

      const snapshot = snapshotUpdateBlock('word-id')
      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Word of the Week successfully promoted!')

      await snapshot
    })

    it('succeeds without updating when no to-do is checked', async (ctx) => {
      nockGetBlockChildren('heading-id', {
        reply: listResults([
          block.to_do({ id: 'todo-1', text: 'Unchecked word' }),
        ]),
      })

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.status).to.equal(200)
      expect(res.text).to.include('Word of the Week successfully promoted!')
    })

    it('sends 400 with error if no notionToken specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ notionToken: null })}`)

      expect(res.text).to.include('A value for <em>notionToken</em> must be provided in the query string')
      expect(res.status).to.equal(400)
    })

    it('sends 400 with error if no headingId specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ headingId: null })}`)

      expect(res.text).to.include('A value for <em>headingId</em> must be provided in the query string')
      expect(res.status).to.equal(400)
    })

    it('sends 400 with error if no wordId specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ wordId: null })}`)

      expect(res.text).to.include('A value for <em>wordId</em> must be provided in the query string')
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

      nockNotion({ error, path: '/v1/blocks/heading-id/children' })

      const query = makeQuery()
      const res = await ctx.request.get(`/notion/action/key?${query}`)

      expect(res.text).to.include('error data')
      expect(res.status).to.equal(500)
    })
  })

  describe('updateWordOfTheWeek', () => {
    it('deletes existing to_do blocks and prepends new blocks from wordsOfTheDay', async () => {
      nock('https://www.merriam-webster.com')
      .get('/wotd/feed/rss2')
      .reply(200, minimalRssFeed, { 'Content-Type': 'application/xml' })

      nockGetBlockChildren('heading-id', {
        reply: listResults([
          block.to_do({ id: 'todo-1', text: 'Old word' }),
          block.to_do({ id: 'todo-2', text: 'Another old' }),
        ]),
      })
      nockDeleteBlock('todo-1')
      nockDeleteBlock('todo-2')

      const snapshot = snapshotAppendChildren({
        id: 'heading-id',
        prepend: true,
        reply: { results: [block.to_do(), block.to_do()] },
      })

      await updateWordOfTheWeek({
        notionToken: 'notion-token',
        wordOfTheWeekHeadingId: 'heading-id',
      })

      await snapshot
    })

    it('prepends blocks when heading has no to_do blocks', async () => {
      nock('https://www.merriam-webster.com')
      .get('/wotd/feed/rss2')
      .reply(200, minimalRssFeed, { 'Content-Type': 'application/xml' })

      nockGetBlockChildren('heading-id', {
        reply: listResults([block.p({ text: 'Word of the Week' })]),
      })

      const snapshot = snapshotAppendChildren({
        id: 'heading-id',
        prepend: true,
        reply: { results: [block.to_do()] },
      })

      await updateWordOfTheWeek({
        notionToken: 'notion-token',
        wordOfTheWeekHeadingId: 'heading-id',
      })

      await snapshot
    })

    it('throws when getBlockChildren errors', async () => {
      nock('https://www.merriam-webster.com')
      .get('/wotd/feed/rss2')
      .reply(200, minimalRssFeed, { 'Content-Type': 'application/xml' })

      const error = new RequestError('notion error', {
        code: 42,
        response: {
          data: {
            code: 24,
            message: 'error data',
          },
        },
      })

      nockNotion({ error, path: '/v1/blocks/heading-id/children' })

      await expect(
        updateWordOfTheWeek({
          notionToken: 'notion-token',
          wordOfTheWeekHeadingId: 'heading-id',
        }),
      ).rejects.toThrow()
    })

    it('filters out words with no title or shortDef', async () => {
      nock('https://www.merriam-webster.com')
      .get('/wotd/feed/rss2')
      .reply(200, rssFeedWithEmptyItem, { 'Content-Type': 'application/xml' })

      nockGetBlockChildren('heading-id', {
        reply: listResults([block.p({ text: 'Word of the Week' })]),
      })

      const snapshot = snapshotAppendChildren({
        id: 'heading-id',
        prepend: true,
        reply: { results: [block.to_do()] },
        message: 'empty feed item fallbacks',
      })

      await updateWordOfTheWeek({
        notionToken: 'notion-token',
        wordOfTheWeekHeadingId: 'heading-id',
      })

      await snapshot
    })
  })
})
