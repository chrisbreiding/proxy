import { describe, expect, it } from 'vitest'
import { getBlocksChildrenDepth, makeBlock } from '../../../../lib/notion/util/general'
import type { OwnBlock } from '../../../../lib/notion/types'

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
  })
})
