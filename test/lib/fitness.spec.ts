import mockFs from 'mock-fs'
import nock from 'nock'
import path from 'path'
import { afterAll, beforeEach, describe, it, vi } from 'vitest'
import { updateFitness } from '../../lib/fitness/fitness'
import { fixtureContents } from '../util'
import { block, getAppendBody, listResults, nockAppendBlockChildren, nockDeleteBlock, nockGetBlockChildren, snapshotAppendChildren } from './notion/util'
import type { PersistentDataStructure } from '../../lib/fitness/cache'

function mockPersistentData (data: PersistentDataStructure | null) {
  mockFs({
    'data': {
      'fitness-data.json': JSON.stringify(data),
    },
    'test': {
      'fixtures': {
        'fitness': {
          'challenge-details.json': mockFs.load(path.resolve(process.cwd(), 'test/fixtures/fitness/challenge-details.json')),
        },
      },
    },
  })
}

function nockFitness (currentScore?: number, transform?: (fitness: any) => any) {
  let data = fixtureContents('fitness/challenge-details')

  if (currentScore) {
    data.progress.currentScore = currentScore
  }

  if (transform) {
    data = transform(data)
  }

  nock('https://api.mapmyfitness.com')
  .get('/challenges/challenge/yvty2025/details')
  .matchHeader('authorization', 'Bearer mmf-token')
  .matchHeader('apiKey', 'mmf-api-key')
  .query({
    mmfUserId: 'mmf-user-id',
    timezone: 'America/New_York',
  })
  .reply(200, data)
}

function nockAndSnapshotDashboard () {
  nockGetBlockChildren('notion-fitness-id', { reply: { results: [] } })

  return snapshotAppendChildren({ id: 'notion-fitness-id' })
}

function nockDashboard () {
  nockGetBlockChildren('notion-fitness-id', { reply: { results: [] } })

  const scope = nockAppendBlockChildren({ id: 'notion-fitness-id' })

  return getAppendBody(scope)
}

describe('lib/fitness', () => {
  const props = {
    isDryRun: false,
    mmfToken: 'mmf-token',
    mmfApiKey: 'mmf-api-key',
    mmfUserId: 'mmf-user-id',
    notionToken: 'notion-token',
    notionFitnessId: 'notion-fitness-id',
  }

  beforeEach(() => {
    vi.setSystemTime(new Date(2025, 0, 7))
    mockPersistentData(null)
  })

  afterAll(() => {
    mockFs.restore()
  })

  it('display fitness breakdown and stats', async () => {
    nockFitness(11770)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('shows a different message if ahead for today', async () => {
    nockFitness(32000)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('shows a different message if ahead for the week', async () => {
    vi.setSystemTime(new Date(2025, 0, 6))
    nockFitness(35000)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles Sunday when behind', async () => {
    vi.setSystemTime(new Date(2025, 0, 12))
    nockFitness(20000)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles Sunday when ahead', async () => {
    vi.setSystemTime(new Date(2025, 0, 12))
    nockFitness(35315)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles pluralization when ahead for today and for the week', async () => {
    vi.setSystemTime(new Date(2025, 0, 12))
    nockFitness(34000)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles pluralization when behind for today', async () => {
    vi.setSystemTime(new Date(2025, 0, 8))
    nockFitness(18051)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles pluralization when behind for the week', async () => {
    nockFitness(33000)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles stats not being defined', async () => {
    nockFitness(20000, (data) => {
      data.stats = []
      return data
    })

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles the challenge being completed', async () => {
    vi.setSystemTime(new Date(2025, 11, 28))
    nockFitness(1808700)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('handles the year being over', async () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    nockFitness(34100)

    const snapshot = nockAndSnapshotDashboard()

    await updateFitness(props)

    await snapshot
  })

  it('does not update notion if the challenge details have not changed and it is the same day', async () => {
    vi.setSystemTime(new Date(2025, 1, 10))
    nockFitness()
    nockDashboard()

    await updateFitness(props)

    vi.setSystemTime(new Date(2025, 1, 10))
    nockFitness()

    // causes nock to throw on any request
    nock.disableNetConnect()

    // nock will throw an error if the request is made, otherwise this will pass
    await updateFitness(props)
  })

  it('updates notion if the challenge details have changed', async () => {
    nockFitness(34100)
    nockDashboard()

    await updateFitness(props)

    nockFitness(34101)
    const requestMade = nockDashboard()

    await updateFitness(props)

    await requestMade
  })

  it('updates notion if it is a new day', async () => {
    vi.setSystemTime(new Date(2025, 1, 20))

    nockFitness()
    nockDashboard()

    await updateFitness(props)

    vi.setSystemTime(new Date(2025, 1, 21))
    nockFitness()
    const requestMade = nockDashboard()

    await updateFitness(props)

    await requestMade
  })

  it('deletes existing blocks', async () => {
    nockFitness(34100)
    nockGetBlockChildren('notion-fitness-id', { reply: listResults([
      block.p({ id: 'existing-block-id', text: 'existing block' }),
    ]) })
    nockDeleteBlock('existing-block-id')
    nockAppendBlockChildren({ id: 'notion-fitness-id' })

    await updateFitness(props)
  })

  it('does not make notion updates if a dry run', async () => {
    nockFitness(34100)

    await updateFitness({ ...props, isDryRun: true })
  })
})
