import type express from 'express'

import { request } from './util/network'
import { getEnv } from './util/env'

const MAP_BASE_URL = 'https://maps.visualcrossing.com/VisualCrossingWebServices/rest/api/v1/map'

// only proxy known elements, formats, and params so this can't be used as an
// open proxy for the api key
const elements = ['precipcomposite', 'preciprate', 'preciptype', 'temp', 'wind', 'windspeed', 'winddir', 'lightning', 'hail']
const tileFormats: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
}
const passthroughParams = ['time', 'unitGroup']
// 'latest' tiles update every 10-60 minutes depending on the element
const TILE_MAX_AGE = 5 * 60 // seconds

const isInteger = (value: string) => /^\d+$/.test(value)

function getParams (query: express.Request['query']) {
  const params: Record<string, string> = {
    apikey: getEnv('VISUAL_CROSSING_API_KEY')!,
  }

  for (const key of passthroughParams) {
    if (typeof query[key] === 'string') {
      params[key] = query[key]
    }
  }

  return params
}

export async function getTile (req: express.Request, res: express.Response) {
  const { element, format, x, y, z } = req.params as Record<string, string>

  if (!elements.includes(element) || !tileFormats[format] || ![x, y, z].every(isInteger)) {
    return res.sendStatus(404)
  }

  try {
    const tile = await request<ArrayBuffer>({
      url: `${MAP_BASE_URL}/tile/${element}/${z}/${x}/${y}.${format}`,
      params: getParams(req.query),
      responseType: 'arraybuffer',
    })

    res.set('Cache-Control', `public, max-age=${TILE_MAX_AGE}`)
    res.type(tileFormats[format])
    res.send(Buffer.from(tile))
  } catch (error: any) {
    res.sendStatus(error?.response?.status || 500)
  }
}

export async function getLegend (req: express.Request, res: express.Response) {
  const { element } = req.params as Record<string, string>

  if (!elements.includes(element)) {
    return res.sendStatus(404)
  }

  try {
    const legend = await request({
      url: `${MAP_BASE_URL}/legend/${element}`,
      params: getParams(req.query),
    })

    res.json(legend)
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
