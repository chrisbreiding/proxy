/* eslint-disable no-console */
console.log('Running hourly scripts...')

require('../lib/notion/update-upcoming-weather')()
.then(() => {
  console.log('Successfully ran hourly scripts')
})
.catch((error) => {
  console.log('Running hourly scripts failed:')
  console.log(error.stack)
})
