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

    return Object.assign(doc.data()!, {
      id: doc.id,
    }) as T
  }))
}

export async function getCollection<T> (collectionName: string): Promise<T[]> {
  if (!db) return []

  const snapshot = await db.collection(collectionName).get()

  return getDataFromSnapshot<T>(snapshot)
}

interface Identifiable {
  id: string
}

export async function getSubCollections<T extends Identifiable, U> (data: T[], collection1Name: string, collection2Name: string): Promise<U[]> {
  if (!db) return []

  return Promise.all(data.map(async (datum: T) => {
    const snapshot = await db.collection(`${collection1Name}/${datum.id}/${collection2Name}`).get()

    const collections = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
      return (await docSnapshot.ref.get()).data()!
    }))

    return Object.assign(datum, {
      [collection2Name]: collections,
    }) as U
  }))
}

export async function getDoc<T> (docPath: string): Promise<T | undefined> {
  if (!db) return

  const doc = await db.doc(docPath).get()

  return doc.data() as T
}

type Condition = [string, admin.firestore.WhereFilterOp, any]

export async function getDocWhere<T> (collectionName: string, condition: Condition): Promise<T | undefined> {
  if (!db) return

  const [fieldPath, opStr, value] = condition
  const snapshot = await db.collection(collectionName).where(fieldPath, opStr, value).get()

  if (snapshot.empty) {
    return
  }

  return (await getDataFromSnapshot<T>(snapshot))[0]
}

export async function addDoc (docPath: string, value: any) {
  if (!db) return

  await db.doc(docPath).set(value)
}

export async function addCollectionToDoc (collectionPath: string, values: any[]) {
  if (!db) return

  const batch = db.batch()

  values.forEach((value) => {
    const docRef = db.collection(collectionPath).doc(value.id)
    batch.set(docRef, value)
  })

  await batch.commit()
}

export async function updateDoc (docPath: string, value: any) {
  if (!db) return

  await db.doc(docPath).update(value)
}

export async function deleteDoc (docPath: string) {
  if (!db) return

  await db.doc(docPath).delete()
}

type Query = admin.firestore.Query<admin.firestore.DocumentData>

async function deleteQueryBatch (db: admin.firestore.Firestore, query: Query, resolve: (value?: unknown) => void) {
  const snapshot = await query.get()

  if (snapshot.size === 0) {
    return resolve()
  }

  const batch = db.batch()
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })
  await batch.commit()

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve)
  })
}

export async function deleteCollection (collectionPath: string, idProp: string) {
  if (!db) return

  const batchSize = 20
  const collectionRef = db.collection(collectionPath)
  const query = collectionRef.orderBy(idProp).limit(batchSize)

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject)
  })
}
