import type express from 'express'
import { request } from './util/network'

export async function get (req: express.Request, res: express.Response) {
  try {
    const response = await request({
      url: `https://prod-hal-api.homeatlastdogrescue.com/dogs/${req.params.id}`,
    })

    res.json(response)
  } catch (error: any) {
    res.status(500).json({
      error,
      data: error?.response?.data,
    })
  }
}

export async function search (req: express.Request, res: express.Response) {
  try {
    const response = await request({
      url: 'https://prod-hal-api.homeatlastdogrescue.com/dogs/search',
      params: req.query,
    })

    res.json(response)
  } catch (error: any) {
    res.status(500).json({
      error,
      data: error?.response?.data,
    })
  }
}
