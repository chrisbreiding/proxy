import { readJsonSync } from 'fs-extra'
import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { notionFixture as fixture, nockGetBlockChildren } from './util'
import { getAllQuests } from '../../../lib/notion/quests'

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
      })).rejects.toThrow('Could not find Upcoming block')
    })
  })
})
