const rp = require('request-promise')

const getData = ({ notionPageId, notionToken, body, method = 'get' }) => {
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

module.exports = {
  getData,
}
