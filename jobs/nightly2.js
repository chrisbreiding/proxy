/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Running nightly script 2 (tv updates)...')

require('../dist/lib/tv/tasks/update').default()
.then(() => {
  console.log('Successfully ran nightly script 2')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running nightly script 2 failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
