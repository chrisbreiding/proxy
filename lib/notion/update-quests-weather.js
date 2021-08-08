const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')

const { getData: getWeatherData } = require('../weather')
const { getBlockChildren, getPlainText, updateBlock } = require('./util')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_TOKEN')
const questsId = getEnv('NOTION_QUESTS_ID')
const upcomingId = getEnv('NOTION_UPCOMING_QUESTS_ID')
const weatherLocation = getEnv('WEATHER_LOCATION')
const weatherTimezone = getEnv('WEATHER_TIMEZONE')
const dryRun = getEnv('DRY_RUN')

if (dryRun) {
  // eslint-disable-next-line no-console
  console.log('--- DRY RUN ---')
}

debug('ENV:', {
  notionToken,
  questsId,
  upcomingId,
  weatherLocation,
  weatherTimezone,
  dryRun,
})

const iconMap = {
  'clear-day': '☀️',
  'clear-night': '☀️',
  'rain': '☔️',
  'snow': '❄️',
  'sleet': '🌨',
  'wind': '💨',
  'fog': '🌫',
  'cloudy': '☁️',
  'partly-cloudy-day': '⛅️',
  'partly-cloudy-night': '⛅️',
  'default': '🌑',
}

const getIcon = (icon) => {
  return iconMap[icon] || iconMap.default
}

const dateRegex = /(Sun|Mon|Tue|Wed|Thu|Fri|Sat), \d+\/\d+/

const getDates = (questBlocks) => {
  return questBlocks.reduce((memo, block) => {
    if (block.type !== 'paragraph') return memo

    const text = getPlainText(block.paragraph)
    const [dateText] = text.match(dateRegex) || []

    if (!dateText) return memo

    const date = dayjs(`${dateText}/${dayjs().year()}`, 'M/D/YYYY').format('YYYY-MM-DD')

    memo.push({
      text,
      date,
      dateText,
      id: block.id,
    })

    return memo
  }, [])
}

const getBlocks = async () => {
  const [quests, upcoming] = await Promise.all([
    getBlockChildren({ notionToken, pageId: questsId }),
    getBlockChildren({ notionToken, pageId: upcomingId }),
  ])

  return [...quests.results, ...upcoming.results]
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

const makeTextPart = (content, color) => {
  const textPart = { text: { content } }

  if (color) {
    textPart.annotations = { color }
  }

  return textPart
}

const insertPrecipInfo = (content, info) => {
  content.paragraph.text.splice(1, 0, makeTextPart(`(${info}) `, 'gray'))
}

const updateBlockWeather = async (block, weather) => {
  const content = {
    paragraph: {
      text: [
        makeTextPart(`${block.dateText}    ${getIcon(weather.icon)} `),
        makeTextPart(`${Math.round(weather.temperatureLow)}°`, 'blue'),
        makeTextPart(' / ', 'gray'),
        makeTextPart(`${Math.round(weather.temperatureHigh)}°`, 'orange'),
      ],
    },
  }

  if (weather.icon === 'rain') {
    insertPrecipInfo(content, `${Math.round(weather.precipProbability * 100)}%`)
  }

  if (weather.icon === 'snow') {
    insertPrecipInfo(content, `${weather.precipAccumulation}in`)
  }

  const newText = content.paragraph.text
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
    const blocks = await getBlocks()
    const dateBlocks = getDates(blocks)

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
