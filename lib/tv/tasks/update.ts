import dayjs from 'dayjs'

import { debug } from '../../util/debug'
import type { ShowProps } from '../models/show'
import { getEpisodesForShow, getEpisodesUpdatedSince } from '../source/episodes'
import { getShowsByIds, SearchResultShow } from '../source/shows'
import { setDoc, updateDoc } from '../store/firebase'
import { getMetaData } from '../store/metadata'
import { getShows } from '../store/shows'

async function getShowUpdates (): Promise<SearchResultShow[]> {
  const ongoingStoreShows = (await getShows()).filter((show: ShowProps) => {
    return show.status !== 'Ended'
  })

  return getShowsByIds(ongoingStoreShows.map((show) => show.id))
}

export async function updateShowsAndEpisodes () {
  const showUpdates = await getShowUpdates()
  const lastUpdated = (await getMetaData()).lastUpdated
  const updatedShowsWithEpisodes = await getEpisodesUpdatedSince(lastUpdated)

  for (const show of showUpdates) {
    debug('Update show - name: %s, id: %s', show.name, show.id)

    await updateDoc(`shows/${show.id}`, {
      poster: show.poster,
      status: show.status,
    })

    const episodeUpdates = updatedShowsWithEpisodes[show.id]

    if (episodeUpdates?.length) {
      debug('Update all episodes for show')
      // if the show has any episode updates, overwrite all the episodes
      // with newly sourced ones
      const episodes = await getEpisodesForShow(show.id)

      await setDoc(`shows/${show.id}/episodes/all`, { episodes })
    }
  }

  updateDoc('meta/data', {
    lastUpdated: dayjs().toISOString(),
  })
}

export default async function main () {
  try {
    debug('Updating shows and episodes...')

    await updateShowsAndEpisodes()
  } catch (error: any) {
    debug('Updating shows and episodes failed:')
    debug(error?.stack || error)
  }
}
