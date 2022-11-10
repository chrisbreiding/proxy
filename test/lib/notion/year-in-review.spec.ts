import { describe, expect, it } from 'vitest'

import { nockGetBlockChildren, nockAppendBlockChildren, snapshotBody } from './util'
import { yearInReview } from '../../../lib/notion/year-in-review'
import monthBlocks from '../../fixtures/notion/year-in-review/month-blocks'

describe('lib/notion/year-in-review', () => {
  it('adds year summmary', async () => {
    nockGetBlockChildren('done-page-id', { fixture: 'year-in-review/done-blocks' })
    nockGetBlockChildren('year-id', { fixture: 'year-in-review/year-blocks' })
    nockGetBlockChildren('january-id', { reply: monthBlocks.january })
    nockGetBlockChildren('february-id', { reply: monthBlocks.february })
    nockGetBlockChildren('march-id', { reply: monthBlocks.march })
    nockGetBlockChildren('april-id', { reply: monthBlocks.april })
    nockGetBlockChildren('may-id', { reply: monthBlocks.may })
    nockGetBlockChildren('june-id', { reply: monthBlocks.june })
    nockGetBlockChildren('july-id', { reply: monthBlocks.july })
    nockGetBlockChildren('august-id', { reply: monthBlocks.january })
    nockGetBlockChildren('september-id', { reply: monthBlocks.september })
    nockGetBlockChildren('october-id', { reply: monthBlocks.october })
    nockGetBlockChildren('november-id', { reply: monthBlocks.november })
    nockGetBlockChildren('december-id', { reply: monthBlocks.december })

    const snapshot = snapshotBody(nockAppendBlockChildren({ id: 'year-id' }))

    await yearInReview({
      donePageId: 'done-page-id',
      notionToken: 'notion-token',
      year: '2021',
    })

    await snapshot
  })

  it('errors if year cannot be found', async () => {
    nockGetBlockChildren('done-page-id', { fixture: 'year-in-review/done-blocks' })

    await expect(() => yearInReview({
      donePageId: 'done-page-id',
      notionToken: 'notion-token',
      year: '2025',
    })).rejects.toThrow('Could not find page for year: 2025')
  })
})
