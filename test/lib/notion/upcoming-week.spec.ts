import fs from 'fs-extra'
import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { handleServer } from '../../support/setup'

import { fixture, nockAppendBlockChildren, nockGetBlockChildren, nockUpdateBlock } from '../../support/util'
import { getAll } from '../../../lib/notion/quests'
import { startServer } from '../../../index'
import { clone } from '../../../lib/util/collections'

describe('lib/notion/quests', () => {
  process.env.API_KEY = 'key'

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

      const append1Body = fs.readJsonSync(fixture('upcoming-week/append-1'))
      const append1Reply = { results: clone(append1Body).children }
      append1Reply.results[append1Reply.results.length - 1].id = 'nested-parent-id'
      nockAppendBlockChildren({
        id: 'append-to-id',
        body: append1Body,
        reply: append1Reply,
      })

      const nestedBody = fs.readJsonSync(fixture('nested-blocks'))
      const nestedResult = { results: clone(nestedBody).children }
      nockAppendBlockChildren({
        id: 'nested-parent-id',
        body: nestedBody,
        reply: nestedResult,
      })

      const append2Body = fs.readJsonSync(fixture('upcoming-week/append-2'))
      const append2Reply = { results: clone(append2Body).children }
      nockAppendBlockChildren({
        id: 'append-to-id',
        body: append2Body,
        reply: append2Reply,
      })

      nockUpdateBlock('button-id', { fixture: 'upcoming-week/button-update' })

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
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/upcoming-week/nope')

      expect(res.status).to.equal(403)
    })
  })
})
