import { readJsonSync } from 'fs-extra'
import { JWT } from 'google-auth-library'
import path from 'path'

import { request } from './network'
import { basePath } from './persistent-data'

const scopes = ['https://www.googleapis.com/auth/spreadsheets']

let authClient: JWT | undefined

export function getAuthClient (credentialsName: string) {
  if (authClient) {
    return authClient
  }

  const credentials = readJsonSync(path.join(basePath, credentialsName), { throws: false })

  if (!credentials) {
    throw new Error('No Google Sheets service account credentials found')
  }

  authClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes,
  })

  return authClient
}

interface AppendRowOptions {
  client: JWT
  spreadsheetId: string
  range: string
  values: string[]
}

export async function appendRow ({ client, spreadsheetId, range, values }: AppendRowOptions) {
  const { token } = await client.getAccessToken()

  if (!token) {
    throw new Error('Could not get Google Sheets access token')
  }

  return request({
    method: 'POST',
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append`,
    params: {
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: {
      values: [values],
    },
  })
}
