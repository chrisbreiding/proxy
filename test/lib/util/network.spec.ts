import nock from 'nock'
import { describe, it, expect } from 'vitest'

import { request } from '../../../lib/util/network'

describe('lib/util/network', () => {
  describe('#request', () => {
    it('requests the given url, GET by default, returning the response data', async () => {
      nock('http://api.com')
      .get('/')
      .reply(200, { the: 'data' })

      // @ts-expect-error
      const result = await request({ url: 'http://api.com' })

      expect(result).to.deep.equal({ the: 'data' })
    })

    it('can specify method', async () => {
      nock('http://api.com')
      .post('/')
      .reply(200)

      // @ts-expect-error
      await request({
        url: 'http://api.com',
        method: 'post',
      })
    })

    it('can include headers', async () => {
      nock('http://api.com')
      .get('/')
      .matchHeader('X-My-Header', 'value')
      .reply(200)

      // @ts-expect-error
      await request({
        url: 'http://api.com',
        headers: {
          'X-My-Header': 'value',
        },
      })
    })

    it('can include query params', async () => {
      nock('http://api.com')
      .get('/?query=value')
      .reply(200)

      // @ts-expect-error
      await request({
        url: 'http://api.com',
        params: {
          query: 'value',
        },
      })
    })

    it('can include body', async () => {
      nock('http://api.com')
      .post('/', { data: 'value' })
      .reply(200)

      // @ts-expect-error
      await request({
        url: 'http://api.com',
        method: 'post',
        body: {
          data: 'value',
        },
      })
    })

    it('re-throws errors', async () => {
      nock('http://api.com')
      .get('/')
      .replyWithError('request failed')

      // @ts-expect-error
      await expect(request({
        url: 'http://api.com',
      })).rejects.toThrow('request failed')
    })
  })
})
