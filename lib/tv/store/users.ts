import { getDoc, getDocWhere, updateDoc } from './firebase'

export interface User {
  apiKey: string
  id: string
  searchLinks: {
    name: string
    showLink: string
    episodeLink: string
  }[]
  username: string
}

export async function getUserByApiKey (apiKey: string): Promise<User | undefined> {
  return getDocWhere<User>('users', ['apiKey', '==', apiKey])
}

export async function getUser (id: string): Promise<User | undefined> {
  return getDoc<User>(`users/${id}`)
}

export async function updateUser (id: string, value: { searchLinks: User['searchLinks'] }): Promise<User | undefined> {
  await updateDoc(`users/${id}`, value)

  return getDoc<User>(`users/${id}`)
}
