import {
  EditableShowProps,
  FullShowProps,
  Show,
  ShowProps,
  UserShow,
} from '../models/show'
import { getEpisodesForShow } from '../source/episodes'
import type { SearchResultShow } from '../source/shows'
import {
  addCollectionToDoc,
  addDoc,
  deleteDoc,
  getCollection,
  getDoc,
  getSubCollections,
  updateDoc,
} from './firebase'
import type { User } from './users'

export async function getShows (user: User): Promise<UserShow[]> {
  const showData = await getCollection<ShowProps>('shows')
  const showsForUser = showData.filter((showDatum) => {
    return !!showDatum.users[user.id]
  })
  const showsWithEpisodes = await getSubCollections<ShowProps, FullShowProps>(showsForUser, 'shows', 'episodes')

  return showsWithEpisodes.map((showDatum) => {
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
