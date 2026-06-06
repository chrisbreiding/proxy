import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { Request, Response } from 'express'

import { getEnv } from './util/env'
import { appendRow, getAuthClient } from './util/google-sheets'
import { guard } from './util/routing'

dayjs.extend(utc)
dayjs.extend(timezone)

const spreadsheetId = getEnv('LENNON_LOG_SPREADSHEET_ID')!
const credentialsName = 'google-lennon-logs-credentials.json'

export const add = guard(async (req: Request, res: Response) => {
  const description = (req.body.description as string | undefined) || ''

  const client = getAuthClient(credentialsName)

  const now = dayjs().tz('America/New_York')
  const timestamp = now.format('M/D/YYYY H:mm:ss')
  const date = now.format('M/D/YYYY')
  const time = now.format('h:mm:ss a')

  await appendRow({
    client,
    spreadsheetId,
    range: 'Form!A:Z',
    values: [timestamp, date, time, description],
  })

  res.sendStatus(200)
})
