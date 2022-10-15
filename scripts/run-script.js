/* eslint-disable no-console */
const scriptName = process.argv[2]
const script = require(`../lib/notion/${scriptName}`)

console.log('Running dev script:', scriptName)

const run = async () => {
  try {
    await script()
    console.log('Successfully ran', scriptName)
  } catch (error) {
    console.log('Running', scriptName, 'failed:')
    console.log(error.stack)
  }
}

run()
