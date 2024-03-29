import { debugVerbose } from '../../util/debug'
import {
  EditableShowProps,
  Show,
  ShowProps,
  UserShow,
} from '../models/show'
import { Episode, getEpisodesForShow } from '../source/episodes'
import { getShowById, SearchResultShow } from '../source/shows'
import {
  addDoc,
  deleteDoc,
  getCollection,
  getDoc,
  updateDoc,
} from './firebase'
import type { User } from './users'

export async function getShows (): Promise<ShowProps[]> {
  return getCollection<ShowProps>('shows')
}

async function getEpisodes (showId: string) {
  const { episodes } = (await getDoc<AllEpisodes>(`shows/${showId}/episodes/all`)) || { episodes: [] }

  return episodes
}

export async function getShowsWithEpisodesForUser (user: User): Promise<UserShow[]> {
  const showData = await getCollection<ShowProps>('shows')
  const showsForUser = showData.filter((showDatum) => {
    return !!showDatum.users[user.id]
  })

  return Promise.all(showsForUser.map(async (showDatum) => {
    const episodes = await getEpisodes(showDatum.id)

    return Show.forUser({ ...showDatum, episodes }, user)
  }))
}

interface AllEpisodes {
  episodes: Episode[]
}

export async function addShow (showToAdd: SearchResultShow, user: User): Promise<UserShow | undefined> {
  const showDatum = await getDoc<ShowProps>(`shows/${showToAdd.id}`)

  // show does not exist in firebase
  // get it from TheTVDB, save it, and add to user
  if (!showDatum) {
    const sourceShow = await getShowById(showToAdd.id)
    const episodes = await getEpisodesForShow(sourceShow.id)
    const show = Show.fromSourceShow(sourceShow, user)

    // sometimes the source show doesn't have the network even though
    // the search result show does
    show.network ||= showToAdd.network

    await addDoc(`shows/${show.id}`, show.serialize())
    await addDoc(`shows/${show.id}/episodes/all`, { episodes })

    return Show.forUser({ ...show, episodes }, user)
  }

  const show = new Show(showDatum)

  // show already has user
  if (show.users[user.id]) {
    return
  }

  // show exists in firebase, add user to it
  show.addUser(user)
  await updateDoc(`shows/${show.id}`, { users: show.users })

  const episodes = await getEpisodes(show.id)

  return Show.forUser({ ...show, episodes }, user)
}

export async function updateShow (id: string, showUpdate: EditableShowProps, user: User) {
  const showDatum = await getDoc<ShowProps>(`shows/${id}`)

  if (!showDatum) return

  const show = new Show(showDatum)

  show.updateUser(user, showUpdate)
  await updateDoc(`shows/${id}`, { users: show.users })

  return show
}

export async function deleteShow (id: string, user: User) {
  const showDatum = await getDoc<ShowProps>(`shows/${id}`)

  if (!showDatum?.users[user.id]) {
    debugVerbose('Could not find show to delete: %s', id)
    return
  }

  delete showDatum?.users[user.id]

  if (Object.keys(showDatum.users).length) {
    debugVerbose('Remove user \'%s\' from show with id: %s', user.username, id)
    await updateDoc(`shows/${id}`, showDatum.users)
  } else {
    debugVerbose('Delete show with id: %s', id)
    await deleteDoc(`shows/${id}/episodes/all`)
    await deleteDoc(`shows/${id}`)
  }
}
