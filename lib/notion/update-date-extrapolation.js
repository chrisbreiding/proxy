const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')

const {
  getBlockChildrenDeep,
  getPlainText,
  makeTextPart,
  updateBlock,
} = require('./util')
const { compact, mapPromisesSerially } = require('../util/collections')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_SARAH_TOKEN')
const dateExtrapolationId = getEnv('NOTION_DATE_EXTRAPOLATION_ID')

debug('ENV:', {
  notionToken,
  dateExtrapolationId,
})

const getCategoryBlocks = () => {
  return getBlockChildrenDeep({
    notionToken,
    pageId: dateExtrapolationId,
    includeId: true,
    filter: (block) => block.type === 'toggle',
  })
}

const getDateFromBlock = (block) => {
  const text = (getPlainText(block) || '').trim()
  const date = dayjs(text)

  return date.isValid() ? date : undefined
}

const getHistoricalDates = (blocks) => {
  return blocks.reduce((memo, block) => {
    const text = (getPlainText(block) || '').trim()

    if (!['Historical', 'Recent'].includes(text)) return memo

    const dates = block.children.map(getDateFromBlock)

    dates.sort((a, b) => a - b)

    return memo.concat(compact(dates))
  }, [])
}

const getIntervals = (dates) => {
  return dates.reduce((memo, date, index) => {
    const nextDate = dates[index + 1]

    if (!nextDate) return memo

    return memo.concat(nextDate.diff(date, 'day'))
  }, [])
}

const getSum = (nums) => {
  return nums.reduce((sum, num) => sum + num, 0)
}

const getAverage = (nums) => {
  return Math.round(getSum(nums) / nums.length)
}

const getExtrapolatedDateBlocks = (blocks) => {
  const extrapolatedBlock = blocks.find((block) => {
    const text = getPlainText(block) || ''

    return text.includes('Extrapolated')
  })

  return extrapolatedBlock.children.filter((b) => b.type === 'bulleted_list_item')
}

const getExtrapolatedDates = (historicalDates, blocks) => {
  const extrapolatedDateBlocks = getExtrapolatedDateBlocks(blocks)
  const intervals = getIntervals(historicalDates)
  const averageInterval = getAverage(intervals)
  const lastHistoricalDate = historicalDates[historicalDates.length - 1]

  return extrapolatedDateBlocks.reduce((memo, block) => {
    const date = memo.lastDate.add(averageInterval, 'days')

    return {
      lastDate: date,
      dates: memo.dates.concat({ date, block }),
    }
  }, { lastDate: lastHistoricalDate, dates: [] }).dates
}

const updateDates = async (extrapolatedDates) => {
  return mapPromisesSerially(extrapolatedDates, ({ date, block }) => {
    const content = {
      bulleted_list_item: {
        rich_text: [makeTextPart(date.format('YYYY-MM-DD'))],
      },
    }

    return updateBlock({ notionToken, block: content, blockId: block.id })
  })
}

const updateDateExtrapolation = async () => {
  try {
    const blocks = await getCategoryBlocks()
    const historicalDates = getHistoricalDates(blocks)
    const extrapolatedDates = getExtrapolatedDates(historicalDates, blocks)

    await updateDates(extrapolatedDates)

    // eslint-disable-next-line no-console
    console.log('Successfully updated date extrapolation')

    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Updating date extrapolation failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)

    process.exit(1)
  }
}

module.exports = updateDateExtrapolation