const fs = require('fs-extra')

// In production, this is mounted with dokku's persistent storage
// https://github.com/dokku/dokku/blob/master/docs/advanced-usage/persistent-storage.md
const basePath = process.env.NODE_ENV === 'development' ? './data' : '/storage'

const create = (name) => {
  const dataPath = `${basePath}/${name}.json`

  const get = () => {
    return fs.readJSON(dataPath) || {}
  }

  const set = (newData) => {
    return fs.outputJSON(dataPath, newData, { spaces: 2 })
  }

  return {
    get,
    set,
  }
}

module.exports = {
  create,
}
