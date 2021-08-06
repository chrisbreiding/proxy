const rp = require('request-promise')

const makeRequest = ({ notionToken, body, method = 'get', path }) => {
  return rp({
    method,
    body,
    uri: `https://api.notion.com/v1/${path}`,
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2021-05-13',
    },
    json: true,
  })
}

const getBlockChildren = ({ notionToken, pageId }) => {
  return makeRequest({ notionToken, path: `blocks/${pageId}/children` })
}

const appendBlockChildren = ({ notionToken, pageId, blocks }) => {
  return makeRequest({
    notionToken,
    method: 'patch',
    path: `blocks/${pageId}/children`,
    body: {
      children: blocks,
    },
  })
}

const updateBlock = ({ notionToken, blockId, block }) => {
  return makeRequest({
    notionToken,
    method: 'patch',
    path: `blocks/${blockId}`,
    body: block,
  })
}

const getPlainText = (withText) => {
  if (!withText) return

  return withText.text
  .map(({ plain_text }) => plain_text)
  .join('')
  .trim()
}

module.exports = {
  getBlockChildren,
  appendBlockChildren,
  updateBlock,
  getPlainText,
}
