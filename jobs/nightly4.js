/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Running nightly script 4 (softball leagues)...')

require('../dist/lib/notion/softball-leagues').default()
.then(() => {
  console.log('Successfully ran nightly script 4')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running nightly script 4 failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
