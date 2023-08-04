/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Running nightly script 1 (restaurants last visit)...')

require('../dist/lib/notion/update-restaurants-last-visit').default()
.then(() => {
  console.log('Successfully ran nightly script 1')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running nightly script 1 failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
