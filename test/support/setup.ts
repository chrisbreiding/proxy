import fs from 'fs-extra'
import path from 'path'
import getPort from 'get-port'
import type http from 'http'
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
