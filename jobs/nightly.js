/* eslint-disable no-console */
const { parentPort } = require('worker_threads')
const { mapPromisesSerially } = require('../lib/util/collections')

console.log('Running nightly scripts...')

const scripts = [
  require('../dist/lib/notion/update-restaurants-last-visit').default,
  require('../dist/lib/notion/update-date-extrapolation').default,
  require('../dist/lib/tv/tasks/update').default,
]

mapPromisesSerially(scripts, (script) => script())
.then(() => {
  console.log('Successfully ran nightly scripts')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running nightly scripts failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
