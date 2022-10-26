import fs from 'fs-extra'

// In production, this is mounted with dokku's persistent storage
// https://github.com/dokku/dokku/blob/master/docs/advanced-usage/persistent-storage.md
const basePath = process.env.NODE_ENV === 'development' ? './data' : '/storage'

export type GarageState = 'open' | 'closed' | 'unknown'

interface PersistentDataStructure {
  left?: GarageState
  leftPrevious?: GarageState
  notifyOnOpen?: boolean
  right?: GarageState
  rightPrevious?: GarageState
  storeNames?: { [key: string]: string[] }
}

export class PersistentData {
  dataPath: string

  constructor (name: string) {
    this.dataPath = `${basePath}/${name}.json`
  }

  get (): Promise<PersistentDataStructure> {
    return fs.readJSON(this.dataPath) || {}
  }

  set (newData: Partial<PersistentDataStructure>) {
    return fs.outputJSON(this.dataPath, newData, { spaces: 2 })
  }
}
