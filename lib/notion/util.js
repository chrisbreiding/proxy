const dayjs = require('dayjs')
const rp = require('request-promise')

const makeRequest = ({ notionToken, body, method = 'get', path }) => {
  return rp({
    method,
    body,
    uri: `https://api.notion.com/v1/${path}`,
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2021-08-16',
    },
    json: true,
  })
}

const getBlockChildren = ({ notionToken, pageId }) => {
  return makeRequest({ notionToken, path: `blocks/${pageId}/children` })
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
      text: [
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

  if (!withText || !withText.text) return

  return withText.text
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

const findUpcomingId = async (blocks) => {
  const block = blocks.find((block) => {
    return block.type === 'toggle' && getPlainText(block) === 'Upcoming'
  })

  if (!block) {
    throw new Error('Could not find Upcoming block')
  }

  return block.id
}

const getQuests = async ({ notionToken, pageId }) => {
  const { results: questBlocks } = await getBlockChildren({ notionToken, pageId })
  const upcomingId = await findUpcomingId(questBlocks)
  const { results: upcomingBlocks } = await getBlockChildren({ notionToken, pageId: upcomingId })


  return [...questBlocks, ...upcomingBlocks]
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
  displayBlocks,
  getBlockChildren,
  getMonthNameFromIndex,
  getMonths,
  getPlainText,
  getQuests,
  getWeatherIcon,
  makeBlock,
  makeTextPart,
  removeAnnotations,
  updateBlock,
}
