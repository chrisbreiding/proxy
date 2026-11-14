import nock from 'nock'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { fixtureContents, handleServer, weatherPath, weatherUrlBase } from '../util'
import { startServer } from '../../index'
import { getWeatherIcon, SourceIcon, toIcon, toPrecipType, WeatherIcon } from '../../lib/weather'

describe('lib/weather', () => {
  describe('GET /weather', () => {
    handleServer(startServer)

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2022, 11, 28))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns weather and converts data from Visual Crossing', async (ctx) => {
      nock(weatherUrlBase)
      .get(weatherPath({ include: 'current,days,hours,alerts' }))
      .reply(200, fixtureContents('weather/weather'))

      const res = await ctx.request.get('/weather?location=lat,lng')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('handles missing hours and wind speed', async (ctx) => {
      const data = fixtureContents('weather/weather')
      const remainingHourCount = data.days.slice(1).reduce((count: number, day: { hours: unknown[] }) => {
        return count + day.hours.length
      }, 0)

      // the current hour is in the first day, so this also leaves no current hour
      delete data.days[0].hours
      data.days[1].hours[0].windspeed = null

      nock(weatherUrlBase)
      .get(weatherPath({ include: 'current,days,hours,alerts' }))
      .reply(200, data)

      const res = await ctx.request.get('/weather?location=lat,lng')

      expect(res.status).to.equal(200)
      expect(res.body.currently.precipProbability).toBeUndefined()
      expect(res.body.currently.precipAccumulation).to.equal(0)
      expect(res.body.hourly.data).to.have.length(remainingHourCount)
      expect(res.body.hourly.data[0].windSpeed).to.equal(0)
    })

    it('sends 500 with error if no location specified', async (ctx) => {
      const res = await ctx.request.get('/weather')

      expect(res.status).to.equal(500)
      expect(res.body.error.message).to.equal(
        'A value for \'location\' must be provided in the query string',
      )
    })

    it('sends 500 with error if error', async (ctx) => {
      nock(weatherUrlBase)
      .get(weatherPath({ include: 'current,days,hours,alerts' }))
      .reply(500, {
        message: 'could not get weather',
      })

      const res = await ctx.request.get('/weather?location=lat,lng')

      expect(res.status).to.equal(500)
      expect(res.body.data).to.deep.equal({
        message: 'could not get weather',
      })
      expect(res.body.error.code).to.equal('ERR_BAD_RESPONSE')
    })
  })

  describe('#getWeatherIcon', () => {
    it('returns icon matching key', async () => {
      expect(getWeatherIcon('snow')).to.equal('❄️')
    })

    it('returns default icon if no matching key', async () => {
      // @ts-expect-error
      expect(getWeatherIcon('nope')).to.equal('🌑')
    })
  })

  describe('#toIcon', () => {
    it('converts Visual Crossing icon to icon name', () => {
      const conversions = {
        'snow': 'snow',
        'snow-showers-day': 'snow',
        'snow-showers-night': 'snow',
        'wind': 'wind',
        'clear-day': 'clear',
        'clear-night': 'clear',
        'cloudy': 'cloudy',
        'rain': 'rain',
        'showers-day': 'rain',
        'showers-night': 'rain',
        'fog': 'fog',
        'thunder-rain': 'storm',
        'thunder-showers-day': 'storm',
        'thunder-showers-night': 'storm',
        'partly-cloudy-day': 'partly-cloudy',
        'partly-cloudy-night': 'partly-cloudy',
      } as Record<SourceIcon, WeatherIcon>

      Object.entries(conversions).forEach(([sourceIcon, iconName]) => {
        expect(toIcon(sourceIcon as SourceIcon)).to.equal(iconName)
      })
    })

    it('returns "default" for unexpected icon', () => {
      // @ts-expect-error
      expect(toIcon('nope')).equal('default')
    })
  })

  describe('#toPrecipType', () => {
    it('returns "clear" if no precipitation', () => {
      expect(toPrecipType(null)).to.equal('clear')
      expect(toPrecipType([])).to.equal('clear')
    })

    it('returns "mixed" if multiple precipitation types', () => {
      expect(toPrecipType(['rain', 'snow'])).to.equal('mixed')
    })

    it('returns "sleet" for freezing rain or ice', () => {
      expect(toPrecipType(['freezingrain'])).to.equal('sleet')
      expect(toPrecipType(['ice'])).to.equal('sleet')
    })

    it('returns rain or snow as-is', () => {
      expect(toPrecipType(['rain'])).to.equal('rain')
      expect(toPrecipType(['snow'])).to.equal('snow')
    })
  })
})
