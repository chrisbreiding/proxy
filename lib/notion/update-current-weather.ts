import dayjs from 'dayjs'

import {
  updateBlock,
  makeTextPart,
  getBlockChildren,
  deleteBlock,
  OwnBlock,
  appendBlockChildrenDeep,
} from './util'
import { compact } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { DayWeather, getWeatherData, getWeatherIcon } from '../weather'
import { makeConditionParts, makePrecipPart, makeTemperatureParts } from './weather'

function getColor (temp: number) {
  if (temp <= 32) return 'purple'
  if (temp > 32 && temp <= 45) return 'blue'
  if (temp > 45 && temp <= 75) return 'green'
  if (temp > 75 && temp <= 90) return 'orange'
  return 'red'
}

function makeTableCells (weather: DayWeather[]) {
  return weather.map((dayWeather) => {
    const date = dayjs.unix(dayWeather.time).format('ddd, M/D')

    return {
      type: 'table_row',
      content: {
        cells: [
          [makeTextPart(`${date}`)], // Mon, 11/1
          [...makeTemperatureParts(dayWeather)], // 33° / 62°
          [...makeConditionParts(dayWeather)], // ☀️ | ☔️ (82%)
        ],
      },
    } as OwnBlock
  })
}

interface UpdateTableWeatherOptions {
  notionToken: string
  currentWeatherId: string
  weather: DayWeather[]
}

async function updateTableWeather ({ notionToken, currentWeatherId, weather }: UpdateTableWeatherOptions) {
  const children = await getBlockChildren({ notionToken, pageId: currentWeatherId })

  if (children.length) {
    deleteBlock({ blockId: children[0].id, notionToken })
  }

  const table = {
    type: 'table',
    content: {
      table_width: 3,
      has_column_header: false,
      has_row_header: false,
    },
    children: makeTableCells(weather),
  } as OwnBlock

  await appendBlockChildrenDeep({ blocks: [table], notionToken, pageId: currentWeatherId })
}

interface UpdateWeatherOptions {
  currentWeatherId: string
  location: string
  notionToken: string
}

export async function updateWeather ({ currentWeatherId, location, notionToken }: UpdateWeatherOptions) {
  const weather = await getWeatherData(location)

  const {
    icon,
    precipProbability,
    precipAccumulation,
    temperature,
  } = weather.currently
  const roundedTemperature = Math.round(temperature)

  const block = {
    type: 'heading_1' as const,
    content: {
      rich_text: compact([
        makeTextPart(`${getWeatherIcon(icon)} `),
        makePrecipPart(icon === 'rain' && precipProbability >= 0.01, `${Math.round(precipProbability * 100)}%`),
        makePrecipPart(icon === 'snow' && precipAccumulation >= 0.1, `${(precipAccumulation || 0).toFixed(2)}in`),
        makeTextPart(`${roundedTemperature}°`, getColor(roundedTemperature)),
      ]),
      color: 'default' as const,
      is_toggleable: true,
    },
  }

  const newText = block.content.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  debug(`Update current weather to '${newText}'`)

  await updateBlock({ notionToken, block, blockId: currentWeatherId })
  await updateTableWeather({ currentWeatherId, notionToken, weather: weather.daily.data })
}

export default async function main () {
  const currentWeatherId = getEnv('CURRENT_WEATHER_ID')!
  const location = getEnv('WEATHER_LOCATION')!
  const notionToken = getEnv('NOTION_TOKEN')!

  debugVerbose('ENV:', {
    currentWeatherId,
    location,
    notionToken,
  })

  try {
    debug('Updating current weather...')

    await updateWeather({
      currentWeatherId,
      location,
      notionToken,
    })
  } catch (error: any) {
    debug('Updating current weather failed:')
    debug(error?.stack || error)
  }
}
