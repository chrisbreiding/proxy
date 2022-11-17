import Mixpanel from 'mixpanel'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

const apikey = process.env.THETVDB_API_KEY = 'api-key'
const pin = process.env.THETVDB_PIN = 'pin'

import { baseUrl } from '../../../../lib/tv/source/util'
import {
  addDoc,
  deleteDoc,
  getCollection,
  getDoc,
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
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getCollection: vi.fn(),
    getDoc: vi.fn(),
    getDocWhere: vi.fn(),
    getSubCollections: vi.fn(),
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
    nockLogin({ apikey, pin, times: 5 })

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
        { recordId: 6, seriesId: 99, method: 'create' },
        { recordId: 7, seriesId: 99, method: 'update' },
        { recordId: 8, seriesId: 99, method: 'delete' },
      ],
    })

    nock(baseUrl)
    .get('/v4/episodes/3')
    .reply(200, { data: {
      aired: '2022-11-12',
      id: 3,
      number: 5,
      seasonNumber: 1,
      name: 'Episode 3',
    } })

    nock(baseUrl)
    .get('/v4/episodes/4')
    .reply(200, { data: {
      aired: '2022-11-13',
      id: 4,
      number: 6,
      seasonNumber: 1,
      name: 'Episode 4',
    } })

    await updateShowsAndEpisodes()

    expect(updateDoc).toBeCalledTimes(4)
    expect(updateDoc).toBeCalledWith('shows/1', {
      poster: 'show 1 poster',
      status: 'Continuing',
    })
    expect(updateDoc).toBeCalledWith('shows/3', {
      poster: 'show 3 poster',
      status: 'Ended',
    })

    expect(addDoc).toHaveBeenCalledOnce()
    expect(addDoc).toBeCalledWith('shows/1/episodes/3', {
      airdate: '2022-11-12T05:00:00.000Z',
      number: 5,
      id: '3',
      season: 1,
      title: 'Episode 3',
    })

    expect(updateDoc).toBeCalledWith('shows/1/episodes/4', {
      airdate: '2022-11-13T05:00:00.000Z',
      number: 6,
      id: '4',
      season: 1,
      title: 'Episode 4',
    })

    expect(deleteDoc).toHaveBeenCalledOnce()
    expect(deleteDoc).toBeCalledWith('shows/1/episodes/5')

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

  it('errors if getting episode fails', async () => {
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
    .get('/v4/episodes/3')
    .replyWithError(new Error('getting episode failed'))

    await expect(() => updateShowsAndEpisodes()).rejects
    .toThrowError('getting episode failed')
  })
})
