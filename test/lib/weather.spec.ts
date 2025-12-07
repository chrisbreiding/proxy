import nock from 'nock'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { fixtureContents, handleServer, weatherUrlBasePath } from '../util'
import { startServer } from '../../index'
import { ConditionCode, getWeatherIcon, toIcon, WeatherIcon } from '../../lib/weather'

const token = process.env.APPLE_WEATHER_TOKEN!

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

    it('returns weather and converts data from WeatherKit', async (ctx) => {
      nock('https://weatherkit.apple.com')
      .matchHeader('authorization', `Bearer ${token}`)
      .get(`${weatherUrlBasePath}&dataSets=currentWeather,forecastDaily,forecastHourly,weatherAlerts&hourlyStart=2022-12-28T05:00:00.000Z&dailyStart=2022-12-28T05:00:00.000Z`)
      .reply(200, fixtureContents('weather/weather'))

      nock('https://weatherkit.apple.com')
      .matchHeader('authorization', `Bearer ${token}`)
      .get('/api/v1/weatherAlert/en/alert-id')
      .reply(200, fixtureContents('weather/weather-alert'))

      const res = await ctx.request.get('/weather?location=lat,lng')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('sends 500 with error if no location specified', async (ctx) => {
      const res = await ctx.request.get('/weather')

      expect(res.status).to.equal(500)
      expect(res.body.error.message).to.equal(
        'A value for \'location\' must be provided in the query string',
      )
    })

    it('sends 500 with error if error', async (ctx) => {
      nock('https://weatherkit.apple.com')
      .get(`${weatherUrlBasePath}&dataSets=currentWeather,forecastDaily,forecastHourly,weatherAlerts&hourlyStart=2022-12-28T05:00:00.000Z&dailyStart=2022-12-28T05:00:00.000Z`)
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
    it('converts WeatherKit conditionCode to icon name', () => {
      const conversions = {
        'Blizzard': 'blizzard',
        'Frigid': 'blizzard',
        'HeavySnow': 'blizzard',
        'BlowingSnow': 'snow',
        'Flurries': 'snow',
        'Snow': 'snow',
        'SnowShowers': 'snow',
        'ScatteredSnowShowers': 'snow',
        'Breezy': 'wind',
        'Windy': 'wind',
        'Clear': 'clear',
        'MostlyClear': 'clear',
        'Cloudy': 'cloudy',
        'Drizzle': 'rain',
        'HeavyRain': 'rain',
        'MixedRainfall': 'rain',
        'Rain': 'rain',
        'ScatteredShowers': 'rain',
        'Showers': 'rain',
        'Dust': 'fog',
        'Fog': 'fog',
        'Haze': 'fog',
        'Smoke': 'fog',
        'Hot': 'hot',
        'Hurricane': 'hurricane',
        'IsolatedThunderstorms': 'storm',
        'ScatteredThunderstorms': 'storm',
        'SevereThunderstorm': 'storm',
        'SevereThunderstorms': 'storm',
        'Thunderstorm': 'storm',
        'Thunderstorms': 'storm',
        'TropicalStorm': 'storm',
        'FreezingDrizzle': 'sleet',
        'FreezingRain': 'sleet',
        'Hail': 'sleet',
        'MixedRainAndSleet': 'sleet',
        'MixedRainAndSnow': 'sleet',
        'MixedSnowAndSleet': 'sleet',
        'Sleet': 'sleet',
        'MostlyCloudy': 'partly-cloudy',
        'PartlyCloudy': 'partly-cloudy',
        'Tornado': 'tornado',
      } as Record<ConditionCode, WeatherIcon>

      Object.entries(conversions).forEach(([conditionCode, iconName]) => {
        expect(toIcon(conditionCode as ConditionCode)).to.equal(iconName)
      })
    })

    it('returns "default" for unexpected conditionCode', () => {
      // @ts-expect-error
      expect(toIcon('nope')).equal('default')
    })
  })
})
