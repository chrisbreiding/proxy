import { updateBlock, makeTextPart } from './util'
import { compact } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { CurrentWeather, getWeatherData, getWeatherIcon } from '../weather'

async function getWeather (location: string) {
  const weather = await getWeatherData({ location })

  return weather.currently
}

function makePrecipPart (condition: boolean, info: string) {
  return condition ? makeTextPart(`(${info}) `, 'gray') : undefined
}

function getColor (temp: number) {
  if (temp <= 32) return 'purple'
  if (temp > 32 && temp <= 45) return 'blue'
  if (temp > 45 && temp <= 75) return 'green'
  if (temp > 75 && temp <= 90) return 'orange'
  return 'red'
}

interface UpdateBlockWeatherOptions {
  weather: CurrentWeather
  notionToken: string
  currentWeatherId: string
}

async function updateBlockWeather ({ weather, notionToken, currentWeatherId }: UpdateBlockWeatherOptions) {
  const {
    icon,
    precipProbability,
    precipAccumulation,
    temperature,
  } = weather
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
    },
  }

  const newText = block.content.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  debug(`Update current weather to '${newText}'`)

  await updateBlock({ notionToken, block, blockId: currentWeatherId })
}

interface UpdateWeatherOptions {
  notionToken: string
  currentWeatherId: string
  weatherLocation: string
}

export async function updateWeather ({ notionToken, currentWeatherId, weatherLocation }: UpdateWeatherOptions) {
  const weather = await getWeather(weatherLocation)

  await updateBlockWeather({ weather, notionToken, currentWeatherId })
}

export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const currentWeatherId = getEnv('CURRENT_WEATHER_ID')!
  const weatherLocation = getEnv('WEATHER_LOCATION')!

  debugVerbose('ENV:', {
    notionToken,
    currentWeatherId,
    weatherLocation,
  })

  try {
    debug('Updating current weather...')

    await updateWeather({
      notionToken,
      currentWeatherId,
      weatherLocation,
    })
  } catch (error: any) {
    debug('Updating current weather failed:')
    debug(error?.stack || error)
  }
}
