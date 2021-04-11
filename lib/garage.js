const fs = require('fs-extra')
const rp = require('request-promise')

// In production, this is mounted with dokku's persistent storage
// https://github.com/dokku/dokku/blob/master/docs/advanced-usage/persistent-storage.md
const dataPath = process.env.NODE_ENV === 'development' ?
  './garage-data.json' :
  '/storage/garage-data.json'

const errorResult = {
  left: 'unknown',
  right: 'unknown',
}

const getStates = () => fs.readJSON(dataPath)

const get = (req, res) => {
  getStates()
  .then((states) => {
    if (states) {
      res.json(states)
    } else {
      res.json(errorResult)
    }
  })
  .catch(() => {
    res.json(errorResult)
  })
}

const set = (req, res) => {
  const { door, state } = req.params

  getStates()
  .then((states) => {
    const previousState = states[door]

    if (previousState === 'open' && state === 'open') {
      // if the door state was 'open' twice in a row, the door failed to close.
      // send a request to IFTTT, which will trigger a push notification.

      rp(`https://maker.ifttt.com/trigger/garage_close_failed/with/key/${process.env.IFTTT_WEBHOOK_KEY}`)
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.log('IFTTT webhook request errored:', error.stack)
      })
    }

    const update = {
      [`${door}Previous`]: previousState,
      [door]: state,
    }

    return fs.outputJSON(dataPath, Object.assign(states, update))
  })
  .finally(() => {
    res.json(errorResult)
  })
}

const view = (req, res) => {
  res.set('Content-Type', 'text/html')

  getStates()
  .then((states) => {
    res.render('garages', { states, layout: false })
  })
  .catch((error) => {
    res.render('error', { message: error.message, stack: error.stack, layout: false })
  })
}

module.exports = {
  get,
  set,
  view,
}
