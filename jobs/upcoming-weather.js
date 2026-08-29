/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Updating upcoming weather...')

require('../dist/lib/notion/update-upcoming-weather').default()
.then(() => {
  console.log('Successfully updated upcoming weather')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Updating upcoming weather failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
