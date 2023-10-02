import { describe, expect, it } from 'vitest'

import { startServer } from '../../../index'
import {
  block,
  listResults,
  nockDeleteBlock,
  nockGetBlockChildren,
  nockNotion,
  notionFixtureContents,
  snapshotAppendChildren,
  toQueryString,
} from './util'
import { RequestError, handleServer } from '../../util'

process.env.API_KEY = 'key'

describe('lib/notion/promote-day', () => {
  handleServer(startServer)

  describe('GET /notion/action/:key?action=promoteDay', () => {
    function makeQuery (updates: Record<string, string | null> = {}) {
      return toQueryString({
        action: 'promoteDay',
        notionToken: 'notion-token',
        questsId: 'quests-id',
        upcomingId: 'upcoming-id',
        ...updates,
      })
    }

    it('moves up next upcoming day into quests', async (ctx) => {
      nockGetBlockChildren('quests-id', { reply: listResults([
        block.p({ text: '⬆️ Promote next day' }),
        block.p({ text: 'Mon, 12/23' }),
        block.bullet({ text: 'Quest 1' }),
        block.bullet({ id: 'last-quest-id', text: 'Quest 2' }),
        block.divider(),
        block.p({ text: 'Done' }),
        block.divider(),
      ]) })
      nockGetBlockChildren('upcoming-id', { reply: listResults([
        block.p({ id: 'date-id', text: 'Tue, 12/24' }),
        block.bullet({ id: 'quest-3-id', text: 'Quest 3' }),
        block.bullet({ id: 'quest-4-id', text: 'Quest 4' }),
        block.bullet({ id: 'quest-5-id', text: '' }),
        block.p({ text: 'Wed, 12/25' }),
        block.bullet({ text: 'Quest 6' }),
      ]) })

      const snapshots = [
        snapshotAppendChildren({
          id: 'quests-id',
          after: 'last-quest-id',
        }),
      ]

      nockDeleteBlock('date-id')
      nockDeleteBlock('quest-3-id')
      nockDeleteBlock('quest-4-id')
      nockDeleteBlock('quest-5-id')

      const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Day successfully promoted!')

      await Promise.all(snapshots)
    })

    it('sends 500 with error if no upcomingId specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ upcomingId: null })}`)

      expect(res.text).to.include('A value for \'upcomingId\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if no questsId specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ questsId: null })}`)

      expect(res.text).to.include('A value for \'questsId\' must be provided in the query string')
      expect(res.status).to.equal(500)
    })

    it('sends 500 with error if no notionToken specified', async (ctx) => {
      const res = await ctx.request.get(`/notion/action/key?${makeQuery({ notionToken: null })}`)

      expect(res.text).to.include('A value for \'notionToken\' must be provided in the query string')
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

      nockNotion({ error, path: '/v1/blocks/quests-id/children' })

      const query = makeQuery()
      const res = await ctx.request.get(`/notion/action/key?${query}`)

      expect(res.text).to.include('error data')
      expect(res.status).to.equal(500)
    })
  })
})
