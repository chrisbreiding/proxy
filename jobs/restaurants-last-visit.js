/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Updating restaurants last visit...')

require('../dist/lib/notion/update-restaurants-last-visit').default()
.then(() => {
  console.log('Successfully updated restaurants last visit')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Updating restaurants last visit failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
