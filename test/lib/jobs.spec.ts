import { readJsonSync } from 'fs-extra'
import mockFs from 'mock-fs'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getBree,
  getEnabledBreeJobs,
  getJobFilePath,
  getJobsData,
  jobs,
  PersistentDataStructure,
  setBree,
  setJobsData,
  toBreeJob,
} from '../../lib/jobs'

function mockData (data: PersistentDataStructure | null) {
  mockFs({
    'data': {
      'jobs-data.json': JSON.stringify(data),
    },
  })
}

function mockError () {
  mockFs({
    'data': {},
  })
}

function getData () {
  return readJsonSync('./data/jobs-data.json')
}

describe('lib/jobs', () => {
  afterEach(() => {
    mockFs.restore()
    setBree(undefined)
  })

  describe('#getJobFilePath', () => {
    it('returns the full path to the job file', () => {
      expect(getJobFilePath('current-weather')).to.equal(`${process.cwd()}/jobs/current-weather.js`)
    })
  })

  describe('#toBreeJob', () => {
    it('converts job data to a bree job definition', () => {
      expect(toBreeJob({
        name: 'Current Weather',
        fileName: 'current-weather',
        enabled: true,
        interval: 'every 15 minutes',
      })).to.deep.equal({
        name: 'current-weather',
        path: getJobFilePath('current-weather'),
        interval: 'every 15 minutes',
      })
    })
  })

  describe('#getJobsData', () => {
    it('uses persisted enabled/interval state when present', async () => {
      mockData({
        jobs: [
          { name: 'Current Weather', fileName: 'current-weather', enabled: false, interval: 'every 5 minutes' },
        ],
      })

      const data = await getJobsData()

      expect(data.find(({ fileName }) => fileName === 'current-weather')).to.deep.equal({
        name: 'Current Weather',
        fileName: 'current-weather',
        enabled: false,
        interval: 'every 5 minutes',
      })
    })

    it('defaults to enabled and the default interval when no persisted data exists', async () => {
      mockData(null)

      const data = await getJobsData()

      expect(data).to.deep.equal(jobs.map((job) => ({
        name: job.name,
        fileName: job.fileName,
        enabled: true,
        interval: job.defaultInterval,
      })))
    })

    it('defaults to enabled and the default interval when the job is not persisted', async () => {
      mockData({ jobs: [] })

      const data = await getJobsData()

      expect(data).to.deep.equal(jobs.map((job) => ({
        name: job.name,
        fileName: job.fileName,
        enabled: true,
        interval: job.defaultInterval,
      })))
    })

    it('defaults to enabled and the default interval on error', async () => {
      mockError()

      const data = await getJobsData()

      expect(data).to.deep.equal(jobs.map((job) => ({
        name: job.name,
        fileName: job.fileName,
        enabled: true,
        interval: job.defaultInterval,
      })))
    })
  })

  describe('#setJobsData', () => {
    it('persists the jobs data', async () => {
      mockData({ jobs: [] })

      const newJobs = [
        { name: 'Current Weather', fileName: 'current-weather', enabled: false, interval: 'every 5 minutes' },
      ]

      await setJobsData(newJobs)

      expect(getData()).to.deep.equal({ jobs: newJobs })
    })
  })

  describe('#getEnabledBreeJobs', () => {
    it('returns bree job definitions for enabled jobs only', async () => {
      mockData({
        jobs: [
          { name: 'Current Weather', fileName: 'current-weather', enabled: false, interval: 'every 5 minutes' },
        ],
      })

      const breeJobs = await getEnabledBreeJobs()

      expect(breeJobs.find(({ name }) => name === 'current-weather')).to.equal(undefined)
      expect(breeJobs.length).to.equal(jobs.length - 1)
    })
  })

  describe('#setBree / #getBree', () => {
    it('sets and gets the bree instance', () => {
      expect(getBree()).to.equal(undefined)

      const bree = {} as any

      setBree(bree)

      expect(getBree()).to.equal(bree)
    })
  })
})
