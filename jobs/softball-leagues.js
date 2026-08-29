/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Updating softball leagues...')

require('../dist/lib/notion/softball-leagues').default()
.then(() => {
  console.log('Successfully updated softball leagues')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Updating softball leagues failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
