const { v4: uuid } = require('uuid')
const debug = require('debug')('proxy:shopping')

const PersistentData = require('../util/persistent-data')
const { getBlockChildren, getPlainText } = require('./util')

const notionToken = process.env.NOTION_TOKEN
const persistentData = PersistentData.create('notion-data')

const makeStoreIndex = (categories) => {
  return categories
  .map(({ stores }) => stores)
  .flat()
  .reduce((memo, store) => {
    memo[store.id] = store.items

    return memo
  }, {})
}

const getStoreNames = (categories) => {
  return categories
  .map(({ storesData }) => storesData)
  .flat()
  .reduce((memo, { notionPageId, storeNames }) => {
    memo[notionPageId] = storeNames

    return memo
  }, {})
}

// if you prepend an item in notion, it will take the previous first item's
// id and the previous first item gets a new id. if that happens, take the
// safer route of throwing out and replacing all persisted items. but only
// do it if the stores have changed.
const getStoresForPage = async ({ notionPageId }) => {
  const result = await getBlockChildren({ notionToken, pageId: notionPageId })
  const persistedData = await persistentData.get()
  const persistedStores = persistedData.stores || {}

  // gather up both the latest items and the persisted items, until it can
  // be determined whether the store names changed
  const { withLatestItems, withPersistedItems } = result.results.reduce((memo, block) => {
    const text = getPlainText(block.paragraph)

    if (block.type === 'paragraph' && text) {
      const store = {
        id: block.id,
        parentId: notionPageId,
        name: text,
        items: [],
      }

      memo.withLatestItems.push(store)
      memo.withPersistedItems.push(Object.assign({}, store, {
        items: persistedStores[block.id] || [],
      }))
    }

    const lastLatestItem = memo.withLatestItems[memo.withLatestItems.length - 1]

    if (block.type === 'to_do' && lastLatestItem) {
      lastLatestItem.items.push({
        id: block.id,
        name: getPlainText(block.to_do),
        isChecked: block.to_do.checked,
      })
    }

    return memo
  }, { withLatestItems: [], withPersistedItems: [] })

  const persistedNames = (persistedData.storeNames || {})[notionPageId]
  const storeNames = withLatestItems.map((store) => store.name).join()

  // if store names have changed, use the latest/freshest data and replace
  // the persisted data. update store names for future comparison
  const stores = persistedNames === storeNames ? withPersistedItems : withLatestItems

  return {
    notionPageId,
    storeNames,
    stores,
  }
}

const getCategories = async () => {
  const categoryNames = process.env.NOTION_LIST_IDS.split('|')

  try {
    const categories = await Promise.all(categoryNames.map(async (categoryString) => {
      const [category, pageIdsString] = categoryString.split(':')
      const pageIds = pageIdsString.split(',')

      const storesData = await Promise.all(pageIds.map(async (notionPageId) => {
        return getStoresForPage({ notionPageId })
      }))

      return {
        id: category,
        name: category,
        storesData,
      }
    }))

    const storeNames = getStoreNames(categories)
    const persistedData = await persistentData.get()

    await persistentData.set(Object.assign(persistedData, { storeNames }))

    return categories.map(({ id, name, storesData }) => ({
      id,
      name,
      stores: storesData.map(({ stores }) => stores).flat(),
    }))
  } catch (error) {
    debug('error getting stores: %s', error.stack)

    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        reason: 'stores',
      },
    }
  }
}

const getStoreItems = async ({ storeId, parentId }) => {
  try {
    const result = await getBlockChildren({ notionToken, pageId: parentId })

    const items = result.results.reduce((memo, block) => {
      if (memo.finished) return memo

      if (block.id === storeId) {
        memo.started = true

        return memo
      }

      if (memo.started && block.type === 'to_do') {
        memo.items.push({
          id: block.id,
          name: getPlainText(block.to_do),
          isChecked: block.to_do.checked,
        })
      }

      if (memo.started && block.type !== 'to_do') {
        memo.finished = true
      }

      return memo
    }, { items: [], started: false, finished: false }).items

    return items
  } catch (error) {
    debug('error getting items: %s\n\n%o', error.stack, { storeId, parentId })

    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        reason: 'items',
      },
    }
  }
}

