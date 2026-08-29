import type express from 'express'
import { request } from './util/network'

const LOCATION_DETAILS_PLACE_ID_BASE_URL = 'https://maps.googleapis.com/maps/api/place/details/json'
const LOCATION_DETAILS_LAT_LNG_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function details (req: express.Request, res: express.Response) {
  const placeId = req.query.placeid as string
  const key = placeId ? 'placeid' : 'latlng'
  const value = placeId || req.query.latlng as string
  const baseUrl = placeId ? LOCATION_DETAILS_PLACE_ID_BASE_URL : LOCATION_DETAILS_LAT_LNG_BASE_URL

  try {
    const result = await request({ url: `${baseUrl}?key=${process.env.GOOGLE_API_KEY}&${key}=${value}` })

    res.send(result)
  } catch (error: any) {
    res.status(500).json({
      error,
      data: error?.response?.data,
    })
  }
}

interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

interface GeocodeResult {
  address_components?: AddressComponent[]
  formatted_address?: string
}

// google returns the most specific match first, which for a set of coordinates
// is usually a street address. the city and state come from its components
export async function getLocationName (latLng: string) {
  const result = await request<{ results?: GeocodeResult[] }>({
    url: `${LOCATION_DETAILS_LAT_LNG_BASE_URL}?key=${process.env.GOOGLE_API_KEY}&latlng=${encodeURIComponent(latLng)}`,
  })

  const [firstResult] = result?.results || []

  if (!firstResult) return undefined

  const components = firstResult.address_components || []
  const findComponent = (type: string) => {
    return components.find(({ types }) => types.includes(type))
  }
  const city = findComponent('locality')
    || findComponent('sublocality')
    || findComponent('administrative_area_level_3')
  const state = findComponent('administrative_area_level_1')

  if (city && state) return `${city.long_name}, ${state.short_name}`

  return firstResult.formatted_address
}

const LOCATION_SEARCH_BASE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const locationSearchCache = {} as { [key: string]: any }

export async function search (req: express.Request, res: express.Response) {
  const query = req.query.query as string

  if (locationSearchCache[query]) {
    return res.send(locationSearchCache[query])
  }

  try {
    const result = await request({ url: `${LOCATION_SEARCH_BASE_URL}?key=${process.env.GOOGLE_API_KEY}&input=${query}` })

    locationSearchCache[query] = result
    res.send(result)
  } catch (error: any) {
    res.status(500).json({
      error,
      data: error?.response?.data,
    })
  }
}
