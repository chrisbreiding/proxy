import admin from 'firebase-admin'
import { readJsonSync } from 'fs-extra'
import path from 'path'

import { getEnv } from '../../util/env'
import { basePath } from '../../util/persistent-data'

function initializeApp () {
  const serviceAccount = readJsonSync(path.join(basePath, 'firebase-tv-credentials.json'), { throws: false })

  // this should only happen when testing
  if (!serviceAccount) return

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: getEnv('FIREBASE_TV_DATABASE_URL'),
  })

  const db = admin.firestore()

  db.settings({ ignoreUndefinedProperties: true })

  return db
}

const db = initializeApp()

type Snapshot = admin.firestore.QuerySnapshot<admin.firestore.DocumentData>

function getDataFromSnapshot<T> (snapshot: Snapshot): Promise<T[]> {
  return Promise.all(snapshot.docs.map(async (docSnapshot) => {
    const doc = await docSnapshot.ref.get()
    const collectionRefs = await docSnapshot.ref.listCollections()

    const collectionPairs = await Promise.all(collectionRefs.map(async (collectionRef) => {
      const snapshot = await docSnapshot.ref.collection(collectionRef.id).get()

      const data = await getDataFromSnapshot<any>(snapshot)

      return [collectionRef.id, data]
    })) as [string, any[]][]

    const collections = collectionPairs.reduce((memo, [name, collection]) => {
      return {
        ...memo,
        [name]: collection,
      }
    }, {})

    return Object.assign(doc.data()!, {
      id: doc.id,
      ...collections,
    }) as T
  }))
}

export async function getCollection<T> (collectionName: string): Promise<T[]> {
  const snapshot = await db.collection(collectionName).get()

  return getDataFromSnapshot<T>(snapshot)
}

export async function getDoc<T> (docPath: string): Promise<T> {
  const doc = await db.doc(docPath).get()

  return doc.data() as T
}

type Condition = [string, admin.firestore.WhereFilterOp, any]

export async function getDocWhere<T> (collectionName: string, condition: Condition): Promise<T | undefined> {
  const ref = db.collection(collectionName)
  const [fieldPath, opStr, value] = condition
  const snapshot = await ref.where(fieldPath, opStr, value).get()

  if (snapshot.empty) {
    return
  }

  return (await getDataFromSnapshot<T>(snapshot))[0]
}

export async function addDoc (docPath: string, value: any) {
  await db.doc(docPath).set(value)
}

export async function addCollectionToDoc (collectionPath: string, values: any[]) {
  const batch = db.batch()

  values.forEach((value) => {
    const docRef = db.collection(collectionPath).doc()
    batch.set(docRef, value)
  })

  await batch.commit()
}

export async function updateDoc (docPath: string, value: any) {
  await db.doc(docPath).update(value)
}

export async function deleteDoc (docPath: string) {
  await db.doc(docPath).delete()
}
