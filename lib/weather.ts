import type express from 'express'

import { request } from './util/network'
import { getEnv } from './util/env'
import dayjs from 'dayjs'

const WEATHER_BASE_URL = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
const FORECAST_DAYS = 10

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
// Visual Crossing 'icons2' icon set
export type SourceIcon = 'clear-day' | 'clear-night' | 'cloudy' | 'fog' | 'partly-cloudy-day' | 'partly-cloudy-night' | 'rain' | 'showers-day' | 'showers-night' | 'snow' | 'snow-showers-day' | 'snow-showers-night' | 'thunder-rain' | 'thunder-showers-day' | 'thunder-showers-night' | 'wind'
type SourcePrecipitationType = 'rain' | 'snow' | 'freezingrain' | 'ice'
type Severity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown'

interface SourceAlert {
  description: string
  endsEpoch: number // unix timestamp
  event: string
  headline: string
  id: string
  onsetEpoch: number // unix timestamp
}

interface SourceCurrentWeather {
  conditions: string
  feelslike: number // °F
  icon: SourceIcon
  preciptype: SourcePrecipitationType[] | null
  temp: number // °F
}

interface SourceHourWeather {
  datetimeEpoch: number // unix timestamp
  feelslike: number // °F
  precip: number | null // in
  precipprob: number | null // 0-100
  preciptype: SourcePrecipitationType[] | null
  snow: number | null // in
  temp: number // °F
  windspeed: number | null // mph
}

interface SourceDayWeather {
  conditions: string
  datetimeEpoch: number // unix timestamp
  hours?: SourceHourWeather[]
  icon: SourceIcon
  precip: number | null // in
  precipprob: number | null // 0-100
  preciptype: SourcePrecipitationType[] | null
  snow: number | null // in
  sunriseEpoch: number // unix timestamp
  sunsetEpoch: number // unix timestamp
  tempmax: number // °F
  tempmin: number // °F
}

