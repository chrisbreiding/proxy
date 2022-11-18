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

  it('updates all upcoming/continuing shows poster and status properties', async () => {
    nockLogin({ apikey, pin, times: 6 })

    nock(baseUrl)
    .get('/v4/series/3')
    .reply(200, { data: { id: 3,
      firstAired: '2022-11-13',
      image: 'show 3 poster',
      status: { name: 'Ended' },
    } })

    nock(baseUrl)
    .get('/v4/updates?type=episodes&since=1668398400')
    .reply(200, {
      data: [
        { recordId: 3, seriesId: 1, method: 'create' },
        { recordId: 4, seriesId: 1, method: 'update' },
        { recordId: 5, seriesId: 1, method: 'delete' },
        { recordId: 6, seriesId: 3, method: 'create' },
        { recordId: 7, seriesId: 3, method: 'update' },
        { recordId: 8, seriesId: 99, method: 'create' },
        { recordId: 9, seriesId: 99, method: 'update' },
      ],
    })

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

    await updateShowsAndEpisodes()

    expect(updateDoc).toBeCalledTimes(3)
    expect(updateDoc).toBeCalledWith('shows/1', {
      poster: 'show 1 poster',
      status: 'Continuing',
    })
    expect(updateDoc).toBeCalledWith('shows/3', {
      poster: 'show 3 poster',
      status: 'Ended',
    })

    expect(setDoc).toHaveBeenCalledTimes(2)
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

    expect(updateDoc).toBeCalledWith('meta/data', { lastUpdated: '2022-12-15T05:00:00.000Z' })
  })

  it('errors if getting show fails', async () => {
    nockLogin({ apikey, pin, times: 2 })

    nock(baseUrl)
    .get('/v4/series/3')
    .replyWithError(new Error('getting show failed'))

    await expect(updateShowsAndEpisodes()).rejects
    .toThrowError('getting show failed')
  })

  it('errors if getting episode updates fails', async () => {
    nockLogin({ apikey, pin, times: 3 })

    nock(baseUrl)
    .get('/v4/series/3')
    .reply(200, { data: { id: 3,
      image: 'show 3 poster',
      status: { name: 'Ended' },
    } })

    nock(baseUrl)
    .get('/v4/updates?type=episodes&since=1668398400')
    .replyWithError(new Error('getting updates failed'))

    await expect(() => updateShowsAndEpisodes()).rejects
    .toThrowError('getting updates failed')
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
