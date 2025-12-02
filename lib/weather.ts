import type express from 'express'

import { request } from './util/network'
import { getEnv } from './util/env'
import dayjs from 'dayjs'

const WEATHER_BASE_URL = 'https://weatherkit.apple.com/api/v1'

const weatherIconMap = {
  'blizzard': '🥶',
  'clear': '☀️',
  'cloudy': '☁️',
  'fog': '🌫',
  'hot': '🥵',
  'hurricane': '🌀',
  'partly-cloudy': '⛅️',
  'rain': '☔️',
  'sleet': '🌨',
  'snow': '❄️',
  'storm': '⛈',
  'tornado': '🌪',
  'wind': '💨',

  'default': '🌑',
}

export type WeatherIcon = keyof typeof weatherIconMap

export function getWeatherIcon (iconName: WeatherIcon) {
  return weatherIconMap[iconName] || weatherIconMap.default
}

type PrecipitationType = 'clear' | 'precipitation' | 'rain' | 'snow' | 'sleet' | 'hail' | 'mixed'
export type ConditionCode = 'Blizzard' | 'BlowingSnow' | 'Breezy' | 'Clear' | 'Cloudy' | 'Drizzle' | 'Dust' | 'Flurries' | 'Fog' | 'FreezingDrizzle' | 'FreezingRain' | 'Frigid' | 'Hail' | 'Haze' | 'HeavyRain' | 'HeavySnow' | 'Hot' | 'Hurricane' | 'IsolatedThunderstorms' | 'MixedRainAndSleet' | 'MixedRainAndSnow' | 'MixedRainfall' | 'MixedSnowAndSleet' | 'MostlyClear' | 'MostlyCloudy' | 'PartlyCloudy' | 'Rain' | 'ScatteredShowers' | 'ScatteredSnowShowers' | 'ScatteredThunderstorms' | 'SevereThunderstorm' | 'SevereThunderstorms' | 'Showers' | 'Sleet' | 'Smoke' | 'Snow' | 'SnowShowers' | 'Thunderstorm' | 'Thunderstorms' | 'Tornado' | 'TropicalStorm' | 'Windy' | 'WintryMix'
type Severity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown'

interface SourceAlertDetails {
  area: string
  messages: {
    language: string
    text: string
  }[]
}

interface SourceAlert {
  description: string
  expireTime: string // ISO-8601 datetime
  id: string
  issuedTime: string // ISO-8601 datetime
  severity: Severity
}

interface SourceCurrentWeather {
  conditionCode: ConditionCode
  temperature: number // °C
  temperatureApparent: number // °C
}

interface SourceDayWeather {
  conditionCode: ConditionCode
  forecastStart: string // ISO-8601 datetime
  precipitationAmount: number // mm
  precipitationChance: number // 0-1
  precipitationType: PrecipitationType
  snowfallAmount: number // mm
  sunrise: string // ISO-8601 datetime
  sunset: string // ISO-8601 datetime
  temperatureMax: number // °C
  temperatureMin: number // °C
}

interface SourceHourWeather {
  forecastStart: string // ISO-8601 datetime
  precipitationAmount: number // mm
  precipitationChance: number // 0-1
  precipitationIntensity: number // mm/hr
  precipitationType: PrecipitationType
  snowfallIntensity: number // mm/hr
  temperature: number // °C
  temperatureApparent: number // °C
  windSpeed: number // kph
}

interface Alert {
  title: string
  messages: string[]
  time: number // unix timestamp
  expires: number // unix timestamp
  severity: Severity // TODO: surface this in app
}

export interface CurrentWeather {
  apparentTemperature: number // °F
  icon: WeatherIcon
  precipProbability?: number // 0-1
  precipAccumulation?: number // in
  summary: string
  temperature: number // °F
}

export interface DayWeather {
  icon: WeatherIcon
  precipAccumulation: number // in
  precipProbability: number // 0-1
  precipType: PrecipitationType
  snowAccumulation: number // in
  sunrise: number // unix timestamp
  sunset: number // unix timestamp
  temperatureLow: number // °F
  temperatureHigh: number // °F
  time: number // unix timestamp
}

interface HourWeather {
  apparentTemperature: number // °F
  precipIntensity: number // in/hr
  precipProbability: number // 0-1
  precipType: PrecipitationType
  snowIntensity: number // in/hr
  temperature: number // °F
  time: number // unix timestamp
  windSpeed: number // mph
}

