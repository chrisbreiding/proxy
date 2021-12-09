const { appendBlockChildren, getBlockChildren, updateBlock, removeAnnotations } = require('./util')

const daysOfWeek = 'Sun|Mon|Tue|Wed|Thu|Fri|Sat'.split('|')
const daysOfWeekRegex = /(Sun|Mon|Tue|Wed|Thu|Fri|Sat), /

const getDates = (startDate) => {
  startDate = new Date(startDate)

  return {
    dates: daysOfWeek.reduce((memo, day) => {
      const date = startDate.getDate()

      memo[day] = `${day}, ${startDate.getMonth() + 1}/${date}`

      startDate.setDate(date + 1)

      return memo
    }, {}),
    nextDate: startDate.toISOString(),
  }
}

const getText = ({ block, dates }) => {
  const textItems = block[block.type].text

  if (block.type !== 'paragraph' || textItems.length !== 1) return removeAnnotations(textItems)

  const text = textItems[0].plain_text

  const [, day] = text.match(daysOfWeekRegex) || []

  if (!day) return removeAnnotations(textItems)

  textItems[0].plain_text = dates.dates[day]
  textItems[0].text.content = dates.dates[day]

  return removeAnnotations(textItems)
}

const addFollowingWeekAndUpdateButton = async ({ query, params }) => {
  const { weekTemplatePageId, notionToken, startDate, appendToId } = query
  const weekTemplate = await getBlockChildren({ notionToken, pageId: weekTemplatePageId })
  const dates = getDates(startDate)

  const blocks = weekTemplate.results.map((block) => {
    return {
      object: 'block',
      type: block.type,
      [block.type]: {
        text: getText({ block, dates, query, params }),
      },
    }
  })

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
          <p style="margin: 20px;">Following week successfully added!<p>
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
