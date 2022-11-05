import dayjs from 'dayjs'
import Debug from 'debug'

import { DayWeather, getWeatherData, getWeatherIcon } from '../weather'
import {
  dateRegex,
  getBlockPlainText,
  getDateFromText,
  makeTextPart,
  NotionBlock,
  updateBlock,
} from './util'
import { getAllQuests } from './quests'
import { compact } from '../util/collections'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

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

    const [dateText] = text?.match(dateRegex) || []

    if (!dateText) return memo

    const date = getDateFromText(dateText).format('YYYY-MM-DD')

    memo.push({
      text,
      date,
      dateText,
      id: block.id,
    })

    return memo
  }, [] as DateObject[])
}

type WeatherByDate = { [key: string]: DayWeather }

async function getWeather ({ location }: { location: string }) {
  const weather = await getWeatherData({ location })

  return weather.daily.data.reduce((memo, dayWeather) => {
    const date = dayjs.unix(dayWeather.time).format('YYYY-MM-DD')

    debug('weather: %o', { timestamp: dayWeather.time, date })

    memo[date] = dayWeather

    return memo
  }, {} as WeatherByDate)
}

const makePrecipPart = (condition: boolean, info: string) => {
  return condition ? makeTextPart(`(${info}) `, 'gray') : undefined
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
      rich_text: compact([
        makeTextPart(`${dateObject.dateText}    ${getWeatherIcon(weather.icon)} `),
        makePrecipPart(weather.icon === 'rain' && weather.precipProbability >= 0.01, `${Math.round(weather.precipProbability * 100)}%`),
        makePrecipPart(weather.icon === 'snow' && weather.precipAccumulation >= 0.1, `${(weather.precipAccumulation || 0).toFixed(2)}in`),
        makeTextPart(`${Math.round(weather.temperatureLow)}°`, 'blue'),
        makeTextPart(' / ', 'gray'),
        makeTextPart(`${Math.round(weather.temperatureHigh)}°`, 'orange'),
      ]),
      color: 'default' as const,
    },
  }

  const newText = block.content.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  if (newText === dateObject.text) {
    debug(`No weather change for ${dateObject.dateText}`)

    return
  }

  debug(`Update "${dateObject.text}" to "${newText}"`)

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
    } else {
      debug('No weather found for %s', dateObject.dateText)
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

  debug('dateObjects:', dateObjects)

  const weather = await getWeather({ location })

  await updateBlocks({ dateObjects, notionToken, weather })
}

export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const questsId = getEnv('NOTION_QUESTS_ID')!
  const location = getEnv('WEATHER_LOCATION')!

  debug('ENV:', {
    notionToken,
    questsId,
    location,
  })

  try {
    // eslint-disable-next-line no-console
    console.log('Updating quests with weather...')

    await updateWeather({ notionToken, questsId, location })

    // eslint-disable-next-line no-console
    console.log('Successfully updated quests with weather')
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Updating quest weather failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)
  }
}
