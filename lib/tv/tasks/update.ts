import dayjs from 'dayjs'
import type { firestore } from 'firebase-admin'
import { debug } from '../../util/debug'
import type { ShowProps } from '../models/show'
import { getEpisodesForShow } from '../source/episodes'
import { getShowsByIds, SearchResultShow } from '../source/shows'
import { initializeApp, setDoc, updateDoc } from '../../util/firebase'
import { getShows } from '../store/shows'

async function getOngoingShows (db: firestore.Firestore): Promise<SearchResultShow[]> {
  const ongoingStoreShows = (await getShows(db)).filter((show: ShowProps) => {
    return show.status !== 'Ended'
  })

  return getShowsByIds(ongoingStoreShows.map((show) => show.id))
}

export async function updateShowsAndEpisodes (db: firestore.Firestore) {
  const ongoingShows = await getOngoingShows(db)
  const currentDateTime = dayjs().toISOString()

  for (const show of ongoingShows) {
    debug('Update show - name: %s, id: %s', show.name, show.id)

    // if the show has any episode updates, overwrite all the episodes
    // with newly sourced ones
    const episodes = await getEpisodesForShow(show.id)

    await setDoc(db, `shows/${show.id}/episodes/all`, { episodes })

    await updateDoc(db, `shows/${show.id}`, {
      poster: show.poster,
      status: show.status,
      lastUpdated: currentDateTime,
    })
  }

  await updateDoc(db, 'meta/data', {
    error: null,
    lastUpdated: currentDateTime,
  })
}

/* v8 ignore next 25 -- @preserve */
export default async function main () {
  let db: firestore.Firestore | undefined

  try {
    debug('Updating shows and episodes...')

    db = initializeApp('tv')

    await updateShowsAndEpisodes(db)
  } catch (error: any) {
    debug('Updating shows and episodes failed:')
    debug(error?.stack || error)

    if (db) {
      await updateDoc(db, 'meta/data', {
        error: {
          message: error?.message || error,
          stack: error?.stack,
          date: dayjs().toISOString(),
        },
      })
    }

    throw error
  }
}
