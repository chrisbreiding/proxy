import path from 'path'
import { outputJSON, readJSON } from 'fs-extra'

// In production, this is mounted with dokku's persistent storage
// https://github.com/dokku/dokku/blob/master/docs/advanced-usage/persistent-storage.md
/* c8 ignore next */
export const basePath = process.env.NODE_ENV === 'production' ? '/storage' : './data'

export class PersistentData<T> {
  dataPath: string

  constructor (name: string) {
    this.dataPath = path.join(basePath, `${name}.json`)
  }

  get (): Promise<T | undefined> {
    return readJSON(this.dataPath)
  }

  set (newData: Partial<T>) {
    return outputJSON(this.dataPath, newData, { spaces: 2 })
  }
}
