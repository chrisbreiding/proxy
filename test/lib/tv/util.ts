import nock from 'nock'
import type supertest from 'supertest'
import { expect } from 'vitest'

import { baseUrl } from '../../../lib/tv/source/util'

export function nockLogin ({ apikey, pin, times = 1 }: { apikey: string, pin: string, times?: number }) {
  return nock(baseUrl)
  .post('/v4/login', { apikey, pin })
  .times(times)
  .reply(200, { data: { token: 'token' } })
}

export async function testError (mockedFn: any, makeRequest: () => supertest.Test) {
  // @ts-ignore
  mockedFn.mockRejectedValue(new Error('failed'))

  const res = await makeRequest()

  expect(res.status).to.equal(500)
  expect(res.body.error).to.equal('failed')
}
