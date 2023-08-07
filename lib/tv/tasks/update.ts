import dayjs from 'dayjs'

import { debug } from '../../util/debug'
import type { ShowProps } from '../models/show'
import { getEpisodesForShow } from '../source/episodes'
import { getShowsByIds, SearchResultShow } from '../source/shows'
import { setDoc, updateDoc } from '../store/firebase'
import { getShows } from '../store/shows'

async function getOngoingShows (): Promise<SearchResultShow[]> {
  const ongoingStoreShows = (await getShows()).filter((show: ShowProps) => {
    return show.status !== 'Ended'
  })

  return getShowsByIds(ongoingStoreShows.map((show) => show.id))
}

export async function updateShowsAndEpisodes () {
  const ongoingShows = await getOngoingShows()

  const currentDateTime = dayjs().toISOString()

  for (const show of ongoingShows) {
    debug('Update show - name: %s, id: %s', show.name, show.id)

    // if the show has any episode updates, overwrite all the episodes
    // with newly sourced ones
    const episodes = await getEpisodesForShow(show.id)

    await setDoc(`shows/${show.id}/episodes/all`, { episodes })

    await updateDoc(`shows/${show.id}`, {
      poster: show.poster,
      status: show.status,
      lastUpdated: currentDateTime,
    })
  }

  await updateDoc('meta/data', {
    error: null,
    lastUpdated: currentDateTime,
  })
}

export default async function main () {
  try {
    debug('Updating shows and episodes...')

    await updateShowsAndEpisodes()
  } catch (error: any) {
    debug('Updating shows and episodes failed:')
    debug(error?.stack || error)

    updateDoc('meta/data', {
      error: {
        message: error?.message || error,
        stack: error?.stack,
        date: dayjs().toISOString(),
      },
    })

    throw error
  }
}
