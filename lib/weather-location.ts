import { debug } from './util/debug'
import { getEnv } from './util/env'
import { PersistentData } from './util/persistent-data'

export interface WeatherLocation {
  coordinates: string // 'lat,lng'
  name: string
}

export interface PersistentDataStructure {
  location?: WeatherLocation
}

const persistentData = new PersistentData<PersistentDataStructure>('weather-data')

export async function getWeatherLocation (): Promise<WeatherLocation | undefined> {
  try {
    const data = await persistentData.get()

    return data?.location
  } catch (error: any) {
    /* v8 ignore next -- @preserve */
    debug('Getting weather location errored:', error?.stack || error)

    return undefined
  }
}

export function setWeatherLocation (location?: WeatherLocation) {
  return persistentData.set({ location })
}

// the location set in the admin page wins. without one, fall back to the
// location configured via the environment
export async function getWeatherCoordinates () {
  const location = await getWeatherLocation()

  return location?.coordinates || getEnv('WEATHER_LOCATION')!
}

// the location set in the admin page wins. without one, fall back to the
// location configured via the environment
export async function getWeatherLocationName () {
  const location = await getWeatherLocation()

  return location?.name || getEnv('WEATHER_LOCATION_NAME')!
}
