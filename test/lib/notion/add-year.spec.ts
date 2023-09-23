import nock from 'nock'
import { beforeEach, describe, expect, it } from 'vitest'

import { addYear } from '../../../lib/notion/add-year'
import { compact } from '../../../lib/util/collections'
import {
  nockGetBlockChildren,
  notionFixtureContents,
  block,
  snapshotAppendChildren,
} from './util'

function makeBlocks (prefix: string, toggle = false, empty = false) {
  return {
    object: 'list',
    next_cursor: null,
    has_more: false,
    type: 'block',
    block: {},
    results: compact([
      block.bullet({ text: `${prefix} task` }),
      empty ? block.bullet({ text: '' }) : undefined,
      toggle ? block.toggle({ text: `${prefix} task w/ toggle`, id: 'blocks-from-toggle-id' }) : undefined,
    ]),
  }
}

function nockMost () {
  nockGetBlockChildren('pattern-month-id', { reply: makeBlocks('pattern-month-id') })
  nockGetBlockChildren('pattern-multiple-months-id', { reply: makeBlocks('pattern-multiple-months-id') })
  nockGetBlockChildren('pattern-multiple-months-date-id', { reply: makeBlocks('pattern-multiple-months-date-id') })
  nockGetBlockChildren('pattern-odd-months-id', { reply: makeBlocks('pattern-odd-months-id') })
  nockGetBlockChildren('pattern-odd-months-date-id', { reply: makeBlocks('pattern-odd-months-date-id') })
  nockGetBlockChildren('blocks-from-nested-id', { reply: makeBlocks('blocks-from-nested-id') })
  nockGetBlockChildren('blocks-from-toggle-id', { reply: makeBlocks('blocks-from-toggle-id') })
}

function nockOthers () {
  nockGetBlockChildren('pattern-month-date-id', { reply: makeBlocks('pattern-month-date-id', true, true) })
  nockGetBlockChildren('pattern-even-months-id', { reply: makeBlocks('pattern-even-months-id') })
  nockGetBlockChildren('pattern-even-months-date-id', { reply: makeBlocks('pattern-even-months-date-id') })
  nockGetBlockChildren('pattern-every-month-id', { reply: makeBlocks('pattern-every-month-id') })
  nockGetBlockChildren('pattern-every-month-date-id', { reply: makeBlocks('pattern-every-month-date-id') })
}

