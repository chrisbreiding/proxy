import type { firestore } from 'firebase-admin'
import { getDoc, getDocWhere, updateDoc } from '../../util/firebase'

export interface User {
  apiKey: string
  hideSpecialEpisodes: boolean
  hideTBAEpisodes: 'ALL' | 'NONE'
  id: string
  isAdmin: boolean
  searchLinks: {
    name: string
    showLink: string
    episodeLink: string
  }[]
  username: string
}

export async function getUserByApiKey (db: firestore.Firestore, apiKey: string): Promise<User | undefined> {
  return getDocWhere<User>(db, 'users', ['apiKey', '==', apiKey])
}

export async function getUser (db: firestore.Firestore, id: string): Promise<User | undefined> {
  return getDoc<User>(db, `users/${id}`)
}

type UserSettings = Pick<User, 'hideSpecialEpisodes' | 'hideTBAEpisodes' | 'searchLinks'>

export async function updateUser (db: firestore.Firestore, id: string, value: UserSettings): Promise<User | undefined> {
  await updateDoc(db, `users/${id}`, value)

  return getDoc<User>(db, `users/${id}`)
}
