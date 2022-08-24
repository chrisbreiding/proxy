const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')

const {
  getBlockChildren,
  getPlainText,
  makeRequest,
} = require('./util')
const { compact } = require('../util/collections')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_TOKEN')
const restaurantsDatabaseId = getEnv('NOTION_NEARBY_RESTAURANTS_TABLE_ID')

debug('ENV:', {
  notionToken,
  restaurantsDatabaseId,
})

const getDatabasePages = async () => {
  const { results } = await makeRequest({
    notionToken,
    method: 'post',
    path: `databases/${restaurantsDatabaseId}/query`,
  })

  return results
}

const updatePage = ({ pageId, properties }) => {
  return makeRequest({
    notionToken,
    body: { properties },
    method: 'patch',
    path: `pages/${pageId}`,
  })
}

const updatePages = (pageDates) => {
  return Promise.all(pageDates.map(({ pageId, date }) => {
    // eslint-disable-next-line no-console
    console.log('Update', pageId, 'to', date)

    return updatePage({
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

const getMostRecentVisitDate = async ({ pageId }) => {
  const { results } = await getBlockChildren({ notionToken, pageId })

  for (let block of results) {
    const text = getPlainText(block)

    if (!text) continue

    const [, dateText] = text.match(dateRegex) || []

    if (dateText) {
      return {
        pageId,
        date: dayjs(dateText).format('YYYY-MM-DD'),
      }
    }
  }
}

const getMostRecentVisitDates = async (databasePages) => {
  const pageDates = await Promise.all(databasePages.map(({ id }) => {
    return getMostRecentVisitDate({ pageId: id })
  }))

  return compact(pageDates)
}

const updateRestaurantsLastVisit = async () => {
  try {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates...')

    const databasePages = await getDatabasePages()
    const pageDates = await getMostRecentVisitDates(databasePages)

    await updatePages(pageDates)

    // eslint-disable-next-line no-console
    console.log('Successfully updated restaurants last visit dates')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)
  }
}

module.exports = updateRestaurantsLastVisit
