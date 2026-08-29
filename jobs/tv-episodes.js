/* eslint-disable no-console */
const { parentPort } = require('worker_threads')

console.log('Updating TV episodes...')

require('../dist/lib/tv/tasks/update').default()
.then(() => {
  console.log('Successfully updated TV episodes')

  if (parentPort) {
    parentPort.postMessage('done')
  } else {
    process.exit(0)
  }
})
.catch((error) => {
  console.log('Updating TV episodes failed:')
  console.log(error?.stack || error)

  process.exit(1)
})
