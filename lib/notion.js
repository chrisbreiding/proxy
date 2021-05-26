const rp = require('request-promise')

const makeRequest = ({ notionPageId, notionToken, body, method = 'get' }) => {
  return rp({
    method,
    body,
    uri: `https://api.notion.com/v1/blocks/${notionPageId}/children`,
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2021-05-13',
    },
    json: true,
  })
}

const getData = (props) => {
  return makeRequest(props)
}

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

const removeAnnotations = (textItems) => {
  return textItems.map((textItem) => {
    delete textItem.annotations

    return textItem
  })
}

const getText = ({ block, dates, query, params }) => {
  const textItems = block[block.type].text

  if (block.type !== 'paragraph' || textItems.length !== 1) return removeAnnotations(textItems)

  const text = textItems[0].plain_text

  const [, day] = text.match(daysOfWeekRegex) || []

  if (!day) return removeAnnotations(textItems)

  textItems[0].plain_text = dates.dates[day]
  textItems[0].text.content = dates.dates[day]

  if (day === 'Sat') {
    textItems[0].plain_text += ' - '
    textItems[0].text.content += ' - '

    const text = 'Add following week'
    const urlQuery = [
      `weekTemplatePageId=${query.weekTemplatePageId}`,
      `upcomingPageId=${query.upcomingPageId}`,
      `notionToken=${query.notionToken}`,
      `startDate=${dates.nextDate}`,
    ].join('&')
    const url = `https://proxy.crbapps.com/notion/upcoming-week/${params.key}?${urlQuery}`

    textItems.push({
      type: 'text',
      plain_text: text,
      href: url,
      text: {
        content: text,
        link: { url },
      },
    })
  }

  return removeAnnotations(textItems)
}

const getWeekTemplate = async ({ query, params }) => {
  const { weekTemplatePageId, notionToken, startDate } = query
  const result = await getData({ notionToken, notionPageId: weekTemplatePageId })

  const dates = getDates(startDate)

  return {
    children: result.results.map((block) => {
      return {
        object: 'block',
        type: block.type,
        [block.type]: {
          text: getText({ block, dates, query, params }),
        },
      }
    }),
  }
}

const addUpcomingWeek = async (req, res) => {
  const { upcomingPageId, notionToken } = req.query

  try {
    const body = await getWeekTemplate(req)

    await makeRequest({
      body,
      notionToken,
      method: 'patch',
      notionPageId: upcomingPageId,
    })

    res.sendStatus(204)
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
  getData,
}
