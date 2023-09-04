import dayjs from 'dayjs'

import { makeBlock, makeTextPart } from './util/general'
import { compact } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { DayWeather, getWeatherIcon, getCurrentAndDailyWeather, CurrentAndDailyWeather } from '../weather'
import { makeConditionParts, makePrecipPart, makeTemperatureParts } from './util/weather'
import type { OwnBlock } from './types'
import { getBlockChildrenDeep } from './util/queries'
import { updateBlock } from './util/updates'

function getColor (temp: number) {
  if (temp <= 32) return 'purple'
  if (temp > 32 && temp <= 45) return 'blue'
  if (temp > 45 && temp <= 75) return 'green'
  if (temp > 75 && temp <= 90) return 'orange'
  return 'red'
}

function makeTableRows (weather: DayWeather[]) {
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
  const toggleContents = await getBlockChildrenDeep({ notionToken, pageId: currentWeatherId })

  if (toggleContents.length !== 2) {
    throw new Error('Expected current weather block to have 2 children, a table block and a paragraph block')
  }

  const table = toggleContents[0]

  if (table.type !== 'table') {
    throw new Error(`Expected first block to be a table, but it is a '${table.type}'`)
  }

  const paragraph = toggleContents[1]

  if (paragraph.type !== 'paragraph') {
    throw new Error(`Expected second block to be a paragraph, but it is a '${paragraph.type}'`)
  }

  const tableRows = table.children

  if (!tableRows || tableRows.length !== 8) {
    throw new Error(`Expected table to have 8 rows, but it has ${tableRows?.length || 0}`)
  }

  const newTableRows = makeTableRows(weather)

  for (const [i, row] of newTableRows.entries()) {
    const blockId = tableRows[i].id

    debugVerbose('Update row #%s', i + 1)

    await updateBlock({ notionToken, blockId, block: row })
  }

  const dateTime = dayjs().format('MMM D, h:mma')

  debugVerbose('Update "Updated" date/time to:', dateTime)

  const paragraphBlock = makeBlock({
    text: `Updated ${dateTime}`,
    type: 'paragraph',
    annotations: {
      color: 'gray',
    },
  })

  await updateBlock({ notionToken, blockId: paragraph.id, block: paragraphBlock })
}

async function getCurrentWeatherBlock (weather: CurrentAndDailyWeather) {
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
        makePrecipPart(!!precipProbability && icon === 'rain' && precipProbability >= 0.01, `${Math.round((precipProbability || 0) * 100)}%`),
        makePrecipPart(!!precipAccumulation && icon === 'snow' && precipAccumulation >= 0.1, `${(precipAccumulation || 0).toFixed(2)}in`),
        makeTextPart(`${roundedTemperature}°`, getColor(roundedTemperature)),
      ]),
      color: 'default' as const,
      is_toggleable: true,
    },
  }

  const text = block.content.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  return { block, text }
}

interface UpdateWeatherOptions {
  currentWeatherId: string
  location: string
  notionToken: string
}

export async function updateWeather ({ currentWeatherId, location, notionToken }: UpdateWeatherOptions) {
  const weather = await getCurrentAndDailyWeather(location)
  const { block, text } = await getCurrentWeatherBlock(weather)

  debug(`Update current weather to '${text}'`)

  await updateBlock({ notionToken, block, blockId: currentWeatherId })
  await updateTableWeather({
    currentWeatherId,
    notionToken,
    weather:
    weather.daily.data.slice(0, 8),
  })
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

    throw error
  }
}
