import { describe, it } from 'vitest'

import { updateRestaurantsLastVisit } from '../../../lib/notion/update-restaurants-last-visit'
import { snapshotBody } from '../../util'
import { block, nockGetBlockChildren, nockNotion } from './util'

function blocksWithDate (date: string) {
  return {
    results: [
      block.p({ text: 'Note: something to note' }),
      block.p({ text: '' }),
      block.p({ text: date }),
      block.bullet({ text: 'Things we ate' }),
      block.bullet({ text: 'And what we thought about it' }),
    ],
  }
}

describe('lib/notion/update-restaurants-last-visit', () => {
  it('updates changed restaurant last visit dates', async () => {
    nockNotion({
      method: 'post',
      path: '/v1/databases/restaurants-id/query',
      fixture: 'restaurants/restaurant-pages',
    })

    nockGetBlockChildren('restaurant-1', { reply: blocksWithDate('9/7/22') })
    nockGetBlockChildren('restaurant-2', { reply: blocksWithDate('11/2/22') })
    nockGetBlockChildren('restaurant-3', { reply: blocksWithDate('7/29/22') })
    nockGetBlockChildren('restaurant-4', { reply: blocksWithDate('12/20/22') })
    nockGetBlockChildren('restaurant-5', { reply: blocksWithDate('6/10/22') })

    const snapshotUpdates = [
      snapshotBody(nockNotion({
        method: 'patch',
        path: '/v1/pages/restaurant-2',
      }), 'restaurant-2'),
      snapshotBody(nockNotion({
        method: 'patch',
        path: '/v1/pages/restaurant-4',
      }), 'restaurant-4'),
    ]

    await updateRestaurantsLastVisit({
      notionToken: 'notion-token',
      restaurantsDatabaseId: 'restaurants-id',
    })

    await Promise.all(snapshotUpdates)
  })
})
