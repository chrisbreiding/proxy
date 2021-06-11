const { v4: uuid } = require('uuid')
const debug = require('debug')('proxy:shopping')

const PersistentData = require('../util/persistent-data')
const { getData } = require('./data')

const notionToken = process.env.NOTION_TOKEN
const persistentData = PersistentData.create('notion-data')

const getText = (hasText) => {
  if (!hasText) return

  return hasText.text
  .map(({ plain_text }) => plain_text)
  .join('')
  .trim()
}

const getStoresForPage = async ({ notionPageId }) => {
  const result = await getData({ notionToken, notionPageId })
  const persistedData = await persistentData.get()
  const persistedStores = persistedData.stores || {}

  return result.results.reduce((memo, block) => {
    const text = getText(block.paragraph)

    if (block.type === 'paragraph' && text) {
      memo.push({
        id: block.id,
        parentId: notionPageId,
        name: text,
        items: persistedStores[block.id] || [],
      })
    }

    return memo
  }, [])
}

const getStores = async () => {
  const categoryNames = process.env.NOTION_LIST_IDS.split('|')

  try {
    const categories = await Promise.all(categoryNames.map(async (categoryString) => {
      const [category, pageIdsString] = categoryString.split(':')
      const pageIds = pageIdsString.split(',')

      const listOfStores = await Promise.all(pageIds.map(async (notionPageId) => {
        return getStoresForPage({ notionPageId })
      }))

      return {
        id: category,
        name: category,
        stores: listOfStores.flat(),
      }
    }))

    return categories
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
    const result = await getData({ notionToken, notionPageId: parentId })

    const items = result.results.reduce((memo, block) => {
      if (memo.finished) return memo

      if (block.id === storeId) {
        memo.started = true

        return memo
      }

      if (memo.started && block.type === 'to_do') {
        memo.items.push({
          id: block.id,
          name: getText(block.to_do),
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

    const stores = await getStores()

    // stores.error = {
    //   name: 'Error',
    //   message: 'Stores error',
    //   stack: 'Stack',
    //   reason: 'stores',
    // }

    if (stores.error) {
      socket.emit('stores:error', JSON.stringify(stores.error))

      return
    }

    debug('emit stores: %o', stores)

    socket.emit('stores', JSON.stringify(stores))
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
    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

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
    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'all' })
  })

  socket.on('update:item', async ({ storeId, item }) => {
    debug('on update:item: %o', { socketId: socket.id, storeId, item })

    const persistedData = await persistentData.get()
    const index = persistedData.stores[storeId].findIndex((i) => i.id === item.id)

    if (index < 0) return

    persistedData.stores[storeId][index] = item
    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'others' })
  })

  socket.on('update:items', async ({ storeId, items }) => {
    debug('on update:items: %o', { socketId: socket.id, storeId, items: items.map((item) => item.id) })

    const persistedData = await persistentData.get()

    persistedData.stores[storeId] = items
    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'others' })
  })

  socket.on('delete:item', async ({ storeId, itemId }) => {
    debug('on delete:item: %o', { socketId: socket.id, storeId, itemId })

    const persistedData = await persistentData.get()
    const index = persistedData.stores[storeId].findIndex((i) => i.id === itemId)

    if (index < 0) return

    persistedData.stores[storeId].splice(index, 1)
    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'others' })
  })
}

module.exports = {
  getStores,
  onSocket,
}
