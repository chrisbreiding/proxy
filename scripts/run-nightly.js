/* eslint-disable no-console */
const { mapPromisesSerially } = require('../lib/util/collections')

console.log('Running nightly scripts...')

const scripts = [
  require('../dist/lib/notion/update-restaurants-last-visit').default,
  require('../dist/lib/notion/update-date-extrapolation').default,
]

mapPromisesSerially(scripts, (script) => script())
.then(() => {
  console.log('Successfully ran nightly scripts')
})
.catch((error) => {
  console.log('Running nightly scripts failed:')
  console.log(error.stack)
})
