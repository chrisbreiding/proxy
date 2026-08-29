import type Bree from 'bree'
import path from 'path'

import { debug } from './util/debug'
import { PersistentData } from './util/persistent-data'

export const jobs = [
  {
    name: 'Current Weather',
    fileName: 'current-weather',
    defaultInterval: 'every 15 minutes',
  },
  {
    name: 'Upcoming Weather',
    fileName: 'upcoming-weather',
    defaultInterval: 'every 60 minutes starting on the 22nd minute',
  },
  {
    name: 'Restaurants Last Visit',
    fileName: 'restaurants-last-visit',
    defaultInterval: 'at 1:07 am',
  },
  {
    name: 'TV Episodes',
    fileName: 'tv-episodes',
    defaultInterval: 'at 2:07 am',
  },
  {
    name: 'Word of the Week',
    fileName: 'word-of-the-week',
    defaultInterval: 'at 3:07 am',
  },
  {
    name: 'Softball Leagues',
    fileName: 'softball-leagues',
    defaultInterval: 'at 4:07 am',
  },
]

export interface JobData {
  name: string
  fileName: string
  enabled: boolean
  interval: string
}

export interface PersistentDataStructure {
  jobs: JobData[]
}

const persistentData = new PersistentData<PersistentDataStructure>('jobs-data')

// bree runs the job files as worker threads, so it needs their full path
export function getJobFilePath (fileName: string) {
  return path.join(process.cwd(), 'jobs', `${fileName}.js`)
}

export function toBreeJob (job: JobData) {
  return {
    name: job.fileName,
    path: getJobFilePath(job.fileName),
    interval: job.interval,
  }
}

async function getPersistedJobs () {
  try {
    const data = await persistentData.get()

    return data?.jobs || []
  } catch (error: any) {
    /* v8 ignore next -- @preserve */
    debug('Getting jobs data errored:', error?.stack || error)

    return []
  }
}

// the jobs in lib/jobs are the source of truth for which jobs exist. the
// persisted data only supplies the interval / enabled state for each of them
export async function getJobsData (): Promise<JobData[]> {
  const persistedJobs = await getPersistedJobs()

  return jobs.map((job) => {
    const persisted = persistedJobs.find(({ fileName }) => fileName === job.fileName)

    return {
      name: job.name,
      fileName: job.fileName,
      enabled: persisted ? persisted.enabled !== false : true,
      interval: persisted?.interval || job.defaultInterval,
    }
  })
}

export function setJobsData (jobsData: JobData[]) {
  return persistentData.set({ jobs: jobsData })
}

export async function getEnabledBreeJobs () {
  const jobsData = await getJobsData()

  return jobsData.filter(({ enabled }) => enabled).map(toBreeJob)
}

let bree: Bree | undefined

export function setBree (instance: Bree | undefined) {
  bree = instance
}

export function getBree () {
  return bree
}
