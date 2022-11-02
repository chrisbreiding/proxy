const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')

const {
  getBlockChildren,
  getPlainText,
  makeRequest,
} = require('./util')
const { compact } = require('../util/collections')
const { getEnv } = require('../util/env')

const getDatabasePages = async ({ notionToken, restaurantsDatabaseId }) => {
  const { results } = await makeRequest({
    notionToken,
    method: 'post',
    path: `databases/${restaurantsDatabaseId}/query`,
  })

  return results
}

const updatePage = ({ notionToken, pageId, properties }) => {
  return makeRequest({
    notionToken,
    body: { properties },
    method: 'patch',
    path: `pages/${pageId}`,
  })
}

const updatePages = ({ notionToken, pageDates }) => {
  return Promise.all(pageDates.map(({ date, name, pageId }) => {
    // eslint-disable-next-line no-console
    console.log('Update', name, 'to', date)

    return updatePage({
      notionToken,
      pageId,
      properties: {
        'Last Visit': {
          date: {
            start: date,
          },
        },
      },
    })
  }))
}

const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{2}).*/

const getMostRecentVisitDate = async ({ name, notionToken, pageId }) => {
  const { results } = await getBlockChildren({ notionToken, pageId })

  for (let block of results) {
    const text = getPlainText(block)

    if (!text) continue

    const [, dateText] = text.match(dateRegex) || []

    if (dateText) {
      return {
        name,
        pageId,
        date: dayjs(dateText).format('YYYY-MM-DD'),
      }
    }
  }
}

const getMostRecentVisitDates = async ({ databasePages, notionToken }) => {
  const pageDates = await Promise.all(databasePages.map(async ({ id, properties }) => {
    const currentDate = properties['Last Visit']?.date?.start
    const name = getPlainText(properties.Name, false)
    const newDate = await getMostRecentVisitDate({ name, notionToken, pageId: id })

    if (currentDate !== newDate.date) return newDate
  }))

  return compact(pageDates)
}

const updateRestaurantsLastVisit = async ({ notionToken, restaurantsDatabaseId }) => {
  const databasePages = await getDatabasePages({ notionToken, restaurantsDatabaseId })
  const pageDates = await getMostRecentVisitDates({ databasePages, notionToken })

  await updatePages({ notionToken, pageDates })
}

const main = async () => {
  const notionToken = getEnv('NOTION_TOKEN')
  const restaurantsDatabaseId = getEnv('NOTION_NEARBY_RESTAURANTS_TABLE_ID')

  debug('ENV:', {
    notionToken,
    restaurantsDatabaseId,
  })

  try {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates...')

    await updateRestaurantsLastVisit({ notionToken, restaurantsDatabaseId })

    // eslint-disable-next-line no-console
    console.log('Successfully updated restaurants last visit dates')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)
  }
}

main.updateRestaurantsLastVisit = updateRestaurantsLastVisit

module.exports = main
