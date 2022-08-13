const dayjs = require('dayjs')
const rp = require('request-promise')
const { compact } = require('../util/collections')

const dateRegex = /(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{1,2}\/\d{1,2})/

const getDateFromText = (dateText) => {
  const currentDate = dayjs()
  // originally assume the date's year matches the current year
  const date = dayjs(`${dateText}/${dayjs().year()}`, 'M/D/YYYY')
  // if the current month is after the date's month, we've crossed over years
  // and the date's year should be the next year. usually, it's because it's
  // currently December, but the date's month is January. this can be
  // generically applied, so it will work if it's currently June, but we're
  // trying to get the weather for April. we don't want past weather, only
  // future weather, so assume it's for the following year.
  if (currentDate.month() > date.month()) {
    return date.add(1, 'year')
  }

  return date
}

const makeRequest = ({ notionToken, body, method = 'get', path }) => {
  return rp({
    method,
    body,
    uri: `https://api.notion.com/v1/${path}`,
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    },
    json: true,
  })
}

const getBlockChildren = ({ notionToken, pageId }) => {
  return makeRequest({ notionToken, path: `blocks/${pageId}/children` })
}

const getBlockContent = async ({ notionToken, block, filter, includeId = false }) => {
  if (filter && !filter(block)) return

  const children = block.has_children
    ? (await getBlockChildrenDeep({ notionToken, pageId: block.id, includeId }))
    : undefined

  const content = {
    object: 'block',
    type: block.type,
    [block.type]: {
      rich_text: block[block.type].rich_text,
    },
    children,
  }

  if (includeId) {
    content.id = block.id
  }

  return content
}

const getBlockChildrenDeep = async ({ notionToken, pageId, filter, includeId }) => {
  const { results } = await getBlockChildren({ notionToken, pageId })

  const blocks = await Promise.all(results.map((block) => {
    return getBlockContent({ notionToken, block, filter, includeId })
  }))

  return compact(blocks)
}

const textFilter = (block) => {
  return !!block[block.type].text[0].plain_text.trim()
}

const makeAppendRequest = ({ notionToken, pageId, blocks }) => {
  return makeRequest({
    notionToken,
    method: 'patch',
    path: `blocks/${pageId}/children`,
    body: {
      children: blocks,
    },
  })
}

const appendBlockChildren = async ({ notionToken, pageId, blocks }) => {
  let toAppend = []

  for (let block of blocks) {
    if (block.children) {
      const children = block.children
      delete block.children
      toAppend.push(block)

      const { results } = await makeAppendRequest({ notionToken, pageId, blocks: toAppend })
      toAppend = []

      await appendBlockChildren({
        notionToken,
        pageId: results[results.length - 1].id,
        blocks: children,
      })
    } else {
      toAppend.push(block)
    }
  }

  if (toAppend.length) {
    return makeAppendRequest({
      notionToken,
      pageId,
      blocks: toAppend,
    })
  }
}

const updateBlock = ({ notionToken, blockId, block }) => {
  return makeRequest({
    notionToken,
    method: 'patch',
    path: `blocks/${blockId}`,
    body: block,
  })
}

const makeBlock = ({ text, type = 'paragraph', annotations, children }) => {
  return {
    type,
    object: 'block',
    children,
    [type]: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: text,
          },
          annotations,
          plain_text: text,
        },
      ],
    },
  }
}

const getPlainText = (block) => {
  if (!block) return

  const withText = block[block.type]

  if (!withText || !withText.rich_text) return

  return (withText.rich_text)
  .map(({ plain_text }) => plain_text)
  .join('')
  .trim()
}

const weatherIconMap = {
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

const getWeatherIcon = (iconName) => {
  return weatherIconMap[iconName] || weatherIconMap.default
}

const makeTextPart = (content, color) => {
  const textPart = { text: { content } }

  if (color) {
    textPart.annotations = { color }
  }

  return textPart
}

const removeAnnotations = (textItems) => {
  return textItems.map((textItem) => {
    delete textItem.annotations

    return textItem
  })
}

const getMonthNameFromIndex = (monthIndex, short = false) => {
  return dayjs().month(monthIndex).format(short ? 'MMM' : 'MMMM')
}

const getMonths = ({ short } = {}) => {
  return Array.from(new Array(12)).map((_, i) => {
    return getMonthNameFromIndex(i, short)
  })
}

const getDisplayPrefix = (block) => {
  switch (block.type) {
    case 'paragraph': return ''
    case 'heading_1': return '# '
    case 'heading_2': return '## '
    case 'heading_3': return '### '
    case 'to_do': return `[${block.to_do.checked ? '✓' : ' '}] `
    case 'bulleted_list_item': return '• '
    case 'numbered_list_item': return '1. '
    case 'toggle': return '> '
    case 'code': return '<> '
    case 'quote': return '| '
    case 'callout': return '" '
    default: return ''
  }
}

const getDisplayText = (block) => {
  if (block.type === 'child_page') {
    return `[${block.child_page.title}]`
  }

  if (block.type === 'divider') {
    return '-----'
  }

  if (block[block.type].text) {
    return `${getDisplayPrefix(block)}${getPlainText(block)}`
  }

  return `(${block.type})`
}

// displays block for logging/debugging purposes
const displayBlocks = (blocks) => {
  blocks.forEach((block) => {
    // eslint-disable-next-line no-console
    console.log(`[${block.id}] ${getDisplayText(block)}${block.has_children ? ' (parent)' : ''}`)
  })
}

module.exports = {
  appendBlockChildren,
  dateRegex,
  displayBlocks,
  getBlockChildren,
  getBlockChildrenDeep,
  getBlockContent,
  getDateFromText,
  getMonthNameFromIndex,
  getMonths,
  getPlainText,
  getWeatherIcon,
  makeBlock,
  makeRequest,
  makeTextPart,
  removeAnnotations,
  textFilter,
  updateBlock,
}
