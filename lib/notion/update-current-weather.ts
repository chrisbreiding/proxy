import Debug from 'debug'

import { CurrentWeather, getWeatherData, getWeatherIcon } from '../weather'
import { updateBlock, makeTextPart } from './util'
import { compact } from '../util/collections'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

const notionToken = getEnv('NOTION_TOKEN')!
const currentWeatherId = getEnv('CURRENT_WEATHER_ID')!
const weatherLocation = getEnv('WEATHER_LOCATION')!

debug('ENV:', {
  notionToken,
  currentWeatherId,
  weatherLocation,
})

async function getWeather () {
  const weather = await getWeatherData({ location: weatherLocation })

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

async function updateBlockWeather (weather: CurrentWeather) {
  const {
    icon,
    precipProbability,
    precipAccumulation,
    temperature,
  } = weather
  const roundedTemperature = Math.round(temperature)

  const content = {
    type: 'heading_1' as const,
    heading_1: {
      rich_text: compact([
        makeTextPart(`${getWeatherIcon(icon)} `),
        makePrecipPart(icon === 'rain' && precipProbability >= 0.01, `${Math.round(precipProbability * 100)}%`),
        makePrecipPart(icon === 'snow' && precipAccumulation >= 0.1, `${(precipAccumulation || 0).toFixed(2)}in`),
        makeTextPart(`${roundedTemperature}°`, getColor(roundedTemperature)),
      ]),
      color: 'default' as const,
    },
  }

  const newText = content.heading_1.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  // eslint-disable-next-line no-console
  console.log(`Update current weather to '${newText}'`)

  await updateBlock({ notionToken, block: content, blockId: currentWeatherId })
}

export default async function updateWeather () {
  try {
    // eslint-disable-next-line no-console
    console.log('Updating current weather...')

    const weather = await getWeather()

    await updateBlockWeather(weather)

    // eslint-disable-next-line no-console
    console.log('Successfully updated current weather')
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Updating current weather failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)
  }
}
