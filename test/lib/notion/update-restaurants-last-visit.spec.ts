import { describe, it } from 'vitest'

import { block, nockGetBlockChildren, nockNotion } from '../../support/util'
import main from '../../../lib/notion/update-restaurants-last-visit'

describe('lib/notion/update-restaurants-last-visit', () => {
  it('updates changed restaurant last visit dates', async () => {
    function blocksWithDate (date) {
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

    function bodyWithDate (date) {
      return {
        properties: {
          'Last Visit': {
            date: {
              start: date,
            },
          },
        },
      }
    }

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

    nockNotion({
      body: bodyWithDate('2022-11-02'),
      method: 'patch',
      path: '/v1/pages/restaurant-2',
    })

    nockNotion({
      body: bodyWithDate('2022-12-20'),
      method: 'patch',
      path: '/v1/pages/restaurant-4',
    })

    await main.updateRestaurantsLastVisit({
      notionToken: 'notion-token',
      restaurantsDatabaseId: 'restaurants-id',
    })
  })
})
