import { describe, expect, it } from 'vitest'
import { areIdsEqual, getBlocksChildrenDepth, makeBlock } from '../../../../lib/notion/util/general'
import type { Block, OwnBlock } from '../../../../lib/notion/types'

function block (children?: OwnBlock[]) {
  return makeBlock({
    children,
    text: 'Block Text',
    type: 'paragraph',
  })
}

describe('lib/notion/util/general', () => {
  describe('#getBlocksChildrenDepth', () => {
    it('returns max depth of children', () => {
      const blocksWithDepth0 = [block()]
      const blocksWithDepth1 = [block([
        block(),
        block(),
      ])]
      const blocksWithDepth2 = [block([
        block([
          block(),
          block(),
          block(),
        ]),
        block(),
      ])]
      const blocksWithDepth3 = [block([
        block([
          block(),
        ]),
        block([
          block([
            block(),
          ]),
        ]),
      ])]

      expect(getBlocksChildrenDepth(blocksWithDepth0)).to.equal(0)
      expect(getBlocksChildrenDepth(blocksWithDepth1)).to.equal(1)
      expect(getBlocksChildrenDepth(blocksWithDepth2)).to.equal(2)
      expect(getBlocksChildrenDepth(blocksWithDepth3)).to.equal(3)
    })

    it('empty children array counts as depth', () => {
      const blocksWithDepth1 = [block([])]
      const blocksWithDepth2 = [block([
        block(),
        block([]),
      ])]
      const blocksWithDepth3 = [block([
        block([
          block(),
          block([]),
          block(),
        ]),
        block(),
      ])]

      expect(getBlocksChildrenDepth(blocksWithDepth1)).to.equal(1)
      expect(getBlocksChildrenDepth(blocksWithDepth2)).to.equal(2)
      expect(getBlocksChildrenDepth(blocksWithDepth3)).to.equal(3)
    })

    it('returns 0 for single block with no children', () => {
      const leafBlock = makeBlock({ text: 'leaf', type: 'paragraph' })
      expect(getBlocksChildrenDepth([leafBlock])).to.equal(0)
    })

    it('returns depth when block has no children property', () => {
      const blockWithNoChildrenKey = { type: 'paragraph', content: {} } as Block
      expect(getBlocksChildrenDepth([blockWithNoChildrenKey], 0)).to.equal(0)
    })
  })

  describe('#areIdsEqual', () => {
    it('returns true when ids are equal', () => {
      expect(areIdsEqual('abc-123', 'abc-123')).to.equal(true)
    })

    it('returns true when ids are equal without dashes', () => {
      expect(areIdsEqual('abc123', 'abc-123')).to.equal(true)
    })

    it('returns false when ids differ', () => {
      expect(areIdsEqual('abc-123', 'xyz-456')).to.equal(false)
    })
  })
})
