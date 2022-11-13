import dayjs from 'dayjs'

import { makeRequest } from './util'
import { debug, debugVerbose } from '../../util/debug'

interface TheTvDbEpisode {
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
  episodeNumber: number
  sourceId: number
  season: number
  title: string
}

function convertTheTvDbEpisodeToEpisode (episode: TheTvDbEpisode): Episode {
  return {
    airdate: episode.aired ? dayjs(episode.aired).toISOString() : undefined,
    episodeNumber: episode.number || 0,
    season: episode.seasonNumber || 0,
    sourceId: episode.id,
    title: episode.name,
  }
}

interface EpisodesResponse {
  status: string
  data: {
    series: object
    episodes: TheTvDbEpisode[]
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
  prevEpisodes: TheTvDbEpisode[] = [],
): Promise<TheTvDbEpisode[]> {
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

    return episodes.map(convertTheTvDbEpisodeToEpisode)
  } catch (error: any) {
    /* c8 ignore next */
    debug(`Getting episodes for show id ${showId} failed:`, error?.stack || error)

    throw error
  }
}
