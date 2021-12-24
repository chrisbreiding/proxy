const dayjs = require('dayjs')

const {
  appendBlockChildren,
  getBlockChildren,
  getMonths,
  getPlainText,
  makeBlock,
  updateBlock,
} = require('./util')

const daysOfWeek = 'Sun|Mon|Tue|Wed|Thu|Fri|Sat'.split('|')
const daysOfWeekRegex = /(Sun|Mon|Tue|Wed|Thu|Fri|Sat),/
const monthPattern = `(?:${getMonths({ short: true }).join('|')})`
const monthsConditionRegex = new RegExp(`( if (${monthPattern}(?:(?:, )${monthPattern})*))`)

const getDates = (startDate) => {
  const { nextDate, dates } = daysOfWeek.reduce((memo, day) => {
    memo.dates[day] = memo.nextDate
    memo.nextDate = memo.nextDate.add(1, 'day')

    return memo
  }, { nextDate: dayjs(startDate), dates: {} })

  return {
    dates,
    nextDate: nextDate.toISOString(),
  }
}

const getText = ({ block, dates, currentDate }) => {
  const text = getPlainText(block)
  const [, day] = text.match(daysOfWeekRegex) || []

  if (day) {
    const date = dates.dates[day]
    const text = `${day}, ${date.month() + 1}/${date.date()}`

    return { date, text }
  }

  const [, condition, monthsString] = text.match(monthsConditionRegex) || []

  if (!condition) return { text }

  const months = monthsString.split(', ')
  const currentMonth = dayjs(currentDate).format('MMM')

  if (!months.includes(currentMonth)) return {}

  return { text: text.replace(condition, '') }
}

const getDayBlocks = async ({ notionToken, weekTemplatePageId, startDate }) => {
  const { results } = await getBlockChildren({ notionToken, pageId: weekTemplatePageId })
  const dates = getDates(startDate)

  let currentDate

  return {
    dates,
    blocks: results.reduce((memo, block) => {
      const { text, date } = getText({ block, startDate, dates, currentDate })

      if (date) {
        memo.currentDate = date
      }

      if (text) {
        memo.blocks.push(makeBlock({ text, type: block.type }))
      }

      return memo
    }, { blocks: [] }).blocks,
  }
}

const addFollowingWeekAndUpdateButton = async ({ query, params }) => {
  const { weekTemplatePageId, notionToken, startDate, appendToId } = query
  const { blocks, dates } = await getDayBlocks({ notionToken, weekTemplatePageId, startDate })

  await appendBlockChildren({ notionToken, blocks, pageId: appendToId })
  await updateAddFollowingWeekButton({ query, params, dates })
}

const updateAddFollowingWeekButton = ({ query, params, dates }) => {
  const { notionToken } = query

  const text = '[ Add following week ]'
  const urlQuery = [
    `weekTemplatePageId=${query.weekTemplatePageId}`,
    `appendToId=${query.appendToId}`,
    `addFollowingWeekButtonId=${query.addFollowingWeekButtonId}`,
    `notionToken=${query.notionToken}`,
    `startDate=${dates.nextDate}`,
  ].join('&')
  const url = `https://proxy.crbapps.com/notion/upcoming-week/${params.key}?${urlQuery}`

  const block = {
    paragraph: {
      text: [{
        text: {
          content: text,
          link: { url },
        },
      }],
    },
  }

  return updateBlock({ notionToken, block, blockId: query.addFollowingWeekButtonId })
}

const addUpcomingWeek = async (req, res) => {
  try {
    await addFollowingWeekAndUpdateButton(req)

    res.set('Content-Type', 'text/html')
    res.send(
      `<!DOCTYPE html>
      <html>
        <body>
          <h2 style="margin: 20px;">Following week successfully added!<h2>
        </body>
      </html>`
    )
  } catch (error) {
    res.status(500).json({
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  }
}

module.exports = {
  addUpcomingWeek,
}