export function toIcon (conditionCode: ConditionCode): WeatherIcon {
  switch (conditionCode) {
    case 'Blizzard':
    case 'Frigid':
    case 'HeavySnow':
      return 'blizzard'

    case 'BlowingSnow':
    case 'Flurries':
    case 'Snow':
    case 'SnowShowers':
    case 'ScatteredSnowShowers':
    case 'WintryMix':
      return 'snow'

    case 'Breezy':
    case 'Windy':
      return 'wind'

    case 'Clear':
    case 'MostlyClear':
      return 'clear'

    case 'Cloudy':
      return 'cloudy'

    case 'Drizzle':
    case 'HeavyRain':
    case 'MixedRainfall':
    case 'Rain':
    case 'ScatteredShowers':
    case 'Showers':
      return 'rain'

    case 'Dust':
    case 'Fog':
    case 'Haze':
    case 'Smoke':
      return 'fog'

    case 'Hot':
      return 'hot'

    case 'Hurricane':
      return 'hurricane'

    case 'IsolatedThunderstorms':
    case 'ScatteredThunderstorms':
    case 'SevereThunderstorm':
    case 'SevereThunderstorms':
    case 'Thunderstorm':
    case 'Thunderstorms':
    case 'TropicalStorm':
      return 'storm'

    case 'FreezingDrizzle':
    case 'FreezingRain':
    case 'Hail':
    case 'MixedRainAndSleet':
    case 'MixedRainAndSnow':
    case 'MixedSnowAndSleet':
    case 'Sleet':
      return 'sleet'

    case 'MostlyCloudy':
    case 'PartlyCloudy':
      return 'partly-cloudy'

    case 'Tornado':
      return 'tornado'

    default:
      return 'default'
  }
}

const beforeCapitalLetterRegex = /(?!^)(?=[A-Z])/g

const conditionCodeToSummary = (conditionCode: ConditionCode) => {
  return conditionCode.split(beforeCapitalLetterRegex).map((word) => {
    return word === 'And' ? '&' : word
  }).join(' ')
}

const toUnix = (dateString: string) => dayjs(dateString).unix()
const toFahrenheit = (celsius = 0) => (celsius * 1.8) + 32
const toInches = (millimeters = 0) => millimeters / 25.4
const toMiles = (kilometers = 0) => kilometers / 1.609

async function getAlertMessages (alert: SourceAlert) {
  const token = getEnv('APPLE_WEATHER_TOKEN')

  const data = await request({
    url: `${WEATHER_BASE_URL}/weatherAlert/en/${alert.id}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }) as SourceAlertDetails

  return data.messages.map((message) => message.text)
}

async function getAlerts (alerts: SourceAlert[]) {
  return Promise.all(alerts.map(async (alert) => ({
    title: alert.description,
    messages: await getAlertMessages(alert),
    time: toUnix(alert.issuedTime),
    expires: toUnix(alert.expireTime),
    severity: alert.severity,
  })))
}

function convertCurrentWeatherData (currentWeather: SourceCurrentWeather, hourWeather?: SourceHourWeather): CurrentWeather {
  return {
    apparentTemperature: toFahrenheit(currentWeather.temperatureApparent),
    icon: toIcon(currentWeather.conditionCode),
    precipProbability: hourWeather?.precipitationChance,
    precipAccumulation: toInches(hourWeather?.precipitationAmount),
    summary: conditionCodeToSummary(currentWeather.conditionCode),
    temperature: toFahrenheit(currentWeather.temperature),
  }
}

function convertDailyWeatherData (forecastDaily: { days: SourceDayWeather[] }): { data: DayWeather[] } {
  return {
    data: forecastDaily.days.map((dayWeather) => ({
      icon: toIcon(dayWeather.conditionCode),
      precipAccumulation: toInches(dayWeather.precipitationAmount),
      precipProbability: dayWeather.precipitationChance,
      precipType: dayWeather.precipitationType,
      snowAccumulation: toInches(dayWeather.snowfallAmount),
      sunrise: toUnix(dayWeather.sunrise),
      sunset: toUnix(dayWeather.sunset),
      temperatureLow: toFahrenheit(dayWeather.temperatureMin),
      temperatureHigh: toFahrenheit(dayWeather.temperatureMax),
      time: toUnix(dayWeather.forecastStart),
    })),
  }
}

interface WeatherParams {
  dataSets: string
  dailyStart?: string
  hourlyStart?: string
  hourlyEnd?: string
}

function getWeather (location: string, params: WeatherParams) {
  const token = getEnv('APPLE_WEATHER_TOKEN')
  const [lat, lng] = location.split(',')

  return request({
    url: `${WEATHER_BASE_URL}/weather/en/${lat}/${lng}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      // TODO: set country and time zone based on location
      country: 'US',
      timezone: (process.env.TZ || 'America/New_York'),
      ...params,
    },
  })
}

function getCurrentHourlyStartAndEnd () {
  const startOfHour = dayjs().startOf('hour')
  const endOfHour = startOfHour.add(1, 'hour')

  return {
    hourlyStart: startOfHour.toISOString(),
    hourlyEnd: endOfHour.toISOString(),
  }
}

