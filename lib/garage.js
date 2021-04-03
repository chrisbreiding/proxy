const fs = require('fs-extra')
const path = require('path')

const dataPath = path.join('.', 'garage-data.json')

const get = (req, res) => {
  fs.readJSON(dataPath)
  .then((states) => {
    if (states) {
      res.json(states)
    } else {
      res.json({})
    }
  })
  .catch(() => {
    res.json({})
  })
}

const set = (req, res) => {
  const update = {
    [req.params.door]: req.params.state,
  }

  fs.readJSON(dataPath)
  .then((states) => {
    return fs.outputJSON(dataPath, Object.assign(states, update))
  })
  .finally(() => {
    res.json({})
  })
}

module.exports = {
  get,
  set,
}
