import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.API_KEY = 'key'

import { compact, times } from '../../../lib/util/collections'
import {
  nockGetBlockChildren,
  notionFixtureContents,
  block,
  snapshotAppendChildren,
  toQueryString,
  nockAppendBlockChildren,
} from './util'
import { handleServer } from '../../util'
import { startServer } from '../../..'

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

function makeQuery (updates: Record<string, string | null> = {}) {
  return toQueryString({
    action: 'addNextYear',
    notionToken: 'notion-token',
    futurePageId: 'future-page-id',
    year: '2023',
    ...updates,
  })
}

describe('lib/notion/add-year', () => {
  handleServer(startServer)

  beforeEach(() => {
    nock.cleanAll()

    vi.useFakeTimers()
    vi.setSystemTime(new Date(2022, 11, 28))

    nockMost()
    nockOthers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds blocks based on the year template patterns and year extras', async (ctx) => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })
    nockGetBlockChildren('extras-id', { fixture: 'add-year/extras-blocks' })

    const snapshots = [
      snapshotAppendChildren({
        id: 'future-page-id',
        after: 'first-block-id',
        reply: { results: [
          block.p({ id: 'first-block-id' }),
          ...times(100).map((_, i) => block.bullet({ id: `block-id-${i + 1}` })),
        ] },
      }),
      snapshotAppendChildren({
        id: 'future-page-id',
        after: 'block-id-100',
        reply: { results: [
          block.p({ id: 'block-id-100' }),
          ...times(28, block.bullet()),
        ] },
      }),
    ]

    const res = await ctx.request.get(`/notion/action/key?${makeQuery({ year: null })}`)

    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
    expect(res.text).to.include('Year 2023 successfully added!')

    await Promise.all(snapshots)
  })

  it('uses following year if not specified', async (ctx) => {
    nockGetBlockChildren('future-page-id', { reply: { results: [
      block.p({ id: 'first-block-id' }),
      block({ id: 'year-template-id', type: 'child_page', content: { title: 'Year Template' }, hasChildren: true }),
      block({ id: 'extras-id', type: 'child_page', content: { title: '2023' }, hasChildren: true }),
    ] } })
    nockGetBlockChildren('year-template-id', { reply: { results: [] } })
    nockGetBlockChildren('extras-id', { reply: { results: [] } })

    nockAppendBlockChildren({
      id: 'future-page-id',
    })

    const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
    expect(res.text).to.include('Year 2023 successfully added!')
  })

  it('handles deeply nested quests', async (ctx) => {
    nockGetBlockChildren('future-page-id', { reply: { results: [
      block.p({ id: 'first-block-id' }),
      block({ id: 'year-template-id', type: 'child_page', content: { title: 'Year Template' }, hasChildren: true }),
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
        after: 'first-block-id',
        id: 'future-page-id',
        reply: { results: [
          { id: 'first-block-id' },
          { id: '' }, { id: '' }, { id: '' },
          { id: 'appended-1-id' },
        ] },
      }),
      snapshotAppendChildren({
        id: 'appended-1-id',
        reply: { results: [{ id: 'appended-2-id' }] },
      }),
      snapshotAppendChildren({
        id: 'appended-2-id',
        reply: { results: [{ id: 'appended-3-id' }] },
      }),
      snapshotAppendChildren({
        id: 'appended-3-id',
        reply: { results: [{}] },
      }),
    ]

    const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
    expect(res.text).to.include('Year 2023 successfully added!')

    await Promise.all(snapshots)
  })

  // TODO: maybe not necesary and can remove?
  it.skip('handles adding more than 100 blocks', async (ctx) => {
    nockGetBlockChildren('future-page-id', { reply: { results: [
      block.p({ id: 'first-block-id' }),
      block({ id: 'year-template-id', type: 'child_page', content: { title: 'Year Template' }, hasChildren: true }),
      block({ id: 'extras-id', type: 'child_page', content: { title: '2023' }, hasChildren: true }),
    ] } })
    nockGetBlockChildren('year-template-id', { reply: { results: [] } })
    nockGetBlockChildren('extras-id', { reply: { results: [
      block.p({ text: 'January' }),
      block.p({ text: '1' }),
      ...times(120).map((_, i) => block.bullet({ text: `Block ${i + 1}` })),
    ] } })

    const snapshots = [
      snapshotAppendChildren({
        id: 'future-page-id',
        after: 'first-block-id',
        reply: { results: [
          block.p({ id: 'first-block-id' }),
          ...times(100).map((_, i) => block.bullet({ id: `block-id-${i + 1}` })),
        ] },
      }),
      snapshotAppendChildren({
        id: 'future-page-id',
        after: 'block-id-100',
        reply: { results: [
          block.p({ id: 'block-id-100' }),
          ...times(23, block.bullet()),
        ] },
      }),
    ]

    const res = await ctx.request.get(`/notion/action/key?${makeQuery({ year: null })}`)

    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
    expect(res.text).to.include('Year 2023 successfully added!')

    await Promise.all(snapshots)
  })

  it('handles months that have no quests and lack of extras', async (ctx) => {
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
      id: 'future-page-id',
      after: 'first-block-id',
      reply: { results: times(23, block.bullet()) },
    })

    const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
    expect(res.text).to.include('Year 2023 successfully added!')

    await snapshot
  })

  it('sends 400 with error if futurePageId is not specified', async (ctx) => {
    const res = await ctx.request.get(`/notion/action/key?${makeQuery({ futurePageId: null })}`)

    expect(res.text).to.include('A value for <em>futurePageId</em> must be provided in the query string')
    expect(res.status).to.equal(400)
  })

  it('sends 400 with error if notionToken is not specified', async (ctx) => {
    const res = await ctx.request.get(`/notion/action/key?${makeQuery({ notionToken: null })}`)

    expect(res.text).to.include('A value for <em>notionToken</em> must be provided in the query string')
    expect(res.status).to.equal(400)
  })

  it('send 500 with error if year template cannot be found', async (ctx) => {
    const futureBlocks = notionFixtureContents('add-year/future-blocks')
    // remove year template block
    futureBlocks.results = futureBlocks.results.filter((block: any) => {
      return block.child_page?.title !== 'Year Template'
    })

    nockGetBlockChildren('future-page-id', { reply: futureBlocks })

    const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

    expect(res.text).to.include('Could not find year template')
    expect(res.status).to.equal(500)
  })

  it('sends 500 with error if extras date is not under a month', async (ctx) => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })

    const extrasBlocks = notionFixtureContents('add-year/extras-blocks')
    // remove the first month block
    extrasBlocks.results = [
      extrasBlocks.results[0],
      ...extrasBlocks.results.slice(2),
    ]

    nockGetBlockChildren('extras-id', { reply: extrasBlocks })

    const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

    expect(res.text).to.include('Tried to add the following date, but could not determine the month for: \'1\'')
    expect(res.status).to.equal(500)
  })

  it('sends 500 with error if extras quest is not under a month', async (ctx) => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })

    const extrasBlocks = notionFixtureContents('add-year/extras-blocks')
    // remove the first month block and date block
    extrasBlocks.results = [
      extrasBlocks.results[0],
      ...extrasBlocks.results.slice(3),
    ]

    nockGetBlockChildren('extras-id', { reply: extrasBlocks })

    const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

    expect(res.text).to.include('Tried to add the following quest, but could not determine the month for: \'Some task\'')
    expect(res.status).to.equal(500)
  })

  it('sends 500 with error if extras quest is not under a date', async (ctx) => {
    nockGetBlockChildren('future-page-id', { fixture: 'add-year/future-blocks' })
    nockGetBlockChildren('year-template-id', { fixture: 'add-year/year-template-blocks' })

    const extrasBlocks = notionFixtureContents('add-year/extras-blocks')
    // remove the first date block
    extrasBlocks.results = [
      ...extrasBlocks.results.slice(0, 2),
      ...extrasBlocks.results.slice(3),
    ]

    nockGetBlockChildren('extras-id', { reply: extrasBlocks })

    const res = await ctx.request.get(`/notion/action/key?${makeQuery()}`)

    expect(res.text).to.include('Tried to add the following quest, but could not determine the date for: \'Some task\'')
    expect(res.status).to.equal(500)
  })
})
