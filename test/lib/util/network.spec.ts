import nock from 'nock'
import { describe, it, expect } from 'vitest'

import { request } from '../../../lib/util/network'

describe('lib/util/network', () => {
  describe('#request', () => {
    it('requests the given url, GET by default, returning the response data', async () => {
      nock('http://api.com')
      .get('/')
      .reply(200, { the: 'data' })

      const result = await request({ url: 'http://api.com' })

      expect(result).to.deep.equal({ the: 'data' })
    })

    it('can specify method', async () => {
      nock('http://api.com')
      .post('/')
      .reply(200)

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

      await request({
        url: 'http://api.com',
        params: {
          query: 'value',
        },
      })
    })

    it('can include query params that are arrays', async () => {
      nock('http://api.com')
      .get('/?query=value1&query=value2')
      .reply(200)

      await request({
        url: 'http://api.com',
        params: {
          query: ['value1', 'value2'],
        },
      })
    })

    it('can include body', async () => {
      nock('http://api.com')
      .post('/', { data: 'value' })
      .reply(200)

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

      await expect(request({
        url: 'http://api.com',
      })).rejects.toThrowError('request failed')
    })

    it('adds callStack to error object', async () => {
      nock('http://api.com')
      .get('/')
      .replyWithError('request failed')

      try {
        await request({ url: 'http://api.com' })
        expect.fail('should have thrown')
      } catch (error: any) {
        expect(error.callStack).to.be.a('string')
        expect(error.callStack).to.include('request failed')
      }
    })
  })
})