const sockets = {}

const broadcast = (message, data, options = {}) => {
  Object.keys(sockets)
  .filter((id) => {
    if (!options.without) return true

    return id !== options.without
  })
  .forEach((id) => {
    debug('emit %s: %o', message, { socketId: id, items: data })
    sockets[id].emit(message, data)
  })
}

const onSocket = (socket) => {
  debug('socket connection: %o', { socketId: socket.id })

  sockets[socket.id] = socket

  const sendItems = (storeId, items, options = {}) => {
    broadcast('items', { storeId, items: JSON.stringify(items) }, {
      without: options.to === 'others' ? socket.id : undefined,
    })
  }

  socket.on('disconnect', () => {
    debug('socket disconnect: %o', { socketId: socket.id })

    delete sockets[socket.id]
  })

  socket.on('get:stores', async () => {
    debug('on get:stores: %o', { socketId: socket.id })

    const categories = await getCategories()

    // categories.error = {
    //   name: 'Error',
    //   message: 'Stores error',
    //   stack: 'Stack',
    //   reason: 'stores',
    // }

    if (categories.error) {
      socket.emit('stores:error', JSON.stringify(categories.error))

      return
    }

    const persistedData = await persistentData.get()

    await persistentData.set(Object.assign(persistedData, {
      stores: makeStoreIndex(categories),
    }))

    debug('emit stores: %o', categories)

    socket.emit('stores', JSON.stringify(categories))
  })

  socket.on('sync:items', async ({ storeId, parentId }) => {
    debug('on sync:items: %o', { socketId: socket.id, storeId, parentId })

    const items = await getStoreItems({ storeId, parentId })

    // items.error = {
    //   name: 'Error',
    //   message: 'Items error',
    //   stack: 'Stack',
    //   reason: 'items',
    // }

    if (items.error) {
      socket.emit('items:error', JSON.stringify(items.error))

      return
    }

    const persistedData = await persistentData.get()

    persistedData.stores[storeId] = items

    await persistentData.set(Object.assign(persistedData, {
      stores: persistedData.stores,
    }))

    sendItems(storeId, items, { to: 'all' })
  })

  socket.on('add:item', async ({ storeId }) => {
    debug('on add:item: %o', { socketId: socket.id, storeId })

    const persistedData = await persistentData.get()

    persistedData.stores[storeId].push({
      id: uuid(),
      name: '',
      isChecked: false,
    })

    await persistentData.set(Object.assign(persistedData, {
      stores: persistedData.stores,
    }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'all' })
  })

  socket.on('update:item', async ({ storeId, item }) => {
    debug('on update:item: %o', { socketId: socket.id, storeId, item })

    const persistedData = await persistentData.get()
    const index = persistedData.stores[storeId].findIndex((i) => i.id === item.id)

    if (index < 0) return

    persistedData.stores[storeId][index] = item

    await persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'others' })
  })

  socket.on('update:items', async ({ storeId, items }) => {
    debug('on update:items: %o', { socketId: socket.id, storeId, items: items.map((item) => item.id) })

    const persistedData = await persistentData.get()

    persistedData.stores[storeId] = items

    await persistentData.set(Object.assign(persistedData, {
      stores: persistedData.stores,
    }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'others' })
  })

  socket.on('delete:item', async ({ storeId, itemId }) => {
    debug('on delete:item: %o', { socketId: socket.id, storeId, itemId })

    const persistedData = await persistentData.get()
    const index = persistedData.stores[storeId].findIndex((i) => i.id === itemId)

    if (index < 0) return

    persistedData.stores[storeId].splice(index, 1)

    await persistentData.set(Object.assign(persistedData, {
      stores: persistedData.stores,
    }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'others' })
  })
}

module.exports = {
  onSocket,
}
