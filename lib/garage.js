const fs = require('fs-extra')
const path = require('path')
const rp = require('request-promise')

const dataPath = path.join('.', 'garage-data.json')

const getStates = () => fs.readJSON(dataPath)

const get = (req, res) => {
  getStates()
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
    res.json({})
  })
}

const view = (req, res) => {
  res.set('Content-Type', 'text/html')

  getStates()
  .then((states) => {
    res.render('garages', { states, layout: false })
  })
}

module.exports = {
  get,
  set,
  view,
}
