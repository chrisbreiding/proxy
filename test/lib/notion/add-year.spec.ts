import fs from 'fs-extra'
import nock from 'nock'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { clone } from '../../../lib/util/collections'
import { addYear } from '../../../lib/notion/add-year'

function fixture (name: string) {
  return path.join(__dirname, `../../fixtures/${name}.json`)
}

function nockGetWithFixture (id: string, fixtureName: string) {
  nock('https://api.notion.com')
  .persist()
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', '2022-06-28')
  .get(`/v1/blocks/${id}/children`)
  .replyWithFile(200, fixture(fixtureName), {
    'Content-Type': 'application/json',
  })
}

function nockPatch (id: string, body: object, reply: object) {
  nock('https://api.notion.com')
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', '2022-06-28')
  .patch(`/v1/blocks/${id}/children`, body as nock.DataMatcherMap)
  .reply(200, reply)
}

describe('lib/notion/add-year', () => {
  it('appends blocks in the drop zone based on the year template patterns and year extras', async () => {
    nockGetWithFixture('future-page-id', 'add-year/notion-future-blocks')
    nockGetWithFixture('year-template-id', 'add-year/year-template-blocks')
    nockGetWithFixture('extras-id', 'add-year/extras-blocks')

    nockGetWithFixture('pattern-month-id', 'blocks')
    nockGetWithFixture('pattern-month-date-id', 'blocks-with-toggle')
    nockGetWithFixture('pattern-multiple-months-id', 'blocks')
    nockGetWithFixture('pattern-multiple-months-date-id', 'blocks')
    nockGetWithFixture('pattern-odd-months-id', 'blocks-with-toggle')
    nockGetWithFixture('pattern-even-months-id', 'blocks')
    nockGetWithFixture('pattern-every-month-date-id', 'blocks')
    nockGetWithFixture('blocks-from-nested-id', 'blocks')
    nockGetWithFixture('blocks-from-toggle-id', 'blocks')

    const nestedBody = fs.readJsonSync(fixture('add-year/drop-zone-nested'))

    ;(new Array(9)).fill(0).forEach((_, index) => {
      const num = index + 1

      const dropZoneBody = fs.readJsonSync(fixture(`add-year/drop-zone-${num}`))
      const dropZoneReply = { results: clone(dropZoneBody).children }
      dropZoneReply.results[dropZoneReply.results.length - 1].id = `drop-zone-${num}-id`

      const dropZoneNestedResult = { results: clone(nestedBody).children }

      nockPatch('drop-zone-id', dropZoneBody, dropZoneReply)
      nockPatch(`drop-zone-${num}-id`, nestedBody, dropZoneNestedResult)
    })

    await addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: '2023',
    })
  })
})
