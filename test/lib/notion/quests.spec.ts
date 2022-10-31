import fs from 'fs-extra'
import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { fixture, nockGetBlockChildren } from '../../support/util'
import { getAll } from '../../../lib/notion/quests'

describe('lib/notion/quests', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  describe('#getAll', () => {
    it('returns all quest blocks', async () => {
      nockGetBlockChildren('page-id', { fixture: 'quests/quests-blocks' })
      nockGetBlockChildren('upcoming-id', { fixture: 'quests/upcoming-blocks' })

      const result = await getAll({
        notionToken: 'notion-token',
        pageId: 'page-id',
      })

      const expected = fs.readJsonSync(fixture('quests/get-all-result'))

      expect(result).to.deep.equal(expected)
    })

    it('errors if no upcoming block found', async () => {
      const questBlocks = fs.readJsonSync(fixture('quests/quests-blocks'))

      questBlocks.results = questBlocks.results.slice(0, questBlocks.results.length - 1)

      nockGetBlockChildren('page-id', { reply: questBlocks })

      try {
        await getAll({
          notionToken: 'notion-token',
          pageId: 'page-id',
        })

        throw new Error('Expected upcoming not to be found')
      } catch (error: any) {
        expect(error.message).to.equal('Could not find Upcoming block')
      }
    })
  })
})