describe('lib/notion/add-year', () => {
  beforeEach(() => {
    nock.cleanAll()

    nockMost()
    nockOthers()
  })

  it('appends blocks in the drop zone based on the year template patterns and year extras', async () => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })
    nockGetBlockChildren('extras-id', { fixture: 'add-year/extras-blocks' })

    const snapshot = snapshotAppendChildren({
      id: 'drop-zone-id',
    })

    await addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })

    await snapshot
  })

  it('handles deeply nested quests', async () => {
    nockGetBlockChildren('future-page-id', { reply: { results: [
      block({ id: 'year-template-id', type: 'child_page', content: { title: 'Year Template' }, hasChildren: true }),
      block({ id: 'drop-zone-id', type: 'synced_block', content: {} }),
    ] } })
    nockGetBlockChildren('year-template-id', { reply: { results: [
      block.p({ id: 'month-id', text: 'January', hasChildren: true }),
    ] } })
    nockGetBlockChildren('month-id', { reply: { results: [
      block.bullet({ id: 'quest-id', text: 'Quest', hasChildren: true }),
    ] } })
    nockGetBlockChildren('quest-id', { reply: { results: [
      block.bullet({ id: 'nested-1-id', text: 'Nested 1', hasChildren: true }),
    ] } })
    nockGetBlockChildren('nested-1-id', { reply: { results: [
      block.bullet({ id: 'nested-2-id', text: 'Nested 2', hasChildren: true }),
    ] } })
    nockGetBlockChildren('nested-2-id', { reply: { results: [
      block.bullet({ text: 'Nested 3' }),
    ] } })

    const snapshots = [
      snapshotAppendChildren({
        id: 'drop-zone-id',
        reply: { results: [{ id: 'drop-1-id' }] },
      }),
      snapshotAppendChildren({
        id: 'drop-1-id',
        reply: { results: [{ id: 'drop-2-id' }] },
      }),
      snapshotAppendChildren({
        id: 'drop-2-id',
        reply: { results: [{ id: 'drop-3-id' }] },
      }),
      snapshotAppendChildren({
        id: 'drop-3-id',
      }),
    ]

    await addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })

    await Promise.all(snapshots)
  })

  it('handles months that have no quests and lack of extras', async () => {
    nock.cleanAll()

    nockMost()

    const yearTemplateBlocks = notionFixtureContents('add-year/year-template-blocks')
    // remove blocks that would cause all months to have quests
    yearTemplateBlocks.results = [
      yearTemplateBlocks.results[0],
      ...yearTemplateBlocks.results.slice(2, 4),
    ]

    const futureBlocks = notionFixtureContents('add-year/future-blocks')
    // remove extras (2023) block
    futureBlocks.results = futureBlocks.results.filter((block: any) => {
      return block.child_page?.title !== '2023'
    })
    nockGetBlockChildren('future-page-id', { reply: futureBlocks })
    nockGetBlockChildren('year-template-id', { reply: yearTemplateBlocks })

    const snapshot = snapshotAppendChildren({
      id: 'drop-zone-id',
    })

    await addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })

    await snapshot
  })

  it('errors if drop zone cannot be found', async () => {
    const futureBlocks = notionFixtureContents('add-year/future-blocks')
    // remove drop zone block
    futureBlocks.results = futureBlocks.results.filter((block: any) => {
      return block.type !== 'synced_block'
    })
    nockGetBlockChildren('future-page-id', { reply: futureBlocks })

    await expect(() => addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })).rejects.toThrowError('Could not find drop zone')
  })

  it('errors if year template cannot be found', async () => {
    const futureBlocks = notionFixtureContents('add-year/future-blocks')
    // remove year template block
    futureBlocks.results = futureBlocks.results.filter((block: any) => {
      return block.child_page?.title !== 'Year Template'
    })

    nockGetBlockChildren('future-page-id', { reply: futureBlocks })

    await expect(() => addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })).rejects.toThrowError('Could not find year template')
  })

  it('errors if extras date is not under a month', async () => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })

    const extrasBlocks = notionFixtureContents('add-year/extras-blocks')
    // remove the first month block
    extrasBlocks.results = [
      extrasBlocks.results[0],
      ...extrasBlocks.results.slice(2),
    ]

    nockGetBlockChildren('extras-id', { reply: extrasBlocks })

    await expect(() => addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })).rejects.toThrowError('Tried to add the following date, but could not determine the month: \'1\'')
  })

  it('errors if extras quest is not under a month', async () => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })

    const extrasBlocks = notionFixtureContents('add-year/extras-blocks')
    // remove the first month block and date block
    extrasBlocks.results = [
      extrasBlocks.results[0],
      ...extrasBlocks.results.slice(3),
    ]

    nockGetBlockChildren('extras-id', { reply: extrasBlocks })

    await expect(() => addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })).rejects.toThrowError('Tried to add the following quest, but could not determine the month: \'Some task\'')
  })

  it('errors if extras quest is not under a date', async () => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })

    const extrasBlocks = notionFixtureContents('add-year/extras-blocks')
    // remove the first date block
    extrasBlocks.results = [
      ...extrasBlocks.results.slice(0, 2),
      ...extrasBlocks.results.slice(3),
    ]

    nockGetBlockChildren('extras-id', { reply: extrasBlocks })

    await expect(() => addYear({
      notionToken: 'notion-token',
      futurePageId: 'future-page-id',
      year: 2023,
    })).rejects.toThrowError('Tried to add the following quest, but could not determine the date: \'Some task\'')
  })
})
