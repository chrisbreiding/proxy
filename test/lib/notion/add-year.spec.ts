import { describe, it } from 'vitest'

import {
  nockGetBlockChildren,
  nockAppendBlockChildren,
  snapshotBody,
} from './util'
import { addYear } from '../../../lib/notion/add-year'

describe('lib/notion/add-year', () => {
  it('appends blocks in the drop zone based on the year template patterns and year extras', async () => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })
    nockGetBlockChildren('extras-id', { fixture: 'add-year/extras-blocks' })

    nockGetBlockChildren('pattern-month-id', { fixture: 'blocks' })
    nockGetBlockChildren('pattern-month-date-id', { fixture: 'blocks-with-toggle' })
    nockGetBlockChildren('pattern-multiple-months-id', { fixture: 'blocks' })
    nockGetBlockChildren('pattern-multiple-months-date-id', { fixture: 'blocks' })
    nockGetBlockChildren('pattern-odd-months-id', { fixture: 'blocks-with-toggle' })
    nockGetBlockChildren('pattern-even-months-id', { fixture: 'blocks' })
    nockGetBlockChildren('pattern-every-month-date-id', { fixture: 'blocks' })
    nockGetBlockChildren('blocks-from-nested-id', { fixture: 'blocks' })
    nockGetBlockChildren('blocks-from-toggle-id', { fixture: 'blocks', times: 2 })

    const snapshots = (new Array(9)).fill(0).map((_, index) => {
      const num = index + 1

      return [
        snapshotBody(nockAppendBlockChildren({
          id: 'drop-zone-id',
          fixture: `add-year/drop-zone-${num}`,
        }), `drop-zone-${num}`),
        snapshotBody(nockAppendBlockChildren({
          id: `drop-zone-${num}-id`,
        }), `drop-zone-${num}-nested`),
      ]
    }).flat()

    await addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })

    await Promise.all(snapshots)
  })
})