interface SourceWeather {
  alerts?: SourceAlert[]
  currentConditions?: SourceCurrentWeather
  days: SourceDayWeather[]
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

export function toIcon (sourceIcon: SourceIcon): WeatherIcon {
  switch (sourceIcon) {
    case 'snow':
    case 'snow-showers-day':
    case 'snow-showers-night':
      return 'snow'

    case 'wind':
      return 'wind'

    case 'clear-day':
    case 'clear-night':
      return 'clear'

    case 'cloudy':
      return 'cloudy'

    case 'rain':
    case 'showers-day':
    case 'showers-night':
      return 'rain'

    case 'fog':
      return 'fog'

    case 'thunder-rain':
    case 'thunder-showers-day':
    case 'thunder-showers-night':
      return 'storm'

    case 'partly-cloudy-day':
    case 'partly-cloudy-night':
      return 'partly-cloudy'

    default:
      return 'default'
  }
}

const isFrozenPrecip = (type: SourcePrecipitationType) => type === 'freezingrain' || type === 'ice'

// the icon set has no sleet icon, so derive it from the precipitation type
function toConditionIcon (sourceIcon: SourceIcon, sourcePrecipType: SourcePrecipitationType[] | null): WeatherIcon {
  const icon = toIcon(sourceIcon)

  if ((icon === 'rain' || icon === 'snow') && sourcePrecipType?.some(isFrozenPrecip)) {
    return 'sleet'
  }

  return icon
}

export function toPrecipType (sourcePrecipType: SourcePrecipitationType[] | null): PrecipitationType {
  if (!sourcePrecipType?.length) return 'clear'
  if (sourcePrecipType.length > 1) return 'mixed'
  if (isFrozenPrecip(sourcePrecipType[0])) return 'sleet'

  return sourcePrecipType[0] as PrecipitationType
}

const toProbability = (percent: number | null = 0) => (percent || 0) / 100

function convertAlerts (alerts: SourceAlert[] = []): Alert[] {
  return alerts.map((alert) => ({
    title: alert.event,
    messages: [alert.description],
    time: alert.onsetEpoch,
    expires: alert.endsEpoch,
    // Visual Crossing does not provide alert severity
    severity: 'unknown',
  }))
}

function convertCurrentWeatherData (currentWeather: SourceCurrentWeather, hourWeather?: SourceHourWeather): CurrentWeather {
  return {
    apparentTemperature: currentWeather.feelslike,
    icon: toConditionIcon(currentWeather.icon, currentWeather.preciptype),
    precipProbability: hourWeather ? toProbability(hourWeather.precipprob) : undefined,
    precipAccumulation: hourWeather?.precip || 0,
    summary: currentWeather.conditions,
    temperature: currentWeather.temp,
  }
}

function convertDailyWeatherData (days: SourceDayWeather[]): { data: DayWeather[] } {
  return {
    data: days.map((dayWeather) => ({
      icon: toConditionIcon(dayWeather.icon, dayWeather.preciptype),
      precipAccumulation: dayWeather.precip || 0,
      precipProbability: toProbability(dayWeather.precipprob),
      precipType: toPrecipType(dayWeather.preciptype),
      snowAccumulation: dayWeather.snow || 0,
      sunrise: dayWeather.sunriseEpoch,
      sunset: dayWeather.sunsetEpoch,
      temperatureLow: dayWeather.tempmin,
      temperatureHigh: dayWeather.tempmax,
      time: dayWeather.datetimeEpoch,
    })),
  }
}

function getHours (data: SourceWeather) {
  return data.days.flatMap((day) => day.hours || [])
}

function getCurrentHour (data: SourceWeather) {
  const startOfHour = dayjs().startOf('hour').unix()

  return getHours(data).find((hour) => hour.datetimeEpoch === startOfHour)
}

interface WeatherParams {
  days: number
  include: string
}

async function getWeather (location: string, { days, include }: WeatherParams) {
  const key = getEnv('VISUAL_CROSSING_API_KEY')!
  const [lat, lng] = location.split(',')
  const start = dayjs().startOf('day')
  const end = start.add(days - 1, 'day')

  const data = await request({
    url: `${WEATHER_BASE_URL}/${lat},${lng}/${start.format('YYYY-MM-DD')}/${end.format('YYYY-MM-DD')}`,
    params: {
      key,
      unitGroup: 'us',
      lang: 'en',
      iconSet: 'icons2',
      include,
    },
  })

  return data as SourceWeather
}

export async function getCurrentWeather (location: string): Promise<CurrentWeather> {
  const data = await getWeather(location, {
    days: 1,
    include: 'current,hours',
  })

  return convertCurrentWeatherData(data.currentConditions!, getCurrentHour(data))
}

interface DailyWeather {
  daily: {
    data: DayWeather[]
  }
}

export async function getDailyWeather (location: string): Promise<DailyWeather> {
  const data = await getWeather(location, {
    days: FORECAST_DAYS,
    include: 'days',
  })

  return {
    daily: convertDailyWeatherData(data.days),
  }
}

export interface CurrentAndDailyWeather {
  currently: CurrentWeather
  daily: {
    data: DayWeather[]
  }
}

export async function getCurrentAndDailyWeather (location: string): Promise<CurrentAndDailyWeather> {
  const data = await getWeather(location, {
    days: FORECAST_DAYS,
    include: 'current,days,hours',
  })

  return {
    currently: convertCurrentWeatherData(data.currentConditions!, getCurrentHour(data)),
    daily: convertDailyWeatherData(data.days),
  }
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

function convertAllData (data: SourceWeather): AllWeather {
  return {
    alerts: convertAlerts(data.alerts),
    currently: convertCurrentWeatherData(data.currentConditions!, getCurrentHour(data)),
    daily: convertDailyWeatherData(data.days),
    hourly: {
      data: getHours(data).map((hourWeather) => ({
        apparentTemperature: hourWeather.feelslike,
        precipIntensity: hourWeather.precip || 0,
        precipProbability: toProbability(hourWeather.precipprob),
        precipType: toPrecipType(hourWeather.preciptype),
        snowIntensity: hourWeather.snow || 0,
        time: hourWeather.datetimeEpoch,
        temperature: hourWeather.temp,
        windSpeed: hourWeather.windspeed || 0,
      })),
    },
  }
}

export async function getAllWeather (location: string): Promise<AllWeather> {
  const data = await getWeather(location, {
    days: FORECAST_DAYS,
    include: 'current,days,hours,alerts',
  })

  return convertAllData(data)
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
