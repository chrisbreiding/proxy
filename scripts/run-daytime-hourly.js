/* eslint-disable no-console */
console.log('Running hourly scripts...')

require('../dist/lib/notion/update-upcoming-weather').default()
.then(() => {
  console.log('Successfully ran hourly scripts')
})
.catch((error) => {
  console.log('Running hourly scripts failed:')
  console.log(error.stack)
})
