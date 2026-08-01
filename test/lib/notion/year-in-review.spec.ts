import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { yearInReview } from '../../../lib/notion/year-in-review'
import monthBlocks, { januaryCursor, januaryPage1, januaryPage2 } from '../../fixtures/notion/year-in-review/month-blocks'
import { getAppendBody, nockAppendBlockChildren, nockGetBlockChildren, snapshotAppendChildren } from './util'

function nockSourceBlocks ({ paginateJanuary }: { paginateJanuary?: boolean } = {}) {
  nockGetBlockChildren('done-page-id', { fixture: 'year-in-review/done-blocks' })
  nockGetBlockChildren('year-id', { fixture: 'year-in-review/year-blocks' })

  if (paginateJanuary) {
    nockGetBlockChildren('january-id', { reply: januaryPage1 })
    nockGetBlockChildren('january-id', { reply: januaryPage2, startCursor: januaryCursor })
  } else {
    nockGetBlockChildren('january-id', { reply: monthBlocks.january })
  }

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
}

describe('lib/notion/year-in-review', () => {
  it('adds year summmary', async () => {
    nockSourceBlocks()

    const snapshot = snapshotAppendChildren({ id: 'year-id' })

    await yearInReview({
      donePageId: 'done-page-id',
      notionToken: 'notion-token',
      year: '2021',
    })

    await snapshot
  })

  it('includes blocks from every page when a month is paginated', async () => {
    nockSourceBlocks()

    const unpaginated = getAppendBody(nockAppendBlockChildren({ id: 'year-id' }))

    await yearInReview({
      donePageId: 'done-page-id',
      notionToken: 'notion-token',
      year: '2021',
    })

    nockSourceBlocks({ paginateJanuary: true })

    const paginated = getAppendBody(nockAppendBlockChildren({ id: 'year-id' }))

    await yearInReview({
      donePageId: 'done-page-id',
      notionToken: 'notion-token',
      year: '2021',
    })

    expect((await paginated).children).to.deep.equal((await unpaginated).children)
    expect(nock.isDone()).to.equal(true)
  })

  it('retries appending the blocks when rate limited', async () => {
    nockSourceBlocks()

    nockAppendBlockChildren({
      headers: { 'retry-after': '0' },
      id: 'year-id',
      reply: { code: 'rate_limited' },
      statusCode: 429,
    })

    const body = getAppendBody(nockAppendBlockChildren({ id: 'year-id' }))

    await yearInReview({
      donePageId: 'done-page-id',
      notionToken: 'notion-token',
      year: '2021',
    })

    expect((await body).children.length).to.be.greaterThan(0)
    expect(nock.isDone()).to.equal(true)
  })

  it('errors if year cannot be found', async () => {
    nockGetBlockChildren('done-page-id', { fixture: 'year-in-review/done-blocks' })

    await expect(() => yearInReview({
      donePageId: 'done-page-id',
      notionToken: 'notion-token',
      year: '2025',
    })).rejects.toThrowError('Could not find page for year: 2025')
  })
})
