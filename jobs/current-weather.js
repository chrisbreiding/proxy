/* eslint-disable no-console */
const { parentPort } = require('worker_threads')
const { mapPromisesSerially } = require('../dist/lib/util/collections')

console.log('Udating current weather...')

const scripts = [
  require('../dist/lib/notion/update-current-weather').default,
]

mapPromisesSerially(scripts, (script) => script())
.then(() => {
  console.log('Successfully updated current weather')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Updating current weather failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
