/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Running nightly script 3 (word of the week)...')

require('../dist/lib/notion/word-of-the-week').default()
.then(() => {
  console.log('Successfully ran nightly script 3')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Running nightly script 3 failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
