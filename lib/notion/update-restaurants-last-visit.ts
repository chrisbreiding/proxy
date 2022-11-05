import dayjs from 'dayjs'
import Debug from 'debug'
import type {
  DatabaseObjectResponse,
  DateDatabasePropertyConfigResponse,
} from '@notionhq/client/build/src/api-endpoints'

import {
  getBlockChildren,
  getBlockPlainText,
  queryDatabases,
  richTextToPlainText,
  updatePage,
} from './util'
import { compact } from '../util/collections'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

interface UpdateRestaurantsLastVisitOptions {
  notionToken: string
  restaurantsDatabaseId: string
}

async function getDatabasePages ({ notionToken, restaurantsDatabaseId }: UpdateRestaurantsLastVisitOptions) {
  const { results } = await queryDatabases({ notionToken, databaseId: restaurantsDatabaseId })

  return results as DatabaseObjectResponse[]
}

interface PageDate {
  name: string
  pageId: string
  date: string
}

interface UpdatePagesOptions {
  pageDates: PageDate[]
  notionToken: string
}

function updatePages ({ pageDates, notionToken }: UpdatePagesOptions) {
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

interface GetMostRecentVisitDateOptions {
  name: string
  notionToken: string
  pageId: string
 }

async function getMostRecentVisitDate ({ name, notionToken, pageId }: GetMostRecentVisitDateOptions) {
  const blocks = await getBlockChildren({ notionToken, pageId })

  for (const block of blocks) {
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

interface GetMostRecentVisitDatesOptions {
  databasePages: DatabaseObjectResponse[]
  notionToken: string
}

async function getMostRecentVisitDates ({ databasePages, notionToken }: GetMostRecentVisitDatesOptions) {
  const pageDates = await Promise.all(databasePages.map(async (databasePage) => {
    const { id, properties } = databasePage
    const lastVisit = properties['Last Visit'] as DateDatabasePropertyConfigResponse
    const currentDate = lastVisit?.date?.start as string | undefined
    // @ts-ignore
    const name = richTextToPlainText(properties.Name.title)
    const newDate = await getMostRecentVisitDate({ name, notionToken, pageId: id })

    if (currentDate !== newDate?.date) return newDate
  }))

  return compact(pageDates)
}

export async function updateRestaurantsLastVisit ({ notionToken, restaurantsDatabaseId }: UpdateRestaurantsLastVisitOptions) {
  const databasePages = await getDatabasePages({ notionToken, restaurantsDatabaseId })
  const pageDates = await getMostRecentVisitDates({ databasePages, notionToken })

  await updatePages({ notionToken, pageDates })
}

export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const restaurantsDatabaseId = getEnv('NOTION_NEARBY_RESTAURANTS_TABLE_ID')!

  debug('ENV:', {
    notionToken,
    restaurantsDatabaseId,
  })

  try {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates...')

    await updateRestaurantsLastVisit({
      notionToken,
      restaurantsDatabaseId,
    })

    // eslint-disable-next-line no-console
    console.log('Successfully updated restaurants last visit dates')
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Updating restaurants last visit dates failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)
  }
}
