import dayjs from 'dayjs'
import Debug from 'debug'
import type {
  BlockObjectResponse,
  DatabaseObjectResponse,
  DateDatabasePropertyConfigResponse,
  ListDatabasesResponse,
} from '@notionhq/client/build/src/api-endpoints'

import { getBlockChildren, getBlockPlainText, makeRequest, richTextToPlainText } from './util'
import { compact } from '../util/collections'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

const notionToken = getEnv('NOTION_TOKEN')!
const restaurantsDatabaseId = getEnv('NOTION_NEARBY_RESTAURANTS_TABLE_ID')!

debug('ENV:', {
  notionToken,
  restaurantsDatabaseId,
})

async function getDatabasePages () {
  const { results } = await makeRequest<ListDatabasesResponse>({
    notionToken,
    method: 'post',
    path: `databases/${restaurantsDatabaseId}/query`,
  })

  return results as DatabaseObjectResponse[]
}

interface UpdatePageOptions {
  pageId: string
  properties: {
    [key: string]: {
      date: {
        start: string
      }
    }
  }
}

function updatePage ({ pageId, properties }: UpdatePageOptions) {
  return makeRequest<void>({
    notionToken,
    body: { properties },
    method: 'patch',
    path: `pages/${pageId}`,
  })
}

interface PageDate {
  name: string
  pageId: string
  date: string
}

function updatePages (pageDates: PageDate[]) {
  return Promise.all(pageDates.map(({ date, name, pageId }) => {
    // eslint-disable-next-line no-console
    console.log('Update', name, 'to', date)

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

async function getMostRecentVisitDate ({ name, pageId }: { name: string, pageId: string }) {
  const { results } = await getBlockChildren({ notionToken, pageId })

  for (const block of results as BlockObjectResponse[]) {
    const text = getBlockPlainText(block)

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

async function getMostRecentVisitDates (databasePages: DatabaseObjectResponse[]) {
  const pageDates = await Promise.all(databasePages.map(async (databasePage) => {
    const { id, properties } = databasePage
    const lastVisit = properties['Last Visit'] as DateDatabasePropertyConfigResponse
    const currentDate = lastVisit?.date?.start as string | undefined
    // @ts-ignore
    const name = richTextToPlainText(properties.Name.title)
    const newDate = await getMostRecentVisitDate({ name, pageId: id })

    if (currentDate !== newDate?.date) return newDate
  }))

  return compact(pageDates)
}

export default async function updateRestaurantsLastVisit () {
  try {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates...')

    const databasePages = await getDatabasePages()
    const pageDates = await getMostRecentVisitDates(databasePages)

    await updatePages(pageDates)

    // eslint-disable-next-line no-console
    console.log('Successfully updated restaurants last visit dates')
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)
  }
}
