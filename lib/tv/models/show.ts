import type { Episode } from '../source/episodes'
import type { SearchResultShow, Status } from '../source/shows'
import type { User } from '../store/users'

export interface UserShow {
  displayName: string
  episodes: Episode[]
  fileName: string
  id: string
  lastUpdated?: string
  network?: string
  poster?: string
  searchName: string
  status: Status
}

export interface EditableShowProps {
  displayName: string
  fileName: string
  searchName: string
}

export interface ShowProps {
  id: string
  lastUpdated?: string
  name: string
  network?: string
  poster?: string
  status: Status
  users: {
    [key: string]: EditableShowProps
  }
}

export interface FullShowProps extends ShowProps {
  episodes: Episode[]
}

export class Show implements ShowProps {
  id: string
  lastUpdated?: string
  name: string
  network?: string
  poster?: string
  status: Status
  users: {
    [key: string]: EditableShowProps
  }

  static fromSourceShow (sourceShow: SearchResultShow, user: User) {
    return new Show({
      id: sourceShow.id,
      name: sourceShow.name,
      network: sourceShow.network,
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
    const userData = showData.users[user.id]

    return {
      episodes: showData.episodes,
      id: showData.id,
      lastUpdated: showData.lastUpdated,
      network: showData.network,
      poster: showData.poster,
      status: showData.status,
      displayName: userData.displayName,
      fileName: userData.fileName,
      searchName: userData.searchName,
    }
  }

  constructor (props: ShowProps) {
    this.id = props.id
    this.lastUpdated = props.lastUpdated
    this.name = props.name
    this.network = props.network
    this.poster = props.poster
    this.status = props.status
    this.users = props.users
  }

  serialize () {
    return {
      id: this.id,
      lastUpdated: this.lastUpdated,
      name: this.name,
      network: this.network,
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
  // don't understand why this fails coverage
  /* c8 ignore next */
}
