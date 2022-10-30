const fs = require('fs-extra')

// In production, this is mounted with dokku's persistent storage
// https://github.com/dokku/dokku/blob/master/docs/advanced-usage/persistent-storage.md
const basePath = process.env.NODE_ENV === 'development' ? './data' : '/storage'

class PersistentData {
  constructor (name) {
    this.dataPath = `${basePath}/${name}.json`
  }

  get () {
    return fs.readJSON(this.dataPath) || {}
  }

  set (newData) {
    return fs.outputJSON(this.dataPath, newData, { spaces: 2 })
  }
}

module.exports = {
  PersistentData,
}
