import type { DateDatabasePropertyConfigResponse } from '@notionhq/client'
import dayjs from 'dayjs'

import { compact } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { DataSource } from './types'
import { richTextToPlainText } from './util/conversions'
import { getBlockPlainText } from './util/general'
import { getBlockChildren, getDataSources } from './util/queries'
import { updatePage } from './util/updates'

interface UpdateRestaurantsLastVisitOptions {
  notionToken: string
  restaurantsDataSourceId: string
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
    debug('Update', name, 'to', date)

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
  dataSources: DataSource[]
  notionToken: string
}

async function getMostRecentVisitDates ({ dataSources, notionToken }: GetMostRecentVisitDatesOptions) {
  const pageDates = await Promise.all(dataSources.map(async (dataSource) => {
    const { id, properties } = dataSource
    const lastVisit = properties['Last Visit'] as DateDatabasePropertyConfigResponse
    const currentDate = lastVisit?.date?.start as string | undefined
    // @ts-ignore
    const nameRichText = properties.Name.title
    const name = richTextToPlainText(nameRichText)
    const newDate = await getMostRecentVisitDate({ name, notionToken, pageId: id })

    if (currentDate !== newDate?.date) return newDate
  }))

  return compact(pageDates)
}

export async function updateRestaurantsLastVisit ({ notionToken, restaurantsDataSourceId }: UpdateRestaurantsLastVisitOptions) {
  const dataSources = await getDataSources({ dataSourceId: restaurantsDataSourceId, notionToken })
  const pageDates = await getMostRecentVisitDates({ dataSources, notionToken })

  await updatePages({ notionToken, pageDates })
}

/* v8 ignore next 24 -- @preserve */
export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const restaurantsDataSourceId = getEnv('NOTION_NEARBY_RESTAURANTS_TABLE_ID')!

  debugVerbose('ENV:', {
    notionToken,
    restaurantsDataSourceId,
  })

  try {
    debug('Updating restaurants last visit dates...')

    await updateRestaurantsLastVisit({
      notionToken,
      restaurantsDataSourceId,
    })

    debug('Successfully updated restaurants last visit dates')
  } catch (error: any) {
    debug('Updating restaurants last visit dates failed:')
    debug(error?.stack || error)

    throw error
  }
}
