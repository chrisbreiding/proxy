import fs from 'fs-extra'
import { describe, it } from 'vitest'

import { fixture, nockGetBlockChildren, nockAppendBlockChildren } from '../../support/util'
import { clone } from '../../../lib/util/collections'
import { addYear } from '../../../lib/notion/add-year'

describe('lib/notion/add-year', () => {
  it('appends blocks in the drop zone based on the year template patterns and year extras', async () => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/notion-future-blocks' })
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
    nockGetBlockChildren('blocks-from-toggle-id', { fixture: 'blocks' })

    const nestedBody = fs.readJsonSync(fixture('nested-blocks'))

    ;(new Array(9)).fill(0).forEach((_, index) => {
      const num = index + 1

      const dropZoneBody = fs.readJsonSync(fixture(`add-year/drop-zone-${num}`))
      const dropZoneReply = { results: clone(dropZoneBody).children }
      dropZoneReply.results[dropZoneReply.results.length - 1].id = `drop-zone-${num}-id`

      const dropZoneNestedResult = { results: clone(nestedBody).children }

      nockAppendBlockChildren({
        id: 'drop-zone-id',
        body: dropZoneBody,
        reply: dropZoneReply,
      })
      nockAppendBlockChildren({
        id: `drop-zone-${num}-id`,
        body: nestedBody,
        reply: dropZoneNestedResult,
      })
    })

    await addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: '2023',
    })
  })
})
