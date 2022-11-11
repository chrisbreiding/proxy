import nock from 'nock'
import type supertest from 'supertest'
import { expect } from 'vitest'

export function nockLogin (apikey: string, pin: string) {
  return nock('https://api4.thetvdb.com')
  .post('/v4/login', { apikey, pin })
  .reply(200, { data: { token: 'token' } })
}

export async function testError (mockedFn: any, makeRequest: () => supertest.Test) {
  // @ts-ignore
  mockedFn.mockRejectedValue(new Error('failed'))

  const res = await makeRequest()

  expect(res.status).to.equal(500)
  expect(res.body.error).to.equal('failed')
}
