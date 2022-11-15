import dayjs from 'dayjs'

import { debug } from '../../util/debug'
import type { ShowProps } from '../models/show'
import { EpisodeUpdate, getEpisode, getEpisodesUpdatedSince } from '../source/episodes'
import { getShowsByIds, SearchResultShow } from '../source/shows'
import { addDoc, deleteDoc, getDoc, updateDoc } from '../store/firebase'
import { getShows } from '../store/shows'

interface MetaData {
  lastUpdated: string
}

async function getMetaData (): Promise<MetaData> {
  return (await getDoc('meta/data')) as MetaData
}

async function getShowUpdates (): Promise<SearchResultShow[]> {
  const continuingStoreShows = (await getShows()).filter((show: ShowProps) => {
    return show.status !== 'Ended'
  })

  return getShowsByIds(continuingStoreShows.map((show) => show.id))
}

async function updateEpisode (showId: string, episodeUpdate: EpisodeUpdate) {
  const { id, method } = episodeUpdate

  if (method === 'delete') {
    debug('Delete episode with id:', id)
    return deleteDoc(`shows/${showId}/episodes/${id}`)
  }

  const episode = await getEpisode(episodeUpdate.id)

  if (method === 'create') {
    debug('Create episode s%se%s', episode.season, episode.number)
    await addDoc(`shows/${showId}/episodes/${id}`, episode)
  } else {
    debug('Update episode s%se%s', episode.season, episode.number)
    await updateDoc(`shows/${showId}/episodes/${id}`, episode)
  }
}

export async function updateShowsAndEpisodes () {
  const showUpdates = await getShowUpdates()
  const lastUpdated = (await getMetaData()).lastUpdated
  const updatedShowsWithEpisodes = await getEpisodesUpdatedSince(lastUpdated)

  for (const show of showUpdates) {
    debug('Update show, name: %s, id: %s', show.name, show.id)

    await updateDoc(`shows/${show.id}`, {
      poster: show.poster,
      status: show.status,
    })

    const updatedEpisodeIds = updatedShowsWithEpisodes[show.id]

    if (updatedEpisodeIds) {
      for (const episodeUpdate of updatedEpisodeIds) {
        await updateEpisode(show.id, episodeUpdate)
      }
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
