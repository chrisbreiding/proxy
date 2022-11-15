import dayjs from 'dayjs'

import { debug, debugVerbose } from '../../util/debug'
import type { TheTVDBEpisode } from './episodes'
import { makeRequest } from './util'

interface TheTVDBSearchResultShow {
  objectID: string
  aliases: string[]
  country: string
  id: string // "series-81189"
  image_url: string // "https://artworks.thetvdb.com/banners/posters/81189-10.jpg"
  name: string // "Breaking Bad"
  first_air_time: string // "2008-01-20",
  overview: string // "When Walter White, a chemistry teacher, is...",
  primary_language: string
  primary_type: string
  status: 'Continuing' | 'Ended'
  type: string
  tvdb_id: string // "81189"
  year: string
  slug: string
  overviews: {
    [key: string]: string
  },
  translations: {
    [key: string]: string
  },
  network: string // "AMC"
  remote_ids: {
    id: string
    type: number
    sourceName: string
  }[]
  thumbnail: string // "https://artworks.thetvdb.com/banners/posters/81189-10_t.jpg"
}

export interface SearchResultShow {
  description: string
  firstAired?: string
  id: string
  name: string
  network: string
  poster?: string
  status: TheTVDBSearchResultShow['status']
}

function convertSearchResultShow (show: TheTVDBSearchResultShow): SearchResultShow {
  return {
    description: show.overview,
    firstAired: show.first_air_time ? dayjs(show.first_air_time).toISOString() : undefined,
    id: show.tvdb_id,
    name: show.name,
    network: show.network,
    poster: show.image_url,
    status: show.status,
  }
}

export async function searchShows (showName: string): Promise<SearchResultShow[]> {
  debugVerbose('search for', showName)

  try {
    const { data: shows } = await makeRequest({
      path: 'search',
      params: {
        query: showName,
        type: 'series',
      },
    }) as { data: TheTVDBSearchResultShow[] }

    return shows.map(convertSearchResultShow)
  } catch (error: any) {
    debug(`Searching ${showName} failed:`, error.stack)

    throw error
  }
}

interface TheTVDBShow {
  aliases: {
    description: string
    language: string
    name: string
  }[]
  averageRuntime: number
  country: string
  defaultSeasonType: number
  description: string
  episodes: TheTVDBEpisode[] | null
  firstAired: string
  id: number
  image: string
  isOrderRandomized: boolean
  lastAired: string
  lastUpdated: string
  name: string
  nameTranslations: string[]
  nextAired: string
  originalCountry: string
  originalLanguage: string
  overviewTranslations: string[]
  score: number
  slug: string
  status: {
    id: number
    keepUpdated: boolean
    name: 'Continuing' | 'Ended'
    recordType: string
  }
  year: string
}

function convertShow (show: TheTVDBShow): SearchResultShow {
  return {
    description: show.description,
    firstAired: show.firstAired ? dayjs(show.firstAired).toISOString() : undefined,
    id: `${show.id}`,
    name: show.name,
    network: '',
    poster: show.image,
    status: show.status.name,
  }
}

export async function getShowsByIds (showIds: string[]): Promise<SearchResultShow[]> {
  debugVerbose('get shows with ids: %o', showIds)

  try {
    return await Promise.all(showIds.map(async (showId) => {
      const { data: show } = await makeRequest({
        path: `series/${showId}`,
      }) as { data: TheTVDBShow }

      return convertShow(show)
    }))
  } catch (error: any) {
    debug('Getting shows failed:', error.stack)

    throw error
  }
}
