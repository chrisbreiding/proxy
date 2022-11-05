/* eslint-disable no-console */
console.log('Running quarter-hourly scripts...')

require('../dist/lib/notion/update-current-weather').default()
.then(() => {
  console.log('Successfully ran quarter-hourly scripts')
})
.catch((error) => {
  console.log('Running quarter-hourly scripts failed:')
  console.log(error.stack)
})
