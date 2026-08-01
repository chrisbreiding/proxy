import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { OwnBlock } from '../../../../lib/notion/types'
import { appendBlockChildren } from '../../../../lib/notion/util/updates'
import { makeBlock } from '../../../../lib/notion/util/general'
import { times } from '../../../../lib/util/collections'

interface AppendRequest {
  children: any[]
  pageId: string
  position?: object
}

let requests: AppendRequest[]

// records every append request and replies with an id for each block appended,
// so that requests to the newly created blocks can be asserted on
function nockAppends () {
  let idCount = 0

  nock('https://api.notion.com')
  .persist()
  .patch(/\/v1\/blocks\/.+\/children/)
  .reply(200, (uri, body: any) => {
    requests.push({
      children: body.children,
      pageId: uri.replace('/v1/blocks/', '').replace('/children', ''),
      position: body.position,
    })

    return {
      results: body.children.map(() => ({ id: `new-block-${++idCount}` })),
    }
  })
}

function block (text: string, children?: OwnBlock[]) {
  return makeBlock({ children, text, type: children ? 'toggle' : 'paragraph' })
}

// notion supports 2 levels of nesting within a request, so this is one level
// deeper than can be appended in a single request
function deeplyNestedBlock () {
  return block('Parent', [
    block('Child', [
      block('Grandchild', [
        block('Great-grandchild'),
      ]),
    ]),
  ])
}

function blocks (num: number) {
  return times(num).map((_: undefined, index: number) => block(`Block ${index + 1}`))
}

function append (options: { blocks: OwnBlock[], position?: 'start' | 'end' | 'afterBlock', afterId?: string }) {
  return appendBlockChildren({
    notionToken: 'notion-token',
    pageId: 'page-id',
    ...options,
  })
}

describe('lib/notion/util/updates', () => {
  beforeEach(() => {
    requests = []
    nockAppends()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('#appendBlockChildren', () => {
    it('appends blocks in a single request when under the limit', async () => {
      await append({ blocks: blocks(3) })

      expect(requests).to.have.length(1)
      expect(requests[0].pageId).to.equal('page-id')
      expect(requests[0].children).to.have.length(3)
      expect(requests[0].position).to.equal(undefined)
    })

    it('returns the results of all requests', async () => {
      const result = await append({ blocks: blocks(101) })

      expect(result?.results.map(({ id }) => id)).to.deep.equal(
        times(101).map((_: undefined, index: number) => `new-block-${index + 1}`),
      )
    })

    it('splits blocks into chunks of 100', async () => {
      await append({ blocks: blocks(250) })

      expect(requests.map(({ children }) => children.length)).to.deep.equal([100, 100, 50])
      expect(requests.every(({ pageId }) => pageId === 'page-id')).to.equal(true)
    })

    it('nests children within the request when 2 or fewer levels of nesting', async () => {
      await append({
        blocks: [
          block('Parent', [
            block('Child 1'),
            block('Child 2'),
          ]),
        ],
      })

      expect(requests).to.have.length(1)
      expect(requests[0].children[0].toggle.children).to.have.length(2)
    })

    it('appends children separately when a nested children array exceeds 100', async () => {
      await append({
        blocks: [
          block('Parent', blocks(113)),
        ],
      })

      expect(requests).to.have.length(3)

      expect(requests[0].pageId).to.equal('page-id')
      expect(requests[0].children).to.have.length(1)
      expect(requests[0].children[0].toggle.children).to.equal(undefined)

      expect(requests[1].pageId).to.equal('new-block-1')
      expect(requests[1].children).to.have.length(100)

      expect(requests[2].pageId).to.equal('new-block-1')
      expect(requests[2].children).to.have.length(13)
    })

    it('appends children separately when a deeply nested children array exceeds 100', async () => {
      await append({
        blocks: [
          block('Parent', [
            block('Child', blocks(113)),
          ]),
        ],
      })

      expect(requests.map(({ pageId, children }) => [pageId, children.length])).to.deep.equal([
        ['page-id', 1],
        ['new-block-1', 1],
        ['new-block-2', 100],
        ['new-block-2', 13],
      ])
    })

    it('appends children separately when more than 2 levels of nesting', async () => {
      await append({ blocks: [deeplyNestedBlock()] })

      expect(requests.map(({ pageId, children }) => [pageId, children.length])).to.deep.equal([
        ['page-id', 1],
        ['new-block-1', 1],
        ['new-block-2', 1],
        ['new-block-3', 1],
      ])
    })

    it('appends blocks without children after those with children', async () => {
      await append({
        blocks: [
          deeplyNestedBlock(),
          block('Sibling'),
        ],
      })

      expect(requests.map(({ pageId, children }) => [pageId, children.length])).to.deep.equal([
        ['page-id', 1],
        ['new-block-1', 1],
        ['new-block-2', 1],
        ['new-block-3', 1],
        ['page-id', 1],
      ])
    })

    it('positions blocks at the start when position is start', async () => {
      await append({ blocks: blocks(3), position: 'start' })

      expect(requests[0].position).to.deep.equal({ type: 'start' })
    })

    it('positions subsequent chunks after the last appended block', async () => {
      await append({ blocks: blocks(150), position: 'start' })

      expect(requests[0].position).to.deep.equal({ type: 'start' })
      expect(requests[1].position).to.deep.equal({
        type: 'after_block',
        after_block: { id: 'new-block-100' },
      })
    })

    it('positions blocks after the given block when position is afterBlock', async () => {
      await append({ blocks: blocks(3), position: 'afterBlock', afterId: 'after-id' })

      expect(requests[0].position).to.deep.equal({
        type: 'after_block',
        after_block: { id: 'after-id' },
      })
    })

    it('does not position blocks when position is afterBlock without an afterId', async () => {
      await append({ blocks: blocks(3), position: 'afterBlock' })

      expect(requests[0].position).to.equal(undefined)
    })

    it('does not position blocks when position is end', async () => {
      await append({ blocks: blocks(3), position: 'end' })

      expect(requests[0].position).to.equal(undefined)
    })

    it('positions nested appends after the last appended block', async () => {
      await append({
        blocks: [
          deeplyNestedBlock(),
          block('Sibling'),
        ],
        position: 'start',
      })

      expect(requests.map(({ position }) => position)).to.deep.equal([
        { type: 'start' },
        undefined,
        undefined,
        undefined,
        { type: 'after_block', after_block: { id: 'new-block-1' } },
      ])
    })

    it('does not position nested appends when no position is given', async () => {
      await append({
        blocks: [
          deeplyNestedBlock(),
          block('Sibling'),
        ],
      })

      expect(requests.every(({ position }) => position === undefined)).to.equal(true)
    })

    it('makes no request when there are no blocks', async () => {
      await append({ blocks: [] })

      expect(requests).to.have.length(0)
    })

    it('makes no trailing request when the last block has children', async () => {
      await append({ blocks: [deeplyNestedBlock()] })

      expect(requests.filter(({ pageId }) => pageId === 'page-id')).to.have.length(1)
    })
  })
})
