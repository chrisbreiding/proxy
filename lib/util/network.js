const axios = require('axios')

const request = async ({ url, body, headers, params, method = 'get' }) => {
  const response = await axios({
    method,
    url,
    headers,
    params,
    data: body,
  })

  return response.data
}

module.exports = {
  request,
}
