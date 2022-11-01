import fs from 'fs-extra'
import { describe, it } from 'vitest'

import { block, fixture, nockGetBlockChildren, nockNotion } from '../../support/util'
import restaurantsLastVisit from '../../../lib/notion/update-restaurants-last-visit'
import { clone } from '../../../lib/util/collections'

describe('lib/notion/update-restaurants-last-visit', () => {
  it('updates changed restaurant last visit dates', async () => {
    const restaurantBlocks = fs.readJsonSync(fixture('restaurants/restaurant-blocks'))

    function blocksWithDate (date) {
      const blocks = clone(restaurantBlocks)
      const newBlock = block({ text: date })

      blocks.results = [
        ...blocks.results.slice(0, 2),
        newBlock,
        ...blocks.results.slice(2),
      ]

      return blocks
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
      path: '/pages/restaurants-2',
    })

    nockNotion({
      body: bodyWithDate('2022-12-20'),
      method: 'patch',
      path: '/pages/restaurants-4',
    })

    await restaurantsLastVisit.updateRestaurantsLastVisit({
      notionToken: 'notion-token',
      restaurantsDatabaseId: 'restaurants-id',
    })
  })
})
