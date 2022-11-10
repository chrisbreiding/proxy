import { outputJSON, readJSON } from 'fs-extra'

// In production, this is mounted with dokku's persistent storage
// https://github.com/dokku/dokku/blob/master/docs/advanced-usage/persistent-storage.md
export const basePath = process.env.NODE_ENV === 'production' ? '/storage' : './data'

export type GarageState = 'open' | 'closed' | 'unknown'

export interface PersistentDataStructure {
  left?: GarageState
  notifyOnOpen?: boolean
  right?: GarageState
  storeNames?: { [key: string]: string[] }
}

export class PersistentData {
  dataPath: string

  constructor (name: string) {
    this.dataPath = `${basePath}/${name}.json`
  }

  get (): Promise<PersistentDataStructure | undefined> {
    return readJSON(this.dataPath)
  }

  set (newData: Partial<PersistentDataStructure>) {
    return outputJSON(this.dataPath, newData, { spaces: 2 })
  }
}
