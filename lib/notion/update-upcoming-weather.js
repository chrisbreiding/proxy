const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')

const { getData: getWeatherData } = require('../weather')
const {
  dateRegex,
  getDateFromText,
  getPlainText,
  getQuests,
  updateBlock,
  getWeatherIcon,
  makeTextPart,
} = require('./util')
const { compact } = require('../util/collections')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_TOKEN')
const questsId = getEnv('NOTION_QUESTS_ID')
const weatherLocation = getEnv('WEATHER_LOCATION')
const dryRun = getEnv('DRY_RUN')

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

const getWeather = async () => {
  const weather = await getWeatherData({ location: weatherLocation })

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

const updateBlockWeather = async (block, weather) => {
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

  // eslint-disable-next-line no-console
  const log = dryRun && !debug.enabled ? console.log : debug

  log(`Update "${block.text}" to "${newText}"`)

  if (dryRun) return

  await updateBlock({ notionToken, block: content, blockId: block.id })
}

const updateBlocks = async (blocks, weather) => {
  for (let block of blocks) {
    if (weather[block.date]) {
      await updateBlockWeather(block, weather[block.date])
    } else {
      debug('No weather found for %s', block.dateText)
    }
  }
}

const updateWeather = async () => {
  try {
    const questBlocks = await getQuests({ notionToken, pageId: questsId })
    const dateBlocks = getDates(questBlocks)

    debug('dateBlocks:', dateBlocks)

    const weather = await getWeather({ location: weatherLocation })

    await updateBlocks(dateBlocks, weather)

    // eslint-disable-next-line no-console
    console.log('Quests successfully updated with weather')

    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Updating quest weather failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)

    process.exit(1)
  }
}

updateWeather()
