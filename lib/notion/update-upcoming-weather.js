const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')

const { getData: getWeatherData } = require('../weather')
const {
  dateRegex,
  getDateFromText,
  getPlainText,
  updateBlock,
  getWeatherIcon,
  makeTextPart,
} = require('./util')
const { getAll: getAllQuests } = require('./quests')
const { compact } = require('../util/collections')
const { getEnv } = require('../util/env')

const getDates = (questBlocks) => {
  return questBlocks.reduce((memo, block) => {
    if (block.type !== 'paragraph') return memo

    const text = getPlainText(block)
    const [dateText] = text.match(dateRegex) || []

    if (!dateText) return memo

    const date = getDateFromText(dateText).format('YYYY-MM-DD')

    memo.push({
      text,
      date,
      dateText,
      id: block.id,
    })

    return memo
  }, [])
}

const getWeather = async ({ location }) => {
  const weather = await getWeatherData({ location })

  return weather.daily.data.reduce((memo, dayWeather) => {
    const date = dayjs.unix(dayWeather.time).format('YYYY-MM-DD')

    debug('weather: %o', { timestamp: dayWeather.time, date })

    memo[date] = dayWeather

    return memo
  }, {})
}

const makePrecipPart = (condition, info) => {
  return condition ? makeTextPart(`(${info}) `, 'gray') : undefined
}

const updateBlockWeather = async ({ block, notionToken, weather }) => {
  const content = {
    paragraph: {
      rich_text: compact([
        makeTextPart(`${block.dateText}    ${getWeatherIcon(weather.icon)} `),
        makePrecipPart(weather.icon === 'rain' && weather.precipProbability >= 0.01, `${Math.round(weather.precipProbability * 100)}%`),
        makePrecipPart(weather.icon === 'snow' && weather.precipAccumulation >= 0.1, `${(weather.precipAccumulation || 0).toFixed(2)}in`),
        makeTextPart(`${Math.round(weather.temperatureLow)}°`, 'blue'),
        makeTextPart(' / ', 'gray'),
        makeTextPart(`${Math.round(weather.temperatureHigh)}°`, 'orange'),
      ]),
    },
  }

  const newText = content.paragraph.rich_text
  .map(({ text }) => text.content)
  .join('')
  .trim()

  if (newText === block.text) {
    debug(`No weather change for ${block.dateText}`)

    return
  }

  debug(`Update "${block.text}" to "${newText}"`)

  await updateBlock({ notionToken, block: content, blockId: block.id })
}

const updateBlocks = async ({ blocks, notionToken, weather }) => {
  for (let block of blocks) {
    if (weather[block.date]) {
      await updateBlockWeather({ block, notionToken, weather: weather[block.date] })
    } else {
      debug('No weather found for %s', block.dateText)
    }
  }
}

const updateWeather = async ({ notionToken, questsId, location }) => {
  const questBlocks = await getAllQuests({ notionToken, pageId: questsId })
  const blocks = getDates(questBlocks)

  debug('dateBlocks:', blocks)

  const weather = await getWeather({ location })

  await updateBlocks({ blocks, notionToken, weather })
}

const main = async () => {
  const notionToken = getEnv('NOTION_TOKEN')
  const questsId = getEnv('NOTION_QUESTS_ID')
  const location = getEnv('WEATHER_LOCATION')

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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Updating quest weather failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)
  }
}

main.updateWeather = updateWeather

module.exports = main
