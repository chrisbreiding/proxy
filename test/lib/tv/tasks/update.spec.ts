import Mixpanel from 'mixpanel'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

const apikey = process.env.THETVDB_API_KEY = 'api-key'
const pin = process.env.THETVDB_PIN = 'pin'

import { baseUrl } from '../../../../lib/tv/source/util'
import {
  getCollection,
  getDoc,
  setDoc,
  updateDoc,
} from '../../../../lib/tv/store/firebase'
import { updateShowsAndEpisodes } from '../../../../lib/tv/tasks/update'
import { mockMixpanel, nockLogin } from '../util'

function makeShow (num: number, status: string) {
  return {
    id: `${num}`,
    name: `Show ${num} name`,
    status,
    users: {},
  }
}

vi.mock('mixpanel', () => {
  return {
    default: {
      init: vi.fn(),
    },
  }
})

vi.mock('../../../../lib/tv/store/firebase', () => {
  return {
    getCollection: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
  }
})

describe('lib/tv/tasks/update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2022, 11, 15))

    ;(getCollection as Mock).mockResolvedValue([
      makeShow(1, 'Upcoming'),
      makeShow(2, 'Ended'),
      makeShow(3, 'Continuing'),
      makeShow(4, 'Continuing'),
    ])
    ;(getDoc as Mock).mockResolvedValue({
      lastUpdated: '2022-11-14T04:00:00.000Z',
    })
    ;(Mixpanel.init as Mock).mockReturnValue(mockMixpanel())

    nock(baseUrl)
    .get('/v4/series/1')
    .reply(200, { data: {
      id: 1,
      image: 'show 1 poster',
      status: { name: 'Continuing' },
    } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates all upcoming/continuing shows', async () => {
    nockLogin({ apikey, pin, times: 6 })

    nock(baseUrl)
    .get('/v4/series/3')
    .reply(200, { data: { id: 3,
      firstAired: '2022-11-13',
      image: 'show 3 poster',
      status: { name: 'Ended' },
    } })

    nock(baseUrl)
    .get('/v4/series/4')
    .reply(200, { data: { id: 4,
      firstAired: '2022-05-01',
      image: 'show 4 poster',
      status: { name: 'Continuing' },
    } })

    nock(baseUrl)
    .get('/v4/series/1/episodes/default?page=0')
    .reply(200, {
      data: { episodes: [{
        aired: '2022-11-12',
        id: 3,
        number: 5,
        seasonNumber: 1,
        name: 'Episode 3',
      }, {
        aired: '2022-11-13',
        id: 4,
        number: 6,
        seasonNumber: 1,
        name: 'Episode 4',
      }] },
      links: {},
    })

    nock(baseUrl)
    .get('/v4/series/3/episodes/default?page=0')
    .reply(200, {
      data: { episodes: [{
        aired: '2022-11-12',
        id: 6,
        number: 5,
        seasonNumber: 1,
        name: 'Episode 6',
      }, {
        aired: '2022-11-13',
        id: 7,
        number: 6,
        seasonNumber: 1,
        name: 'Episode 7',
      }] },
      links: {},
    })

    nock(baseUrl)
    .get('/v4/series/4/episodes/default?page=0')
    .reply(200, {
      data: { episodes: [{
        aired: '2022-12-20',
        id: 8,
        number: 2,
        seasonNumber: 2,
        name: 'Episode 8',
      }, {
        aired: '2022-12-27',
        id: 9,
        number: 3,
        seasonNumber: 2,
        name: 'Episode 9',
      }] },
      links: {},
    })

    await updateShowsAndEpisodes()

    expect(updateDoc).toBeCalledTimes(4)
    expect(updateDoc).toBeCalledWith('shows/1', {
      lastUpdated: '2022-12-15T05:00:00.000Z',
      poster: 'show 1 poster',
      status: 'Continuing',
    })
    expect(updateDoc).toBeCalledWith('shows/3', {
      lastUpdated: '2022-12-15T05:00:00.000Z',
      poster: 'show 3 poster',
      status: 'Ended',
    })
    expect(updateDoc).toBeCalledWith('shows/4', {
      lastUpdated: '2022-12-15T05:00:00.000Z',
      poster: 'show 4 poster',
      status: 'Continuing',
    })

    expect(setDoc).toHaveBeenCalledTimes(3)
    expect(setDoc).toBeCalledWith('shows/1/episodes/all', { episodes: [{
      airdate: '2022-11-12T05:00:00.000Z',
      number: 5,
      id: '3',
      season: 1,
      title: 'Episode 3',
    }, {
      airdate: '2022-11-13T05:00:00.000Z',
      number: 6,
      id: '4',
      season: 1,
      title: 'Episode 4',
    }] })
    expect(setDoc).toBeCalledWith('shows/3/episodes/all', { episodes: [{
      airdate: '2022-11-12T05:00:00.000Z',
      number: 5,
      id: '6',
      season: 1,
      title: 'Episode 6',
    }, {
      airdate: '2022-11-13T05:00:00.000Z',
      number: 6,
      id: '7',
      season: 1,
      title: 'Episode 7',
    }] })
    expect(setDoc).toBeCalledWith('shows/4/episodes/all', { episodes: [{
      airdate: '2022-12-20T05:00:00.000Z',
      number: 2,
      id: '8',
      season: 2,
      title: 'Episode 8',
    }, {
      airdate: '2022-12-27T05:00:00.000Z',
      number: 3,
      id: '9',
      season: 2,
      title: 'Episode 9',
    }] })

    expect(updateDoc).toBeCalledWith('meta/data', {
      error: null,
      lastUpdated: '2022-12-15T05:00:00.000Z',
    })
  })

  it('errors if getting show fails', async () => {
    nockLogin({ apikey, pin, times: 3 })

    nock(baseUrl)
    .get('/v4/series/3')
    .replyWithError(new Error('getting show failed'))

    nock(baseUrl)
    .get('/v4/series/4')
    .reply(200, { data: { id: 4,
      image: 'show 4 poster',
      status: { name: 'Continuing' },
    } })

    await expect(updateShowsAndEpisodes()).rejects
    .toThrowError('getting show failed')
  })

  it('errors if getting episodes fails', async () => {
    nockLogin({ apikey, pin, times: 4 })

    nock(baseUrl)
    .get('/v4/series/3')
    .reply(200, { data: { id: 3,
      image: 'show 3 poster',
      status: { name: 'Ended' },
    } })

    nock(baseUrl)
    .get('/v4/series/4')
    .reply(200, { data: { id: 4,
      image: 'show 4 poster',
      status: { name: 'Continuing' },
    } })

    nock(baseUrl)
    .get('/v4/updates?type=episodes&since=1668398400')
    .reply(200, {
      data: [{ recordId: 3, seriesId: 1, method: 'create' }],
    })

    nock(baseUrl)
    .get('/v4/series/1/episodes/default?page=0')
    .replyWithError(new Error('getting episodes failed'))

    await expect(() => updateShowsAndEpisodes()).rejects
    .toThrowError('getting episodes failed')
  })
})
