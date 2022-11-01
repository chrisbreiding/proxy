const debug = require('debug')('proxy:scripts')

const { getData: getWeatherData } = require('../weather')
const { updateBlock, makeTextPart, getWeatherIcon } = require('./util')
const { compact } = require('../util/collections')
const { getEnv } = require('../util/env')

const getWeather = async (location) => {
  const weather = await getWeatherData({ location })

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

const updateBlockWeather = async ({ weather, notionToken, currentWeatherId }) => {
  const {
    icon,
    precipProbability,
    precipAccumulation,
    temperature,
  } = weather
  const roundedTemperature = Math.round(temperature)

  const content = {
    heading_1: {
      rich_text: compact([
        makeTextPart(`${getWeatherIcon(icon)} `),
        makePrecipPart(icon === 'rain' && precipProbability >= 0.01, `${Math.round(precipProbability * 100)}%`),
        makePrecipPart(icon === 'snow' && precipAccumulation >= 0.1, `${(precipAccumulation || 0).toFixed(2)}in`),
        makeTextPart(`${roundedTemperature}°`, getColor(roundedTemperature)),
      ]),
    },
  }

  const newText = content.heading_1.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  // eslint-disable-next-line no-console
  console.log(`Update current weather to "${newText}"`)

  await updateBlock({ notionToken, block: content, blockId: currentWeatherId })
}

const updateWeather = async ({ notionToken, currentWeatherId, weatherLocation }) => {
  const weather = await getWeather(weatherLocation)

  await updateBlockWeather({ weather, notionToken, currentWeatherId })
}

const updateWeatherScript = () => {
  const notionToken = getEnv('NOTION_TOKEN')
  const currentWeatherId = getEnv('CURRENT_WEATHER_ID')
  const weatherLocation = getEnv('WEATHER_LOCATION')

  debug('ENV:', {
    notionToken,
    currentWeatherId,
    weatherLocation,
  })

  try {
    // eslint-disable-next-line no-console
    console.log('Updating current weather...')

    return updateWeather({
      notionToken,
      currentWeatherId,
      weatherLocation,
    })
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Successfully updated current weather')
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Updating current weather failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)
  }
}

updateWeatherScript.updateWeather = updateWeather

module.exports = updateWeatherScript
