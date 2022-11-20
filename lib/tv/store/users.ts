import { getDoc, getDocWhere, updateDoc } from './firebase'

export interface User {
  apiKey: string
  hideSpecialEpisodes: boolean
  hideTBAEpisodes: 'ALL' | 'NONE'
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

type UserSettings = Pick<User, 'hideSpecialEpisodes' | 'hideTBAEpisodes' | 'searchLinks'>

export async function updateUser (id: string, value: UserSettings): Promise<User | undefined> {
  await updateDoc(`users/${id}`, value)

  return getDoc<User>(`users/${id}`)
}
