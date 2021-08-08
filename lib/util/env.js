const fs = require('fs-extra')

const envFile = process.env.NODE_ENV === 'development' ? fs.readJsonSync('./.env') : {}

const getEnv = (key) => {
  return process.env[key] || envFile[key]
}

module.exports = {
  getEnv,
}
