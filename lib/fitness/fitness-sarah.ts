import minimist from 'minimist'

import { getEnv } from '../util/env'
import { debug } from '../util/debug'
import { updateFitness } from './fitness'

export default async function main () {
  const mmfToken = getEnv('MMF_SARAH_TOKEN')!
  const mmfApiKey = getEnv('MMF_SARAH_API_KEY')!
  const mmfUserId = getEnv('MMF_SARAH_USER_ID')!
  const notionToken = getEnv('NOTION_SARAH_TOKEN')!
  const notionFitnessId = getEnv('NOTION_SARAH_FITNESS_ID')!
  const isDryRun = minimist(process.argv.slice(2)).dryRun

  try {
    await updateFitness({ isDryRun, mmfToken, mmfApiKey, mmfUserId, notionToken, notionFitnessId })

    debug('Successfully updated fitness')
  } catch (error: any) {
    debug('Getting challenge details failed:')
    debug(error?.stack || error)

    throw error
  }
}
