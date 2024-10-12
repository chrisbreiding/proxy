import type { firestore } from 'firebase-admin'
import { getDoc } from '../../util/firebase'

interface MetaData {
  lastUpdated: string
}

export async function getMetaData (db: firestore.Firestore): Promise<MetaData> {
  return (await getDoc(db, 'meta/data')) as MetaData
}
