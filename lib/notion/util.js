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

const getPlainText = (withText) => {
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

module.exports = {
  appendBlockChildren,
  getBlockChildren,
  getPlainText,
  getWeatherIcon,
  makeBlock,
  makeTextPart,
  removeAnnotations,
  updateBlock,
}
