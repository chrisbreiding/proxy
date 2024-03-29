import dayjs from 'dayjs'

import {
  getBlockPlainText,
  makeTextPart,
} from './util/general'
import { getAllQuests } from './quests'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { makeConditionParts, makeTemperatureParts } from './util/weather'
import { DayWeather, getDailyWeather } from '../weather'
import type { NotionBlock } from './types'
import { getDateFromText } from '../util/dates'
import { updateBlock } from './util/updates'

interface DateObject {
  date: string
  dateText: string
  id: string
  text: string
}

function getDates (questBlocks: NotionBlock[]) {
  return questBlocks.reduce((memo, block) => {
    if (block.type !== 'paragraph') return memo

    const text = getBlockPlainText(block)

    if (!text) return memo

    const { date, dateText } = getDateFromText(text)

    if (!date || !dateText) return memo

    memo.push({
      text,
      date: date.format('YYYY-MM-DD'),
      dateText,
      id: block.id,
    })

    return memo
  }, [] as DateObject[])
}

export type WeatherByDate = { [key: string]: DayWeather }

export function getWeatherByDate (weather: DayWeather[]) {
  return weather.reduce((memo, dayWeather) => {
    const date = dayjs.unix(dayWeather.time).format('YYYY-MM-DD')

    debugVerbose('weather: %o', { timestamp: dayWeather.time, date })

    memo[date] = dayWeather

    return memo
  }, {} as WeatherByDate)
  // don't understand why this fails coverage
  /* c8 ignore next */
}

interface UpdateBlockWeatherOptions {
  dateObject: DateObject
  notionToken: string
  weather: DayWeather
}

async function updateBlockWeather ({ dateObject, notionToken, weather }: UpdateBlockWeatherOptions) {
  const block = {
    type: 'paragraph' as const,
    content: {
      rich_text: [
        makeTextPart(`${dateObject.dateText}    `), // Mon, 11/1
        ...makeConditionParts(weather), // ☀️ | ☔️ (82%)
        ...makeTemperatureParts(weather), // 33° / 62°
      ],
      color: 'default' as const,
    },
  }

  const newText = block.content.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  if (newText === dateObject.text) {
    debugVerbose(`No weather change for ${dateObject.dateText}`)

    return
  }

  debugVerbose(`Update "${dateObject.text}" to "${newText}"`)

  await updateBlock({ notionToken, block, blockId: dateObject.id })
}

interface UpdateBlocksOptions {
  dateObjects: DateObject[]
  notionToken: string
  weather: WeatherByDate
}

async function updateBlocks ({ dateObjects, notionToken, weather }: UpdateBlocksOptions) {
  for (const dateObject of dateObjects) {
    if (weather[dateObject.date]) {
      await updateBlockWeather({ dateObject, notionToken, weather: weather[dateObject.date] })
    /* c8 ignore next 3 */
    } else {
      debugVerbose('No weather found for %s', dateObject.dateText)
    }
  }
}

interface UpdateWeatherOptions {
  notionToken: string
  questsId: string
  location: string
}

export async function updateWeather ({ notionToken, questsId, location }: UpdateWeatherOptions) {
  const questBlocks = await getAllQuests({ notionToken, pageId: questsId })
  const dateObjects = getDates(questBlocks)

  debugVerbose('dateObjects:', dateObjects)

  const weatherData = await getDailyWeather(location)
  const weather = getWeatherByDate(weatherData.daily.data)

  await updateBlocks({ dateObjects, notionToken, weather })
}

export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const questsId = getEnv('NOTION_QUESTS_ID')!
  const location = getEnv('WEATHER_LOCATION')!

  debugVerbose('ENV:', {
    notionToken,
    questsId,
    location,
  })

  try {
    debug('Updating quests with weather...')

    await updateWeather({ notionToken, questsId, location })

    debug('Successfully updated quests with weather')
  } catch (error: any) {
    debug('Updating quest weather failed:')
    debug(error?.stack || error)

    throw error
  }
}
