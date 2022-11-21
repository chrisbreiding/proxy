/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Running quarter-hourly scripts...')

require('../dist/lib/notion/update-current-weather').default()
.then(() => {
  console.log('Successfully ran quarter-hourly scripts')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running quarter-hourly scripts failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
