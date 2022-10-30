const { request } = require('./util/network')
const { PersistentData } = require('./util/persistent-data')

const errorResult = {
  left: 'unknown',
  right: 'unknown',
}

const persistentData = new PersistentData('garage-data')

const get = (req, res) => {
  persistentData
  .get()
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

  return request({ url })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.log('IFTTT webhook request errored:', error.stack)
  })
}

const set = (req, res) => {
  const { door, state } = req.params

  persistentData.get()
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
      [door]: state,
    }

    return persistentData.set(Object.assign({}, data, update))
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

  persistentData.get()
  .then((data) => {
    return persistentData.set(Object.assign(data, { notifyOnOpen }))
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

  persistentData.get()
  .then((data) => {
    res.render('garages', { states: data, layout: false })
  })
  .catch((error) => {
    res.render('error', { message: error.message, stack: error.stack, layout: false })
  })
}

function getData () {
  return persistentData.get()
}

module.exports = {
  get,
  getData,
  set,
  setNotifyOnOpen,
  view,
}
