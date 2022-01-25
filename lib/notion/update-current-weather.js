const debug = require('debug')('proxy:scripts')

const { getData: getWeatherData } = require('../weather')
const { updateBlock, makeTextPart, getWeatherIcon } = require('./util')
const { compact } = require('../util/collections')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_TOKEN')
const currentWeatherId = getEnv('CURRENT_WEATHER_ID')
const weatherLocation = getEnv('WEATHER_LOCATION')

debug('ENV:', {
  notionToken,
  currentWeatherId,
  weatherLocation,
})

const getWeather = async () => {
  const weather = await getWeatherData({ location: weatherLocation })

  return weather.currently
}

const makePrecipPart = (condition, info) => {
  return condition ? makeTextPart(`(${info}) `, 'gray') : undefined
}

const getColor = (temp) => {
  if (temp <= 32) return 'purple'
  if (temp > 32 && temp <= 45) return 'blue'
  if (temp > 45 && temp <= 75) return 'green'
  if (temp > 75 && temp <= 90) return 'orange'
  return 'red'
}

const updateBlockWeather = async (weather) => {
  const content = {
    heading_1: {
      text: compact([
        makeTextPart(`${getWeatherIcon(weather.icon)} `),
        makePrecipPart(weather.icon === 'rain' && weather.precipProbability >= 0.01, `${Math.round(weather.precipProbability * 100)}%`),
        makePrecipPart(weather.icon === 'snow' && weather.precipAccumulation >= 0.1, `${weather.precipAccumulation.toFixed(2)}in`),
        makeTextPart(`${Math.round(weather.temperature)}°`, getColor(weather.temperature)),
      ]),
    },
  }

  const newText = content.heading_1.text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  // eslint-disable-next-line no-console
  console.log(`Update current weather to "${newText}"`)

  await updateBlock({ notionToken, block: content, blockId: currentWeatherId })
}

const updateWeather = async () => {
  try {
    const weather = await getWeather({ location: weatherLocation })

    await updateBlockWeather(weather)

    // eslint-disable-next-line no-console
    console.log('Successfully updated current weather')

    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Updating current weather failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)

    process.exit(1)
  }
}

updateWeather()
