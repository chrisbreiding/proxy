import { describe, expect, it } from 'vitest'

import { updateDateExtrapolation } from '../../../lib/notion/update-date-extrapolation'
import { snapshotBody } from '../../util'
import { nockGetBlockChildren, nockUpdateBlock, notionFixtureContents } from './util'

describe('lib/notion/update-date-extrapolation', () => {
  it('updates extrapolated dates based on historical and recent dates', async () => {
    nockGetBlockChildren('date-extrapolation-id', { fixture: 'date-extrapolation/categories' })
    nockGetBlockChildren('historical-id', { fixture: 'date-extrapolation/historical-dates' })
    nockGetBlockChildren('recent-id', { fixture: 'date-extrapolation/recent-dates' })
    nockGetBlockChildren('extrapolated-id', { fixture: 'date-extrapolation/extrapolated-dates' })

    const snapshotUpdates = [
      snapshotBody(nockUpdateBlock('extrapolated-1'), 'extrapolated-1'),
      snapshotBody(nockUpdateBlock('extrapolated-2'), 'extrapolated-2'),
      snapshotBody(nockUpdateBlock('extrapolated-3'), 'extrapolated-3'),
    ]

    await updateDateExtrapolation({
      notionToken: 'notion-token',
      dateExtrapolationId: 'date-extrapolation-id',
    })

    await Promise.all(snapshotUpdates)
  })

  it('throws error if no historical toggle', async () => {
    const categories = notionFixtureContents('date-extrapolation/categories')
    categories.results = categories.results.slice(2)

    nockGetBlockChildren('date-extrapolation-id', { reply: categories })
    nockGetBlockChildren('historical-id', { fixture: 'date-extrapolation/historical-dates' })
    nockGetBlockChildren('recent-id', { fixture: 'date-extrapolation/recent-dates' })
    nockGetBlockChildren('extrapolated-id', { fixture: 'date-extrapolation/extrapolated-dates' })

    try {
      await updateDateExtrapolation({
        notionToken: 'notion-token',
        dateExtrapolationId: 'date-extrapolation-id',
      })

      throw new Error('Should have errored')
    } catch (error: any) {
      expect(error.message).toMatchInlineSnapshot(`
        "The following validation error(s) was/were found:
        - Page must have a \\"Historical\\" toggle block with dates"
      `)
    }
  })

  it('throws error if no recent toggle', async () => {
    const categories = notionFixtureContents('date-extrapolation/categories')
    categories.results = [
      ...categories.results.slice(0, 2),
      ...categories.results.slice(3),
    ]

    nockGetBlockChildren('date-extrapolation-id', { reply: categories })
    nockGetBlockChildren('historical-id', { fixture: 'date-extrapolation/historical-dates' })
    nockGetBlockChildren('recent-id', { fixture: 'date-extrapolation/recent-dates' })
    nockGetBlockChildren('extrapolated-id', { fixture: 'date-extrapolation/extrapolated-dates' })

    try {
      await updateDateExtrapolation({
        notionToken: 'notion-token',
        dateExtrapolationId: 'date-extrapolation-id',
      })

      throw new Error('Should have errored')
    } catch (error: any) {
      expect(error.message).toMatchInlineSnapshot(`
        "The following validation error(s) was/were found:
        - Page must have a \\"Recent\\" toggle block with dates"
      `)
    }
  })

  it('throws error if no extrapolated toggle', async () => {
    const categories = notionFixtureContents('date-extrapolation/categories')
    categories.results = [
      ...categories.results.slice(0, 3),
      ...categories.results.slice(4),
    ]

    nockGetBlockChildren('date-extrapolation-id', { reply: categories })
    nockGetBlockChildren('historical-id', { fixture: 'date-extrapolation/historical-dates' })
    nockGetBlockChildren('recent-id', { fixture: 'date-extrapolation/recent-dates' })
    nockGetBlockChildren('extrapolated-id', { fixture: 'date-extrapolation/extrapolated-dates' })

    try {
      await updateDateExtrapolation({
        notionToken: 'notion-token',
        dateExtrapolationId: 'date-extrapolation-id',
      })

      throw new Error('Should have errored')
    } catch (error: any) {
      expect(error.message).toMatchInlineSnapshot(`
        "The following validation error(s) was/were found:
        - Page must have a \\"Extrapolated\\" toggle block with dates"
      `)
    }
  })
})
