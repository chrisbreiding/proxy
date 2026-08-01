import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { makeRequest } from '../../../../lib/notion/util/requests'

function nockNotionPath (path: string) {
  return nock('https://api.notion.com')
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', '2025-09-03')
  .get(`/v1/${path}`)
}

describe('lib/notion/util/requests', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  describe('#makeRequest', () => {
    it('makes a GET request by default, returning the data', async () => {
      nockNotionPath('blocks/block-id').reply(200, { the: 'data' })

      expect(await makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).to.deep.equal({ the: 'data' })
    })

    it('can specify the method and body', async () => {
      nock('https://api.notion.com')
      .patch('/v1/blocks/block-id/children', { children: [] })
      .reply(200, { the: 'data' })

      expect(await makeRequest({
        body: { children: [] },
        method: 'patch',
        notionToken: 'notion-token',
        path: 'blocks/block-id/children',
      })).to.deep.equal({ the: 'data' })
    })

    it('retries after the Retry-After value when rate limited (429)', async () => {
      nockNotionPath('blocks/block-id')
      .reply(429, { code: 'rate_limited' }, { 'retry-after': '0' })

      nockNotionPath('blocks/block-id').reply(200, { the: 'data' })

      expect(await makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).to.deep.equal({ the: 'data' })

      expect(nock.isDone()).to.equal(true)
    })

    it('retries after the Retry-After value when service is overloaded (529)', async () => {
      nockNotionPath('blocks/block-id')
      .reply(529, { code: 'service_overload' }, { 'retry-after': '0' })

      nockNotionPath('blocks/block-id').reply(200, { the: 'data' })

      expect(await makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).to.deep.equal({ the: 'data' })

      expect(nock.isDone()).to.equal(true)
    })

    it('defaults to retrying after 1 second when Retry-After is not a number', async () => {
      nockNotionPath('blocks/block-id')
      .reply(429, { code: 'rate_limited' }, { 'retry-after': 'soon' })

      nockNotionPath('blocks/block-id').reply(200, { the: 'data' })

      expect(await makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).to.deep.equal({ the: 'data' })

      expect(nock.isDone()).to.equal(true)
    })

    it('defaults to retrying after 1 second when there are no response headers', async () => {
      const error = new Error('rate limited') as Error & { response: object }

      error.response = { status: 429 }

      nockNotionPath('blocks/block-id').replyWithError(error)
      nockNotionPath('blocks/block-id').reply(200, { the: 'data' })

      expect(await makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).to.deep.equal({ the: 'data' })

      expect(nock.isDone()).to.equal(true)
    })

    it('throws once the retries are exhausted', async () => {
      nockNotionPath('blocks/block-id')
      .times(6)
      .reply(429, { code: 'rate_limited' }, { 'retry-after': '0' })

      await expect(makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).rejects.toThrowError('Request failed with status code 429')

      expect(nock.isDone()).to.equal(true)
    })

    it('throws immediately for non-retryable statuses', async () => {
      nockNotionPath('blocks/block-id').reply(400, { code: 'validation_error' })

      await expect(makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).rejects.toThrowError('Request failed with status code 400')

      expect(nock.isDone()).to.equal(true)
    })

    it('throws immediately when the error has no response', async () => {
      nockNotionPath('blocks/block-id').replyWithError('request failed')

      await expect(makeRequest({
        notionToken: 'notion-token',
        path: 'blocks/block-id',
      })).rejects.toThrowError('request failed')

      expect(nock.isDone()).to.equal(true)
    })
  })
})
