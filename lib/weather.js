const { request } = require('./util/network')
const { getEnv } = require('./util/env')

const WEATHER_BASE_URL = `https://api.darksky.net/forecast/${getEnv('DARK_SKY_API_KEY')}`

const getData = ({ location }) => {
  return request({
    url: `${WEATHER_BASE_URL}/${location}`,
    params: {
      exclude: 'minutely,flags',
      extend: 'hourly',
    },
  })
}

const get = (req, res) => {
  getData(req.query)
  .then((result) => {
    res.json(result)
  })
  .catch((error) => {
    res.status(500).json({
      error,
      data: error.response.data,
    })
  })
}

module.exports = {
  get,
  getData,
}
