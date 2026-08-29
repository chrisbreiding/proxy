/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Updating word of the week...')

require('../dist/lib/notion/word-of-the-week').default()
.then(() => {
  console.log('Successfully updated word of the week')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Updating word of the week failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
