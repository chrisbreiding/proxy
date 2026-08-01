import type { BlockObjectResponse } from '@notionhq/client'
import { block } from '../../../lib/notion/util'

const t = {
  a: {
    a: 'Task 1',
    b: '🐟 Task 1',
    c: '⭐️ Task 1',
  },
  b: {
    a: 'Task 2',
    b: '🍞 Task 2',
    c: '🥦 Task 2',
  },
  c: {
    a: 'Task 3',
    b: '🌲 Task 3',
    c: '🇪🇸 Task 3',
  },
  d: {
    a: 'Task 4',
    b: '💬 Task 4',
    c: '⛱ Task 4',
  },
}

function results (blocks: BlockObjectResponse[], nextCursor?: string) {
  return {
    results: blocks,
    has_more: !!nextCursor,
    next_cursor: nextCursor || null,
  }
}

function d (date: string, ...bullets: string[]): BlockObjectResponse[] {
  return [
    block.p({ text: date }),
    ...bullets.map((text) => block.bullet({ text })),
  ]
}

// january split in two, so it can be served as one response or as two
// paginated responses, which notion does when there are more than 100 blocks
const januaryPage1Blocks = [
  ...d('Mon, 1/4', t.a.a, t.b.a),
  ...d('Tue, 1/12', t.b.b, t.c.a, t.d.b),
]
const januaryPage2Blocks = [
  ...d('Wed, 1/20', t.a.b, t.b.c, t.d.c),
  ...d('Thu, 1/28', t.c.b, t.d.a),
]

export const januaryCursor = 'january-cursor'

export const januaryPage1 = results(januaryPage1Blocks, januaryCursor)
export const januaryPage2 = results(januaryPage2Blocks)

export default {
  january: results([
    ...januaryPage1Blocks,
    ...januaryPage2Blocks,
  ]),
  february: results([
    ...d('Mon, 2/1', t.b.c, ''),
    // consecutive dates, so they're collapsed into a range, but t.b.c happens
    // twice on 2/2, so it breaks the range for that quest
    ...d('Tue, 2/2', t.b.c, t.b.c, t.a.a),
    ...d('Wed, 2/3', t.b.c, t.a.a),
    ...d('Tue, 2/9', t.a.a, t.c.a, t.d.b),
    ...d('Wed, 2/17', t.c.a, t.d.b),
  ]),
  march: results([
    ...d('', t.c.a, t.d.c),
    ...d('Mon, 3/1', t.c.a, t.d.c),
    ...d('Tue, 3/9', t.b.a, t.c.c),
    ...d('Wed, 3/17', t.a.b, t.d.b),
    ...d('Thu, 3/25', t.a.a, t.b.a, t.c.c),
  ]),
  april: results([
    ...d('Mon, 4/5', t.c.b, t.b.a, t.a.a),
    ...d('Tue, 4/13', t.a.c, t.b.c),
    ...d('Wed, 4/17', t.b.b, t.a.a),
    ...d('Thu, 4/25', t.c.a, t.b.a, t.a.c),
  ]),
  may: results([
    ...d('Mon, 5/3', t.d.b, t.c.b),
    ...d('Tue, 5/11', t.c.b, t.d.c, t.d.b),
    ...d('Wed, 5/19', t.d.a, t.c.b, t.c.c, t.b.a),
    ...d('Thu, 5/27', t.b.a),
  ]),
  june: results([
    ...d('Mon, 6/7', t.c.a, t.c.a, t.d.b, t.d.c),
    ...d('Tue, 6/15', t.b.b, t.c.a, t.d.a, t.b.a),
    ...d('Wed, 6/23', t.b.a, t.b.b, t.c.b),
  ]),
  july: results([
    ...d('Mon, 7/5', t.a.a, t.b.b, t.a.b),
    ...d('Tue, 7/13', t.a.a),
    ...d('Wed, 7/21', t.d.b, t.a.a, t.d.c),
    ...d('Thu, 7/29', t.c.c, t.a.c, t.a.c, t.b.c),
  ]),
  august: results([
    ...d('Mon, 8/2', t.c.b, t.c.c, t.d.a, t.c.b),
    ...d('Tue, 8/10', t.b.b, t.b.a),
    ...d('Wed, 8/18', t.b.a),
    ...d('Thu, 8/26', t.d.c, t.a.c, t.a.c, t.d.a),
  ]),
  september: results([
    ...d('Mon, 9/6', t.a.c, t.b.b, t.b.c),
    ...d('Tue, 9/14', t.c.c, t.a.a, t.b.a, t.b.b),
    ...d('Wed, 9/22', t.b.c),
  ]),
  october: results([
    ...d('Mon, 10/4', t.b.a),
    ...d('Tue, 10/12', t.b.a, t.d.c),
    ...d('Wed, 10/20', t.a.b, t.a.b, t.a.c, t.b.b),
    ...d('Thu, 10/28', t.a.b, t.d.b, t.c.b),
  ]),
  november: results([
    ...d('Mon, 11/1', t.b.a, t.c.a),
    ...d('Tue, 11/9', t.a.c, t.d.b),
    ...d('Wed, 11/17', t.b.b, t.d.b),
    ...d('Thu, 11/25', t.a.c, t.d.c),
  ]),
  december: results([
    ...d('Mon, 12/6', t.a.b),
    ...d('Tue, 12/14', t.c.c, t.c.a),
    ...d('Wed, 12/22', t.d.b),
  ]),
}
