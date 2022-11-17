import { getDoc } from './firebase'

interface MetaData {
  lastUpdated: string
}

export async function getMetaData (): Promise<MetaData> {
  return (await getDoc('meta/data')) as MetaData
}
