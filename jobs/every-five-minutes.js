/* eslint-disable no-console */
const { parentPort } = require('worker_threads')
const { mapPromisesSerially } = require('../dist/lib/util/collections')

console.log('Running every-five-minute scripts (fitness updates)...')

const scripts = [
  require('../dist/lib/fitness/fitness-chris').default,
  require('../dist/lib/fitness/fitness-sarah').default,
]

mapPromisesSerially(scripts, (script) => script())
.then(() => {
  console.log('Successfully ran every-five-minute scripts')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running every-five-minute scripts failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
