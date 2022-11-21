/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Running hourly scripts...')

require('../dist/lib/notion/update-upcoming-weather').default()
.then(() => {
  console.log('Successfully ran hourly scripts')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running hourly scripts failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
