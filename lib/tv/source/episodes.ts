import dayjs from 'dayjs'

import { makeRequest } from './util'
import { debug, debugVerbose } from '../../util/debug'

export interface TheTVDBEpisode {
  aired: string // "2009-02-17"
  finaleType: string | null
  id: number
  image: string
  imageType: number
  isMovie: number
  lastUpdated: string
  name: string
  nameTranslations: string[]
  number: number
  overview: string
  overviewTranslations: string[]
  runtime: number
  seasonName: string
  seasonNumber: number
  seasons: number | null
  seriesId: number
  year: string
}

export interface Episode {
  airdate?: string
  number: number
  id: string
  season: number
  title: string
}

function convertEpisode (episode: TheTVDBEpisode): Episode {
  return {
    airdate: episode.aired ? dayjs(episode.aired).toISOString() : undefined,
    number: episode.number || 0,
    id: `${episode.id}`,
    season: episode.seasonNumber || 0,
    title: episode.name,
  }
}

interface EpisodesResponse {
  status: string
  data: {
    series: object
    episodes: TheTVDBEpisode[]
  }
  links: {
    prev: null
    self: string
    next: null
    total_items: number
    page_size: number
  }
  token: string
}

async function getAllEpisodesForShow (
  showId: string,
  existingToken?: string,
  page = 0,
  prevEpisodes: TheTVDBEpisode[] = [],
): Promise<TheTVDBEpisode[]> {
  debugVerbose('get episodes for show id %s, page id: %i, total previous: %i', showId, page, prevEpisodes.length)

  const { data, links, token } = await makeRequest({
    path: `series/${showId}/episodes/default`,
    params: { page: `${page}` },
    token: existingToken,
  }) as EpisodesResponse
  const episodes = prevEpisodes.concat(data.episodes)

  if (page === links.next || links.next == null) {
    return episodes
  }

  return getAllEpisodesForShow(showId, token, links.next, episodes)
}

export async function getEpisodesForShow (showId: string): Promise<Episode[]> {
  debugVerbose('get episodes for show id', showId)

  try {
    const episodes = await getAllEpisodesForShow(showId)

    return episodes.map(convertEpisode)
  } catch (error: any) {
    /* c8 ignore next */
    debug(`Getting episodes for show id ${showId} failed:`, error?.stack || error)

    throw error
  }
}

interface TheTvDbEpisodeUpdate {
  entityType: string // "series"
  extraInfo: string
  method: 'create' | 'update' | 'delete'
  methodInt: 1 | 2 | 3 // 1: created, 2: updated, 3: deleted
  recordId: number // 83498
  recordType: string
  seriesId: number
  timeStamp: number // 1667707258
  userId: number
}

export interface EpisodeUpdate {
  id: string
  method: TheTvDbEpisodeUpdate['method']
}

interface ShowAndEpisodeUpdates {
  [key: string]: EpisodeUpdate[]
}

function convertUpdates (updates: ShowAndEpisodeUpdates, episodeUpdate: TheTvDbEpisodeUpdate): ShowAndEpisodeUpdates {
  const showId = `${episodeUpdate.seriesId}`
  const show = updates[showId] || []

  updates[showId] = [
    ...show,
    {
      id: `${episodeUpdate.recordId}`,
      method: episodeUpdate.method,
    },
  ]

  return updates
}

export async function getEpisodesUpdatedSince (date: string): Promise<ShowAndEpisodeUpdates> {
  debugVerbose('find episodes updated since', date)

  try {
    const { data: episodeUpdates } = await makeRequest({
      path: 'updates',
      params: {
        type: 'episodes',
        since: `${dayjs(date).unix()}`,
      },
    })

    return episodeUpdates.reduce(convertUpdates, {} as ShowAndEpisodeUpdates)
  } catch (error: any) {
    debug(`Getting episodes updated since ${date} failed:`, error.stack)

    throw error
  }
}

export async function getEpisode (id: string): Promise<Episode> {
  debugVerbose('Find episode:', id)

  try {
    const { data: episode } = await makeRequest({
      path: `episodes/${id}`,
    }) as { data: TheTVDBEpisode }

    return convertEpisode(episode)
  } catch (error: any) {
    debug(`Getting episode ${id} failed:`, error.stack)

    throw error
  }
}
