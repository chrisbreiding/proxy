import { Episode, getEpisodesForShow } from '../source/episodes'
import type { SearchResultShow } from '../source/shows'
import {
  addCollectionToDoc,
  addDoc,
  deleteDoc,
  getCollection,
  getDoc,
  updateDoc,
} from './firebase'
import type { User } from './users'

interface UserShow {
  displayName: string
  episodes: Episode[]
  fileName: string
  id: string
  poster?: string
  searchName: string
  status: SearchResultShow['status']
}

interface EditableShowProps {
  displayName: string
  fileName: string
  searchName: string
}

interface ShowProps {
  id: string
  name: string
  poster?: string
  status: SearchResultShow['status']
  users: {
    [key: string]: EditableShowProps
  }
}

interface FullShowProps extends ShowProps {
  episodes: Episode[]
}

export class Show implements ShowProps {
  id: string
  name: string
  poster?: string
  status: SearchResultShow['status']
  users: {
    [key: string]: EditableShowProps
  }

  static fromSourceShow (sourceShow: SearchResultShow, user: User) {
    return new Show({
      id: sourceShow.id,
      name: sourceShow.name,
      poster: sourceShow.poster,
      status: sourceShow.status,
      users: {
        [user.id]: {
          displayName: sourceShow.name,
          fileName: sourceShow.name,
          searchName: sourceShow.name,
        },
      },
    })
  }

  static forUser (showData: FullShowProps, user: User): UserShow {
    const userData = showData.users[user.id] || {}

    return {
      episodes: showData.episodes,
      id: showData.id,
      poster: showData.poster,
      status: showData.status,
      displayName: userData.displayName,
      fileName: userData.fileName,
      searchName: userData.searchName,
    }
  }

  constructor (props: ShowProps) {
    this.id = props.id
    this.name = props.name
    this.poster = props.poster
    this.status = props.status
    this.users = props.users
  }

  serialize () {
    return {
      id: this.id,
      name: this.name,
      poster: this.poster,
      status: this.status,
      users: this.users,
    }
  }

  addUser (user: User) {
    this.users[user.id] = {
      displayName: this.name,
      fileName: this.name,
      searchName: this.name,
    }
  }

  updateUser (user: User, props: EditableShowProps) {
    this.users[user.id] = props
  }
}

export async function getShows (user: User): Promise<UserShow[]> {
  const showData = await getCollection<FullShowProps>('shows')

  // TODO: optimize so that all episodes aren't
  // retrieved before getting episodes

  return showData
  .filter((showDatum) => {
    return !!showDatum.users[user.id]
  })
  .map((showDatum) => {
    return Show.forUser(showDatum, user)
  })
}

export async function addShow (sourceShow: SearchResultShow, user: User): Promise<Show | undefined> {
  const showDatum = await getDoc<ShowProps>(`shows/${sourceShow.id}`)

  // show does not exist in firebase
  // get it from TheTVDB, save it, and add to user
  if (!showDatum) {
    const episodes = await getEpisodesForShow(sourceShow.id)
    const show = Show.fromSourceShow(sourceShow, user)

    await addDoc(`shows/${show.id}`, show.serialize())
    await addCollectionToDoc(`shows/${show.id}/episodes`, episodes)

    return show
  }

  const show = new Show(showDatum)

  // show already has user
  if (show.users[user.id]) {
    return
  }

  // show exists in firebase, add user to it
  show.addUser(user)
  await updateDoc(`shows/${show.id}`, { users: show.users })

  return show
}

export async function updateShow (id: string, showUpdate: EditableShowProps, user: User) {
  const showDatum = await getDoc<ShowProps>(`shows/${id}`)

  if (!showDatum) return

  const show = new Show(showDatum)

  show.updateUser(user, showUpdate)
  await updateDoc(`shows/${id}`, show)

  return show
}

export async function deleteShow (id: string, user: User) {
  const showDatum = await getDoc<ShowProps>(`shows/${id}`)

  if (!showDatum?.users[user.id]) {
    return
  }

  delete showDatum?.users[user.id]

  if (Object.keys(showDatum.users).length) {
    await updateDoc(`shows/${id}`, showDatum.users)
  } else {
    await deleteDoc(`shows/${id}`)
  }
}
