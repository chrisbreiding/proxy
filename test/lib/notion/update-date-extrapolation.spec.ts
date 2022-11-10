import { describe, it } from 'vitest'

import { updateDateExtrapolation } from '../../../lib/notion/update-date-extrapolation'
import { snapshotBody } from '../../util'
import { nockGetBlockChildren, nockUpdateBlock } from './util'

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
})
