import type express from 'express'

import { request } from './util/network'
import { getEnv } from './util/env'

const WEATHER_BASE_URL = `https://api.darksky.net/forecast/${getEnv('DARK_SKY_API_KEY')}`

const weatherIconMap = {
  'clear-day': '☀️',
  'clear-night': '☀️',
  'rain': '☔️',
  'snow': '❄️',
  'sleet': '🌨',
  'wind': '💨',
  'fog': '🌫',
  'cloudy': '☁️',
  'partly-cloudy-day': '⛅️',
  'partly-cloudy-night': '⛅️',
  'default': '🌑',
}

export function getWeatherIcon (iconName: keyof typeof weatherIconMap) {
  return weatherIconMap[iconName] || weatherIconMap.default
}

export interface DayWeather {
  icon: keyof typeof weatherIconMap
  precipAccumulation: number
  precipProbability: number
  temperatureLow: number
  temperatureHigh: number
  time: number
}

export interface CurrentWeather {
  icon: keyof typeof weatherIconMap
  precipProbability: number
  precipAccumulation: number
  temperature: number
}

export interface Weather {
  daily: {
    data: DayWeather[]
  }
  currently: CurrentWeather
}

export function getWeatherData ({ location }: { location: string }): Promise<Weather> {
  return request({
    url: `${WEATHER_BASE_URL}/${location}`,
    params: {
      exclude: 'minutely,flags',
      extend: 'hourly',
    },
  })
}

export async function get (req: express.Request, res: express.Response) {
  try {
    const location = req.query.location

    if (!location) {
      throw new Error('A value for \'location\' must be provided in the query string')
    }

    const result = await getWeatherData({ location: location as string })

    res.json(result)
  } catch (error: any) {
    res.status(500).json({
      error,
      data: error?.response?.data,
    })
  }
}
