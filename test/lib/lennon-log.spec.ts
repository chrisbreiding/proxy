import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startServer } from '../../index'
import { appendRow } from '../../lib/util/google-sheets'
import { handleServer } from '../util'

vi.mock('../../lib/util/google-sheets', () => {
  return {
    appendRow: vi.fn(),
    getAuthClient: vi.fn().mockReturnValue({}),
  }
})

describe('lib/lennon-log', () => {
  handleServer(startServer)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /lennon-log/:key', () => {
    const fixedTime = new Date('2026-06-06T22:18:08.000Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(fixedTime)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('appends a row to the configured sheet', async (ctx) => {
      const res = await ctx.request
      .post('/lennon-log/key')
      .send({ description: 'note' })

      expect(res.status).to.equal(200)
      expect(appendRow).toHaveBeenCalledWith({
        client: expect.any(Object),
        spreadsheetId: 'spreadsheet-id',
        range: 'Form!A:Z',
        values: [
          '6/6/2026 18:18:08',
          '6/6/2026',
          '6:18:08 pm',
          'note',
        ],
      })
    })

    it('allows a missing description', async (ctx) => {
      const res = await ctx.request
      .post('/lennon-log/key')
      .send({})

      expect(res.status).to.equal(200)
      expect(appendRow).toHaveBeenCalledWith({
        client: expect.any(Object),
        spreadsheetId: 'spreadsheet-id',
        range: 'Form!A:Z',
        values: [
          '6/6/2026 18:18:08',
          '6/6/2026',
          '6:18:08 pm',
          '',
        ],
      })
    })

    it('allows an empty description', async (ctx) => {
      const res = await ctx.request
      .post('/lennon-log/key')
      .send({ description: '' })

      expect(res.status).to.equal(200)
      expect(appendRow).toHaveBeenCalledWith({
        client: expect.any(Object),
        spreadsheetId: 'spreadsheet-id',
        range: 'Form!A:Z',
        values: [
          '6/6/2026 18:18:08',
          '6/6/2026',
          '6:18:08 pm',
          '',
        ],
      })
    })

    it('returns 403 with an invalid api key', async (ctx) => {
      const res = await ctx.request
      .post('/lennon-log/wrong-key')
      .send({ description: 'entry' })

      expect(res.status).to.equal(403)
      expect(appendRow).not.toHaveBeenCalled()
    })

    it('returns 500 when appendRow fails', async (ctx) => {
      (appendRow as Mock).mockRejectedValue(new Error('Sheets API error'))

      const res = await ctx.request
      .post('/lennon-log/key')
      .send({ description: 'entry' })

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'Sheets API error' })
    })
  })
})
