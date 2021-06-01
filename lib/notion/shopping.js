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

  return result.results.reduce((memo, block) => {
    const text = getText(block.paragraph)

    if (block.type === 'paragraph' && text) {
      memo.push({
        id: block.id,
        parentId: notionPageId,
        name: text,
        items: [],
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

    return []
    // res.status(500).json({
    //   name: error.name,
    //   message: error.message,
    //   stack: error.stack,
    // })
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

    return []
    // res.status(500).json({
    //   name: error.name,
    //   message: error.message,
    //   stack: error.stack,
    // })
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
  sockets[socket.id] = socket

  const sendItems = (storeId, items, options = {}) => {
    const args = [`${storeId}:items`, JSON.stringify(items)]

    if (options.to) {
      broadcast(...args, {
        without: options.to === 'others' ? socket.id : undefined,
      })

      return
    }

    debug('emit %s: %o', args[0], { socketId: socket.id, items: args[1] })

    socket.emit(...args)
  }

  socket.on('disconnect', () => {
    delete sockets[socket.id]
  })

  socket.on('get:stores', async () => {
    debug('on get:stores: %o', { socketId: socket.id })

    const stores = await getStores()

    debug('emit stores: %o', stores)

    socket.emit('stores', JSON.stringify(stores))
  })

  socket.on('get:items', async (storeId) => {
    debug('on get:items: %o', { socketId: socket.id, storeId })

    const persistedData = await persistentData.get()

    sendItems(storeId, persistedData.stores[storeId] || [])
  })

  socket.on('sync:items', async ({ storeId, parentId }) => {
    debug('on sync:items: %o', { socketId: socket.id, storeId, parentId })

    const items = await getStoreItems({ storeId, parentId })
    const persistedData = await persistentData.get()

    persistedData.stores[storeId] = items

    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, items, { to: 'all' })
  })

  socket.on('update:item', async ({ storeId, item }) => {
    debug('on update:item: %o', { socketId: socket.id, storeId, item })

    const persistedData = await persistentData.get()
    const index = persistedData.stores[storeId].findIndex((i) => i.id === item.id)

    persistedData.stores[storeId][index] = item
    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, persistedData.stores[storeId], { to: 'others' })
  })
}

module.exports = {
  getStores,
  onSocket,
}
