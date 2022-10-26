import dayjs from 'dayjs'
import Debug from 'debug'
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

import { DayWeather, getWeatherData, getWeatherIcon } from '../weather'
import {
  dateRegex,
  getDateFromText,
  getBlockPlainText,
  makeTextPart,
  updateBlock,
} from './util'
import { getAllQuests } from './quests'
import { compact } from '../util/collections'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

const notionToken = getEnv('NOTION_TOKEN')!
const questsId = getEnv('NOTION_QUESTS_ID')!
const weatherLocation = getEnv('WEATHER_LOCATION')!
const dryRun = getEnv('DRY_RUN')!

if (dryRun) {
  // eslint-disable-next-line no-console
  console.log('--- DRY RUN ---')
}

debug('ENV:', {
  notionToken,
  questsId,
  weatherLocation,
  dryRun,
})

interface DateObject {
  date: string
  dateText: string
  id: string
  text: string
}

function getDates (questBlocks: BlockObjectResponse[]) {
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

async function getWeather () {
  const weather = await getWeatherData({ location: weatherLocation })

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

async function updateBlockWeather (dateObject: DateObject, weather: DayWeather) {
  const content = {
    type: 'paragraph' as const,
    paragraph: {
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

  const newText = content.paragraph.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  if (newText === dateObject.text) {
    debug(`No weather change for ${dateObject.dateText}`)

    return
  }

  // eslint-disable-next-line no-console
  const log = dryRun && !debug.enabled ? console.log : debug

  log(`Update '${dateObject.text}' to '${newText}'`)

  if (dryRun) return

  await updateBlock({ notionToken, block: content, blockId: dateObject.id })
}

async function updateBlocks (dateObjects: DateObject[], weather: WeatherByDate) {
  for (const dateObject of dateObjects) {
    if (weather[dateObject.date]) {
      await updateBlockWeather(dateObject, weather[dateObject.date])
    } else {
      debug('No weather found for %s', dateObject.dateText)
    }
  }
}

export default async function updateWeather () {
  try {
    // eslint-disable-next-line no-console
    console.log('Updating quests with weather...')

    const questBlocks = await getAllQuests({ notionToken, pageId: questsId })
    const dateObjects = getDates(questBlocks)

    debug('dateObjects:', dateObjects)

    const weather = await getWeather()

    await updateBlocks(dateObjects, weather)

    // eslint-disable-next-line no-console
    console.log('Successfully updated quests with weather')
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Updating quest weather failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)
  }
}
