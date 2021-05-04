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

const getData = () => fs.readJSON(dataPath)

const get = (req, res) => {
  getData()
  .then((data) => {
    if (data) {
      res.json(data)
    } else {
      res.json(errorResult)
    }
  })
  .catch(() => {
    res.json(errorResult)
  })
}

const notify = (message) => {
  const query = `?value1=${encodeURIComponent(message)}`
  const url = `https://maker.ifttt.com/trigger/notify/with/key/${process.env.IFTTT_WEBHOOK_KEY}${query}`

  return rp(url)
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.log('IFTTT webhook request errored:', error.stack)
  })
}

const set = (req, res) => {
  const { door, state } = req.params

  getData()
  .then((data) => {
    const previousState = data[door]

    if (previousState === 'open' && state === 'open') {
      // if the door state was 'open' twice in a row, the door failed to close.
      // send a request to IFTTT, which will trigger a push notification.
      notify(`The ${door} garage door failed to close!`)
    } else if (state === 'open' && data.notifyOnOpen) {
      notify(`The ${door} garage door opened`)
    }

    const update = {
      [`${door}Previous`]: previousState,
      [door]: state,
    }

    return fs.outputJSON(dataPath, Object.assign(data, update))
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.log(`Setting garage state (${door} => ${state}) errored:`, error.stack)
  })
  .finally(() => {
    res.json({})
  })
}

const setNotifyOnOpen = (req, res) => {
  const notifyOnOpen = req.params.notifyOnOpen === 'true'

  getData()
  .then((data) => {
    return fs.outputJSON(dataPath, Object.assign(data, { notifyOnOpen }))
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.log(`Setting notifyOnOpen to ${notifyOnOpen} errored:`, error.stack)
  })
  .finally(() => {
    res.json({})
  })
}

const view = (req, res) => {
  res.set('Content-Type', 'text/html')

  getData()
  .then((data) => {
    res.render('garages', { states: data, layout: false })
  })
  .catch((error) => {
    res.render('error', { message: error.message, stack: error.stack, layout: false })
  })
}

module.exports = {
  get,
  set,
  setNotifyOnOpen,
  view,
}
