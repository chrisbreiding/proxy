const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')

const { getData: getWeatherData } = require('../weather')
const { getBlockChildren, getPlainText, updateBlock } = require('./util')

const notionToken = process.env.NOTION_TOKEN
const questsId = process.env.NOTION_QUESTS_ID
const upcomingId = process.env.NOTION_UPCOMING_QUESTS_ID
const weatherLocation = process.env.WEATHER_LOCATION
const weatherTimezone = process.env.WEATHER_TIMEZONE

debug('ENV:', {
  notionToken,
  questsId,
  upcomingId,
  weatherLocation,
  weatherTimezone,
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

    if (dateRegex.test(text)) {
      const dateText = text.match(dateRegex)[0]
      const date = dayjs(`${dateText}/${dayjs().year()}`, 'M/D/YYYY').format('YYYY-MM-DD')

      memo.push({
        text,
        dateText,
        date: date.unix(),
        id: block.id,
      })
    }

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
        makeTextPart(`${block.dateText}     ${getIcon(weather.icon)} `),
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

  await updateBlock({ notionToken, block: content, blockId: block.id })
}

const updateBlocks = async (blocks, weather) => {
  for (let block of blocks) {
    if (weather[block.date]) {
      await updateBlockWeather(block, weather[block.date])
    } else {
      debug('No weather found for %s (%s)', block.dateText, block.date)
    }
  }
}

const updateWeather = async () => {
  try {
    const blocks = await getBlocks()
    const dateBlocks = getDates(blocks)

    debug('dateBlocks:', dateBlocks)

    const weather = await getWeather({ location: weatherLocation })

    debug('weather:', weather.map((day) => {
      return {
        timestamp: day.time,
        date: dayjs.unix(day.time).toISOString(),
      }
    }))

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
