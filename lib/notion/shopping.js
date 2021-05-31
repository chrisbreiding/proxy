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
        items: [
          {
            'id': 'cb0f0a6f-0b33-425a-81d5-098432549bb0',
            'name': 'Dried strawberries',
            'isChecked': true,
          },
          {
            'id': '4b231c3f-3cae-4d64-a891-bfaa4031a090',
            'name': 'Mango slices',
            'isChecked': false,
          },
          {
            'id': 'd9c4d20a-1e22-46fe-8c85-e4e2091647f2',
            'name': 'Veggie chips',
            'isChecked': false,
          },
        ],
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
    // eslint-disable-next-line no-console
    console.log('error getting stores:', error.stack)

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
    // eslint-disable-next-line no-console
    console.log('error getting items:', error.stack)

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

    socket.emit(...args)
  }

  socket.on('disconnect', () => {
    delete sockets[socket.id]
  })

  socket.on('get:stores', async () => {
    const stores = await getStores()

    socket.emit('stores', JSON.stringify(stores))
  })

  socket.on('get:items', async (storeId) => {
    const persistedData = await persistentData.get()

    sendItems(storeId, persistedData.stores[storeId] || [])
  })

  socket.on('sync:items', async ({ storeId, parentId }) => {
    const items = await getStoreItems({ storeId, parentId })
    const persistedData = await persistentData.get()

    persistedData.stores[storeId] = items

    persistentData.set(Object.assign(persistedData, { stores: persistedData.stores }))

    sendItems(storeId, items, { to: 'all' })
  })

  socket.on('update:item', async ({ storeId, item }) => {
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
