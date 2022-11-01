import { describe, it } from 'vitest'

import { nockGetBlockChildren, nockUpdateBlock } from '../../support/util'
import dateExtrapolation from '../../../lib/notion/update-date-extrapolation'

describe('lib/notion/update-date-extrapolation', () => {
  it('updates extrapolated dates based on historical and recent dates', async () => {
    nockGetBlockChildren('date-extrapolation-id', { fixture: 'date-extrapolation/categories' })
    nockGetBlockChildren('historical-id', { fixture: 'date-extrapolation/historical-dates' })
    nockGetBlockChildren('recent-id', { fixture: 'date-extrapolation/recent-dates' })
    nockGetBlockChildren('extrapolated-id', { fixture: 'date-extrapolation/extrapolated-dates' })

    nockUpdateBlock('extrapolated-1', {
      fixture: 'date-extrapolation/extrapolated-update-1',
    })
    nockUpdateBlock('extrapolated-2', {
      fixture: 'date-extrapolation/extrapolated-update-2',
    })
    nockUpdateBlock('extrapolated-3', {
      fixture: 'date-extrapolation/extrapolated-update-3',
    })

    await dateExtrapolation.updateDateExtrapolation({
      notionToken: 'notion-token',
      dateExtrapolationId: 'date-extrapolation-id',
    })
  })
})
