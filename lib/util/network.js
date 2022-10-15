const axios = require('axios')

const request = async ({ url, body, headers, params, method = 'get' }) => {
  try {
    const response = await axios({
      method,
      url,
      headers,
      params,
      data: body,
    })

    return response.data
  } catch (error) {
    /* eslint-disable no-console */
    console.log('--- axios error ---')
    console.log({ url, body, headers, params, method })
    console.log()
    console.log(error.stack)
    console.log()
    console.trace()
    console.log('-------------------')
    /* eslint-enable no-console */

    throw error
  }
}

module.exports = {
  request,
}
