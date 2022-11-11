import dayjs from 'dayjs'

import { makeRequest } from './util'
import { debug, debugVerbose } from '../../util/debug'

interface TheTvDbShow {
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
  status: TheTvDbShow['status']
}

function convert (show: TheTvDbShow): SearchResultShow {
  return {
    description: show.overview,
    firstAired: show.first_air_time ? dayjs(show.first_air_time).toISOString() : undefined,
    id: `${show.tvdb_id}`,
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
    })

    return shows.map(convert)
  } catch (error: any) {
    debug(`Searching ${showName} failed:`, error?.stack || error)

    throw error
  }
}

interface TheTvDbShowUpdate {
  recordType: string
  recordId: number // 83498
  methodInt: number
  method: string
  extraInfo: string
  userId: number
  timeStamp: number // 1667707258
  entityType: string // "series"
}

interface ShowUpdate {
  id: string
  dateTime: string
}

function convertShowUpdates (showUpdate: TheTvDbShowUpdate): ShowUpdate {
  return {
    id: `${showUpdate.recordId}`,
    dateTime: dayjs.unix(showUpdate.timeStamp).toISOString(),
  }
}

export async function getShowsUpdatedSince (date: string): Promise<ShowUpdate[]> {
  debugVerbose('find shows updated since', date)

  try {
    const { data: showUpdates } = await makeRequest({
      path: 'updates',
      params: {
        action: 'update',
        type: 'series',
        since: `${dayjs(date).unix()}`,
      },
    })

    return showUpdates.map(convertShowUpdates)
  } catch (error: any) {
    debug(`Getting shows updated since ${date} failed:`, error?.stack || error)

    throw error
  }
}
