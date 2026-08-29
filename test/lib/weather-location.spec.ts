import { readJsonSync } from 'fs-extra'
import mockFs from 'mock-fs'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getWeatherCoordinates,
  getWeatherLocation,
  PersistentDataStructure,
  setWeatherLocation,
} from '../../lib/weather-location'

const location = {
  coordinates: '40.1,-80.2',
  name: 'Somewhere, PA',
}

function mockData (data: PersistentDataStructure | null) {
  mockFs({
    'data': {
      'weather-data.json': JSON.stringify(data),
    },
  })
}

function mockError () {
  mockFs({
    'data': {},
  })
}

function getData () {
  return readJsonSync('./data/weather-data.json')
}

describe('lib/weather-location', () => {
  afterEach(() => {
    mockFs.restore()
    process.env.WEATHER_LOCATION = 'lat,lng'
  })

  describe('#getWeatherLocation', () => {
    it('returns the persisted location', async () => {
      mockData({ location })

      expect(await getWeatherLocation()).to.deep.equal(location)
    })

    it('returns undefined when no location is persisted', async () => {
      mockData({})

      expect(await getWeatherLocation()).to.equal(undefined)
    })

    it('returns undefined when there is no persisted data', async () => {
      mockData(null)

      expect(await getWeatherLocation()).to.equal(undefined)
    })

    it('returns undefined on error', async () => {
      mockError()

      expect(await getWeatherLocation()).to.equal(undefined)
    })
  })

  describe('#setWeatherLocation', () => {
    it('persists the location', async () => {
      mockData({})

      await setWeatherLocation(location)

      expect(getData()).to.deep.equal({ location })
      expect(await getWeatherLocation()).to.deep.equal(location)
    })

    it('clears the location when given nothing', async () => {
      mockData({ location })

      await setWeatherLocation()

      expect(getData()).to.deep.equal({})
      expect(await getWeatherLocation()).to.equal(undefined)
    })
  })

  describe('#getWeatherCoordinates', () => {
    it('returns the coordinates of the persisted location', async () => {
      mockData({ location })

      expect(await getWeatherCoordinates()).to.equal('40.1,-80.2')
    })

    it('falls back to the environment variable when no location is persisted', async () => {
      mockData({})

      expect(await getWeatherCoordinates()).to.equal('lat,lng')
    })

    it('falls back to the environment variable on error', async () => {
      mockError()

      expect(await getWeatherCoordinates()).to.equal('lat,lng')
    })

    it('returns undefined when neither is set', async () => {
      delete process.env.WEATHER_LOCATION
      mockData({})

      expect(await getWeatherCoordinates()).to.equal(undefined)
    })
  })
})
