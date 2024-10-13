import type express from 'express'
import { debug } from '../util/debug'

export function guard (handler: (req: express.Request, res: express.Response) => void) {
  return async (req: express.Request, res: express.Response) => {
    try {
      return await handler(req, res)
    } catch (error: any) {
      debug('route error:', { route: req.path, error: error.stack })

      res.status(500).json({ error: error.message })
    }
  }
}
