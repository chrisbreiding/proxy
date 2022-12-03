import { readJsonSync } from 'fs-extra'
import getPort from 'get-port'
import type http from 'http'
import type nock from 'nock'
import path from 'path'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, expect } from 'vitest'

declare module 'vitest' {
  export interface TestContext {
    request: supertest.SuperTest<supertest.Test>
  }
}

export function handleServer (startServer: (port: number) => http.Server) {
  let server: http.Server
  let request: supertest.SuperTest<supertest.Test>

  beforeAll(async () => {
    const port = await getPort()
    server = startServer(port)
    request = supertest(server)
  })

  beforeEach((ctx) => {
    ctx.request = request
  })

  afterAll(() => {
    server.close()
  })
}

export function fixture (name: string) {
  const extension = path.extname(name) ? '' : '.json'

  return path.join(process.cwd(), `test/fixtures/${name}${extension}`)
}

export function fixtureContents (name: string) {
  return readJsonSync(fixture(name))
}

function createUniqueId () {
  const tracker: { [key: string]: number } = {}
  let defaultCount = 0

  return (prefix?: string) => {
    if (!prefix) {
      return `${++defaultCount}`
    }

    const counter = (tracker[prefix] || 0) + 1

    tracker[prefix] = counter

    return `${prefix}${counter}`
  }
}

export const uniqueId = createUniqueId()

export function getBody (scope: nock.Scope) {
  return new Promise<void>((resolve, reject) => {
    scope.on('request', (_, __, body) => {
      try {
        resolve(JSON.parse(body))
      } catch (error: any) {
        reject(error)
      }
    })
  })
}

export async function snapshotBody (scope: nock.Scope, message?: string) {
  expect(await getBody(scope)).toMatchSnapshot(message)
}

const stackLineRegex = /at\s.*(?::\d+:\d+|\s\((?:.*:\d+:\d+|<unknown>)\))\)?/s

export function replaceStackLines (value: string) {
  return value.replace(stackLineRegex, '[stack lines]')
}

export const weatherUrlBasePath = '/api/v1/weather/en/lat/lng?country=US&timezone=America%2FNew_York'