interface SourceCurrentAndHourlyWeather {
  currentWeather: SourceCurrentWeather
  forecastHourly: {
    hours: SourceHourWeather[]
  }
}

export async function getCurrentWeather (location: string): Promise<CurrentWeather> {
  const { hourlyStart, hourlyEnd } = getCurrentHourlyStartAndEnd()

  const data = await getWeather(location, {
    dataSets: 'currentWeather,forecastHourly',
    hourlyEnd,
    hourlyStart,
  }) as SourceCurrentAndHourlyWeather

  return convertCurrentWeatherData(data.currentWeather, data.forecastHourly.hours[0])
}

interface SourceDailyWeather {
  forecastDaily: {
    days: SourceDayWeather[]
  }
}

interface DailyWeather {
  daily: {
    data: DayWeather[]
  }
}

async function convertDailyData (data: SourceDailyWeather): Promise<DailyWeather> {
  return {
    daily: convertDailyWeatherData(data.forecastDaily),
  }
}

export async function getDailyWeather (location: string): Promise<DailyWeather> {
  const data = await getWeather(location, {
    dataSets: 'forecastDaily',
  }) as SourceDailyWeather

  return convertDailyData(data)
}

interface SourceCurrentAndDailyWeather {
  currentWeather: SourceCurrentWeather
  forecastDaily: {
    days: SourceDayWeather[]
  }
  forecastHourly: {
    hours: SourceHourWeather[]
  }
}

export interface CurrentAndDailyWeather {
  currently: CurrentWeather
  daily: {
    data: DayWeather[]
  }
}

async function convertCurrentAndDailyData (data: SourceCurrentAndDailyWeather): Promise<CurrentAndDailyWeather> {
  return {
    currently: convertCurrentWeatherData(data.currentWeather, data.forecastHourly.hours[0]),
    daily: convertDailyWeatherData(data.forecastDaily),
  }
}

export async function getCurrentAndDailyWeather (location: string): Promise<CurrentAndDailyWeather> {
  const { hourlyStart, hourlyEnd } = getCurrentHourlyStartAndEnd()

  const data = await getWeather(location, {
    dataSets: 'currentWeather,forecastDaily,forecastHourly',
    hourlyEnd,
    hourlyStart,
  }) as SourceCurrentAndDailyWeather

  return convertCurrentAndDailyData(data)
}

interface SourceAllWeather {
  currentWeather: SourceCurrentWeather
  forecastDaily: {
    days: SourceDayWeather[]
  }
  forecastHourly: {
    hours: SourceHourWeather[]
  }
  weatherAlerts: {
    alerts: SourceAlert[]
  },
}

export interface AllWeather {
  alerts: Alert[]
  currently: CurrentWeather
  daily: {
    data: DayWeather[]
  }
  hourly: {
    data: HourWeather[]
  }
}

async function convertAllData (data: SourceAllWeather): Promise<AllWeather> {
  const startOfHour = dayjs().startOf('hour').unix()
  const currentHourWeather = data.forecastHourly.hours.find((hour) => {
    return dayjs(hour.forecastStart).unix() === startOfHour
  })

  return {
    alerts: await getAlerts(data.weatherAlerts.alerts),
    currently: convertCurrentWeatherData(data.currentWeather, currentHourWeather),
    daily: convertDailyWeatherData(data.forecastDaily),
    hourly: {
      data: data.forecastHourly.hours.map((hourWeather) => ({
        apparentTemperature: toFahrenheit(hourWeather.temperatureApparent),
        precipIntensity: toInches(hourWeather.precipitationIntensity),
        precipProbability: hourWeather.precipitationChance,
        precipType: hourWeather.precipitationType,
        snowIntensity: toInches(hourWeather.snowfallIntensity),
        time: toUnix(hourWeather.forecastStart),
        temperature: toFahrenheit(hourWeather.temperature),
        windSpeed: toMiles(hourWeather.windSpeed),
      })),
    },
  }
}

export async function getAllWeather (location: string): Promise<AllWeather> {
  const startOfDay = dayjs().startOf('day').toISOString()

  const data = await getWeather(location, {
    dataSets: 'currentWeather,forecastDaily,forecastHourly,weatherAlerts',
    dailyStart: startOfDay,
    hourlyStart: startOfDay,
  }) as SourceAllWeather

  return convertAllData(data)
  // don't understand why this fails coverage
  /* c8 ignore next */
}

export async function get (req: express.Request, res: express.Response) {
  try {
    const location = req.query.location

    if (!location) {
      throw new Error('A value for \'location\' must be provided in the query string')
    }

    const result = await getAllWeather(location as string)

    res.json(result)
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: error?.code,
        message: error?.message,
      },
      data: error?.response?.data,
    })
  }
}
