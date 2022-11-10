import { getDocWhere } from './firebase'

export interface User {
  apiKey: string
  id: string
  searchLinks: {
    name: string
    link: string
  }[]
  username: string
}

export async function getUserByApiKey (apiKey: string): Promise<User | undefined> {
  return getDocWhere<User>('users', ['apiKey', '==', apiKey])
}
