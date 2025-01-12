import { getEnv } from '../util/env'
import { debug } from '../util/debug'
import { updateFitness } from './fitness'

export default async function main () {
  const mmfToken = getEnv('MMF_CHRIS_TOKEN')!
  const mmfApiKey = getEnv('MMF_CHRIS_API_KEY')!
  const mmfUserId = getEnv('MMF_CHRIS_USER_ID')!
  const notionToken = getEnv('NOTION_TOKEN')!
  const notionFitnessId = getEnv('NOTION_CHRIS_FITNESS_ID')!

  try {
    await updateFitness({ mmfToken, mmfApiKey, mmfUserId, notionToken, notionFitnessId })

    debug('Successfully updated fitness')
  } catch (error: any) {
    debug('Getting challenge details failed:')
    debug(error?.stack || error)

    throw error
  }
}
